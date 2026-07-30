import { AutocompleteInput, RoundButton } from '@harborclient/sdk/components';
import { useState, type FormEvent, type JSX } from 'react';
import type { BrowserTab } from '#/renderer/src/store/tabs';
import { hasBrowserPendingSave } from '#/renderer/src/store/tabs';
import {
  faAngleLeft,
  faAngleRight,
  faArrowsRotate,
  faFloppyDisk,
  faGear,
  faHouse
} from '#/renderer/src/fontawesome';
import { normalizeBrowserAddressInput } from '#/browser/browserUrl';
import { browserUrlSource } from '#/renderer/src/autocomplete/sources';

interface Props {
  /**
   * Browser tab whose chrome controls are rendered.
   */
  tab: BrowserTab;

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
   * Saves a new website or updates the linked website from the current tab.
   */
  onSave: () => void;

  /**
   * Opens the linked browser-settings page tab.
   */
  onOpenSettings: () => void;
}

/**
 * Navigation toolbar for an embedded browser tab (back, forward, reload, home, address, save, settings).
 *
 * @param props - Tab state and chrome action handlers.
 * @returns Browser chrome row.
 */
export function BrowserChrome({
  tab,
  onNavigate,
  onBack,
  onForward,
  onReload,
  onHome,
  onSave,
  onOpenSettings
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
  const saveLabel = linked ? 'Update website' : 'Save website';

  /**
   * Submits the address bar and navigates when the URL is allowed.
   *
   * @param event - Form submit event.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalized = normalizeBrowserAddressInput(addressValue);
    if (!normalized) {
      return;
    }
    setEditingAddress(null);
    void browserUrlSource.add(normalized);
    onNavigate(normalized);
  }

  const settingsLabel = dirty ? 'Browser settings (unsaved changes)' : 'Browser settings';

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-separator bg-sidebar-toolbar px-2 py-1.5">
      <RoundButton icon={faAngleLeft} ariaLabel="Back" disabled={!tab.canGoBack} onClick={onBack} />
      <RoundButton
        icon={faAngleRight}
        ariaLabel="Forward"
        disabled={!tab.canGoForward}
        onClick={onForward}
      />
      <RoundButton icon={faArrowsRotate} ariaLabel="Reload" onClick={onReload} />
      <RoundButton icon={faHouse} ariaLabel="Home" onClick={onHome} />
      <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 items-center">
        <label htmlFor={`browser-address-${tab.tabId}`} className="sr-only">
          Address
        </label>
        <AutocompleteInput
          id={`browser-address-${tab.tabId}`}
          type="text"
          value={addressValue}
          source={browserUrlSource}
          onFocus={() => setEditingAddress(tab.url)}
          onBlur={() => setEditingAddress(null)}
          onChange={(value) => setEditingAddress(value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="min-w-0 flex-1 rounded-md border border-separator bg-control px-2 py-1 text-text outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </form>
      <RoundButton
        icon={faFloppyDisk}
        ariaLabel={saveLabel}
        disabled={!saveEnabled}
        onClick={onSave}
      />
      <div className="relative">
        <RoundButton icon={faGear} ariaLabel={settingsLabel} onClick={onOpenSettings} />
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
