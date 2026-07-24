import { z } from 'zod';
/**
 * Modifies the request open in the editor; changes appear immediately but are not saved until the user saves.
 *
 * @param {string} [name] - Display name for the request.
 * @param {string} [method] - HTTP method for the request.
 * @param {string} [url] - Request URL.
 * @param {string} [body] - Request body content (structured JSON for multipart/urlencoded rows).
 * @param {string} [body_type] - Content type of the request body.
 * @param {string|null} [body_raw] - Verbatim Raw body override for multipart/urlencoded; null clears it.
 * @param {string} [pre_request_script] - JavaScript run before the request is sent.
 * @param {string} [pre_request_script_mode] - How to apply pre_request_script; defaults to replace.
 * @param {string} [post_request_script] - JavaScript run after the response is received.
 * @param {string} [post_request_script_mode] - How to apply post_request_script; defaults to replace.
 * @param {string} [comment] - Free-form notes for the request.
 * @param {object[]} [headers] - Request headers to merge or replace.
 * @param {string} [headers_mode] - How to apply headers; defaults to merge.
 * @param {object[]} [params] - Query params to merge or replace.
 * @param {string} [params_mode] - How to apply params; defaults to merge.
 * @param {object} [auth] - Partial auth settings patch.
 * @param {object[]} [cookies] - Cookies for the request host.
 * @param {string} [cookies_mode] - How to apply cookies; defaults to merge.
 */
export declare const updateActiveRequestTool: {
  readonly name: 'update_active_request';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'update_active_request';
      readonly description: 'Modifies the request open in the editor (method, URL, params, headers, body, auth, pre/post scripts, cookies). Call get_active_request_details first when you need current values. For multipart/urlencoded, use body for structured JSON rows and body_raw for the verbatim Raw body drawer text (authoritative at send time, including intentionally invalid bodies). Pass body_raw: null to clear the raw override. Use HarborClient hc API in scripts, not Postman pm (hc.data for passing values between scripts in one send; hc.request.variables/collection.variables/environment.variables/globals with get/set/clear for persisted variables; hc.cookies, hc.execution.setNextRequest/skipRequest, await hc.sendRequest when enabled in Settings → General). Changes appear in the editor immediately but are not saved until the user saves.';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {
          readonly name: {
            readonly type: 'string';
            readonly description: 'Display name for the request.';
          };
          readonly method: {
            readonly type: 'string';
            readonly enum: readonly ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
            readonly description: 'HTTP method for the request.';
          };
          readonly url: {
            readonly type: 'string';
            readonly description: 'Request URL. When changed without params, the params table syncs from the query string.';
          };
          readonly body: {
            readonly type: 'string';
            readonly description: 'Request body content. For multipart/urlencoded this is JSON-serialized structured rows; prefer body_raw when editing the Raw body drawer.';
          };
          readonly body_type: {
            readonly type: 'string';
            readonly enum: readonly ['none', 'json', 'text', 'multipart', 'urlencoded'];
            readonly description: 'Content type of the request body.';
          };
          readonly body_raw: {
            readonly type: readonly ['string', 'null'];
            readonly description: 'Verbatim Raw body override for multipart/urlencoded. Sets the wire text sent as-is and best-effort syncs structured rows. Pass null to clear the override.';
          };
          readonly pre_request_script: {
            readonly type: 'string';
            readonly description: 'JavaScript run before the request is sent.';
          };
          readonly pre_request_script_mode: {
            readonly type: 'string';
            readonly enum: readonly ['replace', 'append'];
            readonly description: 'How to apply pre_request_script; defaults to replace.';
          };
          readonly post_request_script: {
            readonly type: 'string';
            readonly description: 'JavaScript run after the response is received.';
          };
          readonly post_request_script_mode: {
            readonly type: 'string';
            readonly enum: readonly ['replace', 'append'];
            readonly description: 'How to apply post_request_script; defaults to replace.';
          };
          readonly comment: {
            readonly type: 'string';
            readonly description: 'Free-form notes for the request.';
          };
          readonly headers: {
            readonly type: 'array';
            readonly items: {
              readonly type: 'object';
              readonly properties: {
                readonly key: {
                  readonly type: 'string';
                  readonly description: 'Header, param, or cookie name.';
                };
                readonly value: {
                  readonly type: 'string';
                  readonly description: 'Header, param, or cookie value.';
                };
                readonly enabled: {
                  readonly type: 'boolean';
                  readonly description: 'Whether the row is active; defaults to true when omitted.';
                };
              };
              readonly required: readonly ['key', 'value'];
              readonly additionalProperties: false;
            };
            readonly description: 'Request headers to merge or replace.';
          };
          readonly headers_mode: {
            readonly type: 'string';
            readonly enum: readonly ['merge', 'replace'];
            readonly description: 'How to apply headers; defaults to merge.';
          };
          readonly params: {
            readonly type: 'array';
            readonly items: {
              readonly type: 'object';
              readonly properties: {
                readonly key: {
                  readonly type: 'string';
                  readonly description: 'Header, param, or cookie name.';
                };
                readonly value: {
                  readonly type: 'string';
                  readonly description: 'Header, param, or cookie value.';
                };
                readonly enabled: {
                  readonly type: 'boolean';
                  readonly description: 'Whether the row is active; defaults to true when omitted.';
                };
              };
              readonly required: readonly ['key', 'value'];
              readonly additionalProperties: false;
            };
            readonly description: 'Query params to merge or replace.';
          };
          readonly params_mode: {
            readonly type: 'string';
            readonly enum: readonly ['merge', 'replace'];
            readonly description: 'How to apply params; defaults to merge.';
          };
          readonly auth: {
            readonly type: 'object';
            readonly properties: {
              readonly type: {
                readonly type: 'string';
                readonly enum: readonly ['none', 'basic', 'bearer'];
                readonly description: 'Selected auth mode.';
              };
              readonly basic: {
                readonly type: 'object';
                readonly properties: {
                  readonly username: {
                    readonly type: 'string';
                  };
                  readonly password: {
                    readonly type: 'string';
                  };
                };
                readonly additionalProperties: false;
              };
              readonly bearer: {
                readonly type: 'object';
                readonly properties: {
                  readonly token: {
                    readonly type: 'string';
                  };
                };
                readonly additionalProperties: false;
              };
            };
            readonly additionalProperties: false;
            readonly description: 'Partial auth settings patch.';
          };
          readonly cookies: {
            readonly type: 'array';
            readonly items: {
              readonly type: 'object';
              readonly properties: {
                readonly key: {
                  readonly type: 'string';
                  readonly description: 'Header, param, or cookie name.';
                };
                readonly value: {
                  readonly type: 'string';
                  readonly description: 'Header, param, or cookie value.';
                };
                readonly enabled: {
                  readonly type: 'boolean';
                  readonly description: 'Whether the row is active; defaults to true when omitted.';
                };
              };
              readonly required: readonly ['key', 'value'];
              readonly additionalProperties: false;
            };
            readonly description: 'Cookies for the request host; stored in the cookie jar for the URL hostname.';
          };
          readonly cookies_mode: {
            readonly type: 'string';
            readonly enum: readonly ['merge', 'replace'];
            readonly description: 'How to apply cookies; defaults to merge.';
          };
        };
        readonly additionalProperties: false;
      };
    };
  };
  readonly inputShape: {
    readonly name: z.ZodOptional<z.ZodString>;
    readonly method: z.ZodOptional<
      z.ZodEnum<{
        GET: 'GET';
        POST: 'POST';
        PUT: 'PUT';
        PATCH: 'PATCH';
        DELETE: 'DELETE';
        HEAD: 'HEAD';
        OPTIONS: 'OPTIONS';
      }>
    >;
    readonly url: z.ZodOptional<z.ZodString>;
    readonly body: z.ZodOptional<z.ZodString>;
    readonly body_type: z.ZodOptional<
      z.ZodEnum<{
        none: 'none';
        text: 'text';
        json: 'json';
        multipart: 'multipart';
        urlencoded: 'urlencoded';
      }>
    >;
    readonly body_raw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    readonly pre_request_script: z.ZodOptional<z.ZodString>;
    readonly pre_request_script_mode: z.ZodOptional<
      z.ZodEnum<{
        replace: 'replace';
        append: 'append';
      }>
    >;
    readonly post_request_script: z.ZodOptional<z.ZodString>;
    readonly post_request_script_mode: z.ZodOptional<
      z.ZodEnum<{
        replace: 'replace';
        append: 'append';
      }>
    >;
    readonly comment: z.ZodOptional<z.ZodString>;
    readonly headers: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodOptional<z.ZodBoolean>;
          },
          z.core.$strip
        >
      >
    >;
    readonly headers_mode: z.ZodOptional<
      z.ZodEnum<{
        replace: 'replace';
        merge: 'merge';
      }>
    >;
    readonly params: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodOptional<z.ZodBoolean>;
          },
          z.core.$strip
        >
      >
    >;
    readonly params_mode: z.ZodOptional<
      z.ZodEnum<{
        replace: 'replace';
        merge: 'merge';
      }>
    >;
    readonly auth: z.ZodOptional<
      z.ZodObject<
        {
          type: z.ZodOptional<
            z.ZodEnum<{
              none: 'none';
              basic: 'basic';
              bearer: 'bearer';
            }>
          >;
          basic: z.ZodOptional<
            z.ZodObject<
              {
                username: z.ZodOptional<z.ZodString>;
                password: z.ZodOptional<z.ZodString>;
              },
              z.core.$strip
            >
          >;
          bearer: z.ZodOptional<
            z.ZodObject<
              {
                token: z.ZodOptional<z.ZodString>;
              },
              z.core.$strip
            >
          >;
        },
        z.core.$strip
      >
    >;
    readonly cookies: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            key: z.ZodString;
            value: z.ZodString;
            enabled: z.ZodOptional<z.ZodBoolean>;
          },
          z.core.$strip
        >
      >
    >;
    readonly cookies_mode: z.ZodOptional<
      z.ZodEnum<{
        replace: 'replace';
        merge: 'merge';
      }>
    >;
  };
};
//# sourceMappingURL=updateActiveRequest.d.ts.map
