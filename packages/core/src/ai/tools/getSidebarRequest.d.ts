/**
 * Returns the saved request highlighted in the sidebar, or null when the tab is unsaved.
 */
export declare const getSidebarRequestTool: {
  readonly name: 'get_sidebar_request';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'get_sidebar_request';
      readonly description: 'Returns the saved request highlighted in the sidebar (from the active editor tab), or null when the tab is unsaved.';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {};
        readonly additionalProperties: false;
      };
    };
  };
  readonly inputShape: {};
};
//# sourceMappingURL=getSidebarRequest.d.ts.map
