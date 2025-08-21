export interface CacheHitResult {
    runId: number;
    workflowName: string;
    jobName: string;
    stepName: string;
    cacheKey: string;
    isHit: boolean;
    cacheResultType: 'hit' | 'miss' | 'partial';
    cacheSize?: number;
    timeMs?: number;
    runDate: Date;
    runUrl: string;
}
export interface RepositoryInfo {
    owner: string;
    repo: string;
    fullName: string;
    description?: string;
    url: string;
    private: boolean;
    language?: string;
}
export interface OrganizationCacheStats {
    organization: string;
    totalRepositories: number;
    repositoriesWithCache: number;
    overallStats: RepositoryCacheStats;
    repositories: RepositoryCacheStats[];
    metadata: {
        analyzedAt: Date;
        totalWorkflows: number;
        totalRuns: number;
        rateLimitInfo?: ApiRateLimit;
    };
}
export interface WorkflowCacheStats {
    workflowName: string;
    totalCacheOps: number;
    cacheHits: number;
    cacheMisses: number;
    partialHits: number;
    hitRate: number;
    partialHitRate: number;
    avgCacheSize?: number;
    timeSavedMs?: number;
    recentOperations: CacheHitResult[];
}
export interface RepositoryCacheStats {
    owner: string;
    repo: string;
    overallHitRate: number;
    overallPartialHitRate: number;
    totalCacheOps: number;
    totalCacheHits: number;
    totalCacheMisses: number;
    totalPartialHits: number;
    workflowStats: WorkflowCacheStats[];
    dateRange: {
        from: Date;
        to: Date;
    };
    totalRunsAnalyzed: number;
}
export interface CliOptions {
    owner?: string;
    repo?: string;
    allRepos?: boolean;
    since?: string;
    until?: string;
    maxRunsPerWorkflow?: number;
    maxRepos?: number;
    format?: 'table' | 'csv' | 'json';
    concurrency?: number;
    successfulOnly?: boolean;
    minCacheOps?: number;
    output?: string;
    verbose?: boolean;
}
export interface WorkflowRun {
    id: number;
    name?: string | null;
    status: string | null;
    conclusion: string | null;
    created_at: string;
    updated_at: string;
    html_url: string;
    workflow_id: number;
    head_branch: string | null;
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
    logLine: string;
    operationType: 'save' | 'restore';
    key: string;
    success: boolean;
    resultType: 'hit' | 'miss' | 'partial';
    sizeBytes?: number;
    timeMs?: number;
    stepName?: string;
    jobName?: string;
}
export interface ProcessingProgress {
    currentWorkflow?: string;
    workflowsProcessed: number;
    totalWorkflows: number;
    runsProcessed: number;
    totalRuns: number;
    cacheOpsFound: number;
}
export interface ApiRateLimit {
    remaining: number;
    reset: Date;
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
