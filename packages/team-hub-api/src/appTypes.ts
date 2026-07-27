/**
 * Supported HTTP methods for saved and live requests.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Request body content type.
 */
export type BodyType = 'none' | 'json' | 'text' | 'multipart' | 'urlencoded';

/**
 * A key-value pair with an enable toggle for headers and query params.
 */
export interface KeyValue {
  /**
   * Header or query parameter name.
   */
  key: string;

  /**
   * Header or query parameter value.
   */
  value: string;

  /**
   * When false, the pair is ignored when building the request.
   */
  enabled: boolean;
}

/**
 * A collection-scoped variable for use in request URLs via {{key}} syntax.
 */
export interface Variable {
  /**
   * Variable name referenced in {{key}} placeholders.
   */
  key: string;

  /**
   * Value substituted when the variable is resolved.
   */
  value: string;

  /**
   * Fallback value used when value is empty.
   */
  defaultValue: string;

  /**
   * When true, value is included in collection exports.
   */
  share: boolean;
}

/**
 * Supported LLM providers for the OpenAI SDK compatibility layer.
 */
export type LlmProvider = 'openai' | 'claude' | 'gemini';

/**
 * Role of a message in an LLM completion step (includes tool roles).
 */
export type ChatStepMessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Serializable tool call returned from a completion step.
 */
export interface ChatToolCall {
  /**
   * Tool call id from the model.
   */
  id: string;

  /**
   * Tool function name.
   */
  name: string;

  /**
   * JSON-encoded tool arguments.
   */
  arguments: string;
}

/**
 * Serializable message passed to a single LLM completion step.
 */
export interface ChatStepMessage {
  /**
   * OpenAI-compatible message role.
   */
  role: ChatStepMessageRole;

  /**
   * Text content for user, assistant, tool, or system messages.
   */
  content?: string | null;

  /**
   * Tool calls requested by the assistant.
   */
  tool_calls?: ChatToolCall[];

  /**
   * Tool call id this tool message responds to.
   */
  tool_call_id?: string;

  /**
   * Tool name for tool role messages (optional).
   */
  name?: string;
}

/**
 * One LLM model offered by a Team Hub.
 */
export interface HubLlmModel {
  /**
   * Provider-specific model id.
   */
  id: string;

  /**
   * Human-readable label from the hub.
   */
  label: string;

  /**
   * LLM provider that owns this model.
   */
  provider: LlmProvider;
}

/**
 * Hub LLM capability flags advertised by GET /llm/models.
 */
export interface HubLlmCapabilities {
  /**
   * When true, the hub has an OpenAI provider key configured for embeddings and OpenAI models.
   */
  openai: boolean;
}

/**
 * Response body for GET /llm/models and GET /admin/llm/models.
 */
export interface ListHubLlmModelsResponse {
  /**
   * Models the authenticated user or admin may assign or use.
   */
  models: HubLlmModel[];

  /**
   * Hub-level LLM infrastructure capabilities.
   */
  capabilities: HubLlmCapabilities;
}

/**
 * Result of one LLM completion step.
 */
export interface ChatStepResult {
  /**
   * Assistant text when the model finishes without tool calls.
   */
  content: string | null;

  /**
   * Tool calls to execute in the renderer when present.
   */
  toolCalls?: ChatToolCall[];
}

/**
 * Authorization type for the Auth tab; none inherits collection auth at send time.
 */
export type AuthType = 'none' | 'basic' | 'bearer' | 'oauth2';

/**
 * How OAuth client credentials are sent to the token endpoint.
 */
export type OAuth2ClientAuth = 'body' | 'header';

/**
 * OAuth 2.0 Client Credentials configuration stored on requests and collections.
 */
export interface OAuth2Config {
  /**
   * Token endpoint URL.
   */
  tokenUrl: string;

  /**
   * OAuth client id.
   */
  clientId: string;

  /**
   * OAuth client secret.
   */
  clientSecret: string;

  /**
   * Space-delimited OAuth scopes.
   */
  scope: string;

  /**
   * Optional audience claim for token requests.
   */
  audience: string;

  /**
   * Whether client credentials are sent in the POST body or as HTTP Basic auth.
   */
  clientAuth: OAuth2ClientAuth;
}

/**
 * Basic and bearer credential fields stored together so switching type preserves values.
 */
export interface AuthConfig {
  /**
   * Selected auth mode; none means no request-level override.
   */
  type: AuthType;

  /**
   * Username and password for Basic Auth.
   */
  basic: {
    username: string;
    password: string;
  };

  /**
   * Token value for Bearer Token auth.
   */
  bearer: {
    token: string;
  };

  /**
   * OAuth 2.0 Client Credentials settings.
   */
  oauth2: OAuth2Config;
}

/**
 * Returns empty OAuth 2.0 Client Credentials fields.
 *
 * @returns Default OAuth2Config for new auth configs.
 */
export function defaultOAuth2Config(): OAuth2Config {
  return {
    tokenUrl: '',
    clientId: '',
    clientSecret: '',
    scope: '',
    audience: '',
    clientAuth: 'body'
  };
}

/**
 * Returns a default auth config with type none and empty credentials.
 *
 * @returns Empty AuthConfig safe for new requests and collections.
 */
export function defaultAuth(): AuthConfig {
  return {
    type: 'none',
    basic: { username: '', password: '' },
    bearer: { token: '' },
    oauth2: defaultOAuth2Config()
  };
}

/**
 * Normalizes a partial or legacy auth value from storage into a full AuthConfig.
 *
 * @param value - Parsed JSON or unknown field from the database.
 * @returns Valid AuthConfig with defaults for missing fields.
 */
export function normalizeAuth(value: unknown): AuthConfig {
  const fallback = defaultAuth();
  if (value == null || typeof value !== 'object') {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const type =
    record.type === 'basic' ||
    record.type === 'bearer' ||
    record.type === 'oauth2' ||
    record.type === 'none'
      ? record.type
      : fallback.type;

  const basicRecord =
    record.basic != null && typeof record.basic === 'object'
      ? (record.basic as Record<string, unknown>)
      : {};
  const bearerRecord =
    record.bearer != null && typeof record.bearer === 'object'
      ? (record.bearer as Record<string, unknown>)
      : {};
  const oauth2Record =
    record.oauth2 != null && typeof record.oauth2 === 'object'
      ? (record.oauth2 as Record<string, unknown>)
      : {};

  return {
    type,
    basic: {
      username: typeof basicRecord.username === 'string' ? basicRecord.username : '',
      password: typeof basicRecord.password === 'string' ? basicRecord.password : ''
    },
    bearer: {
      token: typeof bearerRecord.token === 'string' ? bearerRecord.token : ''
    },
    oauth2: {
      tokenUrl: typeof oauth2Record.tokenUrl === 'string' ? oauth2Record.tokenUrl : '',
      clientId: typeof oauth2Record.clientId === 'string' ? oauth2Record.clientId : '',
      clientSecret: typeof oauth2Record.clientSecret === 'string' ? oauth2Record.clientSecret : '',
      scope: typeof oauth2Record.scope === 'string' ? oauth2Record.scope : '',
      audience: typeof oauth2Record.audience === 'string' ? oauth2Record.audience : '',
      clientAuth: oauth2Record.clientAuth === 'header' ? 'header' : 'body'
    }
  };
}
