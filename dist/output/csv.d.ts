import { RepositoryCacheStats } from '../types/index.js';
export declare class CsvOutputFormatter {
    output(stats: RepositoryCacheStats, outputPath: string): Promise<void>;
    outputDetailed(stats: RepositoryCacheStats, outputPath: string): Promise<void>;
    outputSummary(stats: RepositoryCacheStats, outputPath: string): Promise<void>;
}
