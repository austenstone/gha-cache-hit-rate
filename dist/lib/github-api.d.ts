import { Workflow, WorkflowRun, ApiRateLimit, RepositoryInfo } from '../types/index.js';
export declare class GitHubApiClient {
    private octokit;
    private owner;
    private repo?;
    private limit;
    constructor(owner: string, repo?: string, concurrency?: number);
    private getAuthToken;
    getRateLimit(): Promise<ApiRateLimit>;
    getWorkflows(): Promise<Workflow[]>;
    getWorkflowRuns(workflowId: number, maxRuns?: number, successfulOnly?: boolean): Promise<WorkflowRun[]>;
    downloadRunLogs(runId: number): Promise<Buffer>;
    getRunJobs(runId: number): Promise<any[]>;
    validateRepository(): Promise<boolean>;
    waitForRateLimit(): Promise<void>;
    getRepositories(maxRepos?: number): Promise<RepositoryInfo[]>;
    hasRepository(): boolean;
    forRepository(repo: string): GitHubApiClient;
    private handleApiError;
    private sleep;
}
