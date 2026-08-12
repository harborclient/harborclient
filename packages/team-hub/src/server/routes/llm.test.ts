import http from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import {
  authHeader,
  createProtectedTestApp,
  sampleUserRecord
} from '#/server/routes/test/createTestApp.js';
import * as agent from '#/server/llm/agent.js';
import { currentUsagePeriod } from '#/server/llm/models.js';

const sampleLlmConfig = {
  providers: {
    openai: { apiKey: 'sk-test' }
  },
  models: ['gpt-4o']
};

/**
 * Starts an authenticated Team Hub route test app on an ephemeral TCP port.
 *
 * app.inject does not reproduce the distinct request and response lifetimes
 * of a POST SSE connection, so these tests use a real HTTP server.
 *
 * @returns The listening app, its database stub, and assigned TCP port.
 */
async function createListeningLlmTestApp(): Promise<{
  app: Awaited<ReturnType<typeof createProtectedTestApp>>;
  db: ReturnType<typeof createStubDatabase>;
  port: number;
}> {
  const db = createStubDatabase();
  db.getLlmUsage.mockResolvedValue(null);
  db.addLlmUsage.mockResolvedValue({
    id: 'usage-1',
    userId: 'user-1',
    period: currentUsagePeriod(),
    promptTokens: 2,
    completionTokens: 3,
    totalTokens: 5,
    updatedAt: new Date('2026-06-01T00:00:00.000Z')
  });
  db.createLlmUsageLog.mockResolvedValue({
    id: 'log-1',
    userId: 'user-1',
    apiTokenId: 'token-1',
    period: currentUsagePeriod(),
    model: 'gpt-4o',
    provider: 'openai',
    promptTokens: 2,
    completionTokens: 3,
    totalTokens: 5,
    isNewTurn: true,
    hadToolCalls: false,
    messageCount: 1,
    createdAt: new Date('2026-06-01T00:00:00.000Z')
  });
  const app = await createProtectedTestApp({
    db,
    withValidAuth: true,
    llm: sampleLlmConfig,
    user: { ...sampleUserRecord, llmAccess: true, llmModels: ['*'] }
  });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') {
    await app.close();
    throw new Error('Expected a TCP listen address.');
  }

  return { app, db, port: address.port };
}

/**
 * Opens a real HTTP POST SSE request and resolves once response headers arrive.
 *
 * @param port - Ephemeral port of the listening Team Hub test server.
 * @returns Response stream and a function that terminates the client connection.
 */
function openLlmChatStream(port: number): Promise<{
  response: http.IncomingMessage;
  destroy: () => void;
}> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/llm/chat/stream',
        method: 'POST',
        headers: {
          ...authHeader(),
          accept: 'text/event-stream',
          'content-type': 'application/json'
        }
      },
      (response) => {
        response.on('error', () => undefined);
        resolve({
          response,
          destroy: () => {
            request.destroy();
            response.destroy();
          }
        });
      }
    );

    request.setTimeout(3_000, () => {
      request.destroy();
      reject(new Error('Timed out waiting for SSE response headers.'));
    });
    request.on('error', reject);
    request.end(
      JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        turnId: 'turn-1',
        stepIndex: 2
      })
    );
  });
}

/**
 * Creates a manually resolvable promise for coordinating HTTP test timing.
 *
 * @returns Promise and resolver pair.
 */
function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('llm routes', () => {
  it('returns 503 when LLM is not configured', async () => {
    const db = createStubDatabase();
    const app = await createProtectedTestApp({ db, withValidAuth: true, llm: null });

    const response = await app.inject({
      method: 'GET',
      url: '/llm/models',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(503);
    await app.close();
  });

  it('returns 403 when the user lacks LLM access', async () => {
    const db = createStubDatabase();
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      llm: sampleLlmConfig,
      user: { ...sampleUserRecord, llmAccess: false }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/llm/models',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('lists allowed models for an LLM-enabled user', async () => {
    const db = createStubDatabase();
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      llm: sampleLlmConfig,
      user: {
        ...sampleUserRecord,
        llmAccess: true,
        llmModels: ['gpt-4o']
      }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/llm/models',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      models: [{ id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' }],
      capabilities: { openai: true }
    });
    await app.close();
  });

  it('returns 402 when a new turn exceeds the monthly token limit', async () => {
    const period = currentUsagePeriod();
    const db = createStubDatabase();
    db.getLlmUsage.mockResolvedValue({
      id: 'usage-1',
      userId: 'user-1',
      period,
      promptTokens: 900,
      completionTokens: 100,
      totalTokens: 1000,
      updatedAt: new Date('2026-06-01T00:00:00.000Z')
    });

    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      llm: sampleLlmConfig,
      user: {
        ...sampleUserRecord,
        llmAccess: true,
        llmModels: ['*'],
        llmMonthlyTokenLimit: 1000
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/llm/chat/step',
      headers: authHeader(),
      payload: {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }]
      }
    });

    expect(response.statusCode).toBe(402);
    await app.close();
  });

  it('allows continuation steps after the monthly limit is reached', async () => {
    const period = currentUsagePeriod();
    const runHubChatStep = vi.spyOn(agent, 'runHubChatStep').mockResolvedValue({
      content: 'Done',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 }
    });

    const db = createStubDatabase();
    db.getLlmUsage.mockResolvedValue({
      id: 'usage-1',
      userId: 'user-1',
      period,
      promptTokens: 900,
      completionTokens: 100,
      totalTokens: 1000,
      updatedAt: new Date('2026-06-01T00:00:00.000Z')
    });
    db.addLlmUsage.mockResolvedValue({
      id: 'usage-1',
      userId: 'user-1',
      period,
      promptTokens: 901,
      completionTokens: 102,
      totalTokens: 1003,
      updatedAt: new Date('2026-06-01T00:00:00.000Z')
    });
    db.createLlmUsageLog.mockResolvedValue({
      id: 'log-1',
      userId: 'user-1',
      apiTokenId: 'token-1',
      period,
      model: 'gpt-4o',
      provider: 'openai',
      promptTokens: 1,
      completionTokens: 2,
      totalTokens: 3,
      isNewTurn: false,
      hadToolCalls: false,
      messageCount: 1,
      createdAt: new Date('2026-06-01T00:00:00.000Z')
    });

    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      llm: sampleLlmConfig,
      user: {
        ...sampleUserRecord,
        llmAccess: true,
        llmModels: ['*'],
        llmMonthlyTokenLimit: 1000
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/llm/chat/step',
      headers: authHeader(),
      payload: {
        model: 'gpt-4o',
        messages: [{ role: 'tool', tool_call_id: 'call-1', content: '{}' }]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(runHubChatStep).toHaveBeenCalledOnce();
    expect(db.addLlmUsage).toHaveBeenCalledWith('user-1', expect.any(String), 1, 2);
    expect(db.createLlmUsageLog).toHaveBeenCalledWith({
      userId: 'user-1',
      apiTokenId: 'token-1',
      period: expect.any(String),
      model: 'gpt-4o',
      provider: 'openai',
      promptTokens: 1,
      completionTokens: 2,
      totalTokens: 3,
      isNewTurn: false,
      hadToolCalls: false,
      messageCount: 1
    });
    runHubChatStep.mockRestore();
    await app.close();
  });

  it('logs per-request usage for successful new-turn completions', async () => {
    const period = currentUsagePeriod();
    const runHubChatStep = vi.spyOn(agent, 'runHubChatStep').mockResolvedValue({
      content: null,
      toolCalls: [{ id: 'call-1', name: 'listCollections', arguments: '{}' }],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
    });

    const db = createStubDatabase();
    db.getLlmUsage.mockResolvedValue(null);
    db.addLlmUsage.mockResolvedValue({
      id: 'usage-1',
      userId: 'user-1',
      period,
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      updatedAt: new Date('2026-06-01T00:00:00.000Z')
    });
    db.createLlmUsageLog.mockResolvedValue({
      id: 'log-1',
      userId: 'user-1',
      apiTokenId: 'token-1',
      period,
      model: 'gpt-4o',
      provider: 'openai',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      isNewTurn: true,
      hadToolCalls: true,
      messageCount: 2,
      createdAt: new Date('2026-06-01T00:00:00.000Z')
    });

    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      llm: sampleLlmConfig,
      user: {
        ...sampleUserRecord,
        llmAccess: true,
        llmModels: ['*']
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/llm/chat/step',
      headers: authHeader(),
      payload: {
        model: 'gpt-4o',
        messages: [
          { role: 'assistant', content: 'Hi' },
          { role: 'user', content: 'Hello' }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(db.createLlmUsageLog).toHaveBeenCalledWith({
      userId: 'user-1',
      apiTokenId: 'token-1',
      period: expect.any(String),
      model: 'gpt-4o',
      provider: 'openai',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      isNewTurn: true,
      hadToolCalls: true,
      messageCount: 2
    });
    runHubChatStep.mockRestore();
    await app.close();
  });

  it('streams correlated events over SSE and meters the completed step', async () => {
    const runHubChatStepStream = vi
      .spyOn(agent, 'runHubChatStepStream')
      .mockImplementation(async (_config, input) => {
        input.onEvent({
          v: 1,
          type: 'step.start',
          turnId: input.turnId,
          stepIndex: input.stepIndex
        });
        input.onEvent({
          v: 1,
          type: 'delta.text',
          turnId: input.turnId,
          stepIndex: input.stepIndex,
          chunk: 'Hello'
        });
        input.onEvent({
          v: 1,
          type: 'step.end',
          turnId: input.turnId,
          stepIndex: input.stepIndex,
          content: 'Hello',
          usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 }
        });
        return {
          content: 'Hello',
          usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 }
        };
      });
    const db = createStubDatabase();
    db.getLlmUsage.mockResolvedValue(null);
    db.addLlmUsage.mockResolvedValue({
      id: 'usage-1',
      userId: 'user-1',
      period: currentUsagePeriod(),
      promptTokens: 2,
      completionTokens: 3,
      totalTokens: 5,
      updatedAt: new Date('2026-06-01T00:00:00.000Z')
    });
    db.createLlmUsageLog.mockResolvedValue({
      id: 'log-1',
      userId: 'user-1',
      apiTokenId: 'token-1',
      period: currentUsagePeriod(),
      model: 'gpt-4o',
      provider: 'openai',
      promptTokens: 2,
      completionTokens: 3,
      totalTokens: 5,
      isNewTurn: true,
      hadToolCalls: false,
      messageCount: 1,
      createdAt: new Date('2026-06-01T00:00:00.000Z')
    });
    const app = await createProtectedTestApp({
      db,
      withValidAuth: true,
      llm: sampleLlmConfig,
      user: { ...sampleUserRecord, llmAccess: true, llmModels: ['*'] }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/llm/chat/stream',
      headers: authHeader(),
      payload: {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        turnId: 'turn-1',
        stepIndex: 2
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.payload).toContain(': connected');
    expect(response.payload).toContain(
      'data: {"v":1,"type":"delta.text","turnId":"turn-1","stepIndex":2,"chunk":"Hello"}'
    );
    expect(runHubChatStepStream).toHaveBeenCalledWith(
      sampleLlmConfig,
      expect.objectContaining({
        turnId: 'turn-1',
        stepIndex: 2,
        signal: expect.any(AbortSignal)
      }),
      {},
      null
    );
    expect(db.addLlmUsage).toHaveBeenCalledWith('user-1', expect.any(String), 2, 3);
    expect(db.createLlmUsageLog).toHaveBeenCalledWith(
      expect.objectContaining({ totalTokens: 5, isNewTurn: true })
    );
    runHubChatStepStream.mockRestore();
    await app.close();
  });

  it('keeps a real POST SSE stream active after its request body completes', async () => {
    const runHubChatStepStream = vi
      .spyOn(agent, 'runHubChatStepStream')
      .mockImplementation(async (_config, input) => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        if (!input.signal) {
          throw new Error('Expected the route to provide an abort signal.');
        }
        expect(input.signal.aborted).toBe(false);
        input.onEvent({
          v: 1,
          type: 'delta.text',
          turnId: input.turnId,
          stepIndex: input.stepIndex,
          chunk: 'Hello'
        });
        return {
          content: 'Hello',
          usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 }
        };
      });
    const { app, db, port } = await createListeningLlmTestApp();

    try {
      const { response } = await openLlmChatStream(port);
      const body = await new Promise<string>((resolve, reject) => {
        let chunks = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          chunks += chunk;
        });
        response.once('end', () => resolve(chunks));
        response.once('error', reject);
      });

      expect(body).toContain('"type":"delta.text"');
      expect(db.addLlmUsage).toHaveBeenCalledWith('user-1', expect.any(String), 2, 3);
      expect(db.createLlmUsageLog).toHaveBeenCalledWith(
        expect.objectContaining({ totalTokens: 5, isNewTurn: true })
      );
    } finally {
      runHubChatStepStream.mockRestore();
      await app.close();
    }
  });

  it('aborts the Hub stream when the real SSE client disconnects', async () => {
    const streamStarted = createDeferred();
    const streamAborted = createDeferred();
    const runHubChatStepStream = vi
      .spyOn(agent, 'runHubChatStepStream')
      .mockImplementation(async (_config, input) => {
        if (!input.signal) {
          throw new Error('Expected the route to provide an abort signal.');
        }
        const signal = input.signal;
        streamStarted.resolve();
        await new Promise<void>((resolve) => {
          if (signal.aborted) {
            resolve();
            return;
          }
          signal.addEventListener('abort', () => resolve(), { once: true });
        });
        streamAborted.resolve();
        throw new DOMException('The client disconnected.', 'AbortError');
      });
    const { app, db, port } = await createListeningLlmTestApp();

    try {
      const { response, destroy } = await openLlmChatStream(port);
      expect(response.statusCode).toBe(200);
      await streamStarted.promise;

      destroy();
      await streamAborted.promise;

      expect(db.addLlmUsage).not.toHaveBeenCalled();
      expect(db.createLlmUsageLog).not.toHaveBeenCalled();
    } finally {
      runHubChatStepStream.mockRestore();
      await app.close();
    }
  });
});
