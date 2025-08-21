export declare class CacheAnalysisError extends Error {
    readonly code?: string | undefined;
    readonly cause?: Error | undefined;
    constructor(message: string, code?: string | undefined, cause?: Error | undefined);
}
export declare class GitHubAuthError extends CacheAnalysisError {
    constructor(message: string, cause?: Error);
}
export declare class RateLimitError extends CacheAnalysisError {
    readonly resetTime: Date;
    readonly remaining: number;
    constructor(message: string, resetTime: Date, remaining: number);
}
export declare class RepositoryAccessError extends CacheAnalysisError {
    readonly repository: string;
    constructor(message: string, repository: string);
}
export declare class LogParsingError extends CacheAnalysisError {
    readonly runId: number;
    constructor(message: string, runId: number);
}
export declare function formatError(error: unknown): string;
export declare function isRetryableError(error: unknown): boolean;
export declare function createContextError(message: string, context: Record<string, any>, cause?: Error): CacheAnalysisError;
