import type {
  AddChatMessageInput,
  Chat,
  ChatMessage,
  ChatStepInput,
  ChatStepResult,
  ChatSummary,
  CreateChatInput,
  GenerateChatTitleInput,
  GithubModelsSignInFinishedEvent,
  GithubModelsStatus,
  HubLlmModelGroup
} from '#/shared/types/ai';

/**
 * IPC methods for chats.
 */
export interface ApiChats {
  /**
   * Lists all AI chats ordered by most recently updated.
   */
  listChats: () => Promise<ChatSummary[]>;
  /**
   * Creates a new AI chat thread.
   *
   * @param input - Optional title and model for the new chat.
   */
  createChat: (input: CreateChatInput) => Promise<Chat>;
  /**
   * Loads a chat and its messages by id.
   *
   * @param id - Chat id to load.
   */
  getChat: (id: number) => Promise<Chat | null>;
  /**
   * Appends a message to a chat thread.
   *
   * @param input - Chat id, role, content, and optional model.
   */
  addChatMessage: (input: AddChatMessageInput) => Promise<ChatMessage>;
  /**
   * Summarizes the user's first message into a short chat title and persists it.
   *
   * @param input - Chat id, prompt text, and model routing fields.
   */
  generateChatTitle: (input: GenerateChatTitleInput) => Promise<string>;
  /**
   * Runs one LLM completion step with tool definitions and returns text or tool calls.
   *
   * @param input - Model id and conversation messages for the step.
   * @param stepRequestId - Optional client id used to cancel the in-flight step.
   */
  completeChatStep: (input: ChatStepInput, stepRequestId?: string) => Promise<ChatStepResult>;
  /**
   * Aborts an in-flight LLM completion step by its client-side step request id.
   *
   * @param stepRequestId - Id passed to completeChatStep when the step was started.
   */
  cancelChatStep: (stepRequestId: string) => Promise<void>;
  /**
   * Lists LLM models offered by configured Team Hubs for the current user.
   */
  listHubLlmModels: () => Promise<HubLlmModelGroup[]>;
  /**
   * Returns GitHub Models connection status.
   */
  getGithubModelsStatus: () => Promise<GithubModelsStatus>;
  /**
   * Starts GitHub Models device flow and returns the user code for browser approval.
   *
   * The browser is not opened until {@link completeGithubModelsSignIn} is called.
   */
  startGithubModelsSignIn: () => Promise<{ userCode: string; verificationUri: string }>;
  /**
   * Opens the GitHub Models verification URI and starts background sign-in polling.
   *
   * @param verificationUri - Device-flow verification URL from {@link startGithubModelsSignIn}.
   */
  completeGithubModelsSignIn: (verificationUri: string) => Promise<void>;
  /**
   * Removes stored GitHub Models credentials.
   */
  signOutGithubModels: () => Promise<void>;
  /**
   * Subscribes to background GitHub Models sign-in completion events.
   *
   * @param callback - Handler invoked when sign-in polling finishes or fails.
   * @returns Unsubscribe function.
   */
  onGithubModelsSignInFinished: (
    callback: (event: GithubModelsSignInFinishedEvent) => void
  ) => () => void;
  /**
   * Deletes a chat and its messages.
   *
   * @param id - Chat id to delete.
   */
  deleteChat: (id: number) => Promise<void>;
}
