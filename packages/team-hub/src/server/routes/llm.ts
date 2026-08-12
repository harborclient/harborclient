import type { FastifyInstance } from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { DocsConfig } from '#/config/docsConfig.js';
import type { LlmConfig } from '#/config/llmConfig.js';
import type { IDatabase } from '#/db/IDatabase.js';
import { canUseLlm, isLlmModelAllowed, isOverMonthlyLimit } from '#/server/auth/accessControl.js';
import { runHubChatStep, runHubChatStepStream } from '#/server/llm/agent.js';
import {
  currentUsagePeriod,
  getHubLlmCapabilities,
  getHubModelById,
  isHubModelOffered,
  listHubOfferedModels
} from '#/server/llm/models.js';
import { denyUnlessAllowed, requireAuthenticatedUser } from '#/server/routes/authorize.js';
import { errorResponseSchema } from '#/server/routes/schemas/common.js';
import {
  listLlmModelsResponseSchema,
  llmChatStreamBodySchema,
  llmChatStepBodySchema,
  llmChatStepResponseSchema,
  llmUsageSummaryResponseSchema
} from '#/server/routes/schemas/llm.js';

/**
 * Interval between SSE heartbeat comments for LLM chat streams.
 */
const LLM_CHAT_STREAM_HEARTBEAT_MS = 30_000;

/**
 * Options for registering LLM proxy routes.
 */
export interface RegisterLlmRoutesOptions {
  /**
   * Database used for usage metering and user access checks.
   */
  db: IDatabase;

  /**
   * Returns the current normalized LLM configuration from server.yaml.
   */
  getLlm: () => LlmConfig | null;

  /**
   * Returns the current normalized documentation search configuration from server.yaml.
   */
  getDocs: () => DocsConfig | null;
}

/**
 * Sends a 402 response when the user has exceeded their monthly token limit.
 *
 * @param reply - Fastify reply used to short-circuit the handler.
 */
function sendMonthlyLimitExceeded(reply: FastifyReply): FastifyReply {
  return reply.code(402).send({
    error: 'Monthly LLM token limit reached. Try again next month or contact your administrator.'
  });
}

/**
 * Sends a 503 response when LLM support is not configured on the hub.
 *
 * @param reply - Fastify reply used to short-circuit the handler.
 */
function sendLlmUnavailable(reply: FastifyReply): FastifyReply {
  return reply.code(503).send({
    error: 'LLM support is not configured on this Team Hub.'
  });
}

/**
 * Records aggregate and request-level usage after a completed LLM step.
 *
 * @param options - Route dependencies containing the tenant database.
 * @param request - Authenticated request carrying the API token attribution.
 * @param input - Completed step metadata to persist.
 * @returns A promise that resolves after both metering records are stored.
 */
async function recordLlmUsage(
  options: RegisterLlmRoutesOptions,
  request: FastifyRequest,
  input: {
    userId: string;
    period: string;
    model: string;
    isNewTurn: boolean;
    messageCount: number;
    hadToolCalls: boolean;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  }
): Promise<void> {
  const catalogModel = getHubModelById(input.model);
  if (!catalogModel) {
    throw new Error(`Unknown hub model: ${input.model}`);
  }

  await options.db.addLlmUsage(
    input.userId,
    input.period,
    input.usage.promptTokens,
    input.usage.completionTokens
  );
  await options.db.createLlmUsageLog({
    userId: input.userId,
    apiTokenId: request.apiToken?.id ?? null,
    period: input.period,
    model: input.model,
    provider: catalogModel.provider,
    promptTokens: input.usage.promptTokens,
    completionTokens: input.usage.completionTokens,
    totalTokens: input.usage.totalTokens,
    isNewTurn: input.isNewTurn,
    hadToolCalls: input.hadToolCalls,
    messageCount: input.messageCount
  });
}

/**
 * Returns whether an error represents cancellation of a provider stream.
 *
 * @param error - Unknown failure from a fetch, reader, or stream route.
 * @returns True when the request was intentionally aborted.
 */
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Writes a normalized event as one SSE data frame.
 *
 * @param reply - Hijacked Fastify reply owning the downstream socket.
 * @param event - Validated event emitted by the Hub agent loop.
 */
function writeStreamEvent(reply: FastifyReply, event: unknown): void {
  if (!reply.raw.writableEnded) {
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

/**
 * Opens an authenticated LLM step stream and releases upstream resources on disconnect.
 *
 * Usage is persisted only after a complete step reaches `step.end`; aborted
 * and post-header failed streams are intentionally not charged.
 *
 * @param request - Validated authenticated stream request.
 * @param reply - Fastify reply hijacked for manual SSE output.
 * @param options - Route configuration and database dependencies.
 * @param context - Prevalidated authorization and usage metadata.
 * @returns A promise that settles when the stream has completed or closed.
 */
async function startLlmChatStream(
  request: FastifyRequest,
  reply: FastifyReply,
  options: RegisterLlmRoutesOptions,
  context: {
    llm: LlmConfig;
    userId: string;
    period: string;
    isNewTurn: boolean;
  }
): Promise<void> {
  const controller = new AbortController();
  const response = reply.raw;
  const socket = response.socket;
  let cleaned = false;
  const heartbeat = setInterval(() => {
    if (!response.writableEnded) {
      response.write(': heartbeat\n\n');
    }
  }, LLM_CHAT_STREAM_HEARTBEAT_MS);

  /**
   * Releases downstream listeners and cancels upstream work only once.
   *
   * The request's `close` event means its POST body was fully received, not
   * that the hijacked SSE response was disconnected. The response and its
   * socket instead represent the downstream stream's lifetime.
   */
  const cleanup = (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    clearInterval(heartbeat);
    response.removeListener('close', cleanup);
    socket?.removeListener('close', cleanup);
    controller.abort();
  };

  reply.hijack();
  response.once('close', cleanup);
  socket?.once('close', cleanup);
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  response.write(': connected\n\n');

  try {
    const { model, messages, tools, systemPrompt, turnId, stepIndex } =
      request.body as import('#/server/routes/schemas/llm.js').LlmChatStreamBody;
    const result = await runHubChatStepStream(
      context.llm,
      {
        model,
        messages,
        tools,
        systemPrompt,
        turnId,
        stepIndex,
        signal: controller.signal,
        onEvent: (event) => writeStreamEvent(reply, event)
      },
      {},
      options.getDocs()
    );

    if (!controller.signal.aborted) {
      await recordLlmUsage(options, request, {
        userId: context.userId,
        period: context.period,
        model,
        isNewTurn: context.isNewTurn,
        messageCount: messages.length,
        hadToolCalls: Boolean(result.toolCalls && result.toolCalls.length > 0),
        usage: result.usage
      });
    }
  } catch (error) {
    if (!controller.signal.aborted && !response.writableEnded) {
      writeStreamEvent(reply, {
        v: 1,
        type: isAbortError(error) ? 'turn.cancelled' : 'turn.error',
        turnId: (request.body as import('#/server/routes/schemas/llm.js').LlmChatStreamBody).turnId,
        ...(isAbortError(error) ? {} : { message: 'The Team Hub chat step failed.' })
      });
    }
  } finally {
    cleanup();
    if (!response.writableEnded) {
      response.end();
    }
  }
}

/**
 * Registers bearer-protected LLM proxy routes.
 *
 * @param app - Encapsulated Fastify scope with auth applied.
 * @param options - Database and LLM configuration.
 */
export async function registerLlmRoutes(
  app: FastifyInstance,
  options: RegisterLlmRoutesOptions
): Promise<void> {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.route({
    method: 'GET',
    url: '/llm/models',
    schema: {
      response: {
        200: listLlmModelsResponseSchema,
        403: errorResponseSchema,
        503: errorResponseSchema
      }
    },
    /**
     * Lists hub-offered models the authenticated user may use.
     */
    handler: async (request, reply) => {
      const llm = options.getLlm();
      if (!llm) {
        return sendLlmUnavailable(reply);
      }

      const user = requireAuthenticatedUser(request);
      if (denyUnlessAllowed(reply, canUseLlm(user))) {
        return;
      }

      const offered = listHubOfferedModels(llm).filter((model) =>
        isLlmModelAllowed(user, model.id)
      );

      return reply.send({
        models: offered.map((model) => ({
          id: model.id,
          label: model.label,
          provider: model.provider
        })),
        capabilities: getHubLlmCapabilities(llm)
      });
    }
  });

  routes.route({
    method: 'GET',
    url: '/llm/usage',
    schema: {
      response: {
        200: llmUsageSummaryResponseSchema,
        403: errorResponseSchema,
        503: errorResponseSchema
      }
    },
    /**
     * Returns the authenticated user's current monthly LLM usage summary.
     */
    handler: async (request, reply) => {
      const llm = options.getLlm();
      if (!llm) {
        return sendLlmUnavailable(reply);
      }

      const user = requireAuthenticatedUser(request);
      if (denyUnlessAllowed(reply, canUseLlm(user))) {
        return;
      }

      const period = currentUsagePeriod();
      const usage = await options.db.getLlmUsage(user.id, period);

      return reply.send({
        period,
        totalTokens: usage?.totalTokens ?? 0,
        limit: user.llmMonthlyTokenLimit
      });
    }
  });

  routes.route({
    method: 'POST',
    url: '/llm/chat/step',
    schema: {
      body: llmChatStepBodySchema,
      response: {
        200: llmChatStepResponseSchema,
        402: errorResponseSchema,
        403: errorResponseSchema,
        503: errorResponseSchema
      }
    },
    /**
     * Runs one stateless LLM completion step using hub-configured provider keys.
     */
    handler: async (request, reply) => {
      const llm = options.getLlm();
      if (!llm) {
        return sendLlmUnavailable(reply);
      }

      const user = requireAuthenticatedUser(request);
      if (denyUnlessAllowed(reply, canUseLlm(user))) {
        return;
      }

      const { model, messages, tools, systemPrompt } = request.body;

      if (!isHubModelOffered(llm, model)) {
        return reply.code(403).send({ error: 'Model is not offered by this Team Hub.' });
      }

      if (!isLlmModelAllowed(user, model)) {
        return reply.code(403).send({ error: 'You are not allowed to use this model.' });
      }

      const period = currentUsagePeriod();
      const usage = await options.db.getLlmUsage(user.id, period);
      const totalTokens = usage?.totalTokens ?? 0;
      const lastMessage = messages.at(-1);
      const isNewTurn = lastMessage?.role === 'user';

      if (isNewTurn && isOverMonthlyLimit(totalTokens, user.llmMonthlyTokenLimit)) {
        return sendMonthlyLimitExceeded(reply);
      }

      const result = await runHubChatStep(
        llm,
        {
          model,
          messages,
          tools,
          systemPrompt
        },
        {},
        options.getDocs()
      );

      await recordLlmUsage(options, request, {
        userId: user.id,
        period,
        model,
        isNewTurn,
        messageCount: messages.length,
        hadToolCalls: Boolean(result.toolCalls && result.toolCalls.length > 0),
        usage: result.usage
      });

      return reply.send({
        content: result.content,
        ...(result.toolCalls && result.toolCalls.length > 0 ? { toolCalls: result.toolCalls } : {}),
        usage: result.usage
      });
    }
  });

  routes.route({
    method: 'POST',
    url: '/llm/chat/stream',
    schema: {
      body: llmChatStreamBodySchema,
      response: {
        402: errorResponseSchema,
        403: errorResponseSchema,
        503: errorResponseSchema
      }
    },
    /**
     * Streams one complete Hub agent step after all authorization and quota checks pass.
     */
    handler: async (request, reply) => {
      const llm = options.getLlm();
      if (!llm) {
        return sendLlmUnavailable(reply);
      }

      const user = requireAuthenticatedUser(request);
      if (denyUnlessAllowed(reply, canUseLlm(user))) {
        return;
      }

      const { model, messages } = request.body;
      if (!isHubModelOffered(llm, model)) {
        return reply.code(403).send({ error: 'Model is not offered by this Team Hub.' });
      }
      if (!isLlmModelAllowed(user, model)) {
        return reply.code(403).send({ error: 'You are not allowed to use this model.' });
      }

      const period = currentUsagePeriod();
      const usage = await options.db.getLlmUsage(user.id, period);
      const isNewTurn = messages.at(-1)?.role === 'user';
      if (isNewTurn && isOverMonthlyLimit(usage?.totalTokens ?? 0, user.llmMonthlyTokenLimit)) {
        return sendMonthlyLimitExceeded(reply);
      }

      await startLlmChatStream(request, reply, options, {
        llm,
        userId: user.id,
        period,
        isNewTurn
      });
    }
  });
}
