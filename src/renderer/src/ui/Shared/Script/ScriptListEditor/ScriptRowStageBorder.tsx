import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { CSSProperties, JSX } from 'react';
import type { ScriptStage } from '@harborclient/sdk';
import { scriptStageBorderColor } from '#/shared/scriptStage';
import { SCRIPT_ROW_STAGE_BORDER_CLASS } from './constants';

interface Props {
  /**
   * Script execution stage used to pick the strip color.
   */
  stage: ScriptStage;

  /**
   * Accessible name when the strip is a drag activator.
   */
  reorderLabel: string;

  /**
   * When true, wires the strip as the dnd-kit drag activator.
   */
  draggable: boolean;

  /**
   * dnd-kit activator ref for the draggable strip button.
   */
  setActivatorNodeRef?: (element: HTMLElement | null) => void;

  /**
   * dnd-kit draggable attributes for keyboard and ARIA on the activator.
   */
  attributes?: DraggableAttributes;

  /**
   * dnd-kit pointer and keyboard listeners for the activator.
   */
  listeners?: SyntheticListenerMap;
}

/**
 * Renders the stage-colored left strip on a script row, optionally as the drag handle.
 *
 * @param props - Stage, drag wiring, and accessible reorder label.
 * @returns Decorative span or draggable button strip.
 */
export function ScriptRowStageBorder({
  stage,
  reorderLabel,
  draggable,
  setActivatorNodeRef,
  attributes,
  listeners
}: Props): JSX.Element {
  const stripStyle: CSSProperties = {
    backgroundColor: scriptStageBorderColor(stage)
  };

  if (draggable) {
    return (
      <button
        type="button"
        ref={setActivatorNodeRef}
        className={`${SCRIPT_ROW_STAGE_BORDER_CLASS} cursor-grab border-none p-0 outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing app-no-drag`}
        style={stripStyle}
        aria-label={reorderLabel}
        title={reorderLabel}
        {...attributes}
        {...listeners}
      />
    );
  }

  return <span className={SCRIPT_ROW_STAGE_BORDER_CLASS} style={stripStyle} aria-hidden="true" />;
}
