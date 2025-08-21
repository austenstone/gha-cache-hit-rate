export interface CacheHitResult {
  /** Workflow run ID */
  runId: number;
  /** Workflow name */
  workflowName: string;
  /** Job name where cache was used */
  jobName: string;
  /** Step name that used cache */
  stepName: string;
  /** Cache key that was used */
  cacheKey: string;
  /** Whether it was a cache hit (true) or miss (false) */
  isHit: boolean;
  /** Type of cache result: 'hit', 'miss', 'partial' (restore-key match) */
  cacheResultType: 'hit' | 'miss' | 'partial';
  /** Size of the cache in bytes (if available) */
  cacheSize?: number;
  /** Time taken to restore/save cache in milliseconds */
  timeMs?: number;
  /** Date when the workflow run occurred */
  runDate: Date;
  /** URL to the workflow run */
  runUrl: string;
}

export interface WorkflowCacheStats {
  /** Workflow name */
  workflowName: string;
  /** Total number of cache operations */
  totalCacheOps: number;
  /** Number of cache hits */
  cacheHits: number;
  /** Number of cache misses */
  cacheMisses: number;
  /** Number of partial hits (restore-key matches) */
  partialHits: number;
  /** Hit rate as percentage (0-100) */
  hitRate: number;
  /** Partial hit rate as percentage (0-100) */
  partialHitRate: number;
  /** Average cache size in bytes */
  avgCacheSize?: number;
  /** Total time saved by cache hits in milliseconds */
  timeSavedMs?: number;
  /** Most recent cache operations */
  recentOperations: CacheHitResult[];
}

export interface RepositoryCacheStats {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Overall hit rate across all workflows */
  overallHitRate: number;
  /** Overall partial hit rate */
  overallPartialHitRate: number;
  /** Total cache operations across all workflows */
  totalCacheOps: number;
  /** Total cache hits */
  totalCacheHits: number;
  /** Total cache misses */
  totalCacheMisses: number;
  /** Total partial hits */
  totalPartialHits: number;
  /** Statistics per workflow */
  workflowStats: WorkflowCacheStats[];
  /** Date range analyzed */
  dateRange: {
    from: Date;
    to: Date;
  };
  /** Total workflow runs analyzed */
  totalRunsAnalyzed: number;
}

export interface CliOptions {
  /** Repository owner (defaults to current repo) */
  owner?: string;
  /** Repository name (defaults to current repo) */
  repo?: string;
  /** Start date for analysis (ISO string) */
  since?: string;
  /** End date for analysis (ISO string) */
  until?: string;
  /** Maximum number of runs to analyze per workflow */
  maxRunsPerWorkflow?: number;
  /** Output format */
  format?: 'table' | 'csv' | 'json';
  /** Number of concurrent requests */
  concurrency?: number;
  /** Include only successful runs */
  successfulOnly?: boolean;
  /** Minimum cache operations to include workflow */
  minCacheOps?: number;
  /** Output file path (for CSV/JSON) */
  output?: string;
  /** Verbose logging */
  verbose?: boolean;
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: string | null;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  workflow_id: number;
  head_branch: string;
  head_sha: string;
}

export interface Workflow {
  id: number;
  name: string;
  path: string;
  state: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface CacheLogEntry {
  /** Raw log line */
  logLine: string;
  /** Parsed cache operation type */
  operationType: 'save' | 'restore';
  /** Cache key */
  key: string;
  /** Whether operation was successful */
  success: boolean;
  /** Cache result type */
  resultType: 'hit' | 'miss' | 'partial';
  /** Size in bytes if available */
  sizeBytes?: number;
  /** Time taken in milliseconds */
  timeMs?: number;
  /** Step name */
  stepName?: string;
  /** Job name */
  jobName?: string;
}

export interface ProcessingProgress {
  /** Current workflow being processed */
  currentWorkflow?: string;
  /** Number of workflows processed */
  workflowsProcessed: number;
  /** Total workflows to process */
  totalWorkflows: number;
  /** Number of runs processed */
  runsProcessed: number;
  /** Total runs to process */
  totalRuns: number;
  /** Cache operations found so far */
  cacheOpsFound: number;
}

export interface ApiRateLimit {
  /** Remaining requests */
  remaining: number;
  /** Rate limit reset time */
  reset: Date;
  /** Total limit */
  limit: number;
}

export interface GitHubApiError extends Error {
  status?: number;
  response?: {
    data?: any;
    status: number;
    headers: Record<string, string>;
  };
}
