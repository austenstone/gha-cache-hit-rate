import { RepositoryCacheStats } from '../types/index.js';
export declare class TableOutputFormatter {
    output(stats: RepositoryCacheStats, verbose?: boolean): void;
    private printHeader;
    private printOverallStats;
    private printWorkflowTable;
    private printDetailedWorkflowStats;
    private printDetailedAnalysis;
    private printRecommendations;
    private formatHitRate;
    private formatCacheResult;
    private formatSize;
    private formatTime;
    private truncateText;
}
