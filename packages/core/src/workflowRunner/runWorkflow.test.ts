import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '../auth';
import { DEFAULT_GENERAL_SETTINGS } from '../generalSettings';
import type { Collection, Environment, Folder, SavedRequest, WorkflowAction } from '../types';
import type { SendResult } from '../types';
import type { ICookieJar } from '../interfaces';
import { runWorkflow } from './runWorkflow';
import { createHeadlessWorkflowExecutor } from './headless/createHeadlessWorkflowExecutor';
import { createHeadlessWorkflowSession } from './headless/session';
import { resetWorkflowScriptContextForTests } from './workflowScriptContext';
import { buildWorkflowRunRequestResultFromHeadlessSend } from './headless/buildWorkflowRunRequestResultFromHeadlessSend';
import type { RunRequestResult } from '../requestRunner/types';

/**
 * Builds a workflow action fixture.
 *
 * @param type - Logical event type.
 * @param payload - Action payload.
 * @param uuid - Optional action uuid.
 * @returns Workflow action.
 */
function a(type: string, payload: unknown, uuid?: string): WorkflowAction {
  return {
    uuid: uuid ?? `act-${type}-${JSON.stringify(payload)}`,
    type,
    payload
  };
}

/**
 * Builds a minimal saved request fixture.
 *
 * @returns Saved request.
 */
function sampleRequest(): SavedRequest {
  return {
    id: 10,
    uuid: 'req-uuid-10',
    collection_id: 1,
    name: 'List things',
    method: 'GET',
    url: 'https://example.com/things',
    headers: [],
    params: [],
    auth: defaultAuth(),
    userAgent: '',
    body: '',
    body_type: 'none',
    body_raw: null,
    body_raw_open: false,
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    comment: '',
    tags: '',
    folder_id: null,
    sort_order: 0,
    created_at: '',
    updated_at: ''
  };
}

/**
 * Builds a minimal collection fixture.
 *
 * @returns Collection.
 */
function sampleCollection(): Collection {
  return {
    id: 1,
    uuid: 'col-1',
    name: 'Demo',
    variables: [],
    headers: [],
    userAgent: '',
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    created_at: '',
    updated_at: ''
  } as Collection;
}

/**
 * Creates an in-memory cookie jar stub for tests.
 *
 * @returns Cookie jar mock.
 */
function createCookieJar(): ICookieJar {
  return {
    getCookiesForDomain: vi.fn(() => []),
    listDomains: vi.fn(() => []),
    setCookiesForDomain: vi.fn(),
    buildCookieHeader: vi.fn(() => null),
    captureSetCookies: vi.fn()
  };
}

describe('runWorkflow + headless executor', () => {
  afterEach(() => {
    resetWorkflowScriptContextForTests();
  });

  it('skips UI actions and executes load → draft → send', async () => {
    const request = sampleRequest();
    const collection = sampleCollection();
    const transport = vi.fn(
      async (): Promise<SendResult> => ({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"ok":true}',
        timeMs: 12,
        sizeBytes: 11
      })
    );

    const session = createHeadlessWorkflowSession();
    const host = {
      resolveRequest: vi.fn(async () => request),
      getCollection: vi.fn(async () => collection),
      getFolder: vi.fn(async (): Promise<Folder | null> => null),
      getEnvironmentByUuid: vi.fn(async (): Promise<Environment | null> => null),
      getEnvironmentById: vi.fn(async (): Promise<Environment | null> => null)
    };

    const executor = createHeadlessWorkflowExecutor({
      session,
      host,
      runnerDeps: {
        settings: DEFAULT_GENERAL_SETTINGS,
        cookieJar: createCookieJar(),
        transport
      },
      workflowUuid: 'wf-1'
    });

    const actions = [
      a('tab.new', {}),
      a('request.load', { uuid: request.uuid, id: request.id }),
      a('request.draft', { url: 'https://example.com/updated', name: 'Updated' }),
      a('page.open', { page: { type: 'settings' } }),
      a('request.send', { target: 'active' }, 'send-1')
    ];

    const result = await runWorkflow({
      actions,
      workflowUuid: 'wf-1',
      workflowName: 'Demo Workflow',
      executor,
      delayMs: 0,
      resolveLogResult: (action, playResult) => {
        if (action.type !== 'request.send' || playResult == null) {
          return action.payload as unknown;
        }
        return buildWorkflowRunRequestResultFromHeadlessSend(
          session.activeDraft!,
          playResult as RunRequestResult
        );
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.completed).toBe(true);
    expect(result.failures).toBe(0);
    expect(transport).toHaveBeenCalledOnce();
    expect(session.activeDraft?.url).toBe('https://example.com/updated');
    expect(result.export.actions).toHaveLength(5);
    expect(result.export.harborclientExport).toBe('workflow-run');
  });

  it('stops on failure when stopOnFailure is set', async () => {
    const request = sampleRequest();
    const collection = sampleCollection();
    const transport = vi.fn(
      async (): Promise<SendResult> => ({
        status: 500,
        statusText: 'Error',
        headers: {},
        body: '',
        timeMs: 1,
        sizeBytes: 0
      })
    );

    const session = createHeadlessWorkflowSession();
    const executor = createHeadlessWorkflowExecutor({
      session,
      host: {
        resolveRequest: async () => request,
        getCollection: async () => collection,
        getFolder: async () => null,
        getEnvironmentByUuid: async () => null,
        getEnvironmentById: async () => null
      },
      runnerDeps: {
        settings: DEFAULT_GENERAL_SETTINGS,
        cookieJar: createCookieJar(),
        transport
      },
      workflowUuid: 'wf-1'
    });

    const result = await runWorkflow({
      actions: [
        a('request.load', { uuid: request.uuid }),
        a('request.send', { target: 'active' }, 'send-1'),
        a('request.send', { target: 'active' }, 'send-2')
      ],
      workflowUuid: 'wf-1',
      workflowName: 'Failing',
      executor,
      stopOnFailure: true
    });

    expect(result.stoppedOnFailure).toBe(true);
    expect(result.failures).toBe(1);
    expect(result.completed).toBe(false);
    expect(transport).toHaveBeenCalledOnce();
  });

  it('jumps via workflowNextAction directive', async () => {
    const played: string[] = [];
    const result = await runWorkflow({
      actions: [a('tab.new', {}, 'one'), a('tab.new', {}, 'two'), a('tab.new', {}, 'three')],
      workflowUuid: 'wf-1',
      workflowName: 'Jump',
      executor: {
        play: async (action) => {
          played.push(action.uuid);
          if (action.uuid === 'one') {
            const { noteWorkflowScriptDirectives } = await import('./workflowScriptContext');
            noteWorkflowScriptDirectives({ workflowNextAction: 'three' });
          }
          return undefined;
        }
      }
    });

    expect(result.completed).toBe(true);
    expect(played).toEqual(['one', 'three']);
  });
});

describe('headless skip list', () => {
  it('no-ops skipped types without throwing', async () => {
    const session = createHeadlessWorkflowSession();
    const executor = createHeadlessWorkflowExecutor({
      session,
      host: {
        resolveRequest: async () => null,
        getCollection: async () => null,
        getFolder: async () => null,
        getEnvironmentByUuid: async () => null,
        getEnvironmentById: async () => null
      },
      runnerDeps: {
        settings: DEFAULT_GENERAL_SETTINGS,
        cookieJar: createCookieJar(),
        transport: async () => {
          throw new Error('should not send');
        }
      },
      workflowUuid: 'wf'
    });

    await expect(executor.play(a('tab.close', {}), 0)).resolves.toBeUndefined();
    await expect(executor.play(a('request.save', {}), 0)).resolves.toBeUndefined();
  });
});
