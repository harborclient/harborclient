import { describe, expect, it } from 'vitest';
import {
  applyScriptAsk,
  applyScriptAskAtLine,
  appendScriptAskThinking,
  buildScriptAskSystemPrompt,
  parseScriptAskResult,
  removeScriptAskCommand,
  removeScriptAskLine,
  renderScriptAskNote,
  stripScriptAskThinking
} from '#/shared/ai/scriptAsk';

describe('buildScriptAskSystemPrompt', () => {
  it('includes numbered script source and the /ask line', () => {
    const prompt = buildScriptAskSystemPrompt({
      code: 'hc.log("hi");\n/ask',
      line: 2,
      phase: 'pre'
    });

    expect(prompt).toContain('line 2');
    expect(prompt).toContain('pre-request');
    expect(prompt).toContain('1| hc.log("hi");');
    expect(prompt).toContain('2| /ask');
    expect(prompt).toContain('answer_script');
    expect(prompt).toContain('replaced entirely');
  });
});

describe('parseScriptAskResult', () => {
  it('reads answer_script tool call arguments', () => {
    const answer = parseScriptAskResult({
      content: null,
      toolCalls: [
        {
          id: '1',
          name: 'answer_script',
          arguments: JSON.stringify({ note: 'Use hc.request.headers.get.' })
        }
      ]
    });

    expect(answer).toEqual({ note: 'Use hc.request.headers.get.' });
  });

  it('prefers code from the tool call', () => {
    const answer = parseScriptAskResult({
      content: null,
      toolCalls: [
        {
          id: '1',
          name: 'answer_script',
          arguments: JSON.stringify({ code: 'hc.log("ok");', note: 'ignored when code present' })
        }
      ]
    });

    expect(answer).toEqual({ code: 'hc.log("ok");', note: 'ignored when code present' });
  });

  it('falls back to plain assistant content as note', () => {
    const answer = parseScriptAskResult({
      content: 'Try hc.request.headers.get("Authorization").',
      toolCalls: []
    });

    expect(answer).toEqual({ note: 'Try hc.request.headers.get("Authorization").' });
  });
});

describe('renderScriptAskNote', () => {
  it('prefixes each line with //', () => {
    expect(renderScriptAskNote('First line\nSecond line')).toBe('// First line\n// Second line');
  });
});

describe('applyScriptAsk', () => {
  it('replaces the slash command span with code', () => {
    const code = 'before\n/ask how?\nafter';
    const from = code.indexOf('/ask');
    const to = code.indexOf('\nafter');

    expect(applyScriptAsk(code, from, to, { code: 'hc.log("ok");' })).toBe(
      'before\nhc.log("ok");\nafter'
    );
  });

  it('replaces the slash command span with comment note', () => {
    const code = 'before\n/ask\nafter';
    const from = code.indexOf('/ask');
    const to = from + '/ask'.length;

    expect(applyScriptAsk(code, from, to, { note: 'Use headers.get' })).toBe(
      'before\n// Use headers.get\nafter'
    );
  });
});

describe('removeScriptAskCommand', () => {
  it('removes the slash command span', () => {
    const code = 'before\n/ask\nafter';
    const from = code.indexOf('/ask');
    const to = from + '/ask'.length;

    expect(removeScriptAskCommand(code, from, to)).toBe('before\nafter');
  });
});

describe('appendScriptAskThinking', () => {
  it('appends the thinking suffix to the target line only', () => {
    const code = '/ask What?\nhc.test("ok");';
    expect(appendScriptAskThinking(code, 1)).toBe('/ask What? Thinking...\nhc.test("ok");');
    expect(appendScriptAskThinking(code, 2)).toBe('/ask What?\nhc.test("ok"); Thinking...');
  });
});

describe('stripScriptAskThinking', () => {
  it('removes the thinking suffix when present', () => {
    expect(stripScriptAskThinking('/ask What? Thinking...')).toBe('/ask What?');
    expect(stripScriptAskThinking('/ask What?')).toBe('/ask What?');
  });
});

describe('applyScriptAskAtLine', () => {
  it('replaces only the /ask line and preserves following lines', () => {
    const code =
      '/ask What does this code do?\nhc.test("Status code is 200", function() {\n  hc.expect(hc.response.code).to.equal(200);\n});';

    expect(applyScriptAskAtLine(code, 1, { note: 'Checks response status.' })).toBe(
      '// Checks response status.\nhc.test("Status code is 200", function() {\n  hc.expect(hc.response.code).to.equal(200);\n});'
    );
  });

  it('strips the thinking suffix before applying the answer', () => {
    const code = '/ask What? Thinking...\nhc.log("ok");';
    expect(applyScriptAskAtLine(code, 1, { code: 'hc.log("answer");' })).toBe(
      'hc.log("answer");\nhc.log("ok");'
    );
  });

  it('leaves code unchanged when the target line is not /ask', () => {
    const code = 'hc.log("hi");\n/ask';
    expect(applyScriptAskAtLine(code, 1, { note: 'ignored' })).toBe(code);
  });

  it('replaces the target line when replaceMissingAskLine is set', () => {
    const code = '\nhc.test("Status code is 200", function() {';
    expect(
      applyScriptAskAtLine(
        code,
        1,
        { note: 'Checks response status.' },
        { replaceMissingAskLine: true }
      )
    ).toBe('// Checks response status.\nhc.test("Status code is 200", function() {');
  });
});

describe('removeScriptAskLine', () => {
  it('removes the entire /ask line by line number', () => {
    const code = 'before\n/ask\nafter';
    expect(removeScriptAskLine(code, 2)).toBe('before\nafter');
  });

  it('removes a line with the thinking suffix', () => {
    const code = 'before\n/ask Thinking...\nafter';
    expect(removeScriptAskLine(code, 2)).toBe('before\nafter');
  });
});
