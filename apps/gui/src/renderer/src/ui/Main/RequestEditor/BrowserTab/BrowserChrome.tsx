import { VariableInput, RoundButton, fieldFrame } from '@harborclient/sdk/components';
import type { Variable } from '@harborclient/core/types';
import { useState, type FormEvent, type JSX } from 'react';
import type { BrowserTab } from '#/renderer/src/store/tabs';
import { hasBrowserPendingSave } from '#/renderer/src/store/tabs';
import {
  faAngleLeft,
  faAngleRight,
  faArrowsRotate,
  faBolt,
  faCamera,
  faGear,
  faHouse,
  faWandMagicSparkles
} from '#/renderer/src/fontawesome';
import { buildRuntimeVars } from '#/renderer/src/scripting/scriptOrchestration';
import { browserUrlSource } from '#/renderer/src/autocomplete/sources';
import { resolveBrowserAddressInput } from './resolveBrowserAddress';
import { resolveBrowserExternalUrl } from './resolveBrowserExternalUrl';
import { browserAddressInputId } from './focusBrowserAddress';
import { BrowserDownloadsMenu } from './BrowserDownloadsMenu';
import { BrowserAddressSecurityIcon } from './BrowserAddressSecurityIcon';
import { BrowserAddressOpenExternalButton } from './BrowserAddressOpenExternalButton';

/**
 * Shared RoundButton sizing for browser chrome controls — matches the 35px omnibox / UrlBar height.
 */
const chromeButtonClassName = 'h-[35px] w-[35px]';

/**
 * Shared icon sizing for browser chrome RoundButtons.
 */
const chromeIconClassName = 'h-5 w-5';

/**
 * Address VariableInput shell: strip default field padding so omnibox gap/px stay even,
 * and fill the 35px chrome row for vertical centering with the security icon.
 */
const addressInputWrapperClassName =
  'flex h-full min-w-0 flex-1 items-center border-0 bg-transparent p-0 shadow-none [&_.hc-variable-input-backdrop]:flex [&_.hc-variable-input-backdrop]:items-center [&_.hc-variable-input-backdrop]:px-0 [&_.hc-variable-input-backdrop]:py-0 [&_.hc-variable-input-field]:h-full [&_.hc-variable-input-field]:px-0 [&_.hc-variable-input-field]:py-0';

/**
 * Address input element classes — height/padding match {@link addressInputWrapperClassName}.
 */
const addressInputClassName = 'app-no-drag h-full px-0 py-0 leading-none';

interface Props {
  /**
   * Browser tab whose chrome controls are rendered.
   */
  tab: BrowserTab;

  /**
   * Active collection/environment variables for address-bar highlighting and resolve-on-navigate.
   */
  variables: Variable[];

  /**
   * Loads a normalized URL in the guest.
   *
   * @param url - Allowed absolute URL.
   */
  onNavigate: (url: string) => void;

  /**
   * Navigates back when history allows.
   */
  onBack: () => void;

  /**
   * Navigates forward when history allows.
   */
  onForward: () => void;

  /**
   * Reloads the current page.
   */
  onReload: () => void;

  /**
   * Navigates to the tab home URL.
   */
  onHome: () => void;

  /**
   * Saves a new live page or updates the linked live page from the current tab.
   */
  onSave: () => void;

  /**
   * Captures a viewport screenshot and prompts to save it.
   */
  onScreenshot: () => void;

  /**
   * When true, disables the screenshot button (capture in progress).
   */
  screenshotDisabled?: boolean;

  /**
   * Opens the AI sidebar and inserts an `@webpage.<tabId>` pointer for this tab.
   *
   * When omitted, the Ask AI chrome button is hidden (AI unavailable).
   */
  onAskAi?: () => void;

  /**
   * When true, the live page settings panel is open under this chrome.
   */
  settingsOpen: boolean;

  /**
   * DOM id of the settings panel for aria-controls.
   */
  settingsPanelId: string;

  /**
   * Toggles the live page settings panel under the address bar.
   */
  onToggleSettings: () => void;

  /**
   * Opens settings to edit a variable from an address-bar token tooltip.
   *
   * @param key - Variable name from the hovered `{{key}}` token.
   */
  onEditVariables?: (key: string) => void;

  /**
   * Reserves layout under the chrome and shrinks the native guest before suggestions paint.
   */
  beforeSuggestionsOpen?: () => void | Promise<void>;

  /**
   * Called when address-bar autocomplete open state changes.
   *
   * @param open - Whether suggestions are open.
   */
  onSuggestionsOpenChange?: (open: boolean) => void;
}

/**
 * Navigation toolbar for an embedded browser tab (back, forward, reload, home, address, downloads, AI, screenshot, save, settings).
 *
 * Address autocomplete is gated on {@link Props.beforeSuggestionsOpen} so the parent can cover
 * the native WebContentsView before the portaled suggestion list paints.
 *
 * @param props - Tab state and chrome action handlers.
 * @returns Browser chrome row.
 */
export function BrowserChrome({
  tab,
  variables,
  onNavigate,
  onBack,
  onForward,
  onReload,
  onHome,
  onSave,
  onScreenshot,
  screenshotDisabled = false,
  onAskAi,
  settingsOpen,
  settingsPanelId,
  onToggleSettings,
  onEditVariables,
  beforeSuggestionsOpen,
  onSuggestionsOpenChange
}: Props): JSX.Element {
  /**
   * While the address field is focused, holds the user's edit buffer; otherwise
   * null so the field mirrors {@link BrowserTab.url} from navigation updates.
   */
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const addressValue = editingAddress ?? tab.url;
  const runtimeVars = buildRuntimeVars(variables);
  const externalUrl = resolveBrowserExternalUrl(addressValue, runtimeVars);
  const dirty = hasBrowserPendingSave(tab);
  const linked = tab.websiteId != null;
  const saveEnabled = !linked || dirty;
  const saveLabel = linked ? 'Update live page' : 'Save live page';

  /**
   * Submits the address bar: substitutes variables, normalizes, then navigates.
   *
   * @param event - Form submit event.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalized = resolveBrowserAddressInput(addressValue, runtimeVars);
    if (!normalized) {
      return;
    }
    setEditingAddress(null);
    const trimmed = addressValue.trim();
    if (trimmed) {
      void browserUrlSource.add(trimmed);
    }
    onNavigate(normalized);
  }

  const settingsLabel = !linked
    ? 'Live page settings (save as a live page first)'
    : dirty
      ? 'Live page settings (unsaved changes)'
      : 'Live page settings';

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-separator bg-sidebar-toolbar p-2">
      <RoundButton
        icon={faAngleLeft}
        ariaLabel="Back"
        disabled={!tab.canGoBack}
        onClick={onBack}
        className={chromeButtonClassName}
        iconClassName={chromeIconClassName}
      />
      <RoundButton
        icon={faAngleRight}
        ariaLabel="Forward"
        disabled={!tab.canGoForward}
        onClick={onForward}
        className={chromeButtonClassName}
        iconClassName={chromeIconClassName}
      />
      <RoundButton
        icon={faArrowsRotate}
        ariaLabel="Reload"
        onClick={onReload}
        className={chromeButtonClassName}
        iconClassName={chromeIconClassName}
      />
      <RoundButton
        icon={faHouse}
        ariaLabel="Home"
        onClick={onHome}
        className={chromeButtonClassName}
        iconClassName={chromeIconClassName}
      />
      <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 items-center">
        <label htmlFor={browserAddressInputId(tab.tabId)} className="sr-only">
          Address
        </label>
        <div
          className={`flex h-[35px] min-w-0 flex-1 items-center gap-2 px-2 ${fieldFrame} rounded-md!`}
        >
          <BrowserAddressSecurityIcon securityState={tab.securityState} />
          <VariableInput
            id={browserAddressInputId(tab.tabId)}
            value={addressValue}
            onChange={(value) => setEditingAddress(value)}
            variables={variables}
            source={browserUrlSource}
            placeholder="Enter URL"
            aria-label="Address"
            onEditVariable={onEditVariables}
            beforeSuggestionsOpen={beforeSuggestionsOpen}
            onSuggestionsOpenChange={onSuggestionsOpenChange}
            wrapperClassName={addressInputWrapperClassName}
            className={addressInputClassName}
            onFocus={() => setEditingAddress((prev) => prev ?? tab.url)}
            onBlur={(event) => {
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.contains(next)) {
                return;
              }
              setEditingAddress(null);
              // Clear an in-flight guest cover if suggestions never opened (stale beforeOpen).
              onSuggestionsOpenChange?.(false);
            }}
          />
          <BrowserAddressOpenExternalButton url={externalUrl} disabled={externalUrl == null} />
        </div>
      </form>
      <BrowserDownloadsMenu
        tabId={tab.tabId}
        buttonClassName={chromeButtonClassName}
        iconClassName={chromeIconClassName}
      />
      {onAskAi != null ? (
        <RoundButton
          icon={faWandMagicSparkles}
          ariaLabel="Ask AI about this page"
          onClick={onAskAi}
          className={chromeButtonClassName}
          iconClassName={chromeIconClassName}
        />
      ) : null}
      <RoundButton
        icon={faCamera}
        ariaLabel={screenshotDisabled ? 'Taking screenshot…' : 'Take screenshot'}
        disabled={screenshotDisabled}
        onClick={onScreenshot}
        className={chromeButtonClassName}
        iconClassName={chromeIconClassName}
      />
      <RoundButton
        icon={faBolt}
        ariaLabel={saveLabel}
        disabled={!saveEnabled}
        onClick={onSave}
        className={
          linked
            ? `${chromeButtonClassName} text-accent disabled:opacity-100`
            : chromeButtonClassName
        }
        iconClassName={chromeIconClassName}
      />
      <div className="relative">
        <RoundButton
          icon={faGear}
          ariaLabel={settingsLabel}
          aria-expanded={settingsOpen}
          aria-controls={settingsPanelId}
          disabled={!linked}
          onClick={onToggleSettings}
          className={chromeButtonClassName}
          iconClassName={chromeIconClassName}
        />
        {linked && dirty ? (
          <span
            className="pointer-events-none absolute end-0.5 top-0.5 h-2 w-2 rounded-full bg-accent"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
