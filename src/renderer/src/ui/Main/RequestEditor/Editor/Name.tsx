import { Input } from '@harborclient/sdk/components';
import { useEffect, useRef, useState, type JSX } from 'react';

import { BreadcrumbPrefix } from '#/renderer/src/ui/Main/RequestEditor/Editor/BreadcrumbPrefix';

interface Props {
  /**
   * Current request name.
   */
  name: string;

  /**
   * Name of the collection this request belongs to, for display as a breadcrumb prefix.
   */
  collectionName?: string;

  /**
   * Name of the folder this request belongs to, for display as a breadcrumb segment.
   */
  folderName?: string;

  /**
   * Called when the request name changes.
   */
  onNameChange: (name: string) => void;

  /**
   * Called when the collection breadcrumb segment is clicked.
   */
  onCollectionClick?: () => void;

  /**
   * Called when the folder breadcrumb segment is clicked.
   */
  onFolderClick?: () => void;
}

/**
 * Inline-editable request name with optional collection and folder breadcrumb.
 */
export function Name({
  name,
  collectionName,
  folderName,
  onNameChange,
  onCollectionClick,
  onFolderClick
}: Props): JSX.Element {
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  /**
   * Focuses and selects the name input when inline edit mode opens.
   */
  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  return (
    <div className="mb-2">
      {editingName ? (
        <div className="flex w-full min-w-0 items-center gap-1">
          <BreadcrumbPrefix
            collectionName={collectionName}
            folderName={folderName}
            compact
            onCollectionClick={onCollectionClick}
            onFolderClick={onFolderClick}
          />
          <Input
            ref={nameInputRef}
            variant="plain"
            className="min-w-0 flex-1 border-none bg-transparent p-0 text-[15px] font-semibold text-text outline-none app-no-drag"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                setEditingName(false);
              }
            }}
          />
        </div>
      ) : (
        <div className="flex w-full min-w-0 items-center gap-1">
          <BreadcrumbPrefix
            collectionName={collectionName}
            folderName={folderName}
            onCollectionClick={onCollectionClick}
            onFolderClick={onFolderClick}
          />
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-text items-center border-none bg-transparent p-0 text-left text-[15px] font-semibold text-text hover:opacity-80 app-no-drag"
            onClick={() => setEditingName(true)}
          >
            <span className="shrink-0 whitespace-nowrap">
              {name ? name : <span className="text-muted">Request name</span>}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
