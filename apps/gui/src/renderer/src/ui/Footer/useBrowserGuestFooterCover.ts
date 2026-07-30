/**
 * Footer guest-cover helpers live on the unified overlay hook.
 *
 * Prefer {@link useBrowserGuestOverlayCover} at the app root; it covers footer
 * panels and Redux blocking modals together so uncover does not race.
 */
export {
  isAnyFooterPanelOpen,
  useBrowserGuestOverlayCover as useBrowserGuestFooterCover
} from '#/renderer/src/ui/Main/RequestEditor/BrowserTab/useBrowserGuestOverlayCover';
