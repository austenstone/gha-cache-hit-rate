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
} from '../types/index.js';

export async function analyzeRepository(options: CliOptions): Promise<void> {
  const spinner = ora('Initializing...').start();
  
  try {
    // Initialize GitHub API client
    spinner.text = 'Connecting to GitHub API...';
    const apiClient = new GitHubApiClient(options.owner!, options.repo!);
    
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
          const runs = await apiClient.getWorkflowRuns(workflow.id, {
            status: options.successfulOnly ? 'success' : undefined,
            maxRuns: options.maxRunsPerWorkflow || 100,
          });

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
      options.owner!,
      options.repo!,
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
      await csvFormatter.output(stats, options.output!);
      console.log(chalk.green(`✅ CSV report saved to ${options.output}`));
      break;
    }

    case 'json': {
      const jsonFormatter = new JsonOutputFormatter();
      await jsonFormatter.output(stats, options.output!);
      console.log(chalk.green(`✅ JSON report saved to ${options.output}`));
      break;
    }

    default:
      throw new Error(`Unsupported output format: ${options.format}`);
  }
}
