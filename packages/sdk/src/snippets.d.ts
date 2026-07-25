/**
 * Ambient globals for HarborClient request/post-request scripts and snippet `.js` files.
 *
 * Enable in your editor with:
 *
 * ```ts
 * /// <reference types="@harborclient/sdk/snippets" />
 * ```
 *
 * Keep in sync with the runtime hc sandbox in harborclient
 * `src/main/scripting/scriptApi.ts` and editor completions in
 * `src/renderer/src/scripting/hcCompletions.ts`.
 *
 * **Import and export** — scripts or snippets whose **Name** ends in `.js` (for example
 * `pass-testing.js`, `before.js`, or `utils/helpers.js`) may be imported from scripts with
 * relative ESM paths: `import { fn } from './pass-testing.js'`. Import targets include
 * the snippet library and inline scripts in the same request and collection. Use standard
 * `export function`, `export const`, and `export default` in module source.
 * Cross-module imports are resolved at send time in HarborClient; the SDK does
 * not type-check import paths between snippet or inline script files.
 *
 * **Not supported:** npm package imports, `require`, and Node.js built-ins.
 * See [Request scripts — Snippets](https://harborclient.com/scripting#snippets).
 *
 * `hc.expect` is Chai BDD expect — see https://www.chaijs.com/api/bdd/
 * `hc.response.to` provides Postman-style response matchers.
 */

/// <reference types="chai" />

/** Chai BDD expect factory type for hc.expect. */
type HcExpectStatic = typeof import('chai').expect;

/**
 * Header helpers on hc.request.headers and hc.collection.headers.
 */
interface HcHeaderApi {
  /**
   * Returns the first enabled header value for key (case-insensitive), or undefined.
   */
  get(key: string): string | undefined;

  /**
   * Sets an existing header or appends a new enabled row.
   */
  upsert(key: string, value: string): void;

  /**
   * Returns enabled headers as a flat key/value map.
   */
  toObject(): Record<string, string>;
}

/**
 * Variable bag helpers shared by hc.collection.variables, hc.environment.variables, and hc.globals.
 */
interface HcVariableBagApi {
  /**
   * Returns a variable value, preferring values set in the current script run.
   */
  get(key: string): string | undefined;

  /**
   * Sets a variable for the remainder of the script run.
   */
  set(key: string, value: unknown): void;

  /**
   * Removes a single key from this scope for the remainder of the script run.
   */
  clear(key: string): void;
}

/**
 * Request-scoped variable helpers on hc.request.variables.
 */
interface HcRequestVariablesApi extends HcVariableBagApi {
  /**
   * Replaces {{variable}} tokens and dynamic $ tokens in a template string.
   */
  replaceIn(template: unknown): string;
}

/**
 * Auth type selector for hc.request.auth and hc.collection.auth.
 */
type HcAuthType = 'none' | 'basic' | 'bearer' | 'oauth2';

/**
 * OAuth client credential transport for hc.*.auth when type is oauth2.
 */
type HcOAuth2ClientAuth = 'header' | 'body';

/**
 * Flat auth field names accepted by hc.*.auth.update().
 */
type HcAuthField =
  | 'type'
  | 'token'
  | 'username'
  | 'password'
  | 'tokenUrl'
  | 'clientId'
  | 'clientSecret'
  | 'scope'
  | 'audience'
  | 'clientAuth';

/**
 * Partial flat auth object accepted by hc.request.auth.set() and hc.collection.auth.set().
 *
 * Merges onto the current auth configuration; switching type preserves stored
 * credentials for other types.
 */
interface HcAuthInput {
  type?: HcAuthType;
  token?: string;
  username?: string;
  password?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  audience?: string;
  clientAuth?: HcOAuth2ClientAuth;
}

/**
 * Flat auth shape returned by hc.request.auth.get() and hc.collection.auth.get().
 *
 * Includes only fields relevant to the active auth type.
 */
type HcAuthSnapshot =
  | { type: 'none' }
  | { type: 'basic'; username: string; password: string }
  | { type: 'bearer'; token: string }
  | {
      type: 'oauth2';
      tokenUrl: string;
      clientId: string;
      clientSecret: string;
      scope: string;
      audience: string;
      clientAuth: HcOAuth2ClientAuth;
    };

/**
 * Auth helpers on hc.request.auth and hc.collection.auth.
 *
 * Request auth changes apply to the current send only. Collection auth changes
 * persist to the collection when the send completes.
 */
interface HcAuthApi {
  /**
   * Returns the active auth fields as a flat object for the current auth type.
   */
  get(): HcAuthSnapshot;

  /**
   * Merges auth configuration from a partial flat auth object.
   */
  set(input: HcAuthInput): void;

  /**
   * Updates a single flat auth field, such as type or token.
   */
  update(field: HcAuthField, value: unknown): void;
}

/**
 * Cookie bag for the request host resolved at send start.
 * URL changes mid-script do not retarget this bag.
 */
interface HcCookieApi {
  /**
   * Returns a cookie value by name, preferring values set in the current script run.
   */
  get(name: string): string | undefined;

  /**
   * Sets a cookie for the request host for the remainder of the script run.
   */
  set(name: string, value: unknown): void;

  /**
   * Removes a single cookie by name for the remainder of the script run.
   */
  clear(name: string): void;
}

/**
 * Collection runner flow control available in pre/post scripts during a run.
 */
interface HcExecutionApi {
  /**
   * Jumps to the named request in the active collection run, or stops the run when null.
   */
  setNextRequest(name: string | null): void;

  /**
   * Skips the HTTP send and post-request scripts for the current request.
   */
  skipRequest(): void;
}

/**
 * Postman-compatible script execution metadata (pm.info equivalent).
 */
interface HcInfoApi {
  /** `"prerequest"` for pre-request scripts, `"test"` for post-request scripts. */
  readonly eventName: 'prerequest' | 'test';
  /** Display name of the saved request. */
  readonly requestName: string;
  /** Saved request database id as a string, or empty when unsaved. */
  readonly requestId: string;
  /** Collection run iteration index; 0 for manual sends and non-data-driven runs. */
  readonly iteration: number;
}

/**
 * Outbound request payload accepted by hc.sendRequest.
 */
interface HcSendRequestInput {
  method?: string;
  url: string;
  headers?: Array<{ key: string; value: string; enabled?: boolean }> | Record<string, string>;
  params?: Array<{ key: string; value: string; enabled?: boolean }>;
  body?: string;
  bodyType?: 'none' | 'json' | 'text' | 'multipart' | 'urlencoded';
  body_type?: 'none' | 'json' | 'text' | 'multipart' | 'urlencoded';
}

/**
 * Response snapshot returned by hc.sendRequest.
 */
interface HcSendRequestResponse {
  readonly code: number;
  readonly status: string;
  readonly headers: Record<string, string>;
  readonly responseTime: number;
  text(): string;
  json(): unknown;
}

/**
 * Element surface exposed by hc.response.document() for HTML bodies.
 */
interface HcResponseElement {
  textContent: string;
  getAttribute(name: string): string | null;
  innerHTML: string;
}

/**
 * Document surface backed by Cheerio for querying HTML response bodies.
 */
interface HcResponseDocument {
  querySelector(selector: string): HcResponseElement | null;
  querySelectorAll(selector: string): HcResponseElement[];
}

/**
 * Response snapshot available in post-request scripts as hc.response.
 */
interface HcResponseAssertionHave {
  status(codeOrText: number | string): void;
  header(name: string): void;
  header(name: string, value: string): void;
  body(): void;
  body(expected: string | RegExp): void;
  jsonBody(): void;
  jsonBody(expected: object): void;
}

/**
 * Status-class and body shortcuts on hc.response.to.be.*.
 */
interface HcResponseAssertionBe {
  readonly success: void;
  readonly redirection: void;
  readonly clientError: void;
  readonly serverError: void;
  readonly error: void;
  readonly ok: void;
  readonly accepted: void;
  readonly badRequest: void;
  readonly unauthorized: void;
  readonly forbidden: void;
  readonly notFound: void;
  readonly rateLimited: void;
  readonly json: void;
  readonly withBody: void;
}

/**
 * Chai assertion chain for Postman-style hc.response.to.* matchers.
 * Extends Chai.Assertion so generic matchers (equal, eql, include, …) type-check too.
 */
interface HcResponseAssertion extends Chai.Assertion {
  readonly have: HcResponseAssertionHave & Chai.Assertion;
  readonly be: HcResponseAssertionBe & Chai.Assertion;
  readonly not: HcResponseAssertion;
}

/**
 * Response snapshot available in post-request scripts as hc.response.
 */
interface HcResponseApi {
  readonly code: number;
  readonly status: string;
  readonly headers: Record<string, string>;
  readonly responseTime: number;
  /** Postman-style response assertions (hc.response.to.have.status(200), etc.). */
  readonly to: HcResponseAssertion;
  text(): string;
  json(): unknown;
  document(): HcResponseDocument;
}

/**
 * HarborClient script sandbox API exposed as the global hc object.
 */
interface HcScriptApi {
  request: {
    method: string;
    url: string;
    body: string;
    headers: HcHeaderApi;
    auth: HcAuthApi;
    variables: HcRequestVariablesApi;
  };
  collection: {
    readonly id: number | null;
    readonly name: string;
    variables: HcVariableBagApi;
    headers: HcHeaderApi;
    auth: HcAuthApi;
  };
  environment: {
    readonly name: string;
    variables: HcVariableBagApi;
  };
  globals: HcVariableBagApi;
  cookies: HcCookieApi;
  /**
   * Mutable object shared across scripts in the current send (pre through post).
   * Use for structured ephemeral data; use variable bags for strings and persistence.
   */
  data: Record<string, unknown>;
  execution: HcExecutionApi;
  /** Read-only metadata about the current script run (Postman pm.info equivalent). */
  info: HcInfoApi;
  /**
   * Sends an outbound HTTP request from the script sandbox.
   * Requires Settings → General → Allow script network requests.
   *
   * @throws When the setting is disabled or sendRequest is unavailable in this context.
   */
  sendRequest(req: HcSendRequestInput): Promise<HcSendRequestResponse>;
  test(name: string, fn: () => void): void;
  /** Chai BDD expect; see https://www.chaijs.com/api/bdd/ */
  expect: HcExpectStatic;
  /**
   * Available in post-request scripts after the primary request completes.
   */
  response?: HcResponseApi;
}

/**
 * HarborClient script sandbox API for pre/post request scripts and snippet files.
 */
declare const hc: HcScriptApi;

/**
 * Capturing console available inside request/post-request script sandboxes.
 */
declare const console: {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
};
