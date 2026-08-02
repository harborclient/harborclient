import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { Button, Checkbox, FaIcon, Input } from '@harborclient/sdk/components';
import type { LiveServerErrorPage } from '@harborclient/core/types';
import type { JSX } from 'react';

interface Props {
  /**
   * Zero-based index of this row (for ids/labels).
   */
  index: number;

  /**
   * Error-page code, path, and enabled values.
   */
  page: LiveServerErrorPage;

  /**
   * When true, disables all controls.
   */
  disabled?: boolean;

  /**
   * Default path passed to the file picker (document root or current path).
   */
  browseDefaultPath: string;

  /**
   * Called when code, path, or enabled changes.
   *
   * @param next - Updated error-page row.
   */
  onChange: (next: LiveServerErrorPage) => void;

  /**
   * Called when the user removes this row.
   */
  onRemove: () => void;
}

/**
 * One editable error-page row (status code → HTML file path) in the Routing tab.
 *
 * @param props - Row values, browse default, and change handlers.
 */
export function ErrorPageRow({
  index,
  page,
  disabled,
  browseDefaultPath,
  onChange,
  onRemove
}: Props): JSX.Element {
  const enabledId = `live-server-error-page-enabled-${index}`;
  const codeId = `live-server-error-page-code-${index}`;
  const pathId = `live-server-error-page-path-${index}`;
  const rowLabel = `Error page ${index + 1}`;

  /**
   * Opens the HTML file picker and stores the selected absolute path.
   */
  function handleBrowse(): void {
    const defaultPath = page.path.trim() !== '' ? page.path : browseDefaultPath;
    void window.api.selectFile(defaultPath).then((selected) => {
      if (selected != null) {
        onChange({ ...page, path: selected });
      }
    });
  }

  return (
    <tr>
      <td className="w-6 p-1 text-center align-middle">
        <Checkbox
          id={enabledId}
          className="app-no-drag"
          checked={page.enabled !== false}
          disabled={disabled}
          aria-label={`${rowLabel} enabled`}
          onChange={(event) => onChange({ ...page, enabled: event.target.checked })}
        />
      </td>
      <td className="w-36 p-1 align-middle">
        <label htmlFor={codeId} className="sr-only">
          {rowLabel} status code
        </label>
        <Input
          id={codeId}
          className="w-full"
          value={page.code}
          disabled={disabled}
          placeholder="e.g. 404"
          aria-label={`${rowLabel} status code`}
          onChange={(event) => onChange({ ...page, code: event.target.value })}
        />
      </td>
      <td className="min-w-0 w-full p-1 align-middle">
        <label htmlFor={pathId} className="sr-only">
          {rowLabel} file path
        </label>
        <div className="flex min-w-0 gap-2">
          <Input
            id={pathId}
            className="min-w-0 flex-1"
            value={page.path}
            disabled={disabled}
            placeholder="e.g. 404.html"
            aria-label={`${rowLabel} file path`}
            onChange={(event) => onChange({ ...page, path: event.target.value })}
          />
          <Button type="button" variant="secondary" disabled={disabled} onClick={handleBrowse}>
            Browse
          </Button>
        </div>
      </td>
      <td className="w-7 p-1 text-center align-middle">
        <Button
          type="button"
          variant="iconDanger"
          disabled={disabled}
          title="Remove"
          aria-label={`Remove ${rowLabel}`}
          onClick={onRemove}
        >
          <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}
