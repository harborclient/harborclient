import { VariableInput, RoundButton, fieldFrame } from '@harborclient/sdk/components';
import type { LivePageChromeActionContext } from '@harborclient/sdk';
import type { Variable } from '@harborclient/core/types';
import { useState, type ClipboardEvent, type FocusEvent, type FormEvent, type JSX } from 'react';
import type { BrowserTab } from '#/renderer/src/store/tabs';
import {
  faAngleLeft,
  faAngleRight,
  faArrowsRotate,
  faCamera,
  faHouse,
  faWandMagicSparkles
} from '#/renderer/src/fontawesome';
import { buildRuntimeVars } from '#/renderer/src/scripting/scriptOrchestration';
import { browserUrlSource } from '#/renderer/src/autocomplete/sources';
import { usePluginLivePageChromeActions } from '#/renderer/src/plugins/pluginHooks';
import { resolvePluginTabIcon } from '#/renderer/src/routing/resolvePluginTabIcon';
import { applyBrowserAddressPaste } from './applyBrowserAddressPaste';
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
const addressInputClassName = 'h-full px-0 py-0 leading-none';

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
 * Navigation toolbar for an embedded browser tab (back, forward, reload, home, address,
 * open external, downloads, plugin chrome actions, AI, screenshot).
 *
 * Address autocomplete is gated on {@link Props.beforeSuggestionsOpen} so the parent can cover
 * the native WebContentsView before the portaled suggestion list paints. Navigation commits when
 * the user presses Enter, blurs the address field, pastes a URL, or accepts a suggestion.
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
  onScreenshot,
  screenshotDisabled = false,
  onAskAi,
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
  const livePageChromeActions = usePluginLivePageChromeActions();

  /**
   * Builds the command context for a live-page chrome action click.
   *
   * @returns Context describing the current browser tab.
   */
  function buildLivePageChromeActionContext(): LivePageChromeActionContext {
    return {
      tabId: tab.tabId,
      url: tab.url,
      title: tab.title,
      websiteId: tab.websiteId
    };
  }

  /**
   * Resolves address-bar text and navigates when it is a valid URL.
   *
   * Skips {@link Props.onNavigate} when the guest is already at the normalized
   * URL, but still clears the edit buffer so the field tracks tab state again.
   *
   * @param raw - Raw address-bar text to commit.
   * @returns Whether the address resolved to an allowed URL.
   */
  function commitAddress(raw: string): boolean {
    const normalized = resolveBrowserAddressInput(raw, runtimeVars);
    if (!normalized) {
      return false;
    }
    setEditingAddress(null);
    const trimmed = raw.trim();
    if (trimmed) {
      void browserUrlSource.add(trimmed);
    }
    if (normalized !== tab.url) {
      onNavigate(normalized);
    }
    return true;
  }

  /**
   * Submits the address bar via Enter: substitutes variables, normalizes, then navigates.
   *
   * @param event - Form submit event.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    commitAddress(addressValue);
  }

  /**
   * Navigates when the address field loses focus outside its wrapper (not when
   * focus moves between the input and in-field variable token controls).
   *
   * Invalid edits are discarded so the field reverts to {@link BrowserTab.url}.
   *
   * @param event - Focus event from the VariableInput wrapper (React focusout).
   */
  function handleAddressBlur(event: FocusEvent<HTMLDivElement>): void {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    if (!commitAddress(addressValue)) {
      setEditingAddress(null);
    }
    // Clear an in-flight guest cover if suggestions never opened (stale beforeOpen).
    onSuggestionsOpenChange?.(false);
  }

  /**
   * Applies a paste to the address value and navigates when the result is valid.
   *
   * Prevents the default insert so controlled state and navigation stay in sync
   * (avoids onChange re-arming the edit buffer after a successful commit).
   *
   * @param event - Paste event bubbled from the address input.
   */
  function handleAddressPaste(event: ClipboardEvent<HTMLDivElement>): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const pasted = event.clipboardData?.getData('text') ?? '';
    if (!pasted) {
      return;
    }
    event.preventDefault();
    const nextValue = applyBrowserAddressPaste(
      input.value,
      input.selectionStart,
      input.selectionEnd,
      pasted
    );
    if (!commitAddress(nextValue)) {
      setEditingAddress(nextValue);
    }
  }

  /**
   * Navigates after the user accepts an address autocomplete suggestion.
   *
   * Suggestion mousedown prevents input blur, so commit must happen here rather
   * than waiting for {@link handleAddressBlur}.
   *
   * @param value - Selected suggestion (already applied via onChange).
   */
  function handleAddressSuggestionSelect(value: string): void {
    commitAddress(value);
  }

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
            onSuggestionSelect={handleAddressSuggestionSelect}
            wrapperClassName={addressInputWrapperClassName}
            className={addressInputClassName}
            onFocus={() => setEditingAddress((prev) => prev ?? tab.url)}
            onBlur={handleAddressBlur}
            onPaste={handleAddressPaste}
          />
        </div>
      </form>
      <BrowserAddressOpenExternalButton
        url={externalUrl}
        disabled={externalUrl == null}
        className={chromeButtonClassName}
        iconClassName={chromeIconClassName}
      />
      <BrowserDownloadsMenu
        tabId={tab.tabId}
        buttonClassName={chromeButtonClassName}
        iconClassName={chromeIconClassName}
      />
      {livePageChromeActions.map((action) => (
        <RoundButton
          key={`${action.pluginId}:${action.id}`}
          icon={resolvePluginTabIcon(action.icon)}
          ariaLabel={action.title}
          title={action.title}
          onClick={() => {
            void window.api.executePluginAgentCommand(action.pluginId, action.command, [
              buildLivePageChromeActionContext()
            ]);
          }}
          className={chromeButtonClassName}
          iconClassName={chromeIconClassName}
        />
      ))}
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
    </div>
  );
}
