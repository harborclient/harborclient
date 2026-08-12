import { describe, expect, it } from 'vitest';
import { AI_TOOL_DEFINITIONS, AI_TOOL_NAMES, buildAiSystemPrompt, getAiToolInputShape } from '.';

describe('ask_user tool', () => {
  it('registers the renderer pause tool with question and optional choices', () => {
    expect(AI_TOOL_NAMES[0]).toBe('ask_user');
    expect(AI_TOOL_DEFINITIONS[0]).toMatchObject({
      type: 'function',
      function: {
        name: 'ask_user',
        parameters: {
          required: ['question'],
          additionalProperties: false
        }
      }
    });

    const shape = getAiToolInputShape('ask_user');
    expect(shape.question.safeParse('Which environment?').success).toBe(true);
    expect(shape.question.safeParse('').success).toBe(false);
    expect(shape.choices.safeParse(['Staging', 'Production']).success).toBe(true);
  });

  it('guides the agent to pause before ambiguous or unsafe progress', () => {
    const prompt = buildAiSystemPrompt();

    expect(prompt).toContain('call ask_user with one focused question');
    expect(prompt).toContain('Do not guess or continue with action tools');
  });
});
