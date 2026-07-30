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
  faHouse
} from '#/renderer/src/fontawesome';
import { buildRuntimeVars } from '#/renderer/src/scripting/scriptOrchestration';
import { browserUrlSource } from '#/renderer/src/autocomplete/sources';
import { resolveBrowserAddressInput } from './resolveBrowserAddress';

/**
 * Shared RoundButton sizing for browser chrome controls — slightly larger than the SDK default.
 */
const chromeButtonClassName = 'h-8 w-8';

/**
 * Shared icon sizing for browser chrome RoundButtons.
 */
const chromeIconClassName = 'h-4 w-4';

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
   * Opens the linked browser-settings page tab.
   */
  onOpenSettings: () => void;

  /**
   * Opens settings to edit a variable from an address-bar token tooltip.
   *
   * @param key - Variable name from the hovered `{{key}}` token.
   */
  onEditVariables?: (key: string) => void;
}

/**
 * Navigation toolbar for an embedded browser tab (back, forward, reload, home, address, save, screenshot, settings).
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
  onOpenSettings,
  onEditVariables
}: Props): JSX.Element {
  /**
   * While the address field is focused, holds the user's edit buffer; otherwise
   * null so the field mirrors {@link BrowserTab.url} from navigation updates.
   */
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const addressValue = editingAddress ?? tab.url;
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
    const normalized = resolveBrowserAddressInput(addressValue, buildRuntimeVars(variables));
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

  const settingsLabel = dirty ? 'Browser settings (unsaved changes)' : 'Browser settings';

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-separator bg-sidebar-toolbar px-2 py-1.5">
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
        <label htmlFor={`browser-address-${tab.tabId}`} className="sr-only">
          Address
        </label>
        <VariableInput
          id={`browser-address-${tab.tabId}`}
          value={addressValue}
          onChange={(value) => setEditingAddress(value)}
          variables={variables}
          source={browserUrlSource}
          placeholder="Enter URL"
          aria-label="Address"
          onEditVariable={onEditVariables}
          wrapperClassName={`min-w-0 flex-1 ${fieldFrame} rounded-md!`}
          className="app-no-drag"
          onFocus={() => setEditingAddress((prev) => prev ?? tab.url)}
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) {
              return;
            }
            setEditingAddress(null);
          }}
        />
      </form>
      <RoundButton
        icon={faBolt}
        ariaLabel={saveLabel}
        disabled={!saveEnabled}
        onClick={onSave}
        className={chromeButtonClassName}
        iconClassName={chromeIconClassName}
      />
      <RoundButton
        icon={faCamera}
        ariaLabel={screenshotDisabled ? 'Taking screenshot…' : 'Take screenshot'}
        disabled={screenshotDisabled}
        onClick={onScreenshot}
        className={chromeButtonClassName}
        iconClassName={chromeIconClassName}
      />
      <div className="relative">
        <RoundButton
          icon={faGear}
          ariaLabel={settingsLabel}
          onClick={onOpenSettings}
          className={chromeButtonClassName}
          iconClassName={chromeIconClassName}
        />
        {dirty ? (
          <span
            className="pointer-events-none absolute end-0.5 top-0.5 h-2 w-2 rounded-full bg-accent"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
