import pLimit from 'p-limit';
import ora from 'ora';
import chalk from 'chalk';
import { isAfter, isBefore, parseISO } from 'date-fns';

import { GitHubApiClient } from './github-api.js';
import { CacheLogParser } from './cache-parser.js';
import { TableOutputFormatter } from '../output/table.js';
import { CsvOutputFormatter } from '../output/csv.js';
import { JsonOutputFormatter } from '../output/json.js';

import {
  CliOptions,
  RepositoryCacheStats,
  WorkflowCacheStats,
  CacheHitResult,
  ProcessingProgress,
  OrganizationCacheStats,
} from '../types/index.js';

/**
 * Analyze cache hit rates across all repositories in an organization
 */
export async function analyzeOrganization(options: CliOptions): Promise<void> {
  if (!options.owner) {
    throw new Error('Organization owner must be specified');
  }

  const spinner = ora('Initializing organization analysis...').start();
  
  try {
    // Initialize GitHub API client for the organization
    spinner.text = 'Connecting to GitHub API...';
    const orgApiClient = new GitHubApiClient(options.owner);
    
    // Check rate limit
    const rateLimit = await orgApiClient.getRateLimit();
    if (options.verbose) {
      spinner.info(`Rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
    }

    // Get all repositories in the organization
    spinner.text = 'Fetching organization repositories...';
    const repositories = await orgApiClient.getRepositories(options.maxRepos || 50);
    
    if (repositories.length === 0) {
      spinner.fail('No repositories found in organization');
      return;
    }

    spinner.succeed(`Found ${repositories.length} repository(ies) to analyze`);

    // Set up concurrent processing with rate limiting
    const limit = pLimit(Math.min(options.concurrency || 2, 2)); // Lower concurrency for org analysis
    const repositoryStats: RepositoryCacheStats[] = [];
    const failedRepos: string[] = [];

    // Progress tracking
    let processedRepos = 0;
    const progressSpinner = ora(`Processing repositories... (0/${repositories.length})`).start();

    // Process repositories concurrently
    const repoPromises = repositories.map(repo => 
      limit(async () => {
        try {
          const repoApiClient = orgApiClient.forRepository(repo.repo);
          
          // Check if repository has workflows
          const workflows = await repoApiClient.getWorkflows();
          if (workflows.length === 0) {
            processedRepos++;
            progressSpinner.text = `Processing repositories... (${processedRepos}/${repositories.length}) - Skipping ${repo.fullName} (no workflows)`;
            return;
          }

          // Process this repository's cache stats
          const repoOptions = { ...options, repo: repo.repo };
          const cacheParser = new CacheLogParser();
          const allResults: CacheHitResult[] = [];
          const workflowStats: WorkflowCacheStats[] = [];

          // Process workflows for this repo
          for (const workflow of workflows) {
            const runs = await repoApiClient.getWorkflowRuns(
              workflow.id,
              Math.min(options.maxRunsPerWorkflow || 50, 50), // Limit runs per workflow for org analysis
              options.successfulOnly || true
            );

            const workflowResults: CacheHitResult[] = [];

            for (const run of runs.slice(0, 20)) { // Limit to recent runs for performance
              try {
                const logData = await repoApiClient.downloadRunLogs(run.id);
                const cacheResults = await cacheParser.parseRunLogs(
                  logData,
                  run.id,
                  run.name || 'Unknown',
                  new Date(run.created_at),
                  run.html_url || ''
                );

                if (cacheResults.length >= (options.minCacheOps || 0)) {
                  workflowResults.push(...cacheResults);
                }
              } catch (error) {
                if (options.verbose) {
                  console.warn(`⚠️  Failed to process run ${run.id} in ${repo.fullName}: ${error}`);
                }
              }
            }

            if (workflowResults.length > 0) {
              allResults.push(...workflowResults);
              workflowStats.push(calculateWorkflowStats(workflow.name, workflowResults));
            }
          }

          // Only include repos with cache operations
          if (allResults.length > 0 && options.owner) {
            const repoStats = calculateRepositoryStats(
              options.owner,
              repo.repo,
              workflowStats,
              repoOptions
            );
            
            // Add repository metadata to stats
            const repoStatsWithInfo = {
              ...repoStats,
              repositoryInfo: repo
            };
            repositoryStats.push(repoStatsWithInfo);
          }

          processedRepos++;
          progressSpinner.text = `Processing repositories... (${processedRepos}/${repositories.length}) - Completed ${repo.fullName}`;

        } catch (error) {
          failedRepos.push(`${repo.fullName}: ${error}`);
          processedRepos++;
          progressSpinner.text = `Processing repositories... (${processedRepos}/${repositories.length}) - Failed ${repo.fullName}`;
        }
      })
    );

    await Promise.all(repoPromises);
    progressSpinner.succeed(`Processed ${processedRepos} repositories`);

    if (failedRepos.length > 0 && options.verbose) {
      console.log(chalk.yellow(`⚠️  Failed to process ${failedRepos.length} repositories:`));
      failedRepos.forEach(error => console.log(chalk.gray(`   ${error}`)));
    }

    // Generate organization-wide statistics
    const orgStats = calculateOrganizationStats(repositoryStats, options);

    // Output results
    await outputOrganizationResults(orgStats, repositoryStats, options);

  } catch (error) {
    spinner.fail(`Organization analysis failed: ${error}`);
    throw error;
  }
}

export async function analyzeRepository(options: CliOptions): Promise<void> {
  const spinner = ora('Initializing...').start();
  
  try {
    // Check if we should analyze the entire organization
    if (!options.repo) {
      return analyzeOrganization(options);
    }

    if (!options.owner || !options.repo) {
      throw new Error('Owner and repository must be specified for single repository analysis');
    }

    // Initialize GitHub API client for single repository
    spinner.text = 'Connecting to GitHub API...';
    const apiClient = new GitHubApiClient(options.owner, options.repo);
    
    // Validate repository access
    await apiClient.validateRepository();
    spinner.text = 'Repository validated ✓';

    // Check rate limit
    const rateLimit = await apiClient.getRateLimit();
    if (options.verbose) {
      spinner.info(`Rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
    }

    // Get workflows
    spinner.text = 'Fetching workflows...';
    const workflows = await apiClient.getWorkflows();
    
    if (workflows.length === 0) {
      spinner.fail('No workflows found in repository');
      return;
    }

    spinner.succeed(`Found ${workflows.length} workflow(s)`);

    // Set up concurrent processing
    const limit = pLimit(options.concurrency || 3);
    const cacheParser = new CacheLogParser();
    const allResults: CacheHitResult[] = [];
    const workflowStats: WorkflowCacheStats[] = [];
    
    const progress: ProcessingProgress = {
      workflowsProcessed: 0,
      totalWorkflows: workflows.length,
      runsProcessed: 0,
      totalRuns: 0,
      cacheOpsFound: 0,
    };

    // Progress spinner
    const progressSpinner = ora('Processing workflows...').start();

    // Process workflows concurrently
    const workflowPromises = workflows.map(workflow => 
      limit(async () => {
        progress.currentWorkflow = workflow.name;
        
        try {
          // Get workflow runs
          const runs = await apiClient.getWorkflowRuns(
            workflow.id,
            options.maxRunsPerWorkflow || 100,
            options.successfulOnly || true
          );

          progress.totalRuns += runs.length;
          
          const workflowResults: CacheHitResult[] = [];

          // Process runs for this workflow
          for (const run of runs) {
            // Filter by date if specified
            if (options.since || options.until) {
              const runDate = new Date(run.created_at);
              
              if (options.since && isBefore(runDate, parseISO(options.since))) {
                continue;
              }
              
              if (options.until && isAfter(runDate, parseISO(options.until))) {
                continue;
              }
            }

            try {
              // Download and parse logs
              const logData = await apiClient.downloadRunLogs(run.id);
              const cacheResults = await cacheParser.parseRunLogs(
                logData,
                run.id,
                workflow.name,
                new Date(run.created_at),
                run.html_url
              );

              workflowResults.push(...cacheResults);
              progress.cacheOpsFound += cacheResults.length;
              
            } catch (error) {
              if (options.verbose) {
                console.warn(`⚠️  Warning: Failed to process run ${run.id}: ${error}`);
              }
            }

            progress.runsProcessed++;
            
            // Update progress
            progressSpinner.text = `Processing ${progress.currentWorkflow} (${progress.runsProcessed}/${progress.totalRuns} runs, ${progress.cacheOpsFound} cache ops found)`;

            // Check rate limit periodically
            if (progress.runsProcessed % 50 === 0) {
              await apiClient.waitForRateLimit();
            }
          }

          // Calculate workflow statistics
          const workflowStat = calculateWorkflowStats(workflow.name, workflowResults);
          
          // Only include workflows with cache operations if minimum threshold is set
          if (!options.minCacheOps || workflowStat.totalCacheOps >= options.minCacheOps) {
            workflowStats.push(workflowStat);
            allResults.push(...workflowResults);
          }

          progress.workflowsProcessed++;
          progressSpinner.text = `Processed ${progress.workflowsProcessed}/${progress.totalWorkflows} workflows`;
          
        } catch (error) {
          if (options.verbose) {
            console.warn(`⚠️  Warning: Failed to process workflow ${workflow.name}: ${error}`);
          }
        }
      })
    );

    await Promise.all(workflowPromises);
    progressSpinner.succeed(`Processed ${progress.workflowsProcessed} workflows with ${progress.cacheOpsFound} cache operations`);

    // Generate repository statistics
    const repoStats = calculateRepositoryStats(
      options.owner,
      options.repo,
      workflowStats,
      options
    );

    // Output results
    await outputResults(repoStats, options);

  } catch (error) {
    spinner.fail(`Analysis failed: ${error}`);
    throw error;
  }
}

/**
 * Calculate statistics for a single workflow
 */
function calculateWorkflowStats(
  workflowName: string,
  results: CacheHitResult[]
): WorkflowCacheStats {
  const totalCacheOps = results.length;
  const cacheHits = results.filter(r => r.cacheResultType === 'hit').length;
  const cacheMisses = results.filter(r => r.cacheResultType === 'miss').length;
  const partialHits = results.filter(r => r.cacheResultType === 'partial').length;
  
  const hitRate = totalCacheOps > 0 ? (cacheHits / totalCacheOps) * 100 : 0;
  const partialHitRate = totalCacheOps > 0 ? (partialHits / totalCacheOps) * 100 : 0;

  // Calculate average cache size
  const sizingResults = results.filter(r => r.cacheSize);
  const avgCacheSize = sizingResults.length > 0 
    ? sizingResults.reduce((sum, r) => sum + (r.cacheSize || 0), 0) / sizingResults.length
    : undefined;

  // Calculate time saved
  const timingResults = results.filter(r => r.timeMs && r.isHit);
  const timeSavedMs = timingResults.length > 0
    ? timingResults.reduce((sum, r) => sum + (r.timeMs || 0), 0)
    : undefined;

  // Get recent operations (last 10)
  const recentOperations = results
    .sort((a, b) => b.runDate.getTime() - a.runDate.getTime())
    .slice(0, 10);

  return {
    workflowName,
    totalCacheOps,
    cacheHits,
    cacheMisses,
    partialHits,
    hitRate,
    partialHitRate,
    avgCacheSize,
    timeSavedMs,
    recentOperations,
  };
}

/**
 * Calculate overall repository statistics
 */
function calculateRepositoryStats(
  owner: string,
  repo: string,
  workflowStats: WorkflowCacheStats[],
  options: CliOptions
): RepositoryCacheStats {
  const totalCacheOps = workflowStats.reduce((sum, w) => sum + w.totalCacheOps, 0);
  const totalCacheHits = workflowStats.reduce((sum, w) => sum + w.cacheHits, 0);
  const totalCacheMisses = workflowStats.reduce((sum, w) => sum + w.cacheMisses, 0);
  const totalPartialHits = workflowStats.reduce((sum, w) => sum + w.partialHits, 0);

  const overallHitRate = totalCacheOps > 0 ? (totalCacheHits / totalCacheOps) * 100 : 0;
  const overallPartialHitRate = totalCacheOps > 0 ? (totalPartialHits / totalCacheOps) * 100 : 0;

  // Calculate date range
  const now = new Date();
  const since = options.since ? parseISO(options.since) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const until = options.until ? parseISO(options.until) : now;

  // Total runs analyzed
  const totalRunsAnalyzed = workflowStats.reduce(
    (sum, w) => sum + w.recentOperations.length, 
    0
  );

  return {
    owner,
    repo,
    overallHitRate,
    overallPartialHitRate,
    totalCacheOps,
    totalCacheHits,
    totalCacheMisses,
    totalPartialHits,
    workflowStats,
    dateRange: {
      from: since,
      to: until,
    },
    totalRunsAnalyzed,
  };
}

/**
 * Output results in the specified format
 */
async function outputResults(
  stats: RepositoryCacheStats,
  options: CliOptions
): Promise<void> {
  if (stats.totalCacheOps === 0) {
    console.log(chalk.yellow('📊 No cache operations found in the analyzed workflows.'));
    console.log(chalk.gray('💡 This could mean:'));
    console.log(chalk.gray('   • Workflows don\'t use actions/cache'));
    console.log(chalk.gray('   • No recent workflow runs in the specified date range'));
    console.log(chalk.gray('   • Cache operations are not being logged properly'));
    return;
  }

  switch (options.format) {
    case 'table': {
      const tableFormatter = new TableOutputFormatter();
      tableFormatter.output(stats, options.verbose || false);
      break;
    }

    case 'csv': {
      const csvFormatter = new CsvOutputFormatter();
      if (!options.output) {
        throw new Error('Output file path required for CSV format');
      }
      await csvFormatter.output(stats, options.output);
      console.log(chalk.green(`✅ CSV report saved to ${options.output}`));
      break;
    }

    case 'json': {
      const jsonFormatter = new JsonOutputFormatter();
      if (!options.output) {
        throw new Error('Output file path required for JSON format');
      }
      await jsonFormatter.output(stats, options.output);
      console.log(chalk.green(`✅ JSON report saved to ${options.output}`));
      break;
    }

    default:
      throw new Error(`Unsupported output format: ${options.format}`);
  }
}

/**
 * Calculate organization-wide statistics from repository stats
 */
function calculateOrganizationStats(
  repositoryStats: RepositoryCacheStats[],
  options: CliOptions
): OrganizationCacheStats {
  const totalRepos = repositoryStats.length;
  const totalCacheOps = repositoryStats.reduce((sum, repo) => sum + repo.totalCacheOps, 0);
  const totalCacheHits = repositoryStats.reduce((sum, repo) => sum + repo.totalCacheHits, 0);
  const totalCacheMisses = repositoryStats.reduce((sum, repo) => sum + repo.totalCacheMisses, 0);
  const totalPartialHits = repositoryStats.reduce((sum, repo) => sum + repo.totalPartialHits, 0);
  
  const overallHitRate = totalCacheOps > 0 ? (totalCacheHits / totalCacheOps) * 100 : 0;
  const overallPartialHitRate = totalCacheOps > 0 ? (totalPartialHits / totalCacheOps) * 100 : 0;

  // Create overall stats as a single repository
  const overallStats: RepositoryCacheStats = {
    owner: options.owner || 'Organization',
    repo: 'All Repositories',
    overallHitRate,
    overallPartialHitRate,
    totalCacheOps,
    totalCacheHits,
    totalCacheMisses,
    totalPartialHits,
    workflowStats: [],
    dateRange: {
      from: new Date(0), // Use epoch as placeholder
      to: new Date(),     // Use current date
    },
    totalRunsAnalyzed: repositoryStats.reduce((sum, repo) => sum + repo.totalRunsAnalyzed, 0),
  };

  const totalWorkflows = repositoryStats.reduce((sum, repo) => sum + repo.workflowStats.length, 0);
  const totalRuns = repositoryStats.reduce((sum, repo) => sum + repo.totalRunsAnalyzed, 0);

  return {
    organization: options.owner || 'Unknown',
    totalRepositories: totalRepos,
    repositoriesWithCache: repositoryStats.filter(repo => repo.totalCacheOps > 0).length,
    overallStats,
    repositories: repositoryStats,
    metadata: {
      analyzedAt: new Date(),
      totalWorkflows,
      totalRuns,
    },
  };
}

/**
 * Output organization results in the specified format
 */
async function outputOrganizationResults(
  orgStats: OrganizationCacheStats,
  repositoryStats: RepositoryCacheStats[],
  options: CliOptions
): Promise<void> {
  if (orgStats.overallStats.totalCacheOps === 0) {
    console.log(chalk.yellow(`📊 No cache operations found across ${orgStats.totalRepositories} repositories.`));
    console.log(chalk.gray('💡 This could mean:'));
    console.log(chalk.gray('   • Repositories don\'t use actions/cache'));
    console.log(chalk.gray('   • No recent workflow runs in the specified date range'));
    console.log(chalk.gray('   • Cache operations are not being logged properly'));
    return;
  }

  // Get top performing repositories by hit rate
  const topRepos = repositoryStats
    .filter(repo => repo.totalCacheOps >= (options.minCacheOps || 1))
    .sort((a, b) => b.overallHitRate - a.overallHitRate)
    .slice(0, 10);

  // Get repos with most cache operations
  const mostActiveRepos = repositoryStats
    .sort((a, b) => b.totalCacheOps - a.totalCacheOps)
    .slice(0, 10);

  // Display organization summary
  console.log(chalk.bold.blue(`\n🏢 Organization: ${orgStats.organization}`));
  console.log(chalk.blue(`📈 Overall Cache Hit Rate: ${orgStats.overallStats.overallHitRate.toFixed(1)}%`));
  console.log(chalk.gray(`📊 ${orgStats.overallStats.totalCacheOps} total cache operations across ${orgStats.repositoriesWithCache} repositories`));
  
  if (topRepos.length > 0) {
    console.log(chalk.bold('\n🏆 Top Performing Repositories:'));
    topRepos.forEach((repo, index) => {
      console.log(
        chalk.green(`  ${index + 1}. ${repo.repo} - ${repo.overallHitRate.toFixed(1)}% (${repo.totalCacheOps} ops)`)
      );
    });
  }

  if (mostActiveRepos.length > 0) {
    console.log(chalk.bold('\n🔥 Most Active Repositories:'));
    mostActiveRepos.forEach((repo, index) => {
      console.log(
        chalk.blue(`  ${index + 1}. ${repo.repo} - ${repo.totalCacheOps} operations (${repo.overallHitRate.toFixed(1)}% hit rate)`)
      );
    });
  }

  // Output detailed results based on format
  switch (options.format) {
    case 'table': {
      // Show summary table for organization
      console.log(chalk.bold('\n📋 Repository Summary:'));
      repositoryStats
        .filter(repo => repo.totalCacheOps > 0)
        .sort((a, b) => b.overallHitRate - a.overallHitRate)
        .forEach(repo => {
          console.log(
            `${chalk.bold(repo.repo.padEnd(30))} ${chalk.green(repo.overallHitRate.toFixed(1).padStart(6))}% ` +
            `${chalk.gray(`(${repo.totalCacheOps} ops, ${repo.workflowStats.length} workflows)`)}`
          );
        });
      break;
    }

    case 'csv': {
      if (!options.output) {
        throw new Error('Output file path required for CSV format');
      }
      
      // Create organization CSV with repository summaries
      const orgCsvData = repositoryStats.map(repo => ({
        repository: repo.repo,
        hitRate: repo.overallHitRate,
        totalOperations: repo.totalCacheOps,
        hits: repo.totalCacheHits,
        misses: repo.totalCacheMisses,
        partialHits: repo.totalPartialHits,
        workflows: repo.workflowStats.length,
      }));

      const csvContent = [
        'repository,hitRate,totalOperations,hits,misses,partialHits,workflows',
        ...orgCsvData.map(row => 
          `${row.repository},${row.hitRate.toFixed(2)},${row.totalOperations},${row.hits},${row.misses},${row.partialHits},${row.workflows}`
        )
      ].join('\n');

      await import('fs/promises').then(fs => fs.writeFile(options.output as string, csvContent));
      console.log(chalk.green(`✅ Organization CSV report saved to ${options.output}`));
      break;
    }

    case 'json': {
      if (!options.output) {
        throw new Error('Output file path required for JSON format');
      }
      
      const jsonData = {
        organizationStats: orgStats,
        repositoryStats: repositoryStats.filter(repo => repo.totalCacheOps > 0),
        metadata: {
          analyzedAt: new Date().toISOString(),
          totalRepositoriesAnalyzed: orgStats.totalRepositories,
          repositoriesWithCacheOperations: orgStats.repositoriesWithCache,
        }
      };

      await import('fs/promises').then(fs => 
        fs.writeFile(options.output as string, JSON.stringify(jsonData, null, 2))
      );
      console.log(chalk.green(`✅ Organization JSON report saved to ${options.output}`));
      break;
    }

    default:
      throw new Error(`Unsupported output format: ${options.format}`);
  }
}
