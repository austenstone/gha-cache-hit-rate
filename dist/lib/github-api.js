import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import pLimit from 'p-limit';
export class GitHubApiClient {
    octokit;
    owner;
    repo;
    limit;
    constructor(owner, repo, concurrency = 3) {
        this.owner = owner;
        this.repo = repo;
        this.limit = pLimit(concurrency);
        this.octokit = new Octokit({
            auth: this.getAuthToken(),
            userAgent: 'gh-actions-cache-hit-rate/0.1.0',
            request: {
                timeout: 30000,
                retries: 3,
            },
        });
    }
    getAuthToken() {
        try {
            const token = execSync('gh auth token', {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            }).trim();
            if (token) {
                return token;
            }
        }
        catch {
        }
        const envToken = process.env.GITHUB_TOKEN ||
            process.env.GH_TOKEN ||
            process.env.GITHUB_PAT;
        if (envToken) {
            return envToken;
        }
        throw new Error('No GitHub authentication found. Please run "gh auth login" or set GITHUB_TOKEN environment variable.');
    }
    async getRateLimit() {
        try {
            const response = await this.octokit.rest.rateLimit.get();
            const core = response.data.rate;
            return {
                remaining: core.remaining,
                reset: new Date(core.reset * 1000),
                limit: core.limit,
            };
        }
        catch (error) {
            throw this.handleApiError(error, 'Failed to get rate limit');
        }
    }
    async getWorkflows() {
        if (!this.repo) {
            throw new Error('Repository must be specified to get workflows');
        }
        try {
            const response = await this.octokit.actions.listRepoWorkflows({
                owner: this.owner,
                repo: this.repo,
            });
            return response.data.workflows.map(workflow => ({
                id: workflow.id,
                name: workflow.name,
                path: workflow.path,
                state: workflow.state,
                created_at: workflow.created_at,
                updated_at: workflow.updated_at,
                html_url: workflow.html_url,
            }));
        }
        catch (error) {
            throw this.handleApiError(error, `fetching workflows for ${this.owner}/${this.repo}`);
        }
    }
    async getWorkflowRuns(workflowId, maxRuns = 100, successfulOnly = true) {
        if (!this.repo) {
            throw new Error('Repository must be specified to get workflow runs');
        }
        try {
            const runs = [];
            let page = 1;
            while (runs.length < maxRuns) {
                const response = await this.octokit.actions.listWorkflowRuns({
                    owner: this.owner,
                    repo: this.repo,
                    workflow_id: workflowId,
                    status: successfulOnly ? 'success' : undefined,
                    per_page: Math.min(100, maxRuns - runs.length),
                    page,
                });
                if (response.data.workflow_runs.length === 0) {
                    break;
                }
                runs.push(...response.data.workflow_runs);
                page++;
            }
            return runs.slice(0, maxRuns);
        }
        catch (error) {
            throw this.handleApiError(error, `fetching workflow runs for workflow ${workflowId}`);
        }
    }
    async downloadRunLogs(runId) {
        if (!this.repo) {
            throw new Error('Repository must be specified to download run logs');
        }
        try {
            const response = await this.octokit.rest.actions.downloadWorkflowRunLogs({
                owner: this.owner,
                repo: this.repo,
                run_id: runId,
            });
            return Buffer.from(response.data);
        }
        catch (error) {
            throw this.handleApiError(error, `Failed to download logs for run ${runId}`);
        }
    }
    async getRunJobs(runId) {
        if (!this.repo) {
            throw new Error('Repository must be specified to get run jobs');
        }
        try {
            const response = await this.octokit.rest.actions.listJobsForWorkflowRun({
                owner: this.owner,
                repo: this.repo,
                run_id: runId,
                per_page: 100,
            });
            return response.data.jobs;
        }
        catch (error) {
            throw this.handleApiError(error, `Failed to fetch jobs for run ${runId}`);
        }
    }
    async validateRepository() {
        if (!this.repo) {
            throw new Error('Repository must be specified to validate repository');
        }
        try {
            await this.octokit.rest.repos.get({
                owner: this.owner,
                repo: this.repo,
            });
            return true;
        }
        catch (error) {
            const apiError = error;
            if (apiError.status === 404) {
                throw new Error(`Repository ${this.owner}/${this.repo} not found or not accessible`);
            }
            if (apiError.status === 403) {
                throw new Error(`Access denied to repository ${this.owner}/${this.repo}. Check your permissions.`);
            }
            throw this.handleApiError(error, 'Failed to validate repository');
        }
    }
    async waitForRateLimit() {
        const rateLimit = await this.getRateLimit();
        if (rateLimit.remaining < 10) {
            const waitTime = rateLimit.reset.getTime() - Date.now();
            if (waitTime > 0) {
                console.log(`⏳ Rate limit nearly exceeded. Waiting ${Math.ceil(waitTime / 1000)}s...`);
                await this.sleep(waitTime);
            }
        }
    }
    async getRepositories(maxRepos = 100) {
        try {
            const repositories = [];
            let page = 1;
            while (repositories.length < maxRepos) {
                console.log(`📂 Fetching repositories page ${page}...`);
                const response = await this.limit(() => this.octokit.repos.listForOrg({
                    org: this.owner,
                    type: 'all',
                    sort: 'updated',
                    direction: 'desc',
                    per_page: Math.min(100, maxRepos - repositories.length),
                    page,
                }));
                if (response.data.length === 0) {
                    break;
                }
                for (const repo of response.data) {
                    if (repositories.length >= maxRepos) {
                        break;
                    }
                    repositories.push({
                        owner: repo.owner.login,
                        repo: repo.name,
                        fullName: repo.full_name,
                        description: repo.description || undefined,
                        url: repo.html_url,
                        private: repo.private,
                        language: repo.language || undefined,
                    });
                }
                page++;
                await this.sleep(200);
            }
            console.log(`✅ Found ${repositories.length} repositories`);
            return repositories;
        }
        catch (error) {
            throw this.handleApiError(error, 'fetching organization repositories');
        }
    }
    hasRepository() {
        return this.repo !== undefined;
    }
    forRepository(repo) {
        return new GitHubApiClient(this.owner, repo);
    }
    handleApiError(error, context) {
        const apiError = error;
        let message = context;
        if (apiError.status) {
            switch (apiError.status) {
                case 401:
                    message += ': Authentication failed. Please check your GitHub token.';
                    break;
                case 403:
                    if (apiError.response?.headers?.['x-ratelimit-remaining'] === '0') {
                        message += ': Rate limit exceeded. Please wait and try again.';
                    }
                    else {
                        message += ': Access forbidden. Check repository permissions.';
                    }
                    break;
                case 404:
                    message += ': Resource not found. Check repository name and permissions.';
                    break;
                case 422:
                    message += ': Invalid request. Check your parameters.';
                    break;
                default:
                    message += `: HTTP ${apiError.status}`;
            }
        }
        if (apiError.message) {
            message += ` - ${apiError.message}`;
        }
        const enhancedError = new Error(message);
        enhancedError.status = apiError.status;
        enhancedError.response = apiError.response;
        return enhancedError;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
