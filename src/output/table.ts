import Table from 'cli-table3';
import chalk from 'chalk';
import { RepositoryCacheStats, WorkflowCacheStats } from '../types/index.js';

export class TableOutputFormatter {
  /**
   * Output cache statistics as a formatted table
   */
  output(stats: RepositoryCacheStats, verbose: boolean = false): void {
    this.printHeader(stats);
    this.printOverallStats(stats);
    this.printWorkflowTable(stats.workflowStats, verbose);
    
    if (verbose) {
      this.printDetailedAnalysis(stats);
    }
    
    this.printRecommendations(stats);
  }

  /**
   * Print header with repository information
   */
  private printHeader(stats: RepositoryCacheStats): void {
    console.log();
    console.log(chalk.bold.blue('🔍 GitHub Actions Cache Hit Rate Analysis'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.bold(`📁 Repository: ${stats.owner}/${stats.repo}`));
    console.log(chalk.gray(`📅 Analysis Period: ${stats.dateRange.from.toISOString().split('T')[0]} → ${stats.dateRange.to.toISOString().split('T')[0]}`));
    console.log(chalk.gray(`🏃 Total Runs Analyzed: ${stats.totalRunsAnalyzed}`));
    console.log();
  }

  /**
   * Print overall repository statistics
   */
  private printOverallStats(stats: RepositoryCacheStats): void {
    console.log(chalk.bold.cyan('📊 Overall Statistics'));
    console.log(chalk.gray('─'.repeat(30)));
    
    const table = new Table({
      head: ['Metric', 'Value'],
      colWidths: [25, 15],
      style: {
        head: ['cyan', 'bold'],
        border: ['gray']
      }
    });

    table.push(
      ['Total Cache Operations', stats.totalCacheOps.toLocaleString()],
      ['Cache Hits', `${stats.totalCacheHits.toLocaleString()} (${stats.overallHitRate.toFixed(1)}%)`],
      ['Cache Misses', `${stats.totalCacheMisses.toLocaleString()} (${(100 - stats.overallHitRate - stats.overallPartialHitRate).toFixed(1)}%)`],
      ['Partial Hits', `${stats.totalPartialHits.toLocaleString()} (${stats.overallPartialHitRate.toFixed(1)}%)`],
      ['Hit Rate', this.formatHitRate(stats.overallHitRate)],
      ['Effective Hit Rate', this.formatHitRate(stats.overallHitRate + stats.overallPartialHitRate)]
    );

    console.log(table.toString());
    console.log();
  }

  /**
   * Print workflow statistics table
   */
  private printWorkflowTable(workflowStats: WorkflowCacheStats[], verbose: boolean): void {
    if (workflowStats.length === 0) {
      console.log(chalk.yellow('📝 No workflows with cache operations found.'));
      return;
    }

    console.log(chalk.bold.cyan('🔧 Workflow Breakdown'));
    console.log(chalk.gray('─'.repeat(50)));

    const table = new Table({
      head: [
        'Workflow',
        'Operations',
        'Hit Rate',
        'Partial Rate',
        'Avg Size',
        'Time Saved'
      ],
      colWidths: [25, 12, 12, 12, 12, 12],
      style: {
        head: ['cyan', 'bold'],
        border: ['gray']
      }
    });

    // Sort workflows by hit rate (ascending) to highlight problematic ones
    const sortedWorkflows = [...workflowStats].sort((a, b) => a.hitRate - b.hitRate);

    for (const workflow of sortedWorkflows) {
      table.push([
        this.truncateText(workflow.workflowName, 23),
        workflow.totalCacheOps.toLocaleString(),
        this.formatHitRate(workflow.hitRate),
        this.formatHitRate(workflow.partialHitRate),
        this.formatSize(workflow.avgCacheSize),
        this.formatTime(workflow.timeSavedMs)
      ]);
    }

    console.log(table.toString());
    console.log();

    if (verbose) {
      this.printDetailedWorkflowStats(sortedWorkflows);
    }
  }

  /**
   * Print detailed workflow statistics
   */
  private printDetailedWorkflowStats(workflowStats: WorkflowCacheStats[]): void {
    console.log(chalk.bold.cyan('📋 Detailed Workflow Analysis'));
    console.log(chalk.gray('─'.repeat(50)));

    for (const workflow of workflowStats) {
      console.log(chalk.bold(`\n🔧 ${workflow.workflowName}`));
      
      const detailTable = new Table({
        colWidths: [20, 15, 15, 15],
        style: {
          head: ['cyan'],
          border: ['gray']
        }
      });

      detailTable.push(
        ['', 'Count', 'Percentage', 'Details'],
        ['Cache Hits', workflow.cacheHits.toString(), `${workflow.hitRate.toFixed(1)}%`, '✅ Perfect matches'],
        ['Cache Misses', workflow.cacheMisses.toString(), `${((workflow.cacheMisses / workflow.totalCacheOps) * 100).toFixed(1)}%`, '❌ No cache found'],
        ['Partial Hits', workflow.partialHits.toString(), `${workflow.partialHitRate.toFixed(1)}%`, '🔄 Restore key match']
      );

      console.log(detailTable.toString());

      // Show recent operations sample
      if (workflow.recentOperations.length > 0) {
        console.log(chalk.gray(`Recent cache operations (last ${Math.min(5, workflow.recentOperations.length)}):`));
        
        const recentTable = new Table({
          head: ['Date', 'Result', 'Cache Key'],
          colWidths: [12, 10, 50],
          style: {
            head: ['gray'],
            border: ['gray']
          }
        });

        workflow.recentOperations.slice(0, 5).forEach(op => {
          recentTable.push([
            op.runDate.toISOString().split('T')[0],
            this.formatCacheResult(op.cacheResultType),
            this.truncateText(op.cacheKey, 47)
          ]);
        });

        console.log(recentTable.toString());
      }
    }
  }

  /**
   * Print detailed analysis insights
   */
  private printDetailedAnalysis(stats: RepositoryCacheStats): void {
    console.log(chalk.bold.cyan('🔍 Analysis Insights'));
    console.log(chalk.gray('─'.repeat(30)));

    // Performance insights
    const highPerformers = stats.workflowStats.filter(w => w.hitRate >= 80);
    const lowPerformers = stats.workflowStats.filter(w => w.hitRate < 50);

    if (highPerformers.length > 0) {
      console.log(chalk.green(`✅ High Performers (≥80% hit rate): ${highPerformers.length} workflows`));
      highPerformers.slice(0, 3).forEach(w => {
        console.log(chalk.gray(`   • ${w.workflowName}: ${w.hitRate.toFixed(1)}%`));
      });
    }

    if (lowPerformers.length > 0) {
      console.log(chalk.red(`❌ Low Performers (<50% hit rate): ${lowPerformers.length} workflows`));
      lowPerformers.slice(0, 3).forEach(w => {
        console.log(chalk.gray(`   • ${w.workflowName}: ${w.hitRate.toFixed(1)}%`));
      });
    }

    // Cache efficiency
    const totalTimeSaved = stats.workflowStats
      .filter(w => w.timeSavedMs)
      .reduce((sum, w) => sum + (w.timeSavedMs || 0), 0);

    if (totalTimeSaved > 0) {
      console.log(chalk.blue(`⏱️  Total Time Saved: ${this.formatTime(totalTimeSaved)}`));
    }

    console.log();
  }

  /**
   * Print actionable recommendations
   */
  private printRecommendations(stats: RepositoryCacheStats): void {
    console.log(chalk.bold.cyan('💡 Recommendations'));
    console.log(chalk.gray('─'.repeat(30)));

    const recommendations: string[] = [];

    // Overall hit rate recommendations
    if (stats.overallHitRate < 50) {
      recommendations.push('🔧 Overall hit rate is low (<50%). Consider reviewing cache key strategies.');
    } else if (stats.overallHitRate >= 80) {
      recommendations.push('✅ Excellent overall hit rate! Your caching strategy is working well.');
    }

    // Workflow-specific recommendations
    const lowPerformers = stats.workflowStats.filter(w => w.hitRate < 40);
    if (lowPerformers.length > 0) {
      recommendations.push(`🎯 ${lowPerformers.length} workflow(s) have very low hit rates. Consider:`);
      recommendations.push('   • Reviewing cache key generation logic');
      recommendations.push('   • Using more stable cache keys (e.g., based on file hashes)');
      recommendations.push('   • Implementing fallback restore-keys');
    }

    // Partial hits analysis
    if (stats.overallPartialHitRate > 20) {
      recommendations.push('🔄 High partial hit rate suggests cache keys change frequently.');
      recommendations.push('   • Consider using more stable primary keys');
      recommendations.push('   • Review what triggers cache key changes');
    }

    // Custom Docker image consideration
    if (stats.overallHitRate < 30 && stats.totalCacheOps > 100) {
      recommendations.push('🐳 Very low hit rate with many operations suggests considering:');
      recommendations.push('   • Custom Docker images with pre-installed dependencies');
      recommendations.push('   • Repository-level package caching');
      recommendations.push('   • Workflow optimization to reduce cache dependency');
    }

    if (recommendations.length === 0) {
      recommendations.push('✨ Your cache configuration looks good! No major issues detected.');
    }

    recommendations.forEach(rec => console.log(rec));
    console.log();
  }

  /**
   * Format hit rate with color coding
   */
  private formatHitRate(rate: number): string {
    const formatted = `${rate.toFixed(1)}%`;
    
    if (rate >= 80) {
      return chalk.green(formatted);
    } else if (rate >= 50) {
      return chalk.yellow(formatted);
    } else {
      return chalk.red(formatted);
    }
  }

  /**
   * Format cache result with appropriate styling
   */
  private formatCacheResult(resultType: string): string {
    switch (resultType) {
      case 'hit':
        return chalk.green('✅ Hit');
      case 'miss':
        return chalk.red('❌ Miss');
      case 'partial':
        return chalk.yellow('🔄 Partial');
      default:
        return resultType;
    }
  }

  /**
   * Format file size in human-readable format
   */
  private formatSize(bytes?: number): string {
    if (!bytes || bytes === 0) {return '-';}
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  /**
   * Format time in human-readable format
   */
  private formatTime(ms?: number): string {
    if (!ms || ms === 0) {return '-';}
    
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      return `${(ms / 60000).toFixed(1)}m`;
    }
  }

  /**
   * Truncate text to fit in table columns
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
}
