export interface GitRepository {
    owner: string;
    repo: string;
}
export declare function getCurrentRepository(): Promise<GitRepository>;
export declare function isGitRepository(): boolean;
export declare function getCurrentBranch(): string | null;
export declare function getCurrentCommit(): string | null;
