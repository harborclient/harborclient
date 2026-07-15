import type { ClientRect, CollisionDetection } from '@dnd-kit/core';
import { closestCenter } from '@dnd-kit/core';
import { describe, expect, it } from 'vitest';
import {
  createCollectionCollisionDetection,
  isContainerDropCollisionId,
  isSortableRowCollisionId,
  rectCenterWithin,
  sortContainerDocuments,
  type ActiveDragKindRef
} from './utils';
import type { CollectionDocument } from '#/shared/types';

/**
 * Options for building collision-detection test args.
 */
interface MakeCollisionArgsOptions {
  /** Droppable ids to include. */
  containerIds: string[];
  /** Pointer coordinates, or null when testing rect intersection only. */
  pointer: { x: number; y: number } | null;
  /** Per-id bounding rects; ids without an entry share a default rect. */
  rectsById?: Record<string, ClientRect>;
  /** Drag overlay collision rect passed to closestCenter. */
  collisionRect?: ClientRect;
}

/**
 * Builds a default square rect at the given origin.
 *
 * @param top Top offset in pixels.
 * @param left Left offset in pixels.
 * @param size Width and height in pixels.
 */
function makeRect(top: number, left: number, size: number): ClientRect {
  return {
    top,
    left,
    width: size,
    height: size,
    bottom: top + size,
    right: left + size
  };
}

/**
 * Builds minimal collision-detection args with configurable rects per droppable.
 *
 * @param options Collision args configuration.
 */
function makeCollisionArgs(options: MakeCollisionArgsOptions): Parameters<CollisionDetection>[0] {
  const defaultRect = makeRect(0, 0, 100);
  const droppableRects = new Map(
    options.containerIds.map((id) => [id, options.rectsById?.[id] ?? defaultRect])
  );
  const droppableContainers = options.containerIds.map((id) => {
    const rect = droppableRects.get(id) ?? defaultRect;
    return {
      id,
      key: id,
      data: { current: {} },
      disabled: false,
      node: { current: null },
      rect: { current: rect }
    };
  });
  const collisionRect = options.collisionRect ?? defaultRect;

  return {
    active: {
      id: 'document:1',
      data: { current: {} },
      rect: { current: { initial: collisionRect, translated: collisionRect } }
    },
    collisionRect,
    droppableRects,
    droppableContainers,
    pointerCoordinates: options.pointer
  } as Parameters<CollisionDetection>[0];
}

describe('sortContainerDocuments', () => {
  it('sorts documents by name case-insensitively', () => {
    const documents: CollectionDocument[] = [
      {
        id: 1,
        collection_id: 1,
        name: 'Zebra.md',
        folder_id: null,
        sort_order: 2,
        uuid: 'a',
        content: '',
        created_at: '',
        updated_at: ''
      },
      {
        id: 2,
        collection_id: 1,
        name: 'alpha.md',
        folder_id: null,
        sort_order: 0,
        uuid: 'b',
        content: '',
        created_at: '',
        updated_at: ''
      },
      {
        id: 3,
        collection_id: 1,
        name: 'Beta.md',
        folder_id: null,
        sort_order: 1,
        uuid: 'c',
        content: '',
        created_at: '',
        updated_at: ''
      }
    ];

    const sorted = sortContainerDocuments(documents);

    expect(sorted.map((doc) => doc.name)).toEqual(['alpha.md', 'Beta.md', 'Zebra.md']);
  });

  it('keeps relative order for equal names', () => {
    const documents: CollectionDocument[] = [
      {
        id: 10,
        collection_id: 1,
        name: 'README.md',
        folder_id: null,
        sort_order: 0,
        uuid: 'a',
        content: '',
        created_at: '',
        updated_at: ''
      },
      {
        id: 20,
        collection_id: 1,
        name: 'README.md',
        folder_id: null,
        sort_order: 1,
        uuid: 'b',
        content: '',
        created_at: '',
        updated_at: ''
      }
    ];

    const sorted = sortContainerDocuments(documents);

    expect(sorted.map((doc) => doc.id)).toEqual([10, 20]);
  });
});

describe('isSortableRowCollisionId', () => {
  it('returns true for request and document row ids', () => {
    expect(isSortableRowCollisionId('request:1')).toBe(true);
    expect(isSortableRowCollisionId('document:42')).toBe(true);
  });

  it('returns false for container and folder ids', () => {
    expect(isSortableRowCollisionId('drop:root:1')).toBe(false);
    expect(isSortableRowCollisionId('drop:folder:1')).toBe(false);
    expect(isSortableRowCollisionId('folder:1')).toBe(false);
  });
});

describe('isContainerDropCollisionId', () => {
  it('returns true for drop zones and folder headers', () => {
    expect(isContainerDropCollisionId('drop:root:1')).toBe(true);
    expect(isContainerDropCollisionId('drop:folder:1')).toBe(true);
    expect(isContainerDropCollisionId('folder:1')).toBe(true);
  });

  it('returns false for request and document row ids', () => {
    expect(isContainerDropCollisionId('request:1')).toBe(false);
    expect(isContainerDropCollisionId('document:1')).toBe(false);
  });
});

describe('rectCenterWithin', () => {
  it('returns true when the rect center lies inside the container', () => {
    const container = makeRect(0, 0, 200);
    const inner = makeRect(50, 50, 20);

    expect(rectCenterWithin(inner, container)).toBe(true);
  });

  it('returns false when the rect center lies outside the container', () => {
    const container = makeRect(0, 0, 50);
    const outside = makeRect(80, 0, 20);

    expect(rectCenterWithin(outside, container)).toBe(false);
  });
});

describe('createCollectionCollisionDetection', () => {
  it('returns a direct row hit when the pointer is over a sortable row', () => {
    const activeDragKindRef: ActiveDragKindRef = { current: 'document' };
    const detect = createCollectionCollisionDetection(activeDragKindRef);
    const args = makeCollisionArgs({
      containerIds: ['drop:root:1', 'request:2'],
      pointer: { x: 50, y: 50 }
    });

    const collisions = detect(args);

    expect(collisions).toHaveLength(1);
    expect(collisions[0]?.id).toBe('request:2');
  });

  it('snaps to the nearest row inside a container when the pointer is in a gap', () => {
    const activeDragKindRef: ActiveDragKindRef = { current: 'document' };
    const detect = createCollectionCollisionDetection(activeDragKindRef);
    const rootRect = { top: 0, left: 0, width: 100, height: 200, bottom: 200, right: 100 };
    const request2Rect = { top: 10, left: 0, width: 100, height: 30, bottom: 40, right: 100 };
    const request3Rect = { top: 50, left: 0, width: 100, height: 30, bottom: 80, right: 100 };
    const collisionRect = {
      top: 70,
      left: 0,
      width: 100,
      height: 30,
      bottom: 100,
      right: 100
    };
    const args = makeCollisionArgs({
      containerIds: ['drop:root:1', 'request:2', 'request:3'],
      pointer: { x: 50, y: 45 },
      rectsById: {
        'drop:root:1': rootRect,
        'request:2': request2Rect,
        'request:3': request3Rect
      },
      collisionRect
    });

    const collisions = detect(args);

    expect(collisions.length).toBeGreaterThan(0);
    expect(collisions[0]?.id).toBe('request:3');
  });

  it('returns the container drop zone when the container has no rows', () => {
    const activeDragKindRef: ActiveDragKindRef = { current: 'document' };
    const detect = createCollectionCollisionDetection(activeDragKindRef);
    const args = makeCollisionArgs({
      containerIds: ['drop:root:1'],
      pointer: { x: 50, y: 50 }
    });

    const collisions = detect(args);

    expect(collisions).toHaveLength(1);
    expect(collisions[0]?.id).toBe('drop:root:1');
  });

  it('delegates folder drags to closest-center collision detection', () => {
    const activeDragKindRef: ActiveDragKindRef = { current: 'folder' };
    const detect = createCollectionCollisionDetection(activeDragKindRef);
    const args = makeCollisionArgs({
      containerIds: ['drop:root:1', 'request:2', 'folder:3'],
      pointer: { x: 50, y: 50 }
    });

    const collisions = detect(args);

    expect(collisions).toEqual(closestCenter(args));
  });
});
