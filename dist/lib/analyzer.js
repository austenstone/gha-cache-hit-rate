import pLimit from 'p-limit';
import ora from 'ora';
import chalk from 'chalk';
import { isAfter, isBefore, parseISO } from 'date-fns';
import { GitHubApiClient } from './github-api.js';
import { CacheLogParser } from './cache-parser.js';
import { TableOutputFormatter } from '../output/table.js';
import { CsvOutputFormatter } from '../output/csv.js';
import { JsonOutputFormatter } from '../output/json.js';
export async function analyzeOrganization(options) {
    if (!options.owner) {
        throw new Error('Organization owner must be specified');
    }
    const spinner = ora('Initializing organization analysis...').start();
    try {
        spinner.text = 'Connecting to GitHub API...';
        const orgApiClient = new GitHubApiClient(options.owner);
        const rateLimit = await orgApiClient.getRateLimit();
        if (options.verbose) {
            spinner.info(`Rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
        }
        spinner.text = 'Fetching organization repositories...';
        const repositories = await orgApiClient.getRepositories(options.maxRepos || 50);
        if (repositories.length === 0) {
            spinner.fail('No repositories found in organization');
            return;
        }
        spinner.succeed(`Found ${repositories.length} repository(ies) to analyze`);
        const limit = pLimit(Math.min(options.concurrency || 2, 2));
        const repositoryStats = [];
        const failedRepos = [];
        let processedRepos = 0;
        const progressSpinner = ora(`Processing repositories... (0/${repositories.length})`).start();
        const repoPromises = repositories.map(repo => limit(async () => {
            try {
                const repoApiClient = orgApiClient.forRepository(repo.repo);
                const workflows = await repoApiClient.getWorkflows();
                if (workflows.length === 0) {
                    processedRepos++;
                    progressSpinner.text = `Processing repositories... (${processedRepos}/${repositories.length}) - Skipping ${repo.fullName} (no workflows)`;
                    return;
                }
                const repoOptions = { ...options, repo: repo.repo };
                const cacheParser = new CacheLogParser();
                const allResults = [];
                const workflowStats = [];
                for (const workflow of workflows) {
                    const runs = await repoApiClient.getWorkflowRuns(workflow.id, Math.min(options.maxRunsPerWorkflow || 50, 50), options.successfulOnly || true);
                    const workflowResults = [];
                    for (const run of runs.slice(0, 20)) {
                        try {
                            const logData = await repoApiClient.downloadRunLogs(run.id);
                            const cacheResults = await cacheParser.parseRunLogs(logData, run.id, run.name || 'Unknown', new Date(run.created_at), run.html_url || '');
                            if (cacheResults.length >= (options.minCacheOps || 0)) {
                                workflowResults.push(...cacheResults);
                            }
                        }
                        catch (error) {
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
                if (allResults.length > 0 && options.owner) {
                    const repoStats = calculateRepositoryStats(options.owner, repo.repo, workflowStats, repoOptions);
                    const repoStatsWithInfo = {
                        ...repoStats,
                        repositoryInfo: repo
                    };
                    repositoryStats.push(repoStatsWithInfo);
                }
                processedRepos++;
                progressSpinner.text = `Processing repositories... (${processedRepos}/${repositories.length}) - Completed ${repo.fullName}`;
            }
            catch (error) {
                failedRepos.push(`${repo.fullName}: ${error}`);
                processedRepos++;
                progressSpinner.text = `Processing repositories... (${processedRepos}/${repositories.length}) - Failed ${repo.fullName}`;
            }
        }));
        await Promise.all(repoPromises);
        progressSpinner.succeed(`Processed ${processedRepos} repositories`);
        if (failedRepos.length > 0 && options.verbose) {
            console.log(chalk.yellow(`⚠️  Failed to process ${failedRepos.length} repositories:`));
            failedRepos.forEach(error => console.log(chalk.gray(`   ${error}`)));
        }
        const orgStats = calculateOrganizationStats(repositoryStats, options);
        await outputOrganizationResults(orgStats, repositoryStats, options);
    }
    catch (error) {
        spinner.fail(`Organization analysis failed: ${error}`);
        throw error;
    }
}
export async function analyzeRepository(options) {
    const spinner = ora('Initializing...').start();
    try {
        if (!options.repo) {
            return analyzeOrganization(options);
        }
        if (!options.owner || !options.repo) {
            throw new Error('Owner and repository must be specified for single repository analysis');
        }
        spinner.text = 'Connecting to GitHub API...';
        const apiClient = new GitHubApiClient(options.owner, options.repo);
        await apiClient.validateRepository();
        spinner.text = 'Repository validated ✓';
        const rateLimit = await apiClient.getRateLimit();
        if (options.verbose) {
            spinner.info(`Rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
        }
        spinner.text = 'Fetching workflows...';
        const workflows = await apiClient.getWorkflows();
        if (workflows.length === 0) {
            spinner.fail('No workflows found in repository');
            return;
        }
        spinner.succeed(`Found ${workflows.length} workflow(s)`);
        const limit = pLimit(options.concurrency || 3);
        const cacheParser = new CacheLogParser();
        const allResults = [];
        const workflowStats = [];
        const progress = {
            workflowsProcessed: 0,
            totalWorkflows: workflows.length,
            runsProcessed: 0,
            totalRuns: 0,
            cacheOpsFound: 0,
        };
        const progressSpinner = ora('Processing workflows...').start();
        const workflowPromises = workflows.map(workflow => limit(async () => {
            progress.currentWorkflow = workflow.name;
            try {
                const runs = await apiClient.getWorkflowRuns(workflow.id, options.maxRunsPerWorkflow || 100, options.successfulOnly || true);
                progress.totalRuns += runs.length;
                const workflowResults = [];
                for (const run of runs) {
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
                        const logData = await apiClient.downloadRunLogs(run.id);
                        const cacheResults = await cacheParser.parseRunLogs(logData, run.id, workflow.name, new Date(run.created_at), run.html_url);
                        workflowResults.push(...cacheResults);
                        progress.cacheOpsFound += cacheResults.length;
                    }
                    catch (error) {
                        if (options.verbose) {
                            console.warn(`⚠️  Warning: Failed to process run ${run.id}: ${error}`);
                        }
                    }
                    progress.runsProcessed++;
                    progressSpinner.text = `Processing ${progress.currentWorkflow} (${progress.runsProcessed}/${progress.totalRuns} runs, ${progress.cacheOpsFound} cache ops found)`;
                    if (progress.runsProcessed % 50 === 0) {
                        await apiClient.waitForRateLimit();
                    }
                }
                const workflowStat = calculateWorkflowStats(workflow.name, workflowResults);
                if (!options.minCacheOps || workflowStat.totalCacheOps >= options.minCacheOps) {
                    workflowStats.push(workflowStat);
                    allResults.push(...workflowResults);
                }
                progress.workflowsProcessed++;
                progressSpinner.text = `Processed ${progress.workflowsProcessed}/${progress.totalWorkflows} workflows`;
            }
            catch (error) {
                if (options.verbose) {
                    console.warn(`⚠️  Warning: Failed to process workflow ${workflow.name}: ${error}`);
                }
            }
        }));
        await Promise.all(workflowPromises);
        progressSpinner.succeed(`Processed ${progress.workflowsProcessed} workflows with ${progress.cacheOpsFound} cache operations`);
        const repoStats = calculateRepositoryStats(options.owner, options.repo, workflowStats, options);
        await outputResults(repoStats, options);
    }
    catch (error) {
        spinner.fail(`Analysis failed: ${error}`);
        throw error;
    }
}
function calculateWorkflowStats(workflowName, results) {
    const totalCacheOps = results.length;
    const cacheHits = results.filter(r => r.cacheResultType === 'hit').length;
    const cacheMisses = results.filter(r => r.cacheResultType === 'miss').length;
    const partialHits = results.filter(r => r.cacheResultType === 'partial').length;
    const hitRate = totalCacheOps > 0 ? (cacheHits / totalCacheOps) * 100 : 0;
    const partialHitRate = totalCacheOps > 0 ? (partialHits / totalCacheOps) * 100 : 0;
    const sizingResults = results.filter(r => r.cacheSize);
    const avgCacheSize = sizingResults.length > 0
        ? sizingResults.reduce((sum, r) => sum + (r.cacheSize || 0), 0) / sizingResults.length
        : undefined;
    const timingResults = results.filter(r => r.timeMs && r.isHit);
    const timeSavedMs = timingResults.length > 0
        ? timingResults.reduce((sum, r) => sum + (r.timeMs || 0), 0)
        : undefined;
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
function calculateRepositoryStats(owner, repo, workflowStats, options) {
    const totalCacheOps = workflowStats.reduce((sum, w) => sum + w.totalCacheOps, 0);
    const totalCacheHits = workflowStats.reduce((sum, w) => sum + w.cacheHits, 0);
    const totalCacheMisses = workflowStats.reduce((sum, w) => sum + w.cacheMisses, 0);
    const totalPartialHits = workflowStats.reduce((sum, w) => sum + w.partialHits, 0);
    const overallHitRate = totalCacheOps > 0 ? (totalCacheHits / totalCacheOps) * 100 : 0;
    const overallPartialHitRate = totalCacheOps > 0 ? (totalPartialHits / totalCacheOps) * 100 : 0;
    const now = new Date();
    const since = options.since ? parseISO(options.since) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const until = options.until ? parseISO(options.until) : now;
    const totalRunsAnalyzed = workflowStats.reduce((sum, w) => sum + w.recentOperations.length, 0);
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
async function outputResults(stats, options) {
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
function calculateOrganizationStats(repositoryStats, options) {
    const totalRepos = repositoryStats.length;
    const totalCacheOps = repositoryStats.reduce((sum, repo) => sum + repo.totalCacheOps, 0);
    const totalCacheHits = repositoryStats.reduce((sum, repo) => sum + repo.totalCacheHits, 0);
    const totalCacheMisses = repositoryStats.reduce((sum, repo) => sum + repo.totalCacheMisses, 0);
    const totalPartialHits = repositoryStats.reduce((sum, repo) => sum + repo.totalPartialHits, 0);
    const overallHitRate = totalCacheOps > 0 ? (totalCacheHits / totalCacheOps) * 100 : 0;
    const overallPartialHitRate = totalCacheOps > 0 ? (totalPartialHits / totalCacheOps) * 100 : 0;
    const overallStats = {
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
            from: new Date(0),
            to: new Date(),
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
async function outputOrganizationResults(orgStats, repositoryStats, options) {
    if (orgStats.overallStats.totalCacheOps === 0) {
        console.log(chalk.yellow(`📊 No cache operations found across ${orgStats.totalRepositories} repositories.`));
        console.log(chalk.gray('💡 This could mean:'));
        console.log(chalk.gray('   • Repositories don\'t use actions/cache'));
        console.log(chalk.gray('   • No recent workflow runs in the specified date range'));
        console.log(chalk.gray('   • Cache operations are not being logged properly'));
        return;
    }
    const topRepos = repositoryStats
        .filter(repo => repo.totalCacheOps >= (options.minCacheOps || 1))
        .sort((a, b) => b.overallHitRate - a.overallHitRate)
        .slice(0, 10);
    const mostActiveRepos = repositoryStats
        .sort((a, b) => b.totalCacheOps - a.totalCacheOps)
        .slice(0, 10);
    console.log(chalk.bold.blue(`\n🏢 Organization: ${orgStats.organization}`));
    console.log(chalk.blue(`📈 Overall Cache Hit Rate: ${orgStats.overallStats.overallHitRate.toFixed(1)}%`));
    console.log(chalk.gray(`📊 ${orgStats.overallStats.totalCacheOps} total cache operations across ${orgStats.repositoriesWithCache} repositories`));
    if (topRepos.length > 0) {
        console.log(chalk.bold('\n🏆 Top Performing Repositories:'));
        topRepos.forEach((repo, index) => {
            console.log(chalk.green(`  ${index + 1}. ${repo.repo} - ${repo.overallHitRate.toFixed(1)}% (${repo.totalCacheOps} ops)`));
        });
    }
    if (mostActiveRepos.length > 0) {
        console.log(chalk.bold('\n🔥 Most Active Repositories:'));
        mostActiveRepos.forEach((repo, index) => {
            console.log(chalk.blue(`  ${index + 1}. ${repo.repo} - ${repo.totalCacheOps} operations (${repo.overallHitRate.toFixed(1)}% hit rate)`));
        });
    }
    switch (options.format) {
        case 'table': {
            console.log(chalk.bold('\n📋 Repository Summary:'));
            repositoryStats
                .filter(repo => repo.totalCacheOps > 0)
                .sort((a, b) => b.overallHitRate - a.overallHitRate)
                .forEach(repo => {
                console.log(`${chalk.bold(repo.repo.padEnd(30))} ${chalk.green(repo.overallHitRate.toFixed(1).padStart(6))}% ` +
                    `${chalk.gray(`(${repo.totalCacheOps} ops, ${repo.workflowStats.length} workflows)`)}`);
            });
            break;
        }
        case 'csv': {
            if (!options.output) {
                throw new Error('Output file path required for CSV format');
            }
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
                ...orgCsvData.map(row => `${row.repository},${row.hitRate.toFixed(2)},${row.totalOperations},${row.hits},${row.misses},${row.partialHits},${row.workflows}`)
            ].join('\n');
            await import('fs/promises').then(fs => fs.writeFile(options.output, csvContent));
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
            await import('fs/promises').then(fs => fs.writeFile(options.output, JSON.stringify(jsonData, null, 2)));
            console.log(chalk.green(`✅ Organization JSON report saved to ${options.output}`));
            break;
        }
        default:
            throw new Error(`Unsupported output format: ${options.format}`);
    }
}
