import { Command } from 'commander';
import { DEPLOY_DIR_ENV_VAR } from '#/deploy/constants.js';
import {
  confirmPurge,
  createDeployContext,
  deployInstall,
  deployLogs,
  deployRestart,
  deployStart,
  deployStatus,
  deployStop,
  deployUninstall,
  deployUpdate,
  deployVersion,
  printDeployStatus
} from '#/deploy/deployManager.js';
import {
  DockerUnavailableError,
  SpawnCommandRunner,
  type CommandRunner
} from '#/deploy/dockerRunner.js';

export interface DeployCommandDependencies {
  /**
   * Optional injectable command runner for tests.
   */
  runner?: CommandRunner;

  /**
   * Module URL used to resolve bundled deploy assets from the installed package.
   */
  moduleUrl?: string;
}

/**
 * Registers Docker deployment management commands under `team-hub deploy`.
 *
 * These commands wrap Docker Compose around the prebuilt GHCR image. They do not
 * build the application image locally or start the Node server directly.
 *
 * @param program - Root Commander program.
 * @param deps - Injectable dependencies for tests.
 */
export function registerDeployCommand(
  program: Command,
  deps: DeployCommandDependencies = {}
): void {
  const runner = deps.runner ?? new SpawnCommandRunner();
  const moduleUrl = deps.moduleUrl ?? import.meta.url;

  const deploy = program
    .command('deploy')
    .description('Manage a production Team Hub deployment via Docker Compose (GHCR image)');

  deploy
    .command('install')
    .description('Prepare deployment files, pull the GHCR image, and start Team Hub')
    .option(
      '--dir <path>',
      `Deployment directory (default: $${DEPLOY_DIR_ENV_VAR} or ~/.config/team-hub)`
    )
    .option('--version <tag>', 'Container image tag to deploy (defaults to CLI package version)')
    .action(async (options: { dir?: string; version?: string }) => {
      await runDeployAction(async () => {
        const ctx = createDeployContext(runner, moduleUrl);
        await deployInstall(ctx, options);
      });
    });

  deploy
    .command('start')
    .description('Start the managed Team Hub deployment')
    .option('--dir <path>', 'Deployment directory')
    .action(async (options: { dir?: string }) => {
      await runDeployAction(async () => {
        const ctx = createDeployContext(runner, moduleUrl);
        await deployStart(ctx, options);
      });
    });

  deploy
    .command('stop')
    .description('Stop the managed Team Hub deployment without removing data volumes')
    .option('--dir <path>', 'Deployment directory')
    .action(async (options: { dir?: string }) => {
      await runDeployAction(async () => {
        const ctx = createDeployContext(runner, moduleUrl);
        await deployStop(ctx, options);
      });
    });

  deploy
    .command('restart')
    .description('Recreate or restart the managed Team Hub deployment')
    .option('--dir <path>', 'Deployment directory')
    .action(async (options: { dir?: string }) => {
      await runDeployAction(async () => {
        const ctx = createDeployContext(runner, moduleUrl);
        await deployRestart(ctx, options);
      });
    });

  deploy
    .command('update')
    .description('Pull the configured GHCR image and recreate the deployment')
    .option('--dir <path>', 'Deployment directory')
    .action(async (options: { dir?: string }) => {
      await runDeployAction(async () => {
        const ctx = createDeployContext(runner, moduleUrl);
        await deployUpdate(ctx, options);
      });
    });

  deploy
    .command('status')
    .description('Show Docker and Team Hub deployment status')
    .option('--dir <path>', 'Deployment directory')
    .action(async (options: { dir?: string }) => {
      await runDeployAction(async () => {
        const ctx = createDeployContext(runner, moduleUrl);
        const status = await deployStatus(ctx, options);
        printDeployStatus(status);
      });
    });

  deploy
    .command('logs')
    .description('Follow Team Hub container logs')
    .option('--dir <path>', 'Deployment directory')
    .option('--tail <lines>', 'Number of historical log lines to show before following', (value) =>
      Number.parseInt(value, 10)
    )
    .action(async (options: { dir?: string; tail?: number }) => {
      await runDeployAction(async () => {
        const ctx = createDeployContext(runner, moduleUrl);
        await deployLogs(ctx, options);
      });
    });

  deploy
    .command('version')
    .description('Show CLI version and configured/running container image information')
    .option('--dir <path>', 'Deployment directory')
    .action(async (options: { dir?: string }) => {
      await runDeployAction(async () => {
        const ctx = createDeployContext(runner, moduleUrl);
        await deployVersion(ctx, options);
      });
    });

  deploy
    .command('uninstall')
    .description(
      'Stop and remove Team Hub containers (optionally purge deployment files and volumes)'
    )
    .option('--dir <path>', 'Deployment directory')
    .option('--purge', 'Delete deployment files and named volumes')
    .option('--yes', 'Skip confirmation prompts for destructive purge operations')
    .action(async (options: { dir?: string; purge?: boolean; yes?: boolean }) => {
      await runDeployAction(async () => {
        if (options.purge) {
          const confirmed = await confirmPurge(options);
          if (!confirmed) {
            console.log('Uninstall cancelled.');
            return;
          }
        }

        const ctx = createDeployContext(runner, moduleUrl);
        await deployUninstall(ctx, options);
      });
    });
}

/**
 * Executes a deploy subcommand action with consistent Docker error handling.
 *
 * @param action - Async deploy handler invoked by Commander.
 */
async function runDeployAction(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (error instanceof DockerUnavailableError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
