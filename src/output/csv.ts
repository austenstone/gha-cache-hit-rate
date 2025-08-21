import { createObjectCsvWriter } from 'csv-writer';
import { RepositoryCacheStats } from '../types/index.js';

export class CsvOutputFormatter {
  /**
   * Output cache statistics as CSV
   */
  async output(stats: RepositoryCacheStats, outputPath: string): Promise<void> {
    // Create CSV writer for workflow summary
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'repository', title: 'Repository' },
        { id: 'workflowName', title: 'Workflow Name' },
        { id: 'totalCacheOps', title: 'Total Cache Operations' },
        { id: 'cacheHits', title: 'Cache Hits' },
        { id: 'cacheMisses', title: 'Cache Misses' },
        { id: 'partialHits', title: 'Partial Hits' },
        { id: 'hitRate', title: 'Hit Rate (%)' },
        { id: 'partialHitRate', title: 'Partial Hit Rate (%)' },
        { id: 'effectiveHitRate', title: 'Effective Hit Rate (%)' },
        { id: 'avgCacheSize', title: 'Average Cache Size (bytes)' },
        { id: 'timeSavedMs', title: 'Time Saved (ms)' },
        { id: 'dateFrom', title: 'Analysis Date From' },
        { id: 'dateTo', title: 'Analysis Date To' },
      ]
    });

    // Prepare data
    const records = stats.workflowStats.map(workflow => ({
      repository: `${stats.owner}/${stats.repo}`,
      workflowName: workflow.workflowName,
      totalCacheOps: workflow.totalCacheOps,
      cacheHits: workflow.cacheHits,
      cacheMisses: workflow.cacheMisses,
      partialHits: workflow.partialHits,
      hitRate: parseFloat(workflow.hitRate.toFixed(2)),
      partialHitRate: parseFloat(workflow.partialHitRate.toFixed(2)),
      effectiveHitRate: parseFloat((workflow.hitRate + workflow.partialHitRate).toFixed(2)),
      avgCacheSize: workflow.avgCacheSize || null,
      timeSavedMs: workflow.timeSavedMs || null,
      dateFrom: stats.dateRange.from.toISOString().split('T')[0],
      dateTo: stats.dateRange.to.toISOString().split('T')[0],
    }));

    // Add overall summary row
    records.unshift({
      repository: `${stats.owner}/${stats.repo}`,
      workflowName: 'OVERALL SUMMARY',
      totalCacheOps: stats.totalCacheOps,
      cacheHits: stats.totalCacheHits,
      cacheMisses: stats.totalCacheMisses,
      partialHits: stats.totalPartialHits,
      hitRate: parseFloat(stats.overallHitRate.toFixed(2)),
      partialHitRate: parseFloat(stats.overallPartialHitRate.toFixed(2)),
      effectiveHitRate: parseFloat((stats.overallHitRate + stats.overallPartialHitRate).toFixed(2)),
      avgCacheSize: null,
      timeSavedMs: null,
      dateFrom: stats.dateRange.from.toISOString().split('T')[0],
      dateTo: stats.dateRange.to.toISOString().split('T')[0],
    });

    await csvWriter.writeRecords(records);
  }

  /**
   * Output detailed cache operations as CSV
   */
  async outputDetailed(stats: RepositoryCacheStats, outputPath: string): Promise<void> {
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'repository', title: 'Repository' },
        { id: 'workflowName', title: 'Workflow Name' },
        { id: 'runId', title: 'Run ID' },
        { id: 'runDate', title: 'Run Date' },
        { id: 'jobName', title: 'Job Name' },
        { id: 'stepName', title: 'Step Name' },
        { id: 'cacheKey', title: 'Cache Key' },
        { id: 'cacheResult', title: 'Cache Result' },
        { id: 'isHit', title: 'Is Hit' },
        { id: 'cacheSize', title: 'Cache Size (bytes)' },
        { id: 'timeMs', title: 'Time (ms)' },
        { id: 'runUrl', title: 'Run URL' },
      ]
    });

    // Collect all cache operations
    const allOperations = stats.workflowStats.flatMap(workflow =>
      workflow.recentOperations.map(op => ({
        repository: `${stats.owner}/${stats.repo}`,
        workflowName: workflow.workflowName,
        runId: op.runId,
        runDate: op.runDate.toISOString(),
        jobName: op.jobName,
        stepName: op.stepName,
        cacheKey: op.cacheKey,
        cacheResult: op.cacheResultType,
        isHit: op.isHit,
        cacheSize: op.cacheSize || null,
        timeMs: op.timeMs || null,
        runUrl: op.runUrl,
      }))
    );

    // Sort by date (newest first)
    allOperations.sort((a, b) => new Date(b.runDate).getTime() - new Date(a.runDate).getTime());

    await csvWriter.writeRecords(allOperations);
  }

  /**
   * Generate a summary statistics CSV file
   */
  async outputSummary(stats: RepositoryCacheStats, outputPath: string): Promise<void> {
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'metric', title: 'Metric' },
        { id: 'value', title: 'Value' },
        { id: 'percentage', title: 'Percentage' },
        { id: 'description', title: 'Description' },
      ]
    });

    const totalOps = stats.totalCacheOps;
    const records = [
      {
        metric: 'Repository',
        value: `${stats.owner}/${stats.repo}`,
        percentage: null,
        description: 'Analyzed repository'
      },
      {
        metric: 'Analysis Period',
        value: `${stats.dateRange.from.toISOString().split('T')[0]} to ${stats.dateRange.to.toISOString().split('T')[0]}`,
        percentage: null,
        description: 'Date range of analysis'
      },
      {
        metric: 'Total Workflows',
        value: stats.workflowStats.length,
        percentage: null,
        description: 'Number of workflows with cache operations'
      },
      {
        metric: 'Total Runs Analyzed',
        value: stats.totalRunsAnalyzed,
        percentage: null,
        description: 'Number of workflow runs processed'
      },
      {
        metric: 'Total Cache Operations',
        value: totalOps,
        percentage: 100.0,
        description: 'All cache operations found'
      },
      {
        metric: 'Cache Hits',
        value: stats.totalCacheHits,
        percentage: totalOps > 0 ? parseFloat(((stats.totalCacheHits / totalOps) * 100).toFixed(2)) : 0,
        description: 'Exact cache key matches'
      },
      {
        metric: 'Cache Misses',
        value: stats.totalCacheMisses,
        percentage: totalOps > 0 ? parseFloat(((stats.totalCacheMisses / totalOps) * 100).toFixed(2)) : 0,
        description: 'No cache found'
      },
      {
        metric: 'Partial Hits',
        value: stats.totalPartialHits,
        percentage: totalOps > 0 ? parseFloat(((stats.totalPartialHits / totalOps) * 100).toFixed(2)) : 0,
        description: 'Restore key matches'
      },
      {
        metric: 'Overall Hit Rate',
        value: `${stats.overallHitRate.toFixed(2)}%`,
        percentage: parseFloat(stats.overallHitRate.toFixed(2)),
        description: 'Percentage of exact hits'
      },
      {
        metric: 'Effective Hit Rate',
        value: `${(stats.overallHitRate + stats.overallPartialHitRate).toFixed(2)}%`,
        percentage: parseFloat((stats.overallHitRate + stats.overallPartialHitRate).toFixed(2)),
        description: 'Percentage of hits + partial hits'
      }
    ];

    await csvWriter.writeRecords(records);
  }
}
