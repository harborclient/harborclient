import { describe, expect, it, beforeEach } from 'vitest';
import {
  findAiScriptReferenceCandidates,
  getChatPointerAgentGuidance,
  getRegisteredChatPointers,
  buildPluginChatPointerToken,
  isValidAiScriptReference,
  buildAiScriptSelectionContextMessage,
  reinstallBuiltinChatPointersForTests,
  refreshAiScriptReferencePattern,
  registerPluginChatPointerGuidance,
  resetChatPointerRegistryForTests
} from '../scriptReferences.js';

describe('chat pointer registry', () => {
  beforeEach(() => {
    resetChatPointerRegistryForTests();
    reinstallBuiltinChatPointersForTests();
    refreshAiScriptReferencePattern();
  });

  it('registers builtin pointer kinds', () => {
    const ids = getRegisteredChatPointers().map((entry) => entry.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'request-script',
        'snippet',
        'terminal',
        'collection',
        'folder',
        'request',
        'webpage',
        'live-server',
        'logs',
        'markdown',
        'response-section',
        'body',
        'plugin'
      ])
    );
  });

  it('parses plugin tokens and prefers longer body matches', () => {
    const token = buildPluginChatPointerToken('com.example.p', 'script', 'abc-1', {
      start: 0,
      end: 4
    });
    const candidates = findAiScriptReferenceCandidates(`Explain ${token} please`);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.kind).toBe('plugin');
    if (candidates[0]?.kind === 'plugin') {
      expect(candidates[0].pluginId).toBe('com.example.p');
      expect(candidates[0].pointerId).toBe('script');
      expect(candidates[0].key).toBe('abc-1');
      expect(candidates[0].selection).toEqual({ start: 0, end: 4 });
    }
  });

  it('ignores unknown @ tokens', () => {
    expect(findAiScriptReferenceCandidates('see @unknown.thing')).toEqual([]);
  });

  it('expands plugin snapshots into send-time context', () => {
    const token = buildPluginChatPointerToken('com.example.p', 'script', 'k1');
    const message = buildAiScriptSelectionContextMessage(`About ${token}`, {
      hasActiveRequestTab: false,
      preScriptCount: 0,
      postScriptCount: 0,
      pluginSelections: {
        [token]: {
          pluginId: 'com.example.p',
          pointerId: 'script',
          label: 'My Script',
          context: 'console.log(1)'
        }
      }
    });
    expect(message).toContain('My Script');
    expect(message).toContain('console.log(1)');
    expect(
      isValidAiScriptReference(findAiScriptReferenceCandidates(token)[0]!, {
        hasActiveRequestTab: false,
        preScriptCount: 0,
        postScriptCount: 0,
        pluginSelections: {
          [token]: {
            pluginId: 'com.example.p',
            pointerId: 'script',
            label: 'My Script',
            context: 'console.log(1)'
          }
        }
      })
    ).toBe(true);
  });

  it('includes builtin and plugin agent guidance', () => {
    const dispose = registerPluginChatPointerGuidance(
      'com.example.p',
      'script',
      'Plugin script pointers include captured source.'
    );
    const guidance = getChatPointerAgentGuidance();
    expect(guidance).toContain('@collection.<uuid>');
    expect(guidance).toContain('@live-server.<uuid>');
    expect(guidance).toContain('@logs.<uuid>');
    expect(guidance).toContain('document.elementFromPoint');
    expect(guidance).toContain('Plugin script pointers include captured source.');
    dispose();
  });
});
