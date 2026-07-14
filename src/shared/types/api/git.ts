import type {
  GitCommitDetail,
  GitGraphLogResult,
  GitIdentity,
  GitLogEntry,
  GitOAuthFinishedEvent,
  GitRequestFileStatus,
  SourceControlStatus
} from '#/shared/types/storage';

/**
 * IPC methods for git.
 */
export interface ApiGit {
  /**
   * Returns source-control status for each mounted git-backed connection.
   */
  listGitStatuses: () => Promise<Record<string, SourceControlStatus>>;
  /**
   * Subscribes to working-tree changes for git-backed connections (pull, external edits).
   *
   * @param callback - Handler invoked with the connection id whose tree changed.
   * @returns Unsubscribe function.
   */
  onGitWorkingTreeChanged: (callback: (connectionId: string) => void) => () => void;
  /**
   * Subscribes to background GitHub OAuth completion for a git-backed connection.
   *
   * @param callback - Handler invoked when OAuth polling finishes or fails.
   * @returns Unsubscribe function.
   */
  onGitOAuthFinished: (callback: (event: GitOAuthFinishedEvent) => void) => () => void;
  /**
   * Commits local changes for one git-backed collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   * @param message - Commit message.
   * @param createHarborRoot - When true, creates the HarborClient subdirectory layout if missing.
   */
  gitCommit: (
    connectionId: string,
    collectionUuid: string,
    message: string,
    createHarborRoot?: boolean
  ) => Promise<void>;
  /**
   * Returns local branch names for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   */
  gitListBranches: (connectionId: string) => Promise<string[]>;
  /**
   * Creates a new branch from the current commit and checks it out.
   *
   * @param connectionId - Git connection id.
   * @param name - Branch name to create.
   */
  gitCreateBranch: (connectionId: string, name: string) => Promise<void>;
  /**
   * Deletes a local branch that is not currently checked out.
   *
   * @param connectionId - Git connection id.
   * @param name - Branch name to delete.
   */
  gitDeleteBranch: (connectionId: string, name: string) => Promise<void>;
  /**
   * Checks out an existing local branch when the working tree is clean.
   *
   * @param connectionId - Git connection id.
   * @param name - Branch name to check out.
   */
  gitCheckoutBranch: (connectionId: string, name: string) => Promise<void>;
  /**
   * Merges another local branch into the current branch.
   *
   * @param connectionId - Git connection id.
   * @param name - Local branch name to merge.
   * @returns Conflict count after the merge attempt.
   */
  gitMergeBranch: (connectionId: string, name: string) => Promise<{ conflictCount: number }>;
  /**
   * Reads raw text from one repository-relative file in a git connection.
   *
   * @param args - Git connection id and repository-relative file path.
   */
  gitReadConflictFile: (args: {
    connectionId: string;
    filePath: string;
  }) => Promise<{ path: string; content: string }>;
  /**
   * Writes raw text to one repository-relative file and stages it.
   *
   * @param args - Git connection id, file path, and resolved file contents.
   */
  gitWriteConflictFile: (args: {
    connectionId: string;
    filePath: string;
    content: string;
  }) => Promise<void>;
  /**
   * Launches the configured external merge editor for one conflicted file.
   *
   * @param args - Git connection id and repository-relative file path.
   */
  gitOpenExternalMergeEditor: (args: { connectionId: string; filePath: string }) => Promise<void>;
  /**
   * Fetches from the configured remote without merging.
   *
   * @param connectionId - Git connection id.
   */
  gitFetch: (connectionId: string) => Promise<void>;
  /**
   * Pulls (fetch + merge) for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   */
  gitPull: (connectionId: string) => Promise<void>;
  /**
   * Pushes commits to the remote for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   */
  gitPush: (connectionId: string) => Promise<void>;
  /**
   * Suggests commit author name and email from repo-local and global git config.
   *
   * @param connectionId - Optional git connection id for repo-local lookup.
   */
  gitSuggestedAuthor: (connectionId?: string) => Promise<{ name: string; email: string }>;
  /**
   * Permanently removes the local git clone directory for a git-backed connection.
   *
   * @param connectionId - Git connection id whose repoPath should be deleted.
   */
  gitDeleteRepoDirectory: (connectionId: string) => Promise<void>;
  /**
   * Returns recent commits for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   * @param depth - Maximum number of commits to return.
   */
  gitLog: (connectionId: string, depth?: number) => Promise<GitLogEntry[]>;
  /**
   * Returns graph-ready commit history for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   * @param depth - Maximum number of commits to include.
   */
  gitGraphLog: (connectionId: string, depth?: number) => Promise<GitGraphLogResult>;
  /**
   * Returns detailed metadata and changed files for one commit.
   *
   * @param connectionId - Git connection id.
   * @param oid - Commit object id.
   */
  gitCommitDetail: (connectionId: string, oid: string) => Promise<GitCommitDetail>;
  /**
   * Returns a diff for one HarborClient file in a specific commit.
   *
   * @param args - Git connection id, commit oid, file path, and optional display metadata.
   */
  gitCommitFileDiff: (args: {
    connectionId: string;
    commitOid: string;
    filePath: string;
    status: 'added' | 'modified' | 'deleted';
    displayName?: string;
    resourceKind?: 'request' | 'document';
    method?: string;
    maxChars?: number;
  }) => Promise<import('#/shared/types').GitRequestDiffFileEntry>;
  /**
   * Returns uncommitted HarborClient-tree diffs for a git-backed collection.
   *
   * @param args - Collection uuid and optional diff output caps.
   */
  gitDiff: (args: {
    collectionUuid: string;
    maxFiles?: number;
    maxCharsPerFile?: number;
    maxTotalChars?: number;
    /**
     * When true, includes only staged changes (HEAD vs index). Defaults to working-tree changes.
     */
    stagedOnly?: boolean;
    /**
     * When true, omits untracked files (not yet added to git) from the diff payload.
     */
    excludeUntracked?: boolean;
  }) => Promise<string>;
  /**
   * Returns git repository metadata for one git-backed collection.
   *
   * @param args - Collection uuid used to resolve the git-backed repository connection.
   */
  gitRepoInfo: (args: { collectionUuid: string }) => Promise<string>;
  /**
   * Returns recent commit history for the repository that contains a collection.
   *
   * @param args - Collection uuid and optional commit depth.
   */
  gitCollectionCommits: (args: { collectionUuid: string; depth?: number }) => Promise<string>;
  /**
   * Returns per-file git metadata and commit history for one saved request.
   *
   * @param args - Collection uuid, request uuid, and optional history depth.
   */
  gitFileInfo: (args: {
    collectionUuid: string;
    requestUuid: string;
    depth?: number;
  }) => Promise<string>;
  /**
   * Returns a diff of one saved request file between two commits.
   *
   * @param args - Collection uuid, request uuid, commit range, and optional diff cap.
   */
  gitFileDiff: (args: {
    collectionUuid: string;
    requestUuid: string;
    commitA: string;
    commitB: string;
    maxChars?: number;
  }) => Promise<string>;
  /**
   * Returns per-request and per-document git status for one git-backed collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   */
  gitListItemStatuses: (
    connectionId: string,
    collectionUuid: string
  ) => Promise<Record<string, GitRequestFileStatus>>;
  /**
   * Returns the number of changed request/document files in one git-backed collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   */
  gitChangedItemCount: (connectionId: string, collectionUuid: string) => Promise<number>;
  /**
   * Stages one request or markdown document in a git-backed collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   * @param itemUuid - Stable request or document uuid.
   */
  gitStageItem: (connectionId: string, collectionUuid: string, itemUuid: string) => Promise<void>;
  /**
   * Unstages one request or markdown document in a git-backed collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   * @param itemUuid - Stable request or document uuid.
   */
  gitUnstageItem: (connectionId: string, collectionUuid: string, itemUuid: string) => Promise<void>;
  /**
   * Discards working-tree changes for one request or markdown file in a git-backed collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   * @param filePath - Repository-relative changed file path.
   * @param previousPaths - Optional deleted paths to restore when reverting a rename.
   */
  gitRevertFile: (
    connectionId: string,
    collectionUuid: string,
    filePath: string,
    previousPaths?: string[]
  ) => Promise<void>;
  /**
   * Stores a PAT for a git-backed connection and validates credentials via fetch.
   *
   * @param connectionId - Git connection id.
   * @param username - Basic Auth username.
   * @param token - Personal access token.
   */
  gitSetPat: (connectionId: string, username: string, token: string) => Promise<void>;
  /**
   * Starts GitHub OAuth device flow for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   * @returns Device flow code and verification URL for the user to approve in a browser.
   */
  gitStartOAuth: (connectionId: string) => Promise<{ userCode: string; verificationUri: string }>;
  /**
   * Completes GitHub OAuth device flow after the user approves in a browser.
   *
   * Ensures background polling is running when a pending device flow exists.
   * Resolves immediately without waiting for GitHub approval.
   *
   * @param connectionId - Git connection id.
   */
  gitCompleteOAuth: (connectionId: string) => Promise<void>;
  /**
   * Removes stored GitHub OAuth tokens and resets auth metadata for a git connection.
   *
   * @param connectionId - Git connection id.
   */
  gitRevokeOAuth: (connectionId: string) => Promise<void>;
  /**
   * Reads the origin remote URL from a local git repository path.
   *
   * SSH remotes are normalized to HTTPS. Returns null when the path is not a git
   * repository or has no configured remotes.
   *
   * @param repoPath - Absolute path to a local git working tree.
   */
  gitReadRemoteUrl: (repoPath: string) => Promise<string | null>;
  /**
   * Lists saved git host identities.
   */
  listGitIdentities: () => Promise<GitIdentity[]>;
  /**
   * Stores a PAT for a git host and optionally validates credentials.
   *
   * @param host - Normalized lowercase git host key.
   * @param username - Basic Auth username.
   * @param token - Personal access token.
   * @param testUrl - Optional repository URL used to validate the token.
   * @param repoPath - Optional local repository path used with testUrl.
   */
  gitSetHostPat: (
    host: string,
    username: string,
    token: string,
    testUrl?: string,
    repoPath?: string
  ) => Promise<void>;
  /**
   * Starts GitHub OAuth device flow for a git host.
   *
   * @param host - Normalized lowercase git host key.
   * @param testUrl - Optional repository URL used to validate after completion.
   * @param repoPath - Optional local repository path used with testUrl.
   */
  gitStartHostOAuth: (
    host: string,
    testUrl?: string,
    repoPath?: string
  ) => Promise<{ userCode: string; verificationUri: string }>;
  /**
   * Revokes stored credentials for a git host.
   *
   * @param host - Normalized lowercase git host key.
   */
  gitRevokeHost: (host: string) => Promise<void>;
  /**
   * Returns whether a directory path is the root of a git working tree.
   *
   * @param repoPath - Absolute directory path to inspect.
   */
  gitIsRepo: (repoPath: string) => Promise<boolean>;
  /**
   * Initializes a git repository and optionally adds an origin remote.
   *
   * @param repoPath - Absolute directory path to initialize.
   * @param url - HTTPS remote URL for origin, or empty to skip.
   * @param branch - Default branch name.
   */
  gitInitRepo: (repoPath: string, url: string, branch: string) => Promise<void>;
}
