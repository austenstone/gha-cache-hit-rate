import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
export async function getCurrentRepository() {
    try {
        const remoteUrl = execSync('git remote get-url origin', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        return parseGitRemoteUrl(remoteUrl);
    }
    catch {
        try {
            const gitConfigPath = path.join(process.cwd(), '.git', 'config');
            const gitConfig = readFileSync(gitConfigPath, 'utf8');
            const urlMatch = gitConfig.match(/\[remote "origin"\][\s\S]*?url = (.+)/);
            if (urlMatch && urlMatch[1]) {
                return parseGitRemoteUrl(urlMatch[1].trim());
            }
        }
        catch {
        }
        throw new Error('Could not determine repository information. Please ensure you are in a git repository or specify --owner and --repo options.');
    }
}
function parseGitRemoteUrl(url) {
    let cleanUrl = url.trim();
    if (cleanUrl.endsWith('.git')) {
        cleanUrl = cleanUrl.slice(0, -4);
    }
    const sshMatch = cleanUrl.match(/git@github\.com:([^/]+)\/(.+)$/);
    if (sshMatch) {
        return {
            owner: sshMatch[1],
            repo: sshMatch[2]
        };
    }
    const httpsMatch = cleanUrl.match(/https:\/\/github\.com\/([^/]+)\/(.+)$/);
    if (httpsMatch) {
        return {
            owner: httpsMatch[1],
            repo: httpsMatch[2]
        };
    }
    const gitMatch = cleanUrl.match(/git:\/\/github\.com\/([^/]+)\/(.+)$/);
    if (gitMatch) {
        return {
            owner: gitMatch[1],
            repo: gitMatch[2]
        };
    }
    throw new Error(`Could not parse git remote URL: ${url}. Please specify --owner and --repo options manually.`);
}
export function isGitRepository() {
    try {
        execSync('git rev-parse --git-dir', {
            stdio: 'ignore'
        });
        return true;
    }
    catch {
        return false;
    }
}
export function getCurrentBranch() {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    }
    catch {
        return null;
    }
}
export function getCurrentCommit() {
    try {
        return execSync('git rev-parse HEAD', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    }
    catch {
        return null;
    }
}
