import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { z } from 'zod';
import type { UpdateActiveRequestToolArgs } from '../requestUpdate';
import { clearLiveServerLogsTool } from './clearLiveServerLogs';
import { createCollectionTool } from './createCollection';
import { createFolderTool } from './createFolder';
import { createLiveServerTool } from './createLiveServer';
import { createRequestTool } from './createRequest';
import { deleteLiveServerTool } from './deleteLiveServer';
import { getActiveRequestTool } from './getActiveRequest';
import { getActiveRequestDetailsTool } from './getActiveRequestDetails';
import { getActiveResponseTool } from './getActiveResponse';
import { getActiveResponseSummaryTool } from './getActiveResponseSummary';
import { getActiveResponseConsoleTool } from './getActiveResponseConsole';
import { getActiveTerminalTool } from './getActiveTerminal';
import { getActiveTerminalLinesTool } from './getActiveTerminalLines';
import { getCollectionTool } from './getCollection';
import { getFolderTool } from './getFolder';
import { getGeneralSettingsTool } from './getGeneralSettings';
import { getLiveServerTool } from './getLiveServer';
import { getLiveServerLogsTool } from './getLiveServerLogs';
import { getMarkdownDocumentTool } from './getMarkdownDocument';
import { getRequestTool } from './getRequest';
import { getScriptRunDiagnosticsTool } from './getScriptRunDiagnostics';
import { getScriptingApiReferenceTool } from './getScriptingApiReference';
import { getSelectedCollectionTool } from './getSelectedCollection';
import { getSidebarRequestTool } from './getSidebarRequest';
import { getThemeTokenTool } from './getThemeToken';
import { gitCommitsTool } from './gitCommits';
import { gitDiffTool } from './gitDiff';
import { gitFileDiffTool } from './gitFileDiff';
import { gitFileInfoTool } from './gitFileInfo';
import { gitRepoInfoTool } from './gitRepoInfo';
import { listCollectionsTool } from './listCollections';
import { listEnvironmentsTool } from './listEnvironments';
import { listLiveServersTool } from './listLiveServers';
import { listRequestsTool } from './listRequests';
import { listRunningLiveServersTool } from './listRunningLiveServers';
import { listThemeTokensTool } from './listThemeTokens';
import { listThemesTool } from './listThemes';
import { queryResponseBodyTool } from './queryResponseBody';
import { searchDocsTool } from './searchDocs';
import { sendActiveRequestTool } from './sendActiveRequest';
import { setActiveEnvironmentTool } from './setActiveEnvironment';
import { setThemeTool } from './setTheme';
import { startLiveServerTool } from './startLiveServer';
import { stopLiveServerTool } from './stopLiveServer';
import { terminalExecTool } from './terminalExec';
import { updateActiveRequestTool } from './updateActiveRequest';
import { updateGeneralSettingsTool } from './updateGeneralSettings';
import { updateLiveServerTool } from './updateLiveServer';
import { updateRequestScriptTool } from './updateRequestScript';
import { updateThemeTokenTool } from './updateThemeToken';
import { webpageEvaluateTool } from './webpageEvaluate';
import { webpageInjectScriptTool } from './webpageInjectScript';
import { webpageInjectStylesheetTool } from './webpageInjectStylesheet';
import { webpageQueryTool } from './webpageQuery';
import { webpageTabTool } from './webpageTab';

export type { UpdateActiveRequestToolArgs };
export type { ITool } from './ITool';
export { AI_SYSTEM_PROMPT, buildAiSystemPrompt } from './systemPrompt';
export type {
  CreateCollectionRequestRow,
  CreateSavedRequestKeyValue,
  GetSidebarItemByUuidToolArgs
} from './types';
export type { ClearLiveServerLogsToolArgs } from './clearLiveServerLogs';
export type { CreateCollectionToolArgs } from './createCollection';
export type { CreateFolderToolArgs } from './createFolder';
export type { CreateLiveServerToolArgs } from './createLiveServer';
export type { CreateRequestToolArgs } from './createRequest';
export type { DeleteLiveServerToolArgs } from './deleteLiveServer';
export type { GetActiveResponseToolArgs } from './getActiveResponse';
export type { GetActiveTerminalLinesToolArgs } from './getActiveTerminalLines';
export type { GetLiveServerToolArgs } from './getLiveServer';
export type { GetLiveServerLogsToolArgs } from './getLiveServerLogs';
export type { GetMarkdownDocumentToolArgs } from './getMarkdownDocument';
export type { GetScriptRunDiagnosticsToolArgs } from './getScriptRunDiagnostics';
export type { GetThemeTokenToolArgs } from './getThemeToken';
export type { GitCommitsToolArgs } from './gitCommits';
export type { GitDiffToolArgs } from './gitDiff';
export type { GitFileDiffToolArgs } from './gitFileDiff';
export type { GitFileInfoToolArgs } from './gitFileInfo';
export type { GitRepoInfoToolArgs } from './gitRepoInfo';
export type { ListRequestsToolArgs } from './listRequests';
export type { QueryResponseBodyToolArgs } from './queryResponseBody';
export type { SearchDocsToolArgs } from './searchDocs';
export type { SendActiveRequestToolArgs } from './sendActiveRequest';
export type { SetActiveEnvironmentToolArgs } from './setActiveEnvironment';
export type { SetThemeToolArgs } from './setTheme';
export type { StartLiveServerToolArgs } from './startLiveServer';
export type { StopLiveServerToolArgs } from './stopLiveServer';
export type { TerminalExecToolArgs } from './terminalExec';
export type { UpdateGeneralSettingsToolArgs } from './updateGeneralSettings';
export type { UpdateLiveServerToolArgs } from './updateLiveServer';
export type { UpdateRequestScriptToolArgs } from './updateRequestScript';
export type { UpdateThemeTokenToolArgs } from './updateThemeToken';
export type { WebpageEvaluateToolArgs } from './webpageEvaluate';
export type { WebpageInjectScriptToolArgs } from './webpageInjectScript';
export type { WebpageInjectStylesheetToolArgs } from './webpageInjectStylesheet';
export type { WebpageQueryToolArgs } from './webpageQuery';
export type { WebpageTabToolArgs } from './webpageTab';

/**
 * Ordered registry of every Harbor AI agent tool.
 *
 * Order matches the historical `AI_TOOL_NAMES` / `AI_TOOL_DEFINITIONS` sequence
 * so consumers that iterate tools keep stable ordering.
 */
export const AI_TOOLS = [
  getSelectedCollectionTool,
  listCollectionsTool,
  getCollectionTool,
  listRequestsTool,
  getFolderTool,
  getRequestTool,
  listEnvironmentsTool,
  getSidebarRequestTool,
  getActiveRequestTool,
  getActiveRequestDetailsTool,
  getActiveResponseSummaryTool,
  getActiveResponseTool,
  getActiveResponseConsoleTool,
  queryResponseBodyTool,
  sendActiveRequestTool,
  setActiveEnvironmentTool,
  updateActiveRequestTool,
  updateRequestScriptTool,
  getGeneralSettingsTool,
  updateGeneralSettingsTool,
  listThemesTool,
  setThemeTool,
  listThemeTokensTool,
  getThemeTokenTool,
  updateThemeTokenTool,
  createCollectionTool,
  createFolderTool,
  createRequestTool,
  searchDocsTool,
  getScriptRunDiagnosticsTool,
  getScriptingApiReferenceTool,
  getActiveTerminalTool,
  getActiveTerminalLinesTool,
  terminalExecTool,
  webpageTabTool,
  webpageQueryTool,
  webpageEvaluateTool,
  webpageInjectScriptTool,
  webpageInjectStylesheetTool,
  getMarkdownDocumentTool,
  gitDiffTool,
  gitRepoInfoTool,
  gitCommitsTool,
  gitFileInfoTool,
  gitFileDiffTool,
  listLiveServersTool,
  listRunningLiveServersTool,
  getLiveServerTool,
  getLiveServerLogsTool,
  startLiveServerTool,
  stopLiveServerTool,
  createLiveServerTool,
  updateLiveServerTool,
  deleteLiveServerTool,
  clearLiveServerLogsTool
] as const;

/**
 * Maps a readonly tool-registry tuple to a readonly tuple of its literal names.
 *
 * @typeParam T - Readonly array of objects that each expose a `name` string literal.
 */
type ToolNamesTuple<T extends readonly { readonly name: string }[]> = {
  -readonly [K in keyof T]: T[K] extends { readonly name: infer N } ? N : never;
};

/**
 * Extracts tool names from the registry while preserving the tuple of literal names.
 *
 * @param tools - Ordered tool registry.
 * @returns Readonly tuple of each tool's `name` field.
 */
function extractToolNames<const T extends readonly { readonly name: string }[]>(
  tools: T
): ToolNamesTuple<T> {
  return tools.map((tool) => tool.name) as ToolNamesTuple<T>;
}

/**
 * Names of tools exposed to the AI chat agent, derived from {@link AI_TOOLS}.
 */
export const AI_TOOL_NAMES = extractToolNames(AI_TOOLS);

/**
 * Union of supported AI agent tool names.
 */
export type AiToolName = (typeof AI_TOOL_NAMES)[number];

/**
 * OpenAI tool definitions for querying and controlling Harbor app state.
 */
export const AI_TOOL_DEFINITIONS: ChatCompletionTool[] = AI_TOOLS.map((tool) => tool.definition);

/**
 * Zod raw shapes for Harbor AI tools, keyed by tool name for MCP registration.
 */
const AI_TOOL_INPUT_SHAPES = Object.fromEntries(
  AI_TOOLS.map((tool) => [tool.name, tool.inputShape])
) as Record<AiToolName, Record<string, z.ZodType>>;

/**
 * Returns the Zod raw shape for a Harbor AI tool's MCP input schema.
 *
 * @param name - Harbor AI tool name.
 * @returns Zod raw shape used when registering the tool on the MCP server.
 */
export function getAiToolInputShape(name: AiToolName): Record<string, z.ZodType> {
  return AI_TOOL_INPUT_SHAPES[name];
}
