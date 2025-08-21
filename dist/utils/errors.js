export class CacheAnalysisError extends Error {
    code;
    cause;
    constructor(message, code, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = 'CacheAnalysisError';
    }
}
export class GitHubAuthError extends CacheAnalysisError {
    constructor(message, cause) {
        super(message, 'AUTH_ERROR', cause);
        this.name = 'GitHubAuthError';
    }
}
export class RateLimitError extends CacheAnalysisError {
    resetTime;
    remaining;
    constructor(message, resetTime, remaining) {
        super(message, 'RATE_LIMIT', undefined);
        this.resetTime = resetTime;
        this.remaining = remaining;
        this.name = 'RateLimitError';
    }
}
export class RepositoryAccessError extends CacheAnalysisError {
    repository;
    constructor(message, repository) {
        super(message, 'REPO_ACCESS', undefined);
        this.repository = repository;
        this.name = 'RepositoryAccessError';
    }
}
export class LogParsingError extends CacheAnalysisError {
    runId;
    constructor(message, runId) {
        super(message, 'LOG_PARSING', undefined);
        this.runId = runId;
        this.name = 'LogParsingError';
    }
}
export function formatError(error) {
    if (error instanceof CacheAnalysisError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
export function isRetryableError(error) {
    if (error instanceof RateLimitError) {
        return true;
    }
    if (error instanceof CacheAnalysisError) {
        return error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT';
    }
    return false;
}
export function createContextError(message, context, cause) {
    const contextStr = Object.entries(context)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');
    const fullMessage = `${message} (Context: ${contextStr})`;
    return new CacheAnalysisError(fullMessage, 'CONTEXT_ERROR', cause);
}
