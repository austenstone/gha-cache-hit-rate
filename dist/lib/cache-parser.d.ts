import { CacheHitResult } from '../types/index.js';
export declare class CacheLogParser {
    private static readonly CACHE_PATTERNS;
    parseRunLogs(logData: Buffer, runId: number, workflowName: string, runDate: Date, runUrl: string): Promise<CacheHitResult[]>;
    private parseLogContent;
    private parseCacheLine;
    private parseFollowingLines;
    static getCacheStats(results: CacheHitResult[]): {
        totalOperations: number;
        hits: number;
        misses: number;
        partialHits: number;
        hitRate: number;
        partialHitRate: number;
        avgSize: number;
        totalTimeSaved: number;
    };
}
