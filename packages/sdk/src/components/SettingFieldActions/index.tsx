import { faGear } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useState } from '@harborclient/sdk/react';
import type { JSX, MouseEvent as ReactMouseEvent } from 'react';
import { type MenuItem, RowActionsMenu } from '../RowActionsMenu/index.js';
import { cn } from '../utils.js';

interface Props {
  /**
   * Catalog setting id (e.g. `general.verifySsl`), used for the accessible name
   * and as context for copy/reset actions.
   */
  settingId: string;

  /**
   * True when the field value differs from its factory default. Keeps the gear
   * visible and enables Reset Setting.
   */
  isModified: boolean;

  /**
   * Resets the setting to its factory default.
   */
  onReset: () => void;

  /**
   * Copies the setting id to the clipboard.
   */
  onCopyId: () => void;

  /**
   * When set, adds a "Copy Setting as JSON" menu item.
   */
  onCopyJson?: () => void;

  /**
   * When set, adds a "Copy Deep Link" menu item for the `#setting-…` hash.
   */
  onCopyDeepLink?: () => void;
}

/**
 * Gear button and dropdown for a single settings field: reset to default and
 * copy helpers. Hidden until the parent `group/setting-field` is hovered or
 * focused; always visible when the field is modified or the menu is open.
 *
 * Place inside a container with the `group/setting-field` Tailwind class so
 * hover/focus reveal works.
 *
 * @param props - Setting id, modified flag, and action handlers.
 */
export function SettingFieldActions({
  settingId,
  isModified,
  onReset,
  onCopyId,
  onCopyJson,
  onCopyDeepLink
}: Props): JSX.Element {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuId = `setting-actions-${settingId}`;
  const isOpen = openMenuId === menuId;

  /**
   * Menu groups for reset and copy actions. Reset is disabled when the value
   * matches the factory default.
   */
  const groups = useMemo((): MenuItem[][] => {
    const copyItems: MenuItem[] = [
      {
        label: 'Copy Setting ID',
        onSelect: onCopyId
      }
    ];
    if (onCopyJson != null) {
      copyItems.push({
        label: 'Copy Setting as JSON',
        onSelect: onCopyJson
      });
    }
    if (onCopyDeepLink != null) {
      copyItems.push({
        label: 'Copy Deep Link',
        onSelect: onCopyDeepLink
      });
    }

    return [
      [
        {
          label: 'Reset Setting',
          disabled: !isModified,
          onSelect: onReset
        }
      ],
      copyItems
    ];
  }, [isModified, onCopyDeepLink, onCopyId, onCopyJson, onReset]);

  /**
   * Prevents the gear click from toggling a wrapping checkbox label.
   *
   * @param event - Native click on the actions wrapper.
   */
  const handleWrapperClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    event.stopPropagation();
  };

  const alwaysVisible = isModified || isOpen;

  return (
    <div
      className={cn(
        'hc-setting-field-actions shrink-0',
        alwaysVisible
          ? 'opacity-100'
          : 'opacity-0 group-focus-within/setting-field:opacity-100 group-hover/setting-field:opacity-100 focus-within:opacity-100'
      )}
      onClick={handleWrapperClick}
    >
      <RowActionsMenu
        menuId={menuId}
        openMenuId={openMenuId}
        onOpenChange={setOpenMenuId}
        triggerIcon={faGear}
        triggerAriaLabel={`Setting actions for ${settingId}`}
        triggerTitle="Setting actions"
        groups={groups}
      />
    </div>
  );
}
