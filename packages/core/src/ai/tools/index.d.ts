import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { z } from 'zod';
import type { UpdateActiveRequestToolArgs } from '../requestUpdate';
export type { UpdateActiveRequestToolArgs };
export type { ITool } from './ITool';
export { AI_SYSTEM_PROMPT } from './systemPrompt';
export type { CreateCollectionRequestRow, CreateSavedRequestKeyValue, GetSidebarItemByUuidToolArgs } from './types';
export type { CreateCollectionToolArgs } from './createCollection';
export type { CreateFolderToolArgs } from './createFolder';
export type { CreateRequestToolArgs } from './createRequest';
export type { GetActiveResponseToolArgs } from './getActiveResponse';
export type { GetActiveTerminalLinesToolArgs } from './getActiveTerminalLines';
export type { GetMarkdownDocumentToolArgs } from './getMarkdownDocument';
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
export type { TerminalExecToolArgs } from './terminalExec';
export type { UpdateRequestScriptToolArgs } from './updateRequestScript';
/**
 * Ordered registry of every Harbor AI agent tool.
 *
 * Order matches the historical `AI_TOOL_NAMES` / `AI_TOOL_DEFINITIONS` sequence
 * so consumers that iterate tools keep stable ordering.
 */
export declare const AI_TOOLS: readonly [{
    readonly name: "get_selected_collection";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_selected_collection";
            readonly description: "Returns the collection currently selected in the sidebar, or null when none is selected.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {};
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {};
}, {
    readonly name: "list_collections";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "list_collections";
            readonly description: "Lists all collections with configuration (variables, headers, auth, scripts), storage metadata (uuid, storageType, isGitBacked, connectionId), and whether each is selected.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {};
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {};
}, {
    readonly name: "get_collection";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_collection";
            readonly description: "Returns one collection by uuid with full configuration (variables, headers, auth, scripts). Use when the user message contains @collection.<uuid>. Use the uuid only for this tool call; refer to the collection by its returned name in replies.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly uuid: {
                        readonly type: "string";
                        readonly description: "Collection uuid from the @collection reference.";
                    };
                };
                readonly required: readonly ["uuid"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly uuid: z.ZodString;
    };
}, {
    readonly name: "list_requests";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "list_requests";
            readonly description: "Lists saved requests in a collection by id.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly collectionId: {
                        readonly type: "number";
                        readonly description: "Collection id to list requests for.";
                    };
                };
                readonly required: readonly ["collectionId"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly collectionId: z.ZodNumber;
    };
}, {
    readonly name: "get_folder";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_folder";
            readonly description: "Returns one folder by uuid with variables, headers, auth, and scripts. Use when the user message contains @folder.<uuid>. Use the uuid only for this tool call; refer to the folder by its returned name in replies.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly uuid: {
                        readonly type: "string";
                        readonly description: "Folder uuid from the @folder reference.";
                    };
                };
                readonly required: readonly ["uuid"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly uuid: z.ZodString;
    };
}, {
    readonly name: "get_request";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_request";
            readonly description: "Returns one saved request by uuid with method, url, headers, params, body, auth, and scripts. Use when the user message contains @request.<uuid>. Use the uuid only for this tool call; refer to the request by its returned name in replies.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly uuid: {
                        readonly type: "string";
                        readonly description: "Saved request uuid from the @request reference.";
                    };
                };
                readonly required: readonly ["uuid"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly uuid: z.ZodString;
    };
}, {
    readonly name: "list_environments";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "list_environments";
            readonly description: "Lists all environments with variables and which one is active.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {};
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {};
}, {
    readonly name: "get_sidebar_request";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_sidebar_request";
            readonly description: "Returns the saved request highlighted in the sidebar (from the active editor tab), or null when the tab is unsaved.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {};
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {};
}, {
    readonly name: "get_active_request";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_active_request";
            readonly description: "Returns summary info for the request open in the editor pane (tab id, method, url, dirty state).";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {};
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {};
}, {
    readonly name: "get_active_request_details";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_active_request_details";
            readonly description: "Returns the full draft of the active editor request (headers, params, body, auth, scripts, cookies). Includes pre_request_scripts and post_request_scripts arrays with 1-based index, name, kind (inline or snippet), and resolved source code for each script row. For multipart and urlencoded bodies, also returns body_raw (verbatim override or null), body_raw_open (drawer state), and body_raw_effective (the wire text that will be sent — the override when set, otherwise a projection from structured rows).";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {};
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {};
}, {
    readonly name: "get_active_response_summary";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_active_response_summary";
            readonly description: "Returns a compact summary of the last HTTP response for the active tab (status, headers, short body preview, tests), or null. Prefer this before fetching the full body.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {};
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {};
}, {
    readonly name: "get_active_response";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_active_response";
            readonly description: "Returns the last HTTP response for the active tab with a capped body (status, headers, body, tests), or null. Use get_active_response_summary first; pass maxBodyChars only when more body text is needed.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly maxBodyChars: {
                        readonly type: "number";
                        readonly description: "Maximum response body characters to return; defaults to 16384.";
                    };
                };
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly maxBodyChars: z.ZodOptional<z.ZodNumber>;
    };
}, {
    readonly name: "query_response_body";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "query_response_body";
            readonly description: "Evaluates a JMESPath expression against the JSON response body of the last HTTP response for the active tab and returns a small structured result. Prefer this for counting items, extracting fields, or checking values without loading the full body. Examples: length(@), length(data.items), data.users[*].id, keys(@).";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly expression: {
                        readonly type: "string";
                        readonly description: "JMESPath expression to evaluate against the JSON response body.";
                    };
                    readonly maxResultChars: {
                        readonly type: "number";
                        readonly description: "Maximum stringified result characters to return; defaults to 4000.";
                    };
                };
                readonly required: readonly ["expression"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly expression: z.ZodString;
        readonly maxResultChars: z.ZodOptional<z.ZodNumber>;
    };
}, {
    readonly name: "send_active_request";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "send_active_request";
            readonly description: "Sends the HTTP request in the active editor tab (equivalent to clicking Send). Returns a compact response summary by default (status, headers, short body preview, tests). Pass maxBodyChars only when you need a capped full body in the same turn; otherwise call get_active_response afterward.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly maxBodyChars: {
                        readonly type: "number";
                        readonly description: "Optional. When provided and greater than zero, includes a capped response body; otherwise only a summary preview is returned.";
                    };
                };
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly maxBodyChars: z.ZodOptional<z.ZodNumber>;
    };
}, {
    readonly name: "set_active_environment";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "set_active_environment";
            readonly description: "Sets the global active environment by id or name. Pass environmentId null to clear the active environment.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly environmentId: {
                        readonly type: readonly ["number", "null"];
                        readonly description: "Environment id to activate, or null for no environment.";
                    };
                    readonly name: {
                        readonly type: "string";
                        readonly description: "Environment name to resolve when environmentId is omitted.";
                    };
                };
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly environmentId: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>>;
        readonly name: z.ZodOptional<z.ZodString>;
    };
}, {
    readonly name: "update_active_request";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "update_active_request";
            readonly description: "Modifies the request open in the editor (method, URL, params, headers, body, auth, pre/post scripts, cookies). Call get_active_request_details first when you need current values. For multipart/urlencoded, use body for structured JSON rows and body_raw for the verbatim Raw body drawer text (authoritative at send time, including intentionally invalid bodies). Pass body_raw: null to clear the raw override. Use HarborClient hc API in scripts, not Postman pm (hc.data for passing values between scripts in one send; hc.request.variables/collection.variables/environment.variables/globals with get/set/clear for persisted variables; hc.cookies, hc.execution.setNextRequest/skipRequest, await hc.sendRequest when enabled in Settings → General). Changes appear in the editor immediately but are not saved until the user saves.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly name: {
                        readonly type: "string";
                        readonly description: "Display name for the request.";
                    };
                    readonly method: {
                        readonly type: "string";
                        readonly enum: readonly ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
                        readonly description: "HTTP method for the request.";
                    };
                    readonly url: {
                        readonly type: "string";
                        readonly description: "Request URL. When changed without params, the params table syncs from the query string.";
                    };
                    readonly body: {
                        readonly type: "string";
                        readonly description: "Request body content. For multipart/urlencoded this is JSON-serialized structured rows; prefer body_raw when editing the Raw body drawer.";
                    };
                    readonly body_type: {
                        readonly type: "string";
                        readonly enum: readonly ["none", "json", "text", "multipart", "urlencoded"];
                        readonly description: "Content type of the request body.";
                    };
                    readonly body_raw: {
                        readonly type: readonly ["string", "null"];
                        readonly description: "Verbatim Raw body override for multipart/urlencoded. Sets the wire text sent as-is and best-effort syncs structured rows. Pass null to clear the override.";
                    };
                    readonly pre_request_script: {
                        readonly type: "string";
                        readonly description: "JavaScript run before the request is sent.";
                    };
                    readonly pre_request_script_mode: {
                        readonly type: "string";
                        readonly enum: readonly ["replace", "append"];
                        readonly description: "How to apply pre_request_script; defaults to replace.";
                    };
                    readonly post_request_script: {
                        readonly type: "string";
                        readonly description: "JavaScript run after the response is received.";
                    };
                    readonly post_request_script_mode: {
                        readonly type: "string";
                        readonly enum: readonly ["replace", "append"];
                        readonly description: "How to apply post_request_script; defaults to replace.";
                    };
                    readonly comment: {
                        readonly type: "string";
                        readonly description: "Free-form notes for the request.";
                    };
                    readonly headers: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "object";
                            readonly properties: {
                                readonly key: {
                                    readonly type: "string";
                                    readonly description: "Header, param, or cookie name.";
                                };
                                readonly value: {
                                    readonly type: "string";
                                    readonly description: "Header, param, or cookie value.";
                                };
                                readonly enabled: {
                                    readonly type: "boolean";
                                    readonly description: "Whether the row is active; defaults to true when omitted.";
                                };
                            };
                            readonly required: readonly ["key", "value"];
                            readonly additionalProperties: false;
                        };
                        readonly description: "Request headers to merge or replace.";
                    };
                    readonly headers_mode: {
                        readonly type: "string";
                        readonly enum: readonly ["merge", "replace"];
                        readonly description: "How to apply headers; defaults to merge.";
                    };
                    readonly params: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "object";
                            readonly properties: {
                                readonly key: {
                                    readonly type: "string";
                                    readonly description: "Header, param, or cookie name.";
                                };
                                readonly value: {
                                    readonly type: "string";
                                    readonly description: "Header, param, or cookie value.";
                                };
                                readonly enabled: {
                                    readonly type: "boolean";
                                    readonly description: "Whether the row is active; defaults to true when omitted.";
                                };
                            };
                            readonly required: readonly ["key", "value"];
                            readonly additionalProperties: false;
                        };
                        readonly description: "Query params to merge or replace.";
                    };
                    readonly params_mode: {
                        readonly type: "string";
                        readonly enum: readonly ["merge", "replace"];
                        readonly description: "How to apply params; defaults to merge.";
                    };
                    readonly auth: {
                        readonly type: "object";
                        readonly properties: {
                            readonly type: {
                                readonly type: "string";
                                readonly enum: readonly ["none", "basic", "bearer"];
                                readonly description: "Selected auth mode.";
                            };
                            readonly basic: {
                                readonly type: "object";
                                readonly properties: {
                                    readonly username: {
                                        readonly type: "string";
                                    };
                                    readonly password: {
                                        readonly type: "string";
                                    };
                                };
                                readonly additionalProperties: false;
                            };
                            readonly bearer: {
                                readonly type: "object";
                                readonly properties: {
                                    readonly token: {
                                        readonly type: "string";
                                    };
                                };
                                readonly additionalProperties: false;
                            };
                        };
                        readonly additionalProperties: false;
                        readonly description: "Partial auth settings patch.";
                    };
                    readonly cookies: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "object";
                            readonly properties: {
                                readonly key: {
                                    readonly type: "string";
                                    readonly description: "Header, param, or cookie name.";
                                };
                                readonly value: {
                                    readonly type: "string";
                                    readonly description: "Header, param, or cookie value.";
                                };
                                readonly enabled: {
                                    readonly type: "boolean";
                                    readonly description: "Whether the row is active; defaults to true when omitted.";
                                };
                            };
                            readonly required: readonly ["key", "value"];
                            readonly additionalProperties: false;
                        };
                        readonly description: "Cookies for the request host; stored in the cookie jar for the URL hostname.";
                    };
                    readonly cookies_mode: {
                        readonly type: "string";
                        readonly enum: readonly ["merge", "replace"];
                        readonly description: "How to apply cookies; defaults to merge.";
                    };
                };
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly name: z.ZodOptional<z.ZodString>;
        readonly method: z.ZodOptional<z.ZodEnum<{
            GET: "GET";
            POST: "POST";
            PUT: "PUT";
            PATCH: "PATCH";
            DELETE: "DELETE";
            HEAD: "HEAD";
            OPTIONS: "OPTIONS";
        }>>;
        readonly url: z.ZodOptional<z.ZodString>;
        readonly body: z.ZodOptional<z.ZodString>;
        readonly body_type: z.ZodOptional<z.ZodEnum<{
            none: "none";
            text: "text";
            json: "json";
            multipart: "multipart";
            urlencoded: "urlencoded";
        }>>;
        readonly body_raw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        readonly pre_request_script: z.ZodOptional<z.ZodString>;
        readonly pre_request_script_mode: z.ZodOptional<z.ZodEnum<{
            replace: "replace";
            append: "append";
        }>>;
        readonly post_request_script: z.ZodOptional<z.ZodString>;
        readonly post_request_script_mode: z.ZodOptional<z.ZodEnum<{
            replace: "replace";
            append: "append";
        }>>;
        readonly comment: z.ZodOptional<z.ZodString>;
        readonly headers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>;
        readonly headers_mode: z.ZodOptional<z.ZodEnum<{
            replace: "replace";
            merge: "merge";
        }>>;
        readonly params: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>;
        readonly params_mode: z.ZodOptional<z.ZodEnum<{
            replace: "replace";
            merge: "merge";
        }>>;
        readonly auth: z.ZodOptional<z.ZodObject<{
            type: z.ZodOptional<z.ZodEnum<{
                none: "none";
                basic: "basic";
                bearer: "bearer";
            }>>;
            basic: z.ZodOptional<z.ZodObject<{
                username: z.ZodOptional<z.ZodString>;
                password: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            bearer: z.ZodOptional<z.ZodObject<{
                token: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        readonly cookies: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>;
        readonly cookies_mode: z.ZodOptional<z.ZodEnum<{
            replace: "replace";
            merge: "merge";
        }>>;
    };
}, {
    readonly name: "update_request_script";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "update_request_script";
            readonly description: "Updates a specific pre- or post-request script in the active editor request by 1-based index. Use when the user message contains @<request-id>.<pre|post>.<script-index> (for example @42.pre.3 or @active.post.1), optionally with #<start>.<end> character offsets into that script source to highlight the selected region. Only inline scripts can be edited; snippet-linked scripts must be reported to the user. Changes update the editor draft only until the user saves.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly requestId: {
                        readonly oneOf: readonly [{
                            readonly type: "number";
                        }, {
                            readonly type: "string";
                            readonly enum: readonly ["active"];
                        }];
                        readonly description: "Saved request id from the @ reference, or \"active\" when the tab is unsaved.";
                    };
                    readonly phase: {
                        readonly type: "string";
                        readonly enum: readonly ["pre", "post"];
                        readonly description: "Script phase: pre-request (pre) or post-request (post).";
                    };
                    readonly scriptIndex: {
                        readonly type: "number";
                        readonly description: "1-based index of the script in the phase array.";
                    };
                    readonly code: {
                        readonly type: "string";
                        readonly description: "JavaScript source to apply to the script.";
                    };
                    readonly mode: {
                        readonly type: "string";
                        readonly enum: readonly ["replace", "append"];
                        readonly description: "How to apply code; defaults to replace.";
                    };
                };
                readonly required: readonly ["requestId", "phase", "scriptIndex", "code"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly requestId: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"active">]>;
        readonly phase: z.ZodEnum<{
            pre: "pre";
            post: "post";
        }>;
        readonly scriptIndex: z.ZodNumber;
        readonly code: z.ZodString;
        readonly mode: z.ZodOptional<z.ZodEnum<{
            replace: "replace";
            append: "append";
        }>>;
    };
}, {
    readonly name: "create_collection";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "create_collection";
            readonly description: "Creates a new collection and optionally saves requests inside it. Persists immediately to storage and selects the collection in the sidebar. Use when the user asks to create a new collection or scaffold API requests in a new collection. Each request row may include an optional folder name; folders are created automatically.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly name: {
                        readonly type: "string";
                        readonly description: "Display name for the new collection.";
                    };
                    readonly requests: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "object";
                            readonly properties: {
                                readonly name: {
                                    readonly type: "string";
                                    readonly description: "Display name for the saved request.";
                                };
                                readonly method: {
                                    readonly type: "string";
                                    readonly description: "HTTP method (for example GET or POST).";
                                };
                                readonly url: {
                                    readonly type: "string";
                                    readonly description: "Request URL.";
                                };
                                readonly folder: {
                                    readonly type: "string";
                                    readonly description: "Optional folder name within the new collection.";
                                };
                                readonly headers: {
                                    readonly description: "Optional headers as a flat object or key-value rows.";
                                    readonly oneOf: readonly [{
                                        readonly type: "object";
                                        readonly additionalProperties: {
                                            readonly type: "string";
                                        };
                                    }, {
                                        readonly type: "array";
                                        readonly items: {
                                            readonly type: "object";
                                            readonly properties: {
                                                readonly key: {
                                                    readonly type: "string";
                                                    readonly description: "Header, param, or cookie name.";
                                                };
                                                readonly value: {
                                                    readonly type: "string";
                                                    readonly description: "Header, param, or cookie value.";
                                                };
                                                readonly enabled: {
                                                    readonly type: "boolean";
                                                    readonly description: "Whether the row is active; defaults to true when omitted.";
                                                };
                                            };
                                            readonly required: readonly ["key", "value"];
                                            readonly additionalProperties: false;
                                        };
                                    }];
                                };
                                readonly params: {
                                    readonly type: "array";
                                    readonly items: {
                                        readonly type: "object";
                                        readonly properties: {
                                            readonly key: {
                                                readonly type: "string";
                                                readonly description: "Header, param, or cookie name.";
                                            };
                                            readonly value: {
                                                readonly type: "string";
                                                readonly description: "Header, param, or cookie value.";
                                            };
                                            readonly enabled: {
                                                readonly type: "boolean";
                                                readonly description: "Whether the row is active; defaults to true when omitted.";
                                            };
                                        };
                                        readonly required: readonly ["key", "value"];
                                        readonly additionalProperties: false;
                                    };
                                    readonly description: "Optional query params.";
                                };
                                readonly body: {
                                    readonly type: "string";
                                    readonly description: "Optional request body content.";
                                };
                                readonly bodyType: {
                                    readonly type: "string";
                                    readonly enum: readonly ["none", "json", "text", "multipart", "urlencoded"];
                                    readonly description: "Optional body content type.";
                                };
                                readonly comment: {
                                    readonly type: "string";
                                    readonly description: "Optional free-form notes for the request.";
                                };
                            };
                            readonly required: readonly ["name", "method", "url"];
                            readonly additionalProperties: false;
                        };
                        readonly description: "Saved requests to create inside the collection.";
                    };
                };
                readonly required: readonly ["name"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly name: z.ZodString;
        readonly requests: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            method: z.ZodString;
            url: z.ZodString;
            folder: z.ZodOptional<z.ZodString>;
            headers: z.ZodOptional<z.ZodUnion<readonly [z.ZodRecord<z.ZodString, z.ZodString>, z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                value: z.ZodString;
                enabled: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>]>>;
            params: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                value: z.ZodString;
                enabled: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>>;
            body: z.ZodOptional<z.ZodString>;
            bodyType: z.ZodOptional<z.ZodEnum<{
                none: "none";
                text: "text";
                json: "json";
                multipart: "multipart";
                urlencoded: "urlencoded";
            }>>;
            comment: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    };
}, {
    readonly name: "create_folder";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "create_folder";
            readonly description: "Creates a folder inside an existing collection. Persists immediately. Use list_collections or get_collection first when you need the collection id.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly collectionId: {
                        readonly type: "number";
                        readonly description: "Collection id that will own the new folder.";
                    };
                    readonly name: {
                        readonly type: "string";
                        readonly description: "Display name for the new folder.";
                    };
                };
                readonly required: readonly ["collectionId", "name"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly collectionId: z.ZodNumber;
        readonly name: z.ZodString;
    };
}, {
    readonly name: "create_request";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "create_request";
            readonly description: "Creates a saved request in an existing collection or folder. Persists immediately without opening an editor tab. Use create_folder first when the target folder does not exist yet.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly collectionId: {
                        readonly type: "number";
                        readonly description: "Collection id that will own the new saved request.";
                    };
                    readonly name: {
                        readonly type: "string";
                        readonly description: "Display name for the saved request.";
                    };
                    readonly method: {
                        readonly type: "string";
                        readonly enum: readonly ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
                        readonly description: "HTTP method for the request.";
                    };
                    readonly url: {
                        readonly type: "string";
                        readonly description: "Request URL.";
                    };
                    readonly folderId: {
                        readonly type: readonly ["number", "null"];
                        readonly description: "Folder id when the request belongs to a folder; omit for collection root.";
                    };
                    readonly folderName: {
                        readonly type: "string";
                        readonly description: "Folder name to resolve within the collection when folderId is omitted.";
                    };
                    readonly headers: {
                        readonly description: "Optional headers as a flat object or key-value rows.";
                        readonly oneOf: readonly [{
                            readonly type: "object";
                            readonly additionalProperties: {
                                readonly type: "string";
                            };
                        }, {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "object";
                                readonly properties: {
                                    readonly key: {
                                        readonly type: "string";
                                        readonly description: "Header, param, or cookie name.";
                                    };
                                    readonly value: {
                                        readonly type: "string";
                                        readonly description: "Header, param, or cookie value.";
                                    };
                                    readonly enabled: {
                                        readonly type: "boolean";
                                        readonly description: "Whether the row is active; defaults to true when omitted.";
                                    };
                                };
                                readonly required: readonly ["key", "value"];
                                readonly additionalProperties: false;
                            };
                        }];
                    };
                    readonly params: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "object";
                            readonly properties: {
                                readonly key: {
                                    readonly type: "string";
                                    readonly description: "Header, param, or cookie name.";
                                };
                                readonly value: {
                                    readonly type: "string";
                                    readonly description: "Header, param, or cookie value.";
                                };
                                readonly enabled: {
                                    readonly type: "boolean";
                                    readonly description: "Whether the row is active; defaults to true when omitted.";
                                };
                            };
                            readonly required: readonly ["key", "value"];
                            readonly additionalProperties: false;
                        };
                        readonly description: "Optional query params.";
                    };
                    readonly body: {
                        readonly type: "string";
                        readonly description: "Optional request body content.";
                    };
                    readonly bodyType: {
                        readonly type: "string";
                        readonly enum: readonly ["none", "json", "text", "multipart", "urlencoded"];
                        readonly description: "Optional body content type.";
                    };
                    readonly comment: {
                        readonly type: "string";
                        readonly description: "Optional free-form notes for the request.";
                    };
                };
                readonly required: readonly ["collectionId", "name", "method", "url"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly collectionId: z.ZodNumber;
        readonly name: z.ZodString;
        readonly method: z.ZodEnum<{
            GET: "GET";
            POST: "POST";
            PUT: "PUT";
            PATCH: "PATCH";
            DELETE: "DELETE";
            HEAD: "HEAD";
            OPTIONS: "OPTIONS";
        }>;
        readonly url: z.ZodString;
        readonly folderId: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>>;
        readonly folderName: z.ZodOptional<z.ZodString>;
        readonly headers: z.ZodOptional<z.ZodUnion<readonly [z.ZodRecord<z.ZodString, z.ZodString>, z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>]>>;
        readonly params: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>;
        readonly body: z.ZodOptional<z.ZodString>;
        readonly bodyType: z.ZodOptional<z.ZodEnum<{
            none: "none";
            text: "text";
            json: "json";
            multipart: "multipart";
            urlencoded: "urlencoded";
        }>>;
        readonly comment: z.ZodOptional<z.ZodString>;
    };
}, {
    readonly name: "search_docs";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "search_docs";
            readonly description: "Search HarborClient user docs and plugin SDK docs for how features work, usage guides, scripting APIs, plugins, and settings. Returns ranked passages with titles and public URLs.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly query: {
                        readonly type: "string";
                        readonly description: "Natural-language question or keywords to search for in the documentation.";
                    };
                    readonly limit: {
                        readonly type: "number";
                        readonly description: "Maximum number of passages to return; defaults to 5.";
                    };
                    readonly source: {
                        readonly type: "string";
                        readonly enum: readonly ["site", "sdk"];
                        readonly description: "Optional filter: site user docs or sdk plugin development docs.";
                    };
                };
                readonly required: readonly ["query"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly query: z.ZodString;
        readonly limit: z.ZodOptional<z.ZodNumber>;
        readonly source: z.ZodOptional<z.ZodEnum<{
            site: "site";
            sdk: "sdk";
        }>>;
    };
}, {
    readonly name: "get_active_terminal";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_active_terminal";
            readonly description: "Returns summary info for the active footer terminal tab (id, title, 1-based tab index, total output line count, host operating system metadata), or an error when no terminal tab is selected.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {};
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {};
}, {
    readonly name: "get_active_terminal_lines";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_active_terminal_lines";
            readonly description: "Returns a 1-based inclusive line range from the active footer terminal output as plain text. Call get_active_terminal first to see totalLines before requesting a range. Lines are clamped to the available buffer.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly startLine: {
                        readonly type: "number";
                        readonly description: "1-based first line to read (inclusive).";
                    };
                    readonly endLine: {
                        readonly type: "number";
                        readonly description: "1-based last line to read (inclusive).";
                    };
                };
                readonly required: readonly ["startLine", "endLine"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly startLine: z.ZodNumber;
        readonly endLine: z.ZodNumber;
    };
}, {
    readonly name: "terminal_exec";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "terminal_exec";
            readonly description: "Sends raw input to the active footer terminal shell stdin (for example \"cd foo\\n\" to change directory or \"npm test\\n\" to run a command). The terminal panel must be open. Include a trailing newline when executing a command. Use get_active_terminal_lines afterward to read command output. Never use for destructive or irreversible commands (rm, rmdir, dd, git reset --hard, sudo, shutdown, and similar).";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly input: {
                        readonly type: "string";
                        readonly description: "Raw bytes to write to the shell stdin; include \\n at the end when running a command.";
                    };
                };
                readonly required: readonly ["input"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly input: z.ZodString;
    };
}, {
    readonly name: "get_markdown_document";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "get_markdown_document";
            readonly description: "Returns one collection markdown document or saved request comment by uuid with name and markdown content. Use when the user message contains @markdown.<uuid>. Prefer the open editor tab content when the document is being edited. Use the uuid only for this tool call; refer to the document by its returned name in replies.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly uuid: {
                        readonly type: "string";
                        readonly description: "Markdown document or request uuid from the @markdown reference.";
                    };
                };
                readonly required: readonly ["uuid"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly uuid: z.ZodString;
    };
}, {
    readonly name: "git_diff";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "git_diff";
            readonly description: "Returns uncommitted git changes for the HarborClient subdirectory of the repository that contains a collection. Use get_collection or list_collections to find a collection uuid. The diff covers the whole repository working tree for that git connection, not only the referenced collection folder.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly collectionUuid: {
                        readonly type: "string";
                        readonly description: "Collection uuid used to resolve the git-backed repository connection.";
                    };
                    readonly maxFiles: {
                        readonly type: "number";
                        readonly description: "Maximum number of changed files to include; defaults to 40.";
                    };
                    readonly maxCharsPerFile: {
                        readonly type: "number";
                        readonly description: "Maximum characters per file diff excerpt; defaults to 4000.";
                    };
                    readonly maxTotalChars: {
                        readonly type: "number";
                        readonly description: "Maximum total characters across all file excerpts; defaults to 32000.";
                    };
                };
                readonly required: readonly ["collectionUuid"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly collectionUuid: z.ZodString;
        readonly maxFiles: z.ZodOptional<z.ZodNumber>;
        readonly maxCharsPerFile: z.ZodOptional<z.ZodNumber>;
        readonly maxTotalChars: z.ZodOptional<z.ZodNumber>;
    };
}, {
    readonly name: "git_repo_info";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "git_repo_info";
            readonly description: "Returns git repository metadata for a git-backed collection: remote url, repo path, HarborClient data path, branch/status, saved requests and documents with repo-relative paths, and uncommitted changes. Use list_collections or get_collection to find a collection uuid.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly collectionUuid: {
                        readonly type: "string";
                        readonly description: "Collection uuid used to resolve the git-backed repository connection.";
                    };
                };
                readonly required: readonly ["collectionUuid"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly collectionUuid: z.ZodString;
    };
}, {
    readonly name: "git_commits";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "git_commits";
            readonly description: "Returns recent commit history for the git repository that contains a collection. Use list_collections or get_collection to find a collection uuid.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly collectionUuid: {
                        readonly type: "string";
                        readonly description: "Collection uuid used to resolve the git-backed repository connection.";
                    };
                    readonly depth: {
                        readonly type: "number";
                        readonly description: "Maximum number of commits to return; defaults to 20.";
                    };
                };
                readonly required: readonly ["collectionUuid"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly collectionUuid: z.ZodString;
        readonly depth: z.ZodOptional<z.ZodNumber>;
    };
}, {
    readonly name: "git_file_info";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "git_file_info";
            readonly description: "Returns detailed information about one saved request in a git-backed collection, including its repository-relative file path and commit history for that file. Use get_request or list_requests to find request uuids.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly collectionUuid: {
                        readonly type: "string";
                        readonly description: "Collection uuid that owns the request.";
                    };
                    readonly requestUuid: {
                        readonly type: "string";
                        readonly description: "Stable request uuid for the saved request file to inspect.";
                    };
                    readonly depth: {
                        readonly type: "number";
                        readonly description: "Maximum number of commits to include in per-file history; defaults to 20.";
                    };
                };
                readonly required: readonly ["collectionUuid", "requestUuid"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly collectionUuid: z.ZodString;
        readonly requestUuid: z.ZodString;
        readonly depth: z.ZodOptional<z.ZodNumber>;
    };
}, {
    readonly name: "git_file_diff";
    readonly definition: {
        readonly type: "function";
        readonly function: {
            readonly name: "git_file_diff";
            readonly description: "Returns a diff of one saved request file between two commits in a git-backed collection. Use git_commits or git_file_info to find commit object ids.";
            readonly parameters: {
                readonly type: "object";
                readonly properties: {
                    readonly collectionUuid: {
                        readonly type: "string";
                        readonly description: "Collection uuid that owns the request.";
                    };
                    readonly requestUuid: {
                        readonly type: "string";
                        readonly description: "Stable request uuid for the saved request file to diff.";
                    };
                    readonly commitA: {
                        readonly type: "string";
                        readonly description: "Older commit object id (parent side of the diff).";
                    };
                    readonly commitB: {
                        readonly type: "string";
                        readonly description: "Newer commit object id (child side of the diff).";
                    };
                    readonly maxChars: {
                        readonly type: "number";
                        readonly description: "Maximum diff characters to return; defaults to 4000.";
                    };
                };
                readonly required: readonly ["collectionUuid", "requestUuid", "commitA", "commitB"];
                readonly additionalProperties: false;
            };
        };
    };
    readonly inputShape: {
        readonly collectionUuid: z.ZodString;
        readonly requestUuid: z.ZodString;
        readonly commitA: z.ZodString;
        readonly commitB: z.ZodString;
        readonly maxChars: z.ZodOptional<z.ZodNumber>;
    };
}];
/**
 * Names of tools exposed to the AI chat agent, derived from {@link AI_TOOLS}.
 */
export declare const AI_TOOL_NAMES: ["get_selected_collection", "list_collections", "get_collection", "list_requests", "get_folder", "get_request", "list_environments", "get_sidebar_request", "get_active_request", "get_active_request_details", "get_active_response_summary", "get_active_response", "query_response_body", "send_active_request", "set_active_environment", "update_active_request", "update_request_script", "create_collection", "create_folder", "create_request", "search_docs", "get_active_terminal", "get_active_terminal_lines", "terminal_exec", "get_markdown_document", "git_diff", "git_repo_info", "git_commits", "git_file_info", "git_file_diff"];
/**
 * Union of supported AI agent tool names.
 */
export type AiToolName = (typeof AI_TOOL_NAMES)[number];
/**
 * OpenAI tool definitions for querying and controlling Harbor app state.
 */
export declare const AI_TOOL_DEFINITIONS: ChatCompletionTool[];
/**
 * Returns the Zod raw shape for a Harbor AI tool's MCP input schema.
 *
 * @param name - Harbor AI tool name.
 * @returns Zod raw shape used when registering the tool on the MCP server.
 */
export declare function getAiToolInputShape(name: AiToolName): Record<string, z.ZodType>;
//# sourceMappingURL=index.d.ts.map