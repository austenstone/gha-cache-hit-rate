import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import { 
  Workflow, 
  WorkflowRun, 
  ApiRateLimit, 
  GitHubApiError 
} from '../types/index.js';

export class GitHubApiClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(owner: string, repo: string) {
    this.owner = owner;
    this.repo = repo;
    this.octokit = new Octokit({
      auth: this.getAuthToken(),
      userAgent: 'gha-cache-hit-rate/0.1.0',
      request: {
        timeout: 30000, // 30 seconds
        retries: 3,
      },
    });
  }

  /**
   * Get authentication token from GitHub CLI or environment
   */
  private getAuthToken(): string {
    // Try to get token from GitHub CLI first
    try {
      const token = execSync('gh auth token', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      
      if (token) {
        return token;
      }
    } catch {
      // GitHub CLI not available or not authenticated
    }

    // Fallback to environment variables
    const envToken = process.env.GITHUB_TOKEN || 
                    process.env.GH_TOKEN || 
                    process.env.GITHUB_PAT;

    if (envToken) {
      return envToken;
    }

    throw new Error(
      'No GitHub authentication found. Please run "gh auth login" or set GITHUB_TOKEN environment variable.'
    );
  }

  /**
   * Get current rate limit status
   */
  async getRateLimit(): Promise<ApiRateLimit> {
    try {
      const response = await this.octokit.rest.rateLimit.get();
      const core = response.data.rate;
      
      return {
        remaining: core.remaining,
        reset: new Date(core.reset * 1000),
        limit: core.limit,
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get rate limit');
    }
  }

  /**
   * Get all workflows for the repository
   */
  async getWorkflows(): Promise<Workflow[]> {
    try {
      const workflows: Workflow[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const response = await this.octokit.rest.actions.listRepoWorkflows({
          owner: this.owner,
          repo: this.repo,
          per_page: perPage,
          page,
        });

        const pageWorkflows = response.data.workflows.map(workflow => ({
          id: workflow.id,
          name: workflow.name,
          path: workflow.path,
          state: workflow.state,
          created_at: workflow.created_at,
          updated_at: workflow.updated_at,
          html_url: workflow.html_url,
        }));

        workflows.push(...pageWorkflows);

        // Check if we've reached the end
        if (pageWorkflows.length < perPage) {
          break;
        }

        page++;
      }

      return workflows;
    } catch (error) {
      throw this.handleApiError(error, 'Failed to fetch workflows');
    }
  }

  /**
   * Get workflow runs for a specific workflow
   */
  async getWorkflowRuns(
    workflowId: number,
    options: {
      status?: 'success' | 'failure' | 'cancelled';
      created?: string; // ISO date string for filtering
      maxRuns?: number;
    } = {}
  ): Promise<WorkflowRun[]> {
    try {
      const runs: WorkflowRun[] = [];
      let page = 1;
      const perPage = 100;
      const maxRuns = options.maxRuns || 1000;

      while (runs.length < maxRuns) {
        const response = await this.octokit.rest.actions.listWorkflowRuns({
          owner: this.owner,
          repo: this.repo,
          workflow_id: workflowId,
          status: options.status,
          created: options.created,
          per_page: Math.min(perPage, maxRuns - runs.length),
          page,
        });

        const pageRuns = response.data.workflow_runs.map(run => ({
          id: run.id,
          name: run.name || 'Unnamed run',
          status: run.status,
          conclusion: run.conclusion,
          created_at: run.created_at,
          updated_at: run.updated_at,
          html_url: run.html_url,
          workflow_id: run.workflow_id,
          head_branch: run.head_branch || 'unknown',
          head_sha: run.head_sha,
        }));

        runs.push(...pageRuns);

        // Check if we've reached the end or API returned fewer results
        if (pageRuns.length < Math.min(perPage, maxRuns - runs.length + pageRuns.length)) {
          break;
        }

        page++;
      }

      return runs.slice(0, maxRuns);
    } catch (error) {
      throw this.handleApiError(error, `Failed to fetch runs for workflow ${workflowId}`);
    }
  }

  /**
   * Download logs for a specific workflow run
   */
  async downloadRunLogs(runId: number): Promise<Buffer> {
    try {
      const response = await this.octokit.rest.actions.downloadWorkflowRunLogs({
        owner: this.owner,
        repo: this.repo,
        run_id: runId,
      });

      // The response.data is already a Buffer for zip files
      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      throw this.handleApiError(error, `Failed to download logs for run ${runId}`);
    }
  }

  /**
   * Get jobs for a specific workflow run
   */
  async getRunJobs(runId: number): Promise<any[]> {
    try {
      const response = await this.octokit.rest.actions.listJobsForWorkflowRun({
        owner: this.owner,
        repo: this.repo,
        run_id: runId,
        per_page: 100,
      });

      return response.data.jobs;
    } catch (error) {
      throw this.handleApiError(error, `Failed to fetch jobs for run ${runId}`);
    }
  }

  /**
   * Check if repository exists and is accessible
   */
  async validateRepository(): Promise<boolean> {
    try {
      await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      return true;
    } catch (error) {
      const apiError = error as GitHubApiError;
      if (apiError.status === 404) {
        throw new Error(`Repository ${this.owner}/${this.repo} not found or not accessible`);
      }
      if (apiError.status === 403) {
        throw new Error(`Access denied to repository ${this.owner}/${this.repo}. Check your permissions.`);
      }
      throw this.handleApiError(error, 'Failed to validate repository');
    }
  }

  /**
   * Wait for rate limit reset if needed
   */
  async waitForRateLimit(): Promise<void> {
    const rateLimit = await this.getRateLimit();
    
    if (rateLimit.remaining < 10) {
      const waitTime = rateLimit.reset.getTime() - Date.now();
      if (waitTime > 0) {
        console.log(`⏳ Rate limit nearly exceeded. Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await this.sleep(waitTime);
      }
    }
  }

  /**
   * Handle API errors with better error messages
   */
  private handleApiError(error: any, context: string): GitHubApiError {
    const apiError = error as GitHubApiError;
    
    let message = context;
    
    if (apiError.status) {
      switch (apiError.status) {
        case 401:
          message += ': Authentication failed. Please check your GitHub token.';
          break;
        case 403:
          if (apiError.response?.headers?.['x-ratelimit-remaining'] === '0') {
            message += ': Rate limit exceeded. Please wait and try again.';
          } else {
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

    const enhancedError = new Error(message) as GitHubApiError;
    enhancedError.status = apiError.status;
    enhancedError.response = apiError.response;
    
    return enhancedError;
  }

  /**
   * Utility method to sleep for a specified time
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
