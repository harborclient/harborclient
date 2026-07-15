import { describe, expect, it } from 'vitest';
import { isDotenvFile, parseDotenvEnvironment } from './envFile';

describe('isDotenvFile', () => {
  it('matches common dotenv file names', () => {
    expect(isDotenvFile('.env')).toBe(true);
    expect(isDotenvFile('.env.local')).toBe(true);
    expect(isDotenvFile('.env.production')).toBe(true);
    expect(isDotenvFile('dev.env')).toBe(true);
    expect(isDotenvFile('prod.env')).toBe(true);
    expect(isDotenvFile('/tmp/project/.env')).toBe(true);
    expect(isDotenvFile('C:\\project\\staging.env')).toBe(true);
  });

  it('rejects non-dotenv file names', () => {
    expect(isDotenvFile('environment.json')).toBe(false);
    expect(isDotenvFile('env.txt')).toBe(false);
    expect(isDotenvFile('')).toBe(false);
  });
});

describe('parseDotenvEnvironment', () => {
  it('parses basic key=value pairs into private variables', () => {
    const result = parseDotenvEnvironment(
      'API_URL=https://api.example.com\nAPI_KEY=secret\n',
      'dev.env'
    );

    expect(result).toEqual({
      harborclientVersion: 1,
      harborclientExport: 'environment',
      name: 'dev.env',
      variables: [
        { key: 'API_URL', value: 'https://api.example.com', defaultValue: '', share: false },
        { key: 'API_KEY', value: 'secret', defaultValue: '', share: false }
      ]
    });
  });

  it('ignores comments and blank lines', () => {
    const result = parseDotenvEnvironment(
      '# API settings\n\nHOST=localhost\n# PORT=3000\nPORT=8080\n',
      '.env'
    );

    expect(result.variables).toEqual([
      { key: 'HOST', value: 'localhost', defaultValue: '', share: false },
      { key: 'PORT', value: '8080', defaultValue: '', share: false }
    ]);
    expect(result.name).toBe('.env');
  });

  it('supports quoted values', () => {
    const result = parseDotenvEnvironment('MESSAGE="hello world"\n', 'prod.env');

    expect(result.variables).toEqual([
      { key: 'MESSAGE', value: 'hello world', defaultValue: '', share: false }
    ]);
  });

  it('throws when no variables are found', () => {
    expect(() => parseDotenvEnvironment('# only comments\n\n', '.env')).toThrow(
      'No environment variables found in file'
    );
  });

  it('throws when the file name is empty', () => {
    expect(() => parseDotenvEnvironment('KEY=value\n', '   ')).toThrow(
      'Environment file name is required'
    );
  });
});
