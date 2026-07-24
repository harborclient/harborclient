import { describe, expect, it } from 'vitest';
import { computeAiModelSelectMenuPosition } from './aiModelSelectMenuPosition';

describe('computeAiModelSelectMenuPosition', () => {
  const viewport = { width: 800, height: 600 };

  it('opens below the trigger when there is enough space', () => {
    const position = computeAiModelSelectMenuPosition(
      { left: 100, top: 100, bottom: 132, width: 200, height: 32 },
      { width: 180, height: 200 },
      viewport
    );

    expect(position.top).toBe(136);
    expect(position.left).toBe(100);
    expect(position.width).toBe(200);
  });

  it('opens above the trigger when space below is insufficient', () => {
    const position = computeAiModelSelectMenuPosition(
      { left: 100, top: 500, bottom: 532, width: 200, height: 32 },
      { width: 180, height: 200 },
      viewport
    );

    expect(position.top).toBe(296);
    expect(position.left).toBe(100);
  });

  it('clamps horizontally so the menu stays in the viewport', () => {
    const position = computeAiModelSelectMenuPosition(
      { left: 750, top: 100, bottom: 132, width: 200, height: 32 },
      { width: 180, height: 100 },
      viewport
    );

    expect(position.left).toBe(592);
    expect(position.width).toBe(200);
  });
});
