import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

export interface GitRepository {
  owner: string;
  repo: string;
}

/**
 * Get the current repository information from git remote
 */
export async function getCurrentRepository(): Promise<GitRepository> {
  try {
    // Try to get remote URL from git
    const remoteUrl = execSync('git remote get-url origin', { 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();

    return parseGitRemoteUrl(remoteUrl);
  } catch {
    // If git command fails, try to read from .git/config
    try {
      const gitConfigPath = path.join(process.cwd(), '.git', 'config');
      const gitConfig = readFileSync(gitConfigPath, 'utf8');
      
      // Look for remote "origin" URL in config
      const urlMatch = gitConfig.match(/\[remote "origin"\][\s\S]*?url = (.+)/);
      if (urlMatch && urlMatch[1]) {
        return parseGitRemoteUrl(urlMatch[1].trim());
      }
    } catch {
      // Ignore file read errors
    }

    throw new Error('Could not determine repository information. Please ensure you are in a git repository or specify --owner and --repo options.');
  }
}

/**
 * Parse a git remote URL to extract owner and repo
 */
function parseGitRemoteUrl(url: string): GitRepository {
  // Handle different URL formats:
  // - https://github.com/owner/repo.git
  // - git@github.com:owner/repo.git
  // - https://github.com/owner/repo
  // - git://github.com/owner/repo.git

  let cleanUrl = url.trim();

  // Remove .git suffix if present
  if (cleanUrl.endsWith('.git')) {
    cleanUrl = cleanUrl.slice(0, -4);
  }

  // Handle SSH format (git@github.com:owner/repo)
  const sshMatch = cleanUrl.match(/git@github\.com:([^/]+)\/(.+)$/);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2]
    };
  }

  // Handle HTTPS format (https://github.com/owner/repo)
  const httpsMatch = cleanUrl.match(/https:\/\/github\.com\/([^/]+)\/(.+)$/);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2]
    };
  }

  // Handle git protocol (git://github.com/owner/repo)
  const gitMatch = cleanUrl.match(/git:\/\/github\.com\/([^/]+)\/(.+)$/);
  if (gitMatch) {
    return {
      owner: gitMatch[1],
      repo: gitMatch[2]
    };
  }

  throw new Error(`Could not parse git remote URL: ${url}. Please specify --owner and --repo options manually.`);
}

/**
 * Check if current directory is a git repository
 */
export function isGitRepository(): boolean {
  try {
    execSync('git rev-parse --git-dir', { 
      stdio: 'ignore'
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current git branch name
 */
export function getCurrentBranch(): string | null {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Get the current commit SHA
 */
export function getCurrentCommit(): string | null {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}
