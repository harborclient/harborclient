import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPluginAiInstructions,
  listPluginAiInstructions,
  registerPluginAiInstructions,
  resetPluginAiInstructionsForTests
} from './pluginAiInstructions.js';
import { buildAiSystemPrompt } from './tools/systemPrompt.js';
import {
  reinstallBuiltinChatPointersForTests,
  refreshAiScriptReferencePattern,
  resetChatPointerRegistryForTests
} from './scriptReferences.js';

describe('pluginAiInstructions', () => {
  beforeEach(() => {
    resetPluginAiInstructionsForTests();
    resetChatPointerRegistryForTests();
    reinstallBuiltinChatPointersForTests();
    refreshAiScriptReferencePattern();
  });

  it('registers and clears instruction fragments', () => {
    const dispose = registerPluginAiInstructions(
      'com.example.p',
      '1',
      'Prefer Invoice tools for billing questions.'
    );
    expect(getPluginAiInstructions()).toContain('Prefer Invoice tools');
    expect(listPluginAiInstructions('com.example.p')).toEqual([
      'Prefer Invoice tools for billing questions.'
    ]);
    dispose();
    expect(getPluginAiInstructions()).toBe('');
  });

  it('ignores whitespace-only fragments', () => {
    registerPluginAiInstructions('com.example.p', '1', '   ');
    expect(getPluginAiInstructions()).toBe('');
  });

  it('appends plugin instructions in buildAiSystemPrompt', () => {
    registerPluginAiInstructions('com.example.p', '1', 'Always cite MCP tool errors.');
    const prompt = buildAiSystemPrompt();
    expect(prompt).toContain('You are an assistant embedded in HarborClient');
    expect(prompt).toContain('Plugin instructions:');
    expect(prompt).toContain('Always cite MCP tool errors.');
  });
});
