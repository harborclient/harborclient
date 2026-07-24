import { createCollectionTool } from './createCollection';
import { createFolderTool } from './createFolder';
import { createRequestTool } from './createRequest';
import { getActiveRequestTool } from './getActiveRequest';
import { getActiveRequestDetailsTool } from './getActiveRequestDetails';
import { getActiveResponseTool } from './getActiveResponse';
import { getActiveResponseSummaryTool } from './getActiveResponseSummary';
import { getActiveTerminalTool } from './getActiveTerminal';
import { getActiveTerminalLinesTool } from './getActiveTerminalLines';
import { getCollectionTool } from './getCollection';
import { getFolderTool } from './getFolder';
import { getMarkdownDocumentTool } from './getMarkdownDocument';
import { getRequestTool } from './getRequest';
import { getSelectedCollectionTool } from './getSelectedCollection';
import { getSidebarRequestTool } from './getSidebarRequest';
import { gitCommitsTool } from './gitCommits';
import { gitDiffTool } from './gitDiff';
import { gitFileDiffTool } from './gitFileDiff';
import { gitFileInfoTool } from './gitFileInfo';
import { gitRepoInfoTool } from './gitRepoInfo';
import { listCollectionsTool } from './listCollections';
import { listEnvironmentsTool } from './listEnvironments';
import { listRequestsTool } from './listRequests';
import { queryResponseBodyTool } from './queryResponseBody';
import { searchDocsTool } from './searchDocs';
import { sendActiveRequestTool } from './sendActiveRequest';
import { setActiveEnvironmentTool } from './setActiveEnvironment';
import { terminalExecTool } from './terminalExec';
import { updateActiveRequestTool } from './updateActiveRequest';
import { updateRequestScriptTool } from './updateRequestScript';
export { AI_SYSTEM_PROMPT } from './systemPrompt';
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
  queryResponseBodyTool,
  sendActiveRequestTool,
  setActiveEnvironmentTool,
  updateActiveRequestTool,
  updateRequestScriptTool,
  createCollectionTool,
  createFolderTool,
  createRequestTool,
  searchDocsTool,
  getActiveTerminalTool,
  getActiveTerminalLinesTool,
  terminalExecTool,
  getMarkdownDocumentTool,
  gitDiffTool,
  gitRepoInfoTool,
  gitCommitsTool,
  gitFileInfoTool,
  gitFileDiffTool
];
/**
 * Extracts tool names from the registry while preserving the tuple of literal names.
 *
 * @param tools - Ordered tool registry.
 * @returns Readonly tuple of each tool's `name` field.
 */
function extractToolNames(tools) {
  return tools.map((tool) => tool.name);
}
/**
 * Names of tools exposed to the AI chat agent, derived from {@link AI_TOOLS}.
 */
export const AI_TOOL_NAMES = extractToolNames(AI_TOOLS);
/**
 * OpenAI tool definitions for querying and controlling Harbor app state.
 */
export const AI_TOOL_DEFINITIONS = AI_TOOLS.map((tool) => tool.definition);
/**
 * Zod raw shapes for Harbor AI tools, keyed by tool name for MCP registration.
 */
const AI_TOOL_INPUT_SHAPES = Object.fromEntries(
  AI_TOOLS.map((tool) => [tool.name, tool.inputShape])
);
/**
 * Returns the Zod raw shape for a Harbor AI tool's MCP input schema.
 *
 * @param name - Harbor AI tool name.
 * @returns Zod raw shape used when registering the tool on the MCP server.
 */
export function getAiToolInputShape(name) {
  return AI_TOOL_INPUT_SHAPES[name];
}
//# sourceMappingURL=index.js.map
