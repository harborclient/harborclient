import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { PageTab, RequestTab } from '#/renderer/src/store/drafts';
import { tabCloseAccessibleName } from '#/renderer/src/ui/Main/RequestEditor/TabBar/tabCloseAccessibleName';

describe('tabCloseAccessibleName', () => {
  it('names request tab close controls with unsaved state', () => {
    const tab: RequestTab = {
      tabId: 't1',
      draft: {
        name: 'Get users',
        method: 'GET',
        url: 'https://example.com/users',
        headers: [{ key: '', value: '', enabled: true }],
        params: [{ key: '', value: '', enabled: true }],
        auth: defaultAuth(),
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: ''
      },
      savedDraft: {
        name: 'Get users',
        method: 'GET',
        url: 'https://example.com',
        headers: [{ key: '', value: '', enabled: true }],
        params: [{ key: '', value: '', enabled: true }],
        auth: defaultAuth(),
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: ''
      },
      response: null,
      sending: false,
      sendingRequestId: null,
      testResults: [],
      scriptLogs: []
    };

    expect(tabCloseAccessibleName(tab)).toBe('Close Get users, unsaved');
  });

  it('names page tab close controls from the resolved title', () => {
    const tab: PageTab = {
      tabId: 'p1',
      kind: 'page',
      page: { type: 'settings', section: 'general' }
    };

    expect(tabCloseAccessibleName(tab, 'General')).toBe('Close General');
  });
});
