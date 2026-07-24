/**
 * Returns the full draft of the active editor request including scripts and cookies.
 */
export declare const getActiveRequestDetailsTool: {
  readonly name: 'get_active_request_details';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'get_active_request_details';
      readonly description: 'Returns the full draft of the active editor request (headers, params, body, auth, scripts, cookies). Includes pre_request_scripts and post_request_scripts arrays with 1-based index, name, kind (inline or snippet), and resolved source code for each script row. For multipart and urlencoded bodies, also returns body_raw (verbatim override or null), body_raw_open (drawer state), and body_raw_effective (the wire text that will be sent — the override when set, otherwise a projection from structured rows).';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {};
        readonly additionalProperties: false;
      };
    };
  };
  readonly inputShape: {};
};
//# sourceMappingURL=getActiveRequestDetails.d.ts.map
