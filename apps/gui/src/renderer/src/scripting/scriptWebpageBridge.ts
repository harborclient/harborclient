import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { ScriptWebpageRequest } from '@harborclient/core/scripting/scriptApi';
import type { RootState } from '#/renderer/src/store/redux';
import { store } from '#/renderer/src/store/redux';
import {
  closeWebpageTab,
  evaluateWebpage,
  focusWebpageTab,
  injectWebpageScript,
  injectWebpageStylesheet,
  isWebpageSessionError,
  openOrReuseWebpageTab,
  queryWebpageDom,
  screenshotWebpage
} from '#/renderer/src/store/browser/webpageSession';

/**
 * Executes one script webpage bridge operation against Redux + browser guests.
 *
 * @param req - Webpage operation from the main-process script host.
 * @returns Session helper result (may be `{ error }`).
 */
export async function executeScriptWebpageRequest(req: ScriptWebpageRequest): Promise<unknown> {
  const ctx = {
    getState: (): RootState => store.getState(),
    dispatch: store.dispatch as ThunkDispatch<RootState, unknown, UnknownAction>
  };

  switch (req.op) {
    case 'open':
      return openOrReuseWebpageTab(ctx, { url: req.url, reuse: req.reuse });
    case 'focus':
      return focusWebpageTab(ctx, req.tabId);
    case 'close':
      return closeWebpageTab(ctx, req.tabId);
    case 'query':
      return queryWebpageDom(ctx.getState(), req.tabId, req.selector, req.all, req.maxElements);
    case 'evaluate':
      return evaluateWebpage(ctx.getState(), req.tabId, req.expression);
    case 'injectScript':
      return injectWebpageScript(ctx.getState(), req.tabId, req.source);
    case 'injectStylesheet':
      return injectWebpageStylesheet(ctx.getState(), req.tabId, req.css);
    case 'screenshot':
      return screenshotWebpage(ctx.getState(), req.tabId, req.fullPage);
    default: {
      const exhaustive: never = req;
      return { error: `Unknown webpage op: ${(exhaustive as ScriptWebpageRequest).op}` };
    }
  }
}

/**
 * Subscribes to script webpage invocations from the main process.
 *
 * @returns Unsubscribe function.
 */
export function startScriptWebpageBridge(): () => void {
  const unsubscribe = window.api.onScriptWebpageInvoke((message) => {
    void (async () => {
      try {
        const result = await executeScriptWebpageRequest(message.req);
        if (isWebpageSessionError(result)) {
          window.api.completeScriptWebpage({
            requestId: message.requestId,
            ok: false,
            error: result.error
          });
          return;
        }
        window.api.completeScriptWebpage({
          requestId: message.requestId,
          ok: true,
          result
        });
      } catch (error) {
        window.api.completeScriptWebpage({
          requestId: message.requestId,
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })();
  });

  return unsubscribe;
}
