import type {
  AddChatMessageInput,
  AiChatStreamContext,
  AiChatStreamRendererMessage,
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
} from '../ai';
import type { PendingAiChatTurn } from '../aiChatStream';

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
   * Saves the full recovery context for a turn paused on `ask_user`.
   *
   * @param pendingTurn - Versioned paused-turn payload for one chat.
   */
  savePendingChatTurn: (pendingTurn: PendingAiChatTurn) => Promise<void>;
  /**
   * Loads the durable paused-turn context for a chat when it is valid.
   *
   * @param chatId - Chat id to inspect.
   */
  getPendingChatTurn: (chatId: number) => Promise<PendingAiChatTurn | null>;
  /**
   * Removes a durable paused-turn context before terminal cleanup or discard.
   *
   * @param chatId - Chat id whose paused context should be cleared.
   */
  deletePendingChatTurn: (chatId: number) => Promise<void>;
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
   * @param streamContextOrStepRequestId - Optional stream context or legacy step request id.
   * @param stepRequestId - Optional client id used to cancel the in-flight step when stream context is provided.
   */
  completeChatStep: (
    input: ChatStepInput,
    streamContextOrStepRequestId?: AiChatStreamContext | string,
    stepRequestId?: string
  ) => Promise<ChatStepResult>;
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
   * Subscribes to normalized AI chat stream events pushed from the main process.
   *
   * @param callback - Handler invoked for validated stream events correlated by chat id.
   */
  onAiChatStream: (callback: (message: AiChatStreamRendererMessage) => void) => () => void;
  /**
   * Deletes a chat and its messages.
   *
   * @param id - Chat id to delete.
   */
  deleteChat: (id: number) => Promise<void>;
}
