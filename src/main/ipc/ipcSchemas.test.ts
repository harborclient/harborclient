import { describe, expect, it } from 'vitest';
import { HARD_MAX_RESPONSE_SIZE_MB } from '@harborclient/http';
import {
  MAX_IPC_COMMENT_CHARS,
  MAX_IPC_REQUEST_BODY_CHARS,
  MAX_IPC_SCRIPT_CHARS,
  MAX_IPC_URL_CHARS
} from './ipcLimits';
import {
  bodyType,
  storageConnection,
  editorTab,
  generalSettings,
  httpMethod,
  ipcArgSchemas,
  saveRequestInput,
  sendRequestInput,
  scriptRunInput,
  themeSource,
  variable
} from './ipcSchemas';

const validKeyValue = { key: 'Authorization', value: 'Bearer x', enabled: true };

const validSaveRequest = {
  collection_id: 1,
  name: 'Get users',
  method: 'GET' as const,
  url: 'https://example.com/users',
  headers: [validKeyValue],
  params: [],
  body: '',
  body_type: 'none' as const,
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  comment: '',
  tags: '',
  auth: {
    type: 'none' as const,
    basic: { username: '', password: '' },
    bearer: { token: '' },
    oauth2: {
      tokenUrl: '',
      clientId: '',
      clientSecret: '',
      scope: '',
      audience: '',
      clientAuth: 'body' as const
    }
  }
};

const validSendRequest = {
  method: 'POST' as const,
  url: 'https://example.com',
  headers: [],
  params: [],
  body: '{}',
  bodyType: 'json' as const
};

const validScriptRun = {
  phase: 'pre' as const,
  script: 'hc.test("ok", () => true);',
  request: validSendRequest,
  variables: { foo: 'bar' }
};

const validGitConnectionId = 'git-conn-abc123';

describe('enum schemas', () => {
  it('httpMethod rejects unknown values', () => {
    expect(httpMethod.safeParse('FETCH').success).toBe(false);
    expect(httpMethod.safeParse('GET').success).toBe(true);
  });

  it('bodyType rejects unknown values', () => {
    expect(bodyType.safeParse('xml').success).toBe(false);
    expect(bodyType.safeParse('json').success).toBe(true);
  });

  it('themeSource rejects unknown values', () => {
    expect(themeSource.safeParse('auto').success).toBe(false);
    expect(themeSource.safeParse('system').success).toBe(true);
    expect(themeSource.safeParse('high-contrast').success).toBe(true);
  });

  it('editorTab rejects unknown values', () => {
    expect(editorTab.safeParse('tests').success).toBe(false);
    expect(editorTab.safeParse('headers').success).toBe(true);
    expect(editorTab.safeParse('auth').success).toBe(true);
  });
});

describe('saveRequestInput', () => {
  it('parses saveRequestInput with required collection_id, method, and KeyValue headers', () => {
    expect(saveRequestInput.safeParse(validSaveRequest).success).toBe(true);
  });

  it('preserves expanded on script reference arrays', () => {
    const parsed = saveRequestInput.safeParse({
      ...validSaveRequest,
      pre_request_scripts: [
        {
          id: 'script-1',
          enabled: true,
          kind: 'inline',
          code: '',
          expanded: false
        }
      ]
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pre_request_scripts[0]?.expanded).toBe(false);
    }
  });

  it('accepts optional folder_id as null or number', () => {
    expect(saveRequestInput.safeParse({ ...validSaveRequest, folder_id: null }).success).toBe(true);
    expect(saveRequestInput.safeParse({ ...validSaveRequest, folder_id: 3 }).success).toBe(true);
  });

  it('rejects missing collection_id', () => {
    const invalid = { ...validSaveRequest };
    delete (invalid as { collection_id?: number }).collection_id;
    expect(saveRequestInput.safeParse(invalid).success).toBe(false);
  });

  it('rejects wrong-typed headers', () => {
    expect(
      saveRequestInput.safeParse({ ...validSaveRequest, headers: [{ key: 1, value: 'x' }] }).success
    ).toBe(false);
  });

  it('rejects unknown method FETCH and body_type xml in saveRequestInput', () => {
    expect(saveRequestInput.safeParse({ ...validSaveRequest, method: 'FETCH' }).success).toBe(
      false
    );
    expect(saveRequestInput.safeParse({ ...validSaveRequest, body_type: 'xml' }).success).toBe(
      false
    );
  });
});

describe('storageConnection', () => {
  it('parses sqlite storageConnection with dbFilename settings', () => {
    expect(
      storageConnection.safeParse({
        id: 'abc',
        name: 'Local',
        type: 'sqlite',
        settings: {
          dbFilename: 'harborclient.db',
          legacyDbFilename: 'harbor-client.db',
          legacyUserDataDir: 'harbor-client'
        }
      }).success
    ).toBe(true);
  });

  it('parses mysql storageConnection with host, port, and credentials', () => {
    expect(
      storageConnection.safeParse({
        id: 'mysql-1',
        name: 'MySQL',
        type: 'mysql',
        settings: {
          host: '127.0.0.1',
          port: 3306,
          user: 'root',
          password: '',
          database: 'app'
        }
      }).success
    ).toBe(true);
  });

  it('rejects storageConnection when type is not sqlite, mysql, or postgres', () => {
    expect(
      storageConnection.safeParse({
        id: 'x',
        name: 'Bad',
        type: 'mongodb',
        settings: {}
      }).success
    ).toBe(false);
  });

  it('rejects wrong settings shape for sqlite', () => {
    expect(
      storageConnection.safeParse({
        id: 'x',
        name: 'Bad',
        type: 'sqlite',
        settings: { dbFilename: 'only-one-field' }
      }).success
    ).toBe(false);
  });

  it('rejects sqlite legacyUserDataDir with path traversal or separators', () => {
    const base = {
      id: 'abc',
      name: 'Local',
      type: 'sqlite' as const,
      settings: {
        dbFilename: 'harborclient.db',
        legacyDbFilename: 'harbor-client.db',
        legacyUserDataDir: 'harbor-client'
      }
    };

    for (const legacyUserDataDir of ['..', '../escape', 'foo/bar', 'foo\\bar', '.']) {
      expect(
        storageConnection.safeParse({
          ...base,
          settings: { ...base.settings, legacyUserDataDir }
        }).success
      ).toBe(false);
    }
  });
});

describe('generalSettings', () => {
  const validGeneralSettings = {
    requestTimeoutMs: 30000,
    scriptTimeoutMs: 5000,
    allowScriptNetworkRequests: false,
    allowedNetworkPlugins: [],
    maxResponseSizeMb: 50,
    verifySsl: true,
    followRedirects: true,
    scrollbarAutoHide: false,
    wrapTabs: true,
    spellCheckEnabled: true,
    warnWhenSwitchingThemes: true,
    warnWhenExitingWithUnsavedChanges: true,
    warnWhenClosingUnsavedRequests: true,
    warnWhenEditingSnippet: true,
    warnWhenCloningSnippet: true,
    warnWhenClickingReadonlySnippet: true,
    warnWhenCreatingTabGroup: true,
    warnWhenOpeningTabGroup: true,
    warnWhenAgentUsesTerminal: true,
    gitAutoAdd: true,
    externalMergeEditorPath: '',
    gitCommitAuthorName: '',
    gitCommitAuthorEmail: '',
    gitCommitAuthorPrompted: false,
    codeEditorTheme: 'default' as const,
    codeEditorSetup: {
      lineNumbers: true,
      foldGutter: true,
      highlightActiveLine: true,
      highlightActiveLineGutter: true
    },
    codeEditorFontSize: '16px',
    proxy: {
      enabled: false,
      protocol: 'http' as const,
      host: '',
      port: 8080,
      authEnabled: false,
      username: '',
      password: ''
    },
    globalVariables: [],
    logFilePath: ''
  };

  it('parses generalSettings with numeric timeout and boolean verifySsl', () => {
    expect(generalSettings.safeParse(validGeneralSettings).success).toBe(true);
  });

  it('rejects non-number requestTimeoutMs', () => {
    expect(
      generalSettings.safeParse({
        ...validGeneralSettings,
        requestTimeoutMs: '30000'
      }).success
    ).toBe(false);
  });

  it('rejects non-number scriptTimeoutMs', () => {
    expect(
      generalSettings.safeParse({
        ...validGeneralSettings,
        scriptTimeoutMs: '5000'
      }).success
    ).toBe(false);
  });

  it('accepts maxResponseSizeMb from 0 through the hard cap', () => {
    expect(
      generalSettings.safeParse({
        ...validGeneralSettings,
        maxResponseSizeMb: 0
      }).success
    ).toBe(true);
    expect(
      generalSettings.safeParse({
        ...validGeneralSettings,
        maxResponseSizeMb: 512
      }).success
    ).toBe(true);
  });

  it('rejects maxResponseSizeMb outside the allowed range', () => {
    expect(
      generalSettings.safeParse({
        ...validGeneralSettings,
        maxResponseSizeMb: -1
      }).success
    ).toBe(false);
    expect(
      generalSettings.safeParse({
        ...validGeneralSettings,
        maxResponseSizeMb: 1_000_000
      }).success
    ).toBe(false);
  });
});

describe('nullable folderId tuples', () => {
  it('requestReorder accepts null and numeric folderId', () => {
    expect(ipcArgSchemas.requestReorder.safeParse([1, null, [2, 3]]).success).toBe(true);
    expect(ipcArgSchemas.requestReorder.safeParse([1, 5, [2, 3]]).success).toBe(true);
  });

  it('rejects requestReorder when folderId is a string instead of null or number', () => {
    expect(ipcArgSchemas.requestReorder.safeParse([1, 'root', [2]]).success).toBe(false);
  });

  it('requestMove accepts null folderId', () => {
    expect(ipcArgSchemas.requestMove.safeParse([10, null, 0]).success).toBe(true);
  });
});

describe('git IPC schemas', () => {
  it('gitCommit accepts connection id, collection uuid, and non-empty commit message', () => {
    expect(
      ipcArgSchemas.gitCommit.safeParse([validGitConnectionId, 'collection-uuid', 'Initial commit'])
        .success
    ).toBe(true);
    expect(
      ipcArgSchemas.gitCommit.safeParse([validGitConnectionId, 'collection-uuid', '  fix typo  '])
        .success
    ).toBe(true);
    expect(
      ipcArgSchemas.gitCommit.safeParse([
        validGitConnectionId,
        'collection-uuid',
        'Initial commit',
        true
      ]).success
    ).toBe(true);
  });

  it('gitCommit rejects empty or whitespace-only commit message', () => {
    expect(
      ipcArgSchemas.gitCommit.safeParse([validGitConnectionId, 'collection-uuid', '']).success
    ).toBe(false);
    expect(
      ipcArgSchemas.gitCommit.safeParse([validGitConnectionId, 'collection-uuid', '   ']).success
    ).toBe(false);
  });

  it('gitCommit rejects non-string connection id and wrong arity', () => {
    expect(ipcArgSchemas.gitCommit.safeParse([123, 'collection-uuid', 'msg']).success).toBe(false);
    expect(
      ipcArgSchemas.gitCommit.safeParse([validGitConnectionId, 'collection-uuid']).success
    ).toBe(false);
    expect(
      ipcArgSchemas.gitCommit.safeParse([validGitConnectionId, 'collection-uuid', 'msg', 'yes'])
        .success
    ).toBe(false);
  });

  it('gitListBranches accepts a connection id', () => {
    expect(ipcArgSchemas.gitListBranches.safeParse([validGitConnectionId]).success).toBe(true);
    expect(ipcArgSchemas.gitListBranches.safeParse([123]).success).toBe(false);
  });

  it('gitCreateBranch accepts connection id and non-empty branch name', () => {
    expect(ipcArgSchemas.gitCreateBranch.safeParse([validGitConnectionId, 'feature']).success).toBe(
      true
    );
    expect(
      ipcArgSchemas.gitCreateBranch.safeParse([validGitConnectionId, '  feature  ']).success
    ).toBe(true);
  });

  it('gitCreateBranch rejects empty branch name', () => {
    expect(ipcArgSchemas.gitCreateBranch.safeParse([validGitConnectionId, '']).success).toBe(false);
    expect(ipcArgSchemas.gitCreateBranch.safeParse([validGitConnectionId, '   ']).success).toBe(
      false
    );
  });

  it('gitDeleteBranch accepts connection id and non-empty branch name', () => {
    expect(ipcArgSchemas.gitDeleteBranch.safeParse([validGitConnectionId, 'feature']).success).toBe(
      true
    );
  });

  it('gitDeleteBranch rejects empty branch name', () => {
    expect(ipcArgSchemas.gitDeleteBranch.safeParse([validGitConnectionId, '']).success).toBe(false);
  });

  it('gitFetch accepts a connection id', () => {
    expect(ipcArgSchemas.connectionId.safeParse([validGitConnectionId]).success).toBe(true);
  });

  it('gitCheckoutBranch accepts connection id and non-empty branch name', () => {
    expect(ipcArgSchemas.gitCheckoutBranch.safeParse([validGitConnectionId, 'main']).success).toBe(
      true
    );
  });

  it('gitCheckoutBranch rejects empty branch name', () => {
    expect(ipcArgSchemas.gitCheckoutBranch.safeParse([validGitConnectionId, '']).success).toBe(
      false
    );
  });

  it('gitLog accepts connection id with optional positive depth', () => {
    expect(ipcArgSchemas.gitLog.safeParse([validGitConnectionId]).success).toBe(true);
    expect(ipcArgSchemas.gitLog.safeParse([validGitConnectionId, 10]).success).toBe(true);
  });

  it('gitLog rejects invalid depth values', () => {
    expect(ipcArgSchemas.gitLog.safeParse([validGitConnectionId, 0]).success).toBe(false);
    expect(ipcArgSchemas.gitLog.safeParse([validGitConnectionId, -1]).success).toBe(false);
    expect(ipcArgSchemas.gitLog.safeParse([validGitConnectionId, 1.5]).success).toBe(false);
    expect(ipcArgSchemas.gitLog.safeParse([validGitConnectionId, '10']).success).toBe(false);
  });

  it('gitLog rejects non-string connection id', () => {
    expect(ipcArgSchemas.gitLog.safeParse([null]).success).toBe(false);
  });

  it('gitSuggestedAuthor accepts optional connection id', () => {
    expect(ipcArgSchemas.gitSuggestedAuthor.safeParse([validGitConnectionId]).success).toBe(true);
    expect(ipcArgSchemas.gitSuggestedAuthor.safeParse([undefined]).success).toBe(true);
  });

  it('gitSuggestedAuthor rejects invalid connection id', () => {
    expect(ipcArgSchemas.gitSuggestedAuthor.safeParse([null]).success).toBe(false);
  });

  it('gitDeleteRepoDirectory accepts a connection id', () => {
    expect(ipcArgSchemas.gitDeleteRepoDirectory.safeParse([validGitConnectionId]).success).toBe(
      true
    );
  });

  it('gitDeleteRepoDirectory rejects missing connection id', () => {
    expect(ipcArgSchemas.gitDeleteRepoDirectory.safeParse([]).success).toBe(false);
  });

  it('gitSetPat accepts connection id, username, and non-empty token', () => {
    expect(
      ipcArgSchemas.gitSetPat.safeParse([validGitConnectionId, 'octocat', 'ghp_xxx']).success
    ).toBe(true);
    expect(ipcArgSchemas.gitSetPat.safeParse([validGitConnectionId, '', 'ghp_xxx']).success).toBe(
      true
    );
  });

  it('gitSetPat rejects empty token', () => {
    expect(ipcArgSchemas.gitSetPat.safeParse([validGitConnectionId, 'octocat', '']).success).toBe(
      false
    );
  });

  it('gitSetPat rejects non-string connection id and wrong arity', () => {
    expect(ipcArgSchemas.gitSetPat.safeParse([{}, 'user', 'token']).success).toBe(false);
    expect(ipcArgSchemas.gitSetPat.safeParse([validGitConnectionId, 'user']).success).toBe(false);
  });

  it('gitGraphLog accepts connection id with optional positive depth', () => {
    expect(ipcArgSchemas.gitGraphLog.safeParse([validGitConnectionId]).success).toBe(true);
    expect(ipcArgSchemas.gitGraphLog.safeParse([validGitConnectionId, 25]).success).toBe(true);
    expect(ipcArgSchemas.gitGraphLog.safeParse([validGitConnectionId, 0]).success).toBe(false);
  });

  it('gitCommitDetail accepts connection id and commit oid', () => {
    expect(ipcArgSchemas.gitCommitDetail.safeParse([validGitConnectionId, 'abc123']).success).toBe(
      true
    );
    expect(ipcArgSchemas.gitCommitDetail.safeParse([validGitConnectionId, '']).success).toBe(false);
  });

  it('gitCommitFileDiff accepts commit file diff args', () => {
    expect(
      ipcArgSchemas.gitCommitFileDiff.safeParse([
        {
          connectionId: validGitConnectionId,
          commitOid: 'abc123',
          filePath: '.harborclient/collection-api/req-health.json',
          status: 'modified'
        }
      ]).success
    ).toBe(true);
    expect(
      ipcArgSchemas.gitCommitFileDiff.safeParse([
        {
          connectionId: validGitConnectionId,
          commitOid: 'abc123',
          filePath: '.harborclient/collection-api/req-health.json',
          status: 'added',
          displayName: 'Health Check',
          resourceKind: 'request',
          method: 'GET'
        }
      ]).success
    ).toBe(true);
    expect(
      ipcArgSchemas.gitCommitFileDiff.safeParse([
        {
          connectionId: validGitConnectionId,
          commitOid: '',
          filePath: '.harborclient/collection-api/req-health.json',
          status: 'modified'
        }
      ]).success
    ).toBe(false);
  });

  it('gitDiff accepts collection uuid with optional caps and excludeUntracked', () => {
    expect(ipcArgSchemas.gitDiff.safeParse([{ collectionUuid: 'collection-uuid' }]).success).toBe(
      true
    );
    expect(
      ipcArgSchemas.gitDiff.safeParse([
        {
          collectionUuid: 'collection-uuid',
          stagedOnly: true,
          excludeUntracked: true
        }
      ]).success
    ).toBe(true);
    expect(ipcArgSchemas.gitDiff.safeParse([{ collectionUuid: '' }]).success).toBe(false);
  });

  it('gitListItemStatuses accepts connection id and collection uuid', () => {
    expect(
      ipcArgSchemas.gitListItemStatuses.safeParse([validGitConnectionId, 'collection-uuid']).success
    ).toBe(true);
    expect(ipcArgSchemas.gitListItemStatuses.safeParse([validGitConnectionId, '']).success).toBe(
      false
    );
  });

  it('gitChangedItemCount accepts connection id and collection uuid', () => {
    expect(
      ipcArgSchemas.gitChangedItemCount.safeParse([validGitConnectionId, 'collection-uuid']).success
    ).toBe(true);
    expect(ipcArgSchemas.gitChangedItemCount.safeParse([validGitConnectionId, '']).success).toBe(
      false
    );
  });

  it('gitStageItem accepts connection id, collection uuid, and item uuid', () => {
    expect(
      ipcArgSchemas.gitStageItem.safeParse([
        validGitConnectionId,
        'collection-uuid',
        'request-uuid'
      ]).success
    ).toBe(true);
    expect(
      ipcArgSchemas.gitStageItem.safeParse([validGitConnectionId, 'collection-uuid', '']).success
    ).toBe(false);
  });

  it('gitUnstageItem accepts connection id, collection uuid, and item uuid', () => {
    expect(
      ipcArgSchemas.gitUnstageItem.safeParse([
        validGitConnectionId,
        'collection-uuid',
        'document-uuid'
      ]).success
    ).toBe(true);
  });

  it('gitRevertFile accepts connection id, collection uuid, file path, and optional previous paths', () => {
    expect(
      ipcArgSchemas.gitRevertFile.safeParse([
        validGitConnectionId,
        'collection-uuid',
        '.harborclient/collection-api/req-health.json'
      ]).success
    ).toBe(true);
    expect(
      ipcArgSchemas.gitRevertFile.safeParse([
        validGitConnectionId,
        'collection-uuid',
        '.harborclient/collection-api/req-health.json',
        ['.harborclient/collection-api/req-old.json']
      ]).success
    ).toBe(true);
    expect(
      ipcArgSchemas.gitRevertFile.safeParse([validGitConnectionId, 'collection-uuid', '']).success
    ).toBe(false);
  });

  it('menuGitSidebarVisible accepts a boolean tuple', () => {
    expect(ipcArgSchemas.menuGitSidebarVisible.safeParse([true]).success).toBe(true);
    expect(ipcArgSchemas.menuGitSidebarVisible.safeParse([false]).success).toBe(true);
    expect(ipcArgSchemas.menuGitSidebarVisible.safeParse([]).success).toBe(false);
  });

  it('menuGetSubmenuSnapshot accepts the Git root menu label', () => {
    expect(ipcArgSchemas.menuGetSubmenuSnapshot.safeParse(['Git']).success).toBe(true);
  });
});

describe('object schema happy paths', () => {
  it('parses sendRequestInput with POST method and json bodyType', () => {
    expect(sendRequestInput.safeParse(validSendRequest).success).toBe(true);
  });

  it('parses scriptRunInput with phase, script, request, and variables', () => {
    expect(scriptRunInput.safeParse(validScriptRun).success).toBe(true);
  });

  it('parses variable with key, value, defaultValue, and share flag', () => {
    expect(
      variable.safeParse({ key: 'baseUrl', value: 'https://a', defaultValue: '', share: false })
        .success
    ).toBe(true);
  });

  it('sendRequest tuple accepts optional requestId', () => {
    expect(ipcArgSchemas.sendRequest.safeParse([validSendRequest]).success).toBe(true);
    expect(ipcArgSchemas.sendRequest.safeParse([validSendRequest, 'req-1']).success).toBe(true);
  });

  it('chatCompleteStep tuple accepts optional stepRequestId', () => {
    const validStep = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }]
    };
    expect(ipcArgSchemas.chatCompleteStep.safeParse([validStep]).success).toBe(true);
    expect(ipcArgSchemas.chatCompleteStep.safeParse([validStep, 'step-1']).success).toBe(true);
  });

  it('chatCancelStep tuple requires a stepRequestId', () => {
    expect(ipcArgSchemas.chatCancelStep.safeParse(['step-1']).success).toBe(true);
    expect(ipcArgSchemas.chatCancelStep.safeParse([]).success).toBe(false);
  });

  it('shareCreate accepts optional recipientKid', () => {
    expect(ipcArgSchemas.shareCreate.safeParse([1]).success).toBe(true);
    expect(ipcArgSchemas.shareCreate.safeParse([1, 'kid-abc']).success).toBe(true);
    expect(ipcArgSchemas.shareCreate.safeParse([1, '']).success).toBe(false);
  });

  it('closeDecision accepts booleans and rejects non-boolean proceed values', () => {
    expect(ipcArgSchemas.closeDecision.safeParse([true]).success).toBe(true);
    expect(ipcArgSchemas.closeDecision.safeParse([false]).success).toBe(true);
    expect(ipcArgSchemas.closeDecision.safeParse([1]).success).toBe(false);
    expect(ipcArgSchemas.closeDecision.safeParse(['true']).success).toBe(false);
    expect(ipcArgSchemas.closeDecision.safeParse([]).success).toBe(false);
  });

  it('teamHubSnippetCreate accepts name, code, and scope', () => {
    expect(
      ipcArgSchemas.teamHubSnippetCreate.safeParse([
        'hub-1',
        { name: 'Auth helper', code: 'console.log("ok");', scope: 'pre-request' }
      ]).success
    ).toBe(true);
    expect(
      ipcArgSchemas.teamHubSnippetCreate.safeParse([
        'hub-1',
        { name: '', code: 'console.log("ok");', scope: 'pre-request' }
      ]).success
    ).toBe(false);
  });

  it('teamHubSnippetUpdate requires snippet id and admin payload', () => {
    expect(
      ipcArgSchemas.teamHubSnippetUpdate.safeParse([
        'hub-1',
        '770e8400-e29b-41d4-a716-446655440003',
        { name: 'Updated', code: 'console.log("ok");', scope: 'any' }
      ]).success
    ).toBe(true);
    expect(
      ipcArgSchemas.teamHubSnippetUpdate.safeParse([
        'hub-1',
        '',
        { name: 'Updated', code: 'console.log("ok");', scope: 'any' }
      ]).success
    ).toBe(false);
  });

  it('teamHubSnippetDelete requires hub id and snippet id', () => {
    expect(
      ipcArgSchemas.teamHubSnippetDelete.safeParse([
        'hub-1',
        '770e8400-e29b-41d4-a716-446655440003'
      ]).success
    ).toBe(true);
    expect(ipcArgSchemas.teamHubSnippetDelete.safeParse(['hub-1']).success).toBe(false);
  });
});

describe('non-empty name schemas', () => {
  it('name tuple rejects whitespace-only strings', () => {
    expect(ipcArgSchemas.name.safeParse(['']).success).toBe(false);
    expect(ipcArgSchemas.name.safeParse(['   ']).success).toBe(false);
    expect(ipcArgSchemas.name.safeParse(['My API']).success).toBe(true);
    expect(ipcArgSchemas.name.safeParse(['  My API  ']).success).toBe(true);
  });

  it('saveRequestInput rejects empty request name', () => {
    expect(saveRequestInput.safeParse({ ...validSaveRequest, name: '' }).success).toBe(false);
    expect(saveRequestInput.safeParse({ ...validSaveRequest, name: '   ' }).success).toBe(false);
  });
});

describe('IPC size limits', () => {
  it('aligns request body cap with the hard response size ceiling', () => {
    expect(MAX_IPC_REQUEST_BODY_CHARS).toBe(HARD_MAX_RESPONSE_SIZE_MB * 1024 * 1024);
  });

  it('saveRequestInput rejects oversized pre_request_script and accepts at-limit script', () => {
    const oversizedScript = 'x'.repeat(MAX_IPC_SCRIPT_CHARS + 1);
    const atLimitScript = 'x'.repeat(MAX_IPC_SCRIPT_CHARS);

    expect(
      saveRequestInput.safeParse({ ...validSaveRequest, pre_request_script: oversizedScript })
        .success
    ).toBe(false);
    expect(
      saveRequestInput.safeParse({ ...validSaveRequest, pre_request_script: atLimitScript }).success
    ).toBe(true);
  });

  it('scriptRunInput rejects oversized script and accepts at-limit script', () => {
    const oversizedScript = 'x'.repeat(MAX_IPC_SCRIPT_CHARS + 1);
    const atLimitScript = 'x'.repeat(MAX_IPC_SCRIPT_CHARS);

    expect(scriptRunInput.safeParse({ ...validScriptRun, script: oversizedScript }).success).toBe(
      false
    );
    expect(scriptRunInput.safeParse({ ...validScriptRun, script: atLimitScript }).success).toBe(
      true
    );
  });

  it('sendRequestInput rejects oversized url', () => {
    expect(
      sendRequestInput.safeParse({
        ...validSendRequest,
        url: 'https://example.com/' + 'a'.repeat(MAX_IPC_URL_CHARS)
      }).success
    ).toBe(false);
  });

  it('saveRequestInput rejects oversized comment and accepts at-limit comment', () => {
    const oversizedComment = 'x'.repeat(MAX_IPC_COMMENT_CHARS + 1);
    const atLimitComment = 'x'.repeat(MAX_IPC_COMMENT_CHARS);

    expect(
      saveRequestInput.safeParse({ ...validSaveRequest, comment: oversizedComment }).success
    ).toBe(false);
    expect(
      saveRequestInput.safeParse({ ...validSaveRequest, comment: atLimitComment }).success
    ).toBe(true);
  });

  it('accepts oauth2 auth config on saveRequestInput', () => {
    expect(
      saveRequestInput.safeParse({
        ...validSaveRequest,
        auth: {
          ...validSaveRequest.auth,
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://example.com/oauth/token',
            clientId: 'client',
            clientSecret: 'secret',
            scope: 'read',
            audience: 'api',
            clientAuth: 'header'
          }
        }
      }).success
    ).toBe(true);
  });

  it('validates oauth IPC tuple schemas', () => {
    const oauthConfig = {
      tokenUrl: 'https://example.com/oauth/token',
      clientId: 'client',
      clientSecret: 'secret',
      scope: 'read',
      audience: '',
      clientAuth: 'body' as const
    };

    expect(ipcArgSchemas.oauthFetchToken.safeParse(['request:1', oauthConfig, false]).success).toBe(
      true
    );
    expect(ipcArgSchemas.oauthClearToken.safeParse(['request:1']).success).toBe(true);
    expect(ipcArgSchemas.oauthClearToken.safeParse(['']).success).toBe(false);
  });

  it('teamHubInvitationPreview accepts base URL and invitation code', () => {
    expect(
      ipcArgSchemas.teamHubInvitationPreview.safeParse([
        'http://127.0.0.1:8788',
        'hbi_testinvitationcode123'
      ]).success
    ).toBe(true);
    expect(
      ipcArgSchemas.teamHubInvitationPreview.safeParse(['http://127.0.0.1:8788']).success
    ).toBe(false);
  });

  it('teamHubInvitationRedeem accepts optional token label', () => {
    expect(
      ipcArgSchemas.teamHubInvitationRedeem.safeParse([
        'http://127.0.0.1:8788',
        'hbi_testinvitationcode123'
      ]).success
    ).toBe(true);
    expect(
      ipcArgSchemas.teamHubInvitationRedeem.safeParse([
        'http://127.0.0.1:8788',
        'hbi_testinvitationcode123',
        'Onboarding token'
      ]).success
    ).toBe(true);
  });
});
