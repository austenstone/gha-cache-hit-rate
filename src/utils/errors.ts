/**
 * Error handling utilities and custom error types
 */

export class CacheAnalysisError extends Error {
  constructor(message: string, public readonly code?: string, public readonly cause?: Error) {
    super(message);
    this.name = 'CacheAnalysisError';
  }
}

export class GitHubAuthError extends CacheAnalysisError {
  constructor(message: string, cause?: Error) {
    super(message, 'AUTH_ERROR', cause);
    this.name = 'GitHubAuthError';
  }
}

export class RateLimitError extends CacheAnalysisError {
  constructor(
    message: string, 
    public readonly resetTime: Date,
    public readonly remaining: number
  ) {
    super(message, 'RATE_LIMIT', undefined);
    this.name = 'RateLimitError';
  }
}

export class RepositoryAccessError extends CacheAnalysisError {
  constructor(message: string, public readonly repository: string) {
    super(message, 'REPO_ACCESS', undefined);
    this.name = 'RepositoryAccessError';
  }
}

export class LogParsingError extends CacheAnalysisError {
  constructor(message: string, public readonly runId: number) {
    super(message, 'LOG_PARSING', undefined);
    this.name = 'LogParsingError';
  }
}

/**
 * Handle and format errors for user display
 */
export function formatError(error: unknown): string {
  if (error instanceof CacheAnalysisError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return String(error);
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError) {
    return true;
  }
  
  if (error instanceof CacheAnalysisError) {
    return error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT';
  }
  
  return false;
}

/**
 * Create error with context information
 */
export function createContextError(
  message: string, 
  context: Record<string, any>, 
  cause?: Error
): CacheAnalysisError {
  const contextStr = Object.entries(context)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  
  const fullMessage = `${message} (Context: ${contextStr})`;
  return new CacheAnalysisError(fullMessage, 'CONTEXT_ERROR', cause);
}
