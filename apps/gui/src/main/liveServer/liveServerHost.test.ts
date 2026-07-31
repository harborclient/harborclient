import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  defaultLiveServerCorsSettings,
  defaultLiveServerSslSettings,
  normalizeLiveServerConfigFields,
  type LiveServerConfig
} from '@harborclient/core/types';
import {
  clearLiveServerLogs,
  getLiveServerLogs,
  resolveLiveServerOrigin,
  resolveLiveServerOriginHost,
  startLiveServer,
  stopAllLiveServers,
  stopLiveServer
} from './liveServerHost';

const tempRoots: string[] = [];

/**
 * Minimal self-signed certificate for HTTPS live-server tests (CN=localhost).
 * Generated offline; not for production use.
 */
const TEST_SSL_CERT = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUHU9G2xNEQwzpt1bHX2oNbmK6ri8wDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDczMTE1MjYxNloXDTM2MDcy
ODE1MjYxNlowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAjTvVIxsKlPk20c0A2jPjJq3WcJ4t+2lbgXJ5fhT1hya4
ETun4Qk2+1ILXwbDOXyE1iHaR3TzDfmZkGgcpRy6zj+X3T3fKR81MplC6gwvb8nR
YvruqS4nKEgyFLB0A5d/xHRiiC6dPRi2Q23Q5qwyfjStNlH6SwZ8XNyXFZdPyMjo
7I69NX8YaS6XNTAI+qIY1P8/iwuqXv4lnJrvlvhWgwuYNnWmBwCSbjMfESNnT3wF
IjOiKV4d/07DBD9oo+M12UOHyV+7sYuVuqAz/fXrfdh3bnd46T5zruVdPH4ADuim
5LqMf+0iv496YpZZLKNR02oaG1pQx7Dj3nSxqT4JSQIDAQABo1MwUTAdBgNVHQ4E
FgQURYKQbeCSYjudiBpeUlP/ljv8L+AwHwYDVR0jBBgwFoAURYKQbeCSYjudiBpe
UlP/ljv8L+AwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAaWhw
Yb+aYsim6iIIJ34ELIQvOkUi5K9H92m42ObFjcUTdNQcmPd80d266ZiPszSFNbQ5
WJNwcKe6OI8e4T6OKI07IbFvfeh0bLWcFPk+4nsF6qjvnDElokbbGKDUogwHWghl
9+fDYDDWdQlv8bMgdohpZ8OR4T+1VX/1b4cPZr+ojI/7uSmXTVj9F2hmiplwBesS
LI4ff1hR2m+Xb9vssQZDi+RwGDmqKf3bnagP9OURWQnqv98ZDxi+w3zIDroTncME
SzH28ykLtQ7XnusfWbQ893MjJrfu5HkeMMipC8FddF5R3bQhSh2YUmAMJPUfYlC5
h9tBBx1wLH2RFkhN9w==
-----END CERTIFICATE-----
`;

/**
 * Private key matching {@link TEST_SSL_CERT}.
 */
const TEST_SSL_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCNO9UjGwqU+TbR
zQDaM+MmrdZwni37aVuBcnl+FPWHJrgRO6fhCTb7UgtfBsM5fITWIdpHdPMN+ZmQ
aBylHLrOP5fdPd8pHzUymULqDC9vydFi+u6pLicoSDIUsHQDl3/EdGKILp09GLZD
bdDmrDJ+NK02UfpLBnxc3JcVl0/IyOjsjr01fxhpLpc1MAj6ohjU/z+LC6pe/iWc
mu+W+FaDC5g2daYHAJJuMx8RI2dPfAUiM6IpXh3/TsMEP2ij4zXZQ4fJX7uxi5W6
oDP99et92Hdud3jpPnOu5V08fgAO6Kbkuox/7SK/j3pillkso1HTahobWlDHsOPe
dLGpPglJAgMBAAECggEACasja6xRvKIU8SbmHIn5zm+PIxWJE1GCnKmADLQVnON3
LWLWms69L1ZOBfraCYjvNROLNGIas4W3UA34jAsb9Lugw1oVeWS0CRs52/jqlG4O
AgcoqHdK4fSTTRxJTOelrQbEqgr647BZ5eLSLsByEna7tuDE0DcI83h8dVNu+FFC
qcQNCfK2dNUY4DBX80j9AFTpuno0ShTa1UWRCt70XRGYUgcbrtQL5ajmNIKbmelS
1/77AYKd01rx01EY6s6siIAmiqgnq08nZdY9F2v3sPSOIC0WKpQr5yj9fokHJSXl
fe8TaAN8QMrYgwwggiieAK9tQ4OoVTzfnDtoOupnwwKBgQDDKpJG6v2bDt7/e9WU
KpIRvmQd7JnpgD2kMdw4eQ6BP0fNqG7E0o+3QbA5hOQh5YcsexadeHU6m6aj9GM/
yAZPGoTBdJQZ1xYL6CZhWoLHrEDA0Z6YRXaSjiyQo9GEOJU3OYxHs1ai12yVTP/m
bnZ7TC3BgoIpgHv2GnZ6JfoBPwKBgQC5QaylbDbGYxhYve8lmySU3UP3+KkAOBI/
u832ACghGKE4GmYSiXJ/fr8aThdEA8tvRevrA7m1fG8UWSh2zu7/nQMhWmBInQtH
3HtssQbVXZNQqWNmWcEtBv5upUEWHhrpBD9lWMpouXvrc98cbFgF9NomC5FvqjG2
qwc8B9ZLdwKBgGPyNzruOLXhpb28kyHvsyI3GFpiwmdb7zVY+2hIRm9WEtV1PlS5
aDP3BeJO9e2N9+2Fk41NFOvQrkQkcXdGXkTAVeAkbXvWNEogtxcAHR1YT0jvkIJ2
gESJXrUrz64gs/m2FOrbIrD+FXNYHWzKgQ6fcoc46KOMUu8zmhzvudpNAoGACn10
iD1zcJJl64h9xTRewuswkRcMgs2qAt/gjsB9hTo+zs134C7WQ+/qZFPtr1VDrL5Z
2InydxtfsthFmUyobeL3LWlPsGzsGZqbhpEToPtWfyfIUCBe9uzBdYR4BgeYYH90
E4oOlBWEtdVu2c4swdGWlLbs+lS50e0nULfk44sCgYAXdzvq+obYzi7KyEwVMBr+
r825FVI5WnwPyp66zp0HrM5h1xs5RgT2m3tKd0aa2Qsp7sNDaaI6hVd3Wa9CGcuW
ZKijCI7lpMFEp5nO/LKggwOdqb35U4msK8KBlhGN7Pkwitg4vM8l6sKHac0Pco0v
bmJDJYrkNaS5Xjr31lturg==
-----END PRIVATE KEY-----
`;

/**
 * Creates a temporary document root with an index.html file.
 *
 * @returns Absolute path to the new directory.
 */
function makeTempRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-live-host-'));
  tempRoots.push(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>host</h1>');
  return dir;
}

/**
 * Writes the test PEM cert and key into a temporary directory.
 *
 * @returns Absolute paths to the certificate and private key files.
 */
function writeTempSslFiles(): { certPath: string; keyPath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-live-ssl-'));
  tempRoots.push(dir);
  const certPath = path.join(dir, 'cert.pem');
  const keyPath = path.join(dir, 'key.pem');
  fs.writeFileSync(certPath, TEST_SSL_CERT);
  fs.writeFileSync(keyPath, TEST_SSL_KEY);
  return { certPath, keyPath };
}

/**
 * Fetches a URL over HTTPS while accepting self-signed certificates.
 *
 * Used only in host tests; Live Page TLS policy is handled separately in Step 5.
 *
 * @param url - Absolute HTTPS URL to request.
 * @returns Status code and response body text.
 */
function fetchHttpsInsecure(url: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { rejectUnauthorized: false }, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            text: Buffer.concat(chunks).toString('utf8')
          });
        });
      })
      .on('error', reject);
  });
}

/**
 * Builds a complete live-server start config with sensible test defaults.
 *
 * @param root - Document root directory.
 * @param overrides - Optional field overrides (host, ssl, etc.).
 * @returns Config ready for {@link startLiveServer}.
 */
function makeConfig(
  root: string,
  overrides: Partial<ReturnType<typeof normalizeLiveServerConfigFields>> & {
    name?: string;
    port?: number | null;
    watch?: boolean;
  } = {}
): LiveServerConfig {
  const fields = normalizeLiveServerConfigFields({
    ...overrides
  });
  return {
    name: overrides.name ?? 'Docs',
    root,
    port: overrides.port ?? null,
    aliases: [],
    watch: overrides.watch ?? false,
    cors: defaultLiveServerCorsSettings(),
    ...fields,
    ...(overrides.host != null ? { host: overrides.host } : {}),
    ...(overrides.ssl != null ? { ssl: overrides.ssl } : {})
  };
}

afterEach(async () => {
  await stopAllLiveServers();
  for (const dir of tempRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveLiveServerOrigin', () => {
  it('keeps loopback hosts and http scheme by default', () => {
    expect(resolveLiveServerOriginHost('127.0.0.1')).toBe('127.0.0.1');
    expect(resolveLiveServerOrigin('127.0.0.1', 5500, false)).toBe('http://127.0.0.1:5500');
  });

  it('substitutes 127.0.0.1 for wildcard bind hosts', () => {
    expect(resolveLiveServerOriginHost('0.0.0.0')).toBe('127.0.0.1');
    expect(resolveLiveServerOriginHost('::')).toBe('127.0.0.1');
    expect(resolveLiveServerOrigin('0.0.0.0', 5600, false)).toBe('http://127.0.0.1:5600');
  });

  it('brackets IPv6 hosts and uses https when SSL is enabled', () => {
    expect(resolveLiveServerOriginHost('::1')).toBe('[::1]');
    expect(resolveLiveServerOrigin('::1', 5500, true)).toBe('https://[::1]:5500');
  });
});

describe('liveServerHost listen / origin', () => {
  it('serves HTTP on 127.0.0.1 with an http origin', async () => {
    const root = makeTempRoot();
    const running = await startLiveServer({
      config: makeConfig(root)
    });

    expect(running.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(running.config.host).toBe('127.0.0.1');
    expect(running.config.ssl.enabled).toBe(false);

    const response = await fetch(`${running.origin}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('host');
  });

  it('binds 0.0.0.0 but reports a 127.0.0.1 origin', async () => {
    const root = makeTempRoot();
    const running = await startLiveServer({
      config: makeConfig(root, { host: '0.0.0.0' })
    });

    expect(running.config.host).toBe('0.0.0.0');
    expect(running.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const response = await fetch(`${running.origin}/`);
    expect(response.status).toBe(200);
  });

  it('serves HTTPS with cert/key files and reports an https origin', async () => {
    const root = makeTempRoot();
    const { certPath, keyPath } = writeTempSslFiles();
    const running = await startLiveServer({
      config: makeConfig(root, {
        ssl: {
          enabled: true,
          certPath,
          keyPath
        }
      })
    });

    expect(running.origin).toMatch(/^https:\/\/127\.0\.0\.1:\d+$/);
    expect(running.config.ssl.enabled).toBe(true);

    const response = await fetchHttpsInsecure(`${running.origin}/`);
    expect(response.status).toBe(200);
    expect(response.text).toContain('host');
  });

  it('rejects HTTPS start when the certificate file is missing', async () => {
    const root = makeTempRoot();
    const { keyPath } = writeTempSslFiles();

    await expect(
      startLiveServer({
        config: makeConfig(root, {
          ssl: {
            enabled: true,
            certPath: path.join(os.tmpdir(), 'hc-missing-cert.pem'),
            keyPath
          }
        })
      })
    ).rejects.toThrow(/Failed to read SSL certificate/);
  });

  it('rejects HTTPS start when cert/key paths are empty', async () => {
    const root = makeTempRoot();

    await expect(
      startLiveServer({
        config: makeConfig(root, {
          ssl: {
            ...defaultLiveServerSslSettings(),
            enabled: true
          }
        })
      })
    ).rejects.toThrow(/certificate path or private key path is empty/);
  });
});

describe('liveServerHost request logs', () => {
  it('buffers request logs and clears them by saved id', async () => {
    const root = makeTempRoot();
    const running = await startLiveServer({
      savedId: 42,
      config: makeConfig(root)
    });

    const response = await fetch(`${running.origin}/`);
    expect(response.status).toBe(200);

    // Allow the Express finish handler to append the access log.
    await waitForLogs(42, 1);

    const logs = getLiveServerLogs({ savedId: 42 });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.method).toBe('GET');
    expect(logs[0]?.url).toBe('/');
    expect(logs[0]?.savedId).toBe(42);
    expect(logs[0]?.id).toBe(running.id);

    clearLiveServerLogs({ savedId: 42 });
    expect(getLiveServerLogs({ savedId: 42 })).toEqual([]);

    await stopLiveServer(running.id);
    expect(getLiveServerLogs({ savedId: 42 })).toEqual([]);
  });

  it('returns an empty list when the server is not running', () => {
    expect(getLiveServerLogs({ savedId: 99 })).toEqual([]);
    expect(getLiveServerLogs({ id: 'missing' })).toEqual([]);
  });
});

/**
 * Polls until buffered logs reach the expected count or the timeout elapses.
 *
 * @param savedId - Saved live server id to query.
 * @param count - Expected minimum number of log entries.
 */
async function waitForLogs(savedId: number, count: number): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (getLiveServerLogs({ savedId }).length >= count) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${count} live-server log(s)`);
}
