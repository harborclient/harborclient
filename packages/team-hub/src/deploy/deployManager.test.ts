import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDeployContext,
  deployInstall,
  deployStatus,
  deployUninstall,
  deployUpdate,
  ensureDeploymentFiles,
  readConfiguredImageTag
} from '#/deploy/deployManager.js';
import type { CommandResult, CommandRunner } from '#/deploy/dockerRunner.js';
import { formatImageReference, resolveDeploymentDirectory } from '#/deploy/deploymentPaths.js';

/**
 * Builds an in-memory command runner that records invocations for assertions.
 *
 * @param handler - Function that returns synthetic process results per command.
 * @returns Runner exposing captured command calls.
 */
function createRecordingRunner(
  handler: (file: string, args: string[], cwd?: string) => CommandResult
): CommandRunner & { calls: Array<{ file: string; args: string[]; cwd?: string }> } {
  const calls: Array<{ file: string; args: string[]; cwd?: string }> = [];

  return {
    calls,
    run: async (file, args, options = {}) => {
      calls.push({ file, args, cwd: options.cwd as string | undefined });
      return handler(file, args, options.cwd as string | undefined);
    }
  };
}

const moduleUrl = new URL('./deployCommand.ts', import.meta.url).href;

describe('deployManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves the default deployment directory under ~/.config/team-hub', () => {
    const dir = resolveDeploymentDirectory();
    expect(dir.endsWith(`${path.sep}.config${path.sep}team-hub`)).toBe(true);
  });

  it('creates compose.yaml and .env without overwriting an existing .env', () => {
    const deploymentDir = mkdtempSync(path.join(tmpdir(), 'team-hub-deploy-'));
    const ctx = createDeployContext(
      {
        run: async () => ({ exitCode: 0, stdout: '', stderr: '' })
      },
      moduleUrl
    );
    ctx.deploymentDir = deploymentDir;

    writeFileSync(path.join(deploymentDir, '.env'), 'APP_VERSION=9.9.9\n', 'utf8');
    ensureDeploymentFiles(ctx, '0.7.6');

    expect(readFileSync(path.join(deploymentDir, 'compose.yaml'), 'utf8')).toContain(
      'ghcr.io/harborclient/team-hub'
    );
    expect(readConfiguredImageTag(deploymentDir)).toBe('9.9.9');
  });

  it('install pulls and starts the deployment via docker compose', async () => {
    const deploymentDir = mkdtempSync(path.join(tmpdir(), 'team-hub-deploy-'));
    const runner = createRecordingRunner((file, args) => {
      if (file === 'docker' && args[0] === 'info') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (file === 'docker' && args[0] === 'compose' && args[1] === 'version') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const ctx = createDeployContext(runner, moduleUrl);
    ctx.deploymentDir = deploymentDir;
    ctx.cliVersion = '0.7.6';

    await deployInstall(ctx, { dir: deploymentDir, version: '0.7.6' });

    expect(runner.calls.some((call) => call.args.join(' ') === 'compose pull')).toBe(true);
    expect(
      runner.calls.some((call) => call.args.join(' ') === 'compose up -d --remove-orphans')
    ).toBe(true);
    expect(readConfiguredImageTag(deploymentDir)).toBe('0.7.6');
  });

  it('update pulls and recreates the deployment', async () => {
    const deploymentDir = mkdtempSync(path.join(tmpdir(), 'team-hub-deploy-'));
    mkdirSync(deploymentDir, { recursive: true });
    writeFileSync(path.join(deploymentDir, '.env'), 'APP_VERSION=0.7.5\n', 'utf8');
    writeFileSync(path.join(deploymentDir, 'compose.yaml'), 'services: {}\n', 'utf8');

    const runner = createRecordingRunner((file, args) => {
      if (file === 'docker' && args[0] === 'info') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (file === 'docker' && args[0] === 'compose') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (file === 'docker' && args[0] === 'ps') {
        return { exitCode: 0, stdout: 'abc123\n', stderr: '' };
      }
      if (file === 'docker' && args[0] === 'inspect') {
        return {
          exitCode: 0,
          stdout: JSON.stringify([
            {
              State: { Status: 'running', Health: { Status: 'healthy' } },
              Config: { Image: formatImageReference('0.7.5') }
            }
          ]),
          stderr: ''
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const ctx = createDeployContext(runner, moduleUrl);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await deployUpdate(ctx, { dir: deploymentDir });

    expect(runner.calls.some((call) => call.args.join(' ') === 'compose pull')).toBe(true);
    expect(
      runner.calls.some((call) => call.args.join(' ') === 'compose up -d --remove-orphans')
    ).toBe(true);
    expect(log).toHaveBeenCalledWith(`Configured image: ${formatImageReference('0.7.5')}`);

    log.mockRestore();
  });

  it('reports structured deployment status from docker inspect output', async () => {
    const deploymentDir = mkdtempSync(path.join(tmpdir(), 'team-hub-deploy-'));
    mkdirSync(deploymentDir, { recursive: true });
    writeFileSync(path.join(deploymentDir, '.env'), 'APP_VERSION=0.7.6\n', 'utf8');

    const runner = createRecordingRunner((file, args) => {
      if (file === 'docker' && args[0] === 'info') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (file === 'docker' && args[0] === 'ps') {
        return { exitCode: 0, stdout: 'abc123\n', stderr: '' };
      }
      if (file === 'docker' && args[0] === 'inspect') {
        return {
          exitCode: 0,
          stdout: JSON.stringify([
            {
              State: { Status: 'running', Health: { Status: 'healthy' } },
              Config: { Image: formatImageReference('0.7.6') }
            }
          ]),
          stderr: ''
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const ctx = createDeployContext(runner, moduleUrl);
    const status = await deployStatus(ctx, { dir: deploymentDir });

    expect(status.dockerAvailable).toBe(true);
    expect(status.containerRunning).toBe(true);
    expect(status.healthStatus).toBe('healthy');
    expect(status.configuredImage).toBe(formatImageReference('0.7.6'));
  });

  it('uninstall without purge keeps deployment files', async () => {
    const deploymentDir = mkdtempSync(path.join(tmpdir(), 'team-hub-deploy-'));
    mkdirSync(deploymentDir, { recursive: true });
    writeFileSync(path.join(deploymentDir, '.env'), 'APP_VERSION=0.7.6\n', 'utf8');

    const runner = createRecordingRunner((file, args) => {
      if (file === 'docker' && args[0] === 'info') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (file === 'docker' && args[0] === 'compose') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const ctx = createDeployContext(runner, moduleUrl);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await deployUninstall(ctx, { dir: deploymentDir });

    expect(
      runner.calls.some((call) => call.args.join(' ') === 'compose down --remove-orphans')
    ).toBe(true);
    expect(readFileSync(path.join(deploymentDir, '.env'), 'utf8')).toContain('APP_VERSION=0.7.6');
    expect(log).toHaveBeenCalledWith(`Deployment files retained at: ${deploymentDir}`);

    log.mockRestore();
  });
});
