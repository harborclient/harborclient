import { describe, expect, it } from 'vitest';
import { HARD_MAX_RESPONSE_SIZE_MB } from '#/main/http';
import {
  MAX_IPC_COMMENT_CHARS,
  MAX_IPC_REQUEST_BODY_CHARS,
  MAX_IPC_SCRIPT_CHARS,
  MAX_IPC_URL_CHARS
} from '#/main/ipc/ipcLimits';
import {
  bodyType,
  databaseConnection,
  editorTab,
  generalSettings,
  httpMethod,
  ipcArgSchemas,
  saveRequestInput,
  sendRequestInput,
  scriptRunInput,
  themeSource,
  variable
} from '#/main/ipc/ipcSchemas';

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
  comment: '',
  auth: {
    type: 'none' as const,
    basic: { username: '', password: '' },
    bearer: { token: '' }
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

describe('databaseConnection', () => {
  it('parses sqlite databaseConnection with dbFilename settings', () => {
    expect(
      databaseConnection.safeParse({
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

  it('parses mysql databaseConnection with host, port, and credentials', () => {
    expect(
      databaseConnection.safeParse({
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

  it('rejects databaseConnection when type is not sqlite, mysql, or postgres', () => {
    expect(
      databaseConnection.safeParse({
        id: 'x',
        name: 'Bad',
        type: 'mongodb',
        settings: {}
      }).success
    ).toBe(false);
  });

  it('rejects wrong settings shape for sqlite', () => {
    expect(
      databaseConnection.safeParse({
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
        databaseConnection.safeParse({
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
    maxResponseSizeMb: 50,
    verifySsl: true,
    codeEditorTheme: 'default' as const,
    codeEditorSetup: {
      lineNumbers: true,
      foldGutter: true,
      highlightActiveLine: true,
      highlightActiveLineGutter: true
    }
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

  it('inviteCreate accepts optional recipientKid', () => {
    expect(ipcArgSchemas.inviteCreate.safeParse([1]).success).toBe(true);
    expect(ipcArgSchemas.inviteCreate.safeParse([1, 'kid-abc']).success).toBe(true);
    expect(ipcArgSchemas.inviteCreate.safeParse([1, '']).success).toBe(false);
  });

  it('closeDecision accepts booleans and rejects non-boolean proceed values', () => {
    expect(ipcArgSchemas.closeDecision.safeParse([true]).success).toBe(true);
    expect(ipcArgSchemas.closeDecision.safeParse([false]).success).toBe(true);
    expect(ipcArgSchemas.closeDecision.safeParse([1]).success).toBe(false);
    expect(ipcArgSchemas.closeDecision.safeParse(['true']).success).toBe(false);
    expect(ipcArgSchemas.closeDecision.safeParse([]).success).toBe(false);
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
});
