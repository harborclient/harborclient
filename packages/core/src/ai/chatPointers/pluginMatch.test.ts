import { describe, expect, it, beforeEach } from 'vitest';
import {
  compilePluginChatPointerMatch,
  normalizePluginChatPointerMatchSource,
  findReservedChatPointerMatchCollision,
  RESERVED_CHAT_POINTER_MATCH_PROBES,
  registerCustomPluginChatPointerDefinition,
  unregisterCustomPluginChatPointerDefinition,
  findAiScriptReferenceCandidates,
  reinstallBuiltinChatPointersForTests,
  refreshAiScriptReferencePattern,
  resetChatPointerRegistryForTests,
  setCustomPluginChatPointerHandlers,
  isValidAiScriptReference
} from '../scriptReferences.js';

describe('plugin chat pointer match validation', () => {
  it('normalizes RegExp and string sources', () => {
    expect(normalizePluginChatPointerMatchSource(/^invoice\.([a-z]+)$/)).toBe('invoice\\.([a-z]+)');
    expect(normalizePluginChatPointerMatchSource('invoice\\.([a-z]+)')).toBe('invoice\\.([a-z]+)');
  });

  it('rejects global flag and empty patterns', () => {
    expect(() => normalizePluginChatPointerMatchSource(/foo/g)).toThrow(/global/);
    expect(() => normalizePluginChatPointerMatchSource('')).toThrow(/empty/);
  });

  it('rejects reserved builtin collisions', () => {
    expect(() => compilePluginChatPointerMatch(/^logs\./)).toThrow(/reserved/);
    expect(() => compilePluginChatPointerMatch('plugin\\.')).toThrow(/reserved/);
    expect(() => compilePluginChatPointerMatch(/^request\./)).toThrow(/reserved/);
    expect(() => compilePluginChatPointerMatch('term\\.\\d+')).toThrow(/reserved/);
  });

  it('accepts a custom invoice-style pattern', () => {
    const compiled = compilePluginChatPointerMatch(/^invoice\.([A-Za-z0-9-]+)(?:#(\d+)\.(\d+))?/);
    expect('invoice.inv-42#0.12'.match(compiled)?.[0]).toBe('invoice.inv-42#0.12');
    expect(findReservedChatPointerMatchCollision(compiled)).toBeNull();
  });

  it('lists reserved probes covering builtins', () => {
    expect(RESERVED_CHAT_POINTER_MATCH_PROBES.length).toBeGreaterThan(10);
    expect(RESERVED_CHAT_POINTER_MATCH_PROBES.some((p) => p.startsWith('res.'))).toBe(true);
  });
});

describe('custom plugin chat pointer definitions', () => {
  beforeEach(() => {
    resetChatPointerRegistryForTests();
    reinstallBuiltinChatPointersForTests();
    setCustomPluginChatPointerHandlers({
      validate: isValidAiScriptReference,
      resolveName: () => null,
      resolveLabel: () => null,
      expandContext: () => null,
      collectSnapshot: () => null
    });
    refreshAiScriptReferencePattern();
  });

  it('parses custom tokens and does not steal builtin shapes', () => {
    registerCustomPluginChatPointerDefinition({
      pluginId: 'com.example.invoices',
      pointerId: 'invoice',
      match: 'invoice\\.([A-Za-z0-9-]+)(?:#(\\d+)\\.(\\d+))?',
      agentGuidance: 'Prefer invoice snapshots.'
    });
    refreshAiScriptReferencePattern();

    const custom = findAiScriptReferenceCandidates('See @invoice.inv-42#1.5');
    expect(custom).toHaveLength(1);
    expect(custom[0]?.kind).toBe('plugin');
    if (custom[0]?.kind === 'plugin') {
      expect(custom[0].pluginId).toBe('com.example.invoices');
      expect(custom[0].pointerId).toBe('invoice');
      expect(custom[0].key).toBe('inv-42');
      expect(custom[0].selection).toEqual({ start: 1, end: 5 });
    }

    expect(
      findAiScriptReferenceCandidates('@logs.550e8400-e29b-41d4-a716-446655440000')[0]?.kind
    ).toBe('logs');

    unregisterCustomPluginChatPointerDefinition('com.example.invoices', 'invoice');
    refreshAiScriptReferencePattern();
    expect(findAiScriptReferenceCandidates('See @invoice.inv-42')).toEqual([]);
  });
});
