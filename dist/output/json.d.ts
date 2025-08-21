import { RepositoryCacheStats } from '../types/index.js';
export declare class JsonOutputFormatter {
    output(stats: RepositoryCacheStats, outputPath: string): Promise<void>;
    private formatStats;
    private calculateAverageCacheSize;
    private getPerformanceRating;
    private getWorkflowRecommendations;
    private generateRecommendations;
    private generateInsights;
    private calculateHitRateVariance;
}
