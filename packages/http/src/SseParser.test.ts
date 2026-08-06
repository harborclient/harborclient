import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SSE_RETRY_MS,
  isEventStreamContentType,
  MAX_SSE_RETRY_MS,
  SseParser,
  sseReconnectDelay
} from './SseParser.js';

describe('SseParser', () => {
  it('parses a single data event with default message type', () => {
    const parser = new SseParser();
    const events = parser.push('data: hello\n\n');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      seq: 1,
      type: 'message',
      data: 'hello',
      raw: 'data: hello'
    });
  });

  it('joins multi-line data with newlines', () => {
    const parser = new SseParser();
    const events = parser.push('data: line1\ndata: line2\n\n');
    expect(events[0]?.data).toBe('line1\nline2');
  });

  it('parses event, id, and retry fields', () => {
    const parser = new SseParser();
    const events = parser.push('event: update\nid: 42\nretry: 5000\ndata: {"ok":true}\n\n');
    expect(events[0]).toMatchObject({
      type: 'update',
      id: '42',
      data: '{"ok":true}',
      retryMs: 5000
    });
    expect(parser.lastEventId).toBe('42');
    expect(parser.retryMs).toBe(5000);
  });

  it('ignores comment lines and blank events without data', () => {
    const parser = new SseParser();
    const events = parser.push(': keep-alive\n\nevent: ping\n\ndata: x\n\n');
    expect(events).toHaveLength(1);
    expect(events[0]?.data).toBe('x');
  });

  it('tolerates CRLF and CR line terminators', () => {
    const parser = new SseParser();
    const crlf = parser.push('data: a\r\n\r\n');
    expect(crlf[0]?.data).toBe('a');
    const cr = parser.push('data: b\r\r');
    expect(cr[0]?.data).toBe('b');
  });

  it('handles events split across chunk boundaries', () => {
    const parser = new SseParser();
    expect(parser.push('data: hel')).toEqual([]);
    expect(parser.push('lo\nid: 1')).toEqual([]);
    const events = parser.push('\n\n');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ data: 'hello', id: '1', seq: 1 });
  });

  it('assigns monotonic sequence numbers', () => {
    const parser = new SseParser();
    const events = parser.push('data: a\n\ndata: b\n\n');
    expect(events.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('continues sequence numbers when seeded from a prior connection', () => {
    const parser = new SseParser('', 2);
    const events = parser.push('data: c\n\ndata: d\n\n');
    expect(events.map((e) => e.seq)).toEqual([3, 4]);
    expect(parser.seq).toBe(4);
    expect(parser.nextSeq).toBe(5);
  });

  it('ignores id fields containing a null character', () => {
    const parser = new SseParser('seed');
    parser.push('id: bad\0id\ndata: x\n\n');
    expect(parser.lastEventId).toBe('seed');
  });

  it('caps retry values at MAX_SSE_RETRY_MS', () => {
    const parser = new SseParser();
    parser.push(`retry: ${MAX_SSE_RETRY_MS + 1}\ndata: x\n\n`);
    expect(parser.retryMs).toBe(MAX_SSE_RETRY_MS);
  });

  it('ignores non-integer retry values', () => {
    const parser = new SseParser();
    parser.push('retry: abc\ndata: x\n\n');
    expect(parser.retryMs).toBe(DEFAULT_SSE_RETRY_MS);
  });

  it('strips one leading space after the colon', () => {
    const parser = new SseParser();
    const events = parser.push('data: value\n\n');
    expect(events[0]?.data).toBe('value');
  });

  it('flush discards incomplete trailing state', () => {
    const parser = new SseParser();
    parser.push('data: incomplete');
    expect(parser.flush()).toEqual([]);
    expect(parser.push('data: next\n\n')[0]?.data).toBe('next');
  });
});

describe('isEventStreamContentType', () => {
  it('accepts text/event-stream with optional parameters', () => {
    expect(isEventStreamContentType('text/event-stream')).toBe(true);
    expect(isEventStreamContentType('text/event-stream; charset=utf-8')).toBe(true);
    expect(isEventStreamContentType('TEXT/EVENT-STREAM')).toBe(true);
  });

  it('rejects missing or other media types', () => {
    expect(isEventStreamContentType(null)).toBe(false);
    expect(isEventStreamContentType('application/json')).toBe(false);
  });
});

describe('sseReconnectDelay', () => {
  it('scales by attempt and caps at the maximum', () => {
    expect(sseReconnectDelay(1000, 1)).toBe(1000);
    expect(sseReconnectDelay(1000, 3)).toBe(3000);
    expect(sseReconnectDelay(MAX_SSE_RETRY_MS, 2)).toBe(MAX_SSE_RETRY_MS);
  });
});
