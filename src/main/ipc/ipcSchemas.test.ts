import { describe, expect, it } from 'vitest';
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
  comment: ''
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
});

describe('generalSettings', () => {
  it('parses generalSettings with numeric timeout and boolean verifySsl', () => {
    expect(
      generalSettings.safeParse({
        requestTimeoutMs: 30000,
        maxResponseSizeMb: 50,
        verifySsl: true
      }).success
    ).toBe(true);
  });

  it('rejects non-number requestTimeoutMs', () => {
    expect(
      generalSettings.safeParse({
        requestTimeoutMs: '30000',
        maxResponseSizeMb: 50,
        verifySsl: true
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
  });
});
