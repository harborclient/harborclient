import { describe, expect, it } from 'vitest';
import {
  buildResponseEditorSplitMenuActions,
  moveTabToSecondarySplit,
  partitionResponseTabs,
  resolvePaneActiveTab,
  responseEditorSplitMenuLabel,
  unsplitResponseTab
} from './responseEditorSplit';

describe('responseEditorSplit helpers', () => {
  const tabs = [
    { value: 'body', label: 'Body' },
    { value: 'headers', label: 'Headers' },
    { value: 'console', label: 'Console' }
  ];

  it('partitions tabs with secondary order preserved', () => {
    expect(partitionResponseTabs(tabs, ['console', 'body'])).toEqual({
      primary: [{ value: 'headers', label: 'Headers' }],
      secondary: [
        { value: 'console', label: 'Console' },
        { value: 'body', label: 'Body' }
      ]
    });
  });

  it('omits unavailable secondary ids from the strip', () => {
    expect(partitionResponseTabs(tabs, ['console', 'missing'])).toEqual({
      primary: [
        { value: 'body', label: 'Body' },
        { value: 'headers', label: 'Headers' }
      ],
      secondary: [{ value: 'console', label: 'Console' }]
    });
  });

  it('offers all four split actions when unsplit', () => {
    expect(buildResponseEditorSplitMenuActions('primary', null, true)).toEqual([
      { type: 'split', side: 'left' },
      { type: 'split', side: 'right' },
      { type: 'split', side: 'down' },
      { type: 'split', side: 'up' }
    ]);
  });

  it('offers only the existing side when a split is active', () => {
    expect(
      buildResponseEditorSplitMenuActions(
        'primary',
        {
          side: 'right',
          secondaryTabIds: ['console'],
          size: 280,
          activeTab: 'console'
        },
        true
      )
    ).toEqual([{ type: 'split', side: 'right' }]);
  });

  it('offers Unsplit for secondary pane tabs', () => {
    expect(
      buildResponseEditorSplitMenuActions(
        'secondary',
        {
          side: 'right',
          secondaryTabIds: ['console'],
          size: 280,
          activeTab: 'console'
        },
        true
      )
    ).toEqual([{ type: 'unsplit' }]);
    expect(responseEditorSplitMenuLabel({ type: 'unsplit' })).toBe('Unsplit');
  });

  it('creates and grows a secondary split', () => {
    const created = moveTabToSecondarySplit(null, 'console', 'right', 3);
    expect(created).toEqual({
      side: 'right',
      secondaryTabIds: ['console'],
      size: 280,
      activeTab: 'console'
    });

    const grown = moveTabToSecondarySplit(created, 'body', 'right', 2);
    expect(grown?.secondaryTabIds).toEqual(['console', 'body']);
    expect(grown?.activeTab).toBe('body');
  });

  it('refuses to move the last primary tab', () => {
    expect(moveTabToSecondarySplit(null, 'body', 'left', 1)).toBeNull();
  });

  it('clears the split when the last secondary tab is unsplit', () => {
    const split = {
      side: 'left' as const,
      secondaryTabIds: ['console', 'body'],
      size: 300,
      activeTab: 'body'
    };
    expect(unsplitResponseTab(split, 'body')).toEqual({
      side: 'left',
      secondaryTabIds: ['console'],
      size: 300,
      activeTab: 'console'
    });
    expect(
      unsplitResponseTab({ ...split, secondaryTabIds: ['body'], activeTab: 'body' }, 'body')
    ).toBe(null);
  });

  it('resolves pane active tabs with fallbacks', () => {
    expect(resolvePaneActiveTab('headers', ['body', 'headers'], 'body')).toBe('headers');
    expect(resolvePaneActiveTab('missing', ['body', 'headers'], 'body')).toBe('body');
  });
});
