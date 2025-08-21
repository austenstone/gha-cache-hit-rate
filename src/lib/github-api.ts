import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import pLimit from 'p-limit';
import { 
  Workflow, 
  WorkflowRun, 
  ApiRateLimit, 
  GitHubApiError,
  RepositoryInfo
} from '../types/index.js';

export class GitHubApiClient {
  private octokit: Octokit;
  private owner: string;
  private repo?: string;
  private limit: ReturnType<typeof pLimit>;

  constructor(owner: string, repo?: string, concurrency = 3) {
    this.owner = owner;
    this.repo = repo;
    this.limit = pLimit(concurrency);
    
    this.octokit = new Octokit({
      auth: this.getAuthToken(),
      userAgent: 'gh-actions-cache-hit-rate/0.1.0',
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
   * Get workflows for the configured repository
   */
  async getWorkflows(): Promise<Workflow[]> {
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
    } catch (error) {
      throw this.handleApiError(error, `fetching workflows for ${this.owner}/${this.repo}`);
    }
  }

  /**
   * Get workflow runs for a specific workflow
   */
  async getWorkflowRuns(
    workflowId: number, 
    maxRuns = 100, 
    successfulOnly = true
  ): Promise<WorkflowRun[]> {
    if (!this.repo) {
      throw new Error('Repository must be specified to get workflow runs');
    }

    try {
      const runs: WorkflowRun[] = [];
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
    } catch (error) {
      throw this.handleApiError(error, `fetching workflow runs for workflow ${workflowId}`);
    }
  }

  /**
   * Download logs for a specific workflow run
   */
  async downloadRunLogs(runId: number): Promise<Buffer> {
    if (!this.repo) {
      throw new Error('Repository must be specified to download run logs');
    }

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
    } catch (error) {
      throw this.handleApiError(error, `Failed to fetch jobs for run ${runId}`);
    }
  }

  /**
   * Check if repository exists and is accessible
   */
  async validateRepository(): Promise<boolean> {
    if (!this.repo) {
      throw new Error('Repository must be specified to validate repository');
    }

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
   * Get all repositories for an organization or user
   */
  async getRepositories(maxRepos = 100): Promise<RepositoryInfo[]> {
    try {
      const repositories: RepositoryInfo[] = [];
      let page = 1;
      
      while (repositories.length < maxRepos) {
        console.log(`📂 Fetching repositories page ${page}...`);
        
        const response = await this.limit(() => 
          this.octokit.repos.listForOrg({
            org: this.owner,
            type: 'all',
            sort: 'updated',
            direction: 'desc',
            per_page: Math.min(100, maxRepos - repositories.length),
            page,
          })
        );

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
        
        // Rate limiting: small delay between requests
        await this.sleep(200);
      }

      console.log(`✅ Found ${repositories.length} repositories`);
      return repositories;
    } catch (error) {
      throw this.handleApiError(error, 'fetching organization repositories');
    }
  }

  /**
   * Check if the current client has a specific repository set
   */
  hasRepository(): boolean {
    return this.repo !== undefined;
  }

  /**
   * Create a new client instance for a specific repository
   */
  forRepository(repo: string): GitHubApiClient {
    return new GitHubApiClient(this.owner, repo);
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
