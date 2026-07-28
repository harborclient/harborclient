import { afterEach, describe, expect, it } from 'vitest';
import {
  beginWorkflowActionScriptContext,
  endWorkflowActionScriptContext,
  getActiveWorkflowScriptContext,
  noteWorkflowScriptDirectives,
  resetWorkflowScriptContextForTests,
  takeWorkflowScriptDirectives
} from './workflowScriptContext';

describe('workflowScriptContext', () => {
  afterEach(() => {
    resetWorkflowScriptContextForTests();
  });

  it('exposes the active context while an action is playing', () => {
    expect(getActiveWorkflowScriptContext()).toBeNull();
    beginWorkflowActionScriptContext({
      workflowId: 'wf',
      workflowActionId: 'act',
      workflowActionIteration: 2
    });
    expect(getActiveWorkflowScriptContext()).toEqual({
      workflowId: 'wf',
      workflowActionId: 'act',
      workflowActionIteration: 2
    });
    endWorkflowActionScriptContext();
    expect(getActiveWorkflowScriptContext()).toBeNull();
  });

  it('records and clears directives only while a context is active', () => {
    noteWorkflowScriptDirectives({ workflowNextAction: 'ignored', workflowSkipAction: true });
    expect(takeWorkflowScriptDirectives()).toEqual({});

    beginWorkflowActionScriptContext({
      workflowId: 'wf',
      workflowActionId: 'act',
      workflowActionIteration: 0
    });
    noteWorkflowScriptDirectives({ workflowNextAction: 'target' });
    noteWorkflowScriptDirectives({ workflowSkipAction: true });
    endWorkflowActionScriptContext();

    expect(takeWorkflowScriptDirectives()).toEqual({
      workflowNextAction: 'target',
      workflowSkipAction: true
    });
    expect(takeWorkflowScriptDirectives()).toEqual({});
  });
});
