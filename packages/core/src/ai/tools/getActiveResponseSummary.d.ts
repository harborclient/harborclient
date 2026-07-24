/**
 * Returns a compact summary of the last HTTP response for the active tab, or null.
 */
export declare const getActiveResponseSummaryTool: {
  readonly name: 'get_active_response_summary';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'get_active_response_summary';
      readonly description: 'Returns a compact summary of the last HTTP response for the active tab (status, headers, short body preview, tests), or null. Prefer this before fetching the full body.';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {};
        readonly additionalProperties: false;
      };
    };
  };
  readonly inputShape: {};
};
//# sourceMappingURL=getActiveResponseSummary.d.ts.map
