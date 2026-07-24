import { z } from 'zod';
/**
 * Arguments for the send_active_request tool.
 */
export interface SendActiveRequestToolArgs {
  /**
   * When provided and greater than zero, includes a capped response body; otherwise only a summary preview is returned.
   */
  maxBodyChars?: number;
}
/**
 * Sends the HTTP request in the active editor tab and returns a compact response summary by default.
 *
 * @param {number} [maxBodyChars] - When greater than zero, includes a capped response body.
 */
export declare const sendActiveRequestTool: {
  readonly name: 'send_active_request';
  readonly definition: {
    readonly type: 'function';
    readonly function: {
      readonly name: 'send_active_request';
      readonly description: 'Sends the HTTP request in the active editor tab (equivalent to clicking Send). Returns a compact response summary by default (status, headers, short body preview, tests). Pass maxBodyChars only when you need a capped full body in the same turn; otherwise call get_active_response afterward.';
      readonly parameters: {
        readonly type: 'object';
        readonly properties: {
          readonly maxBodyChars: {
            readonly type: 'number';
            readonly description: 'Optional. When provided and greater than zero, includes a capped response body; otherwise only a summary preview is returned.';
          };
        };
        readonly additionalProperties: false;
      };
    };
  };
  readonly inputShape: {
    readonly maxBodyChars: z.ZodOptional<z.ZodNumber>;
  };
};
//# sourceMappingURL=sendActiveRequest.d.ts.map
