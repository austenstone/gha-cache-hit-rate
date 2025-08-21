import { Workflow, WorkflowRun, ApiRateLimit } from '../types/index.js';
export declare class GitHubApiClient {
    private octokit;
    private owner;
    private repo;
    constructor(owner: string, repo: string);
    private getAuthToken;
    getRateLimit(): Promise<ApiRateLimit>;
    getWorkflows(): Promise<Workflow[]>;
    getWorkflowRuns(workflowId: number, options?: {
        status?: 'success' | 'failure' | 'cancelled';
        created?: string;
        maxRuns?: number;
    }): Promise<WorkflowRun[]>;
    downloadRunLogs(runId: number): Promise<Buffer>;
    getRunJobs(runId: number): Promise<any[]>;
    validateRepository(): Promise<boolean>;
    waitForRateLimit(): Promise<void>;
    private handleApiError;
    private sleep;
}
