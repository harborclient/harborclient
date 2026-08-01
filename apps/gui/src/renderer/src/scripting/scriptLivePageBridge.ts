import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { ScriptLivePageRequest } from '@harborclient/core/scripting/scriptApi';
import type { RootState } from '#/renderer/src/store/redux';
import { store } from '#/renderer/src/store/redux';
import {
  closeWebpageTab,
  evaluateWebpage,
  focusWebpageTab,
  goBackWebpageTab,
  goForwardWebpageTab,
  injectWebpageScript,
  injectWebpageStylesheet,
  isWebpageSessionError,
  navigateWebpageTab,
  openOrReuseWebpageTab,
  queryWebpageDom,
  reloadWebpageTab,
  screenshotWebpage
} from '#/renderer/src/store/browser/webpageSession';

/**
 * Executes one script live page bridge operation against Redux + browser guests.
 *
 * @param req - Webpage operation from the main-process script host.
 * @returns Session helper result (may be `{ error }`).
 */
export async function executeScriptLivePageRequest(req: ScriptLivePageRequest): Promise<unknown> {
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
    case 'goBack':
      return goBackWebpageTab(ctx, req.tabId);
    case 'goForward':
      return goForwardWebpageTab(ctx, req.tabId);
    case 'reload':
      return reloadWebpageTab(ctx, req.tabId);
    case 'navigate':
      return navigateWebpageTab(ctx, req.tabId, req.url);
    default: {
      const exhaustive: never = req;
      return { error: `Unknown livePage op: ${(exhaustive as ScriptLivePageRequest).op}` };
    }
  }
}

/**
 * Subscribes to script livePage invocations from the main process.
 *
 * @returns Unsubscribe function.
 */
export function startScriptLivePageBridge(): () => void {
  const unsubscribe = window.api.onScriptLivePageInvoke((message) => {
    void (async () => {
      try {
        const result = await executeScriptLivePageRequest(message.req);
        if (isWebpageSessionError(result)) {
          window.api.completeScriptLivePage({
            requestId: message.requestId,
            ok: false,
            error: result.error
          });
          return;
        }
        window.api.completeScriptLivePage({
          requestId: message.requestId,
          ok: true,
          result
        });
      } catch (error) {
        window.api.completeScriptLivePage({
          requestId: message.requestId,
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })();
  });

  return unsubscribe;
}
