import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_TIMELINE_DRAG_THRESHOLD_PX,
  clientXToTimelineContentX,
  timelinePanScrollLeft,
  timelinePointerExceededDragThreshold
} from './workflowTimelinePointer';

describe('workflowTimelinePointer', () => {
  describe('clientXToTimelineContentX', () => {
    it('maps client X relative to the track rect and clamps to width', () => {
      const track = {
        getBoundingClientRect: () => ({ left: 100 }) as DOMRect
      };

      expect(clientXToTimelineContentX(100, track, 500)).toBe(0);
      expect(clientXToTimelineContentX(250, track, 500)).toBe(150);
      expect(clientXToTimelineContentX(700, track, 500)).toBe(500);
      expect(clientXToTimelineContentX(50, track, 500)).toBe(0);
    });

    it('clamps to 0 when total width is non-positive', () => {
      const track = {
        getBoundingClientRect: () => ({ left: 40 }) as DOMRect
      };
      expect(clientXToTimelineContentX(80, track, 0)).toBe(0);
      expect(clientXToTimelineContentX(80, track, -10)).toBe(0);
    });
  });

  describe('timelinePanScrollLeft', () => {
    it('decreases scrollLeft when dragging right', () => {
      expect(timelinePanScrollLeft(100, 200, 250)).toBe(50);
    });

    it('increases scrollLeft when dragging left', () => {
      expect(timelinePanScrollLeft(100, 200, 150)).toBe(150);
    });

    it('does not go below zero', () => {
      expect(timelinePanScrollLeft(10, 200, 250)).toBe(0);
    });
  });

  describe('timelinePointerExceededDragThreshold', () => {
    it('is false inside the default threshold', () => {
      expect(
        timelinePointerExceededDragThreshold(100, 100 + WORKFLOW_TIMELINE_DRAG_THRESHOLD_PX - 1)
      ).toBe(false);
    });

    it('is true at or beyond the threshold', () => {
      expect(
        timelinePointerExceededDragThreshold(100, 100 + WORKFLOW_TIMELINE_DRAG_THRESHOLD_PX)
      ).toBe(true);
      expect(timelinePointerExceededDragThreshold(100, 100 - 10, 4)).toBe(true);
    });
  });
});
