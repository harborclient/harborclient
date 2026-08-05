import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { POSTGRES_VOLUME_NAME } from '#/deploy/constants.js';
import {
  assertComposeSuccess,
  assertDockerAvailable,
  assertDockerComposeAvailable,
  runDockerCompose,
  type CommandRunner
} from '#/deploy/dockerRunner.js';
import {
  bundledDeployAssetPaths,
  formatImageReference,
  resolveDeploymentDirectory,
  resolveGhcrImageRepository,
  resolvePackageRootFromModuleUrl
} from '#/deploy/deploymentPaths.js';
import { readPackageVersion } from '#/packageVersion.js';
import { isValidImageTag } from '#/deploy/validation.js';

export interface DeployContext {
  /**
   * Managed deployment directory containing compose.yaml and .env.
   */
  deploymentDir: string;

  /**
   * GHCR repository without tag (for example ghcr.io/harborclient/team-hub).
   */
  imageRepository: string;

  /**
   * CLI package version from package.json.
   */
  cliVersion: string;

  /**
   * Command runner used to invoke Docker (injectable in tests).
   */
  runner: CommandRunner;

  /**
   * Absolute npm package root used to locate bundled deploy templates.
   */
  packageRoot: string;
}

export interface DeployInstallOptions {
  /**
   * Optional override for the managed deployment directory.
   */
  dir?: string;

  /**
   * Image tag to deploy (defaults to the CLI package version).
   */
  version?: string;
}

export interface DeployLogsOptions {
  /**
   * Optional number of log lines to show before following output.
   */
  tail?: number;
}

export interface DeployUninstallOptions {
  /**
   * When true, delete deployment files and named volumes after confirmation.
   */
  purge?: boolean;

  /**
   * When true, skip interactive confirmation for destructive purge operations.
   */
  yes?: boolean;
}

export interface DeployStatus {
  /**
   * Whether Docker responded successfully to `docker info`.
   */
  dockerAvailable: boolean;

  /**
   * Whether the Team Hub container exists.
   */
  containerExists: boolean;

  /**
   * Whether the Team Hub container is currently running.
   */
  containerRunning: boolean;

  /**
   * Docker-reported container state (for example `running`, `exited`).
   */
  containerState: string | null;

  /**
   * Health status from Docker when a health check is configured.
   */
  healthStatus: string | null;

  /**
   * Image reference configured in compose (.env APP_VERSION + repository).
   */
  configuredImage: string;

  /**
   * Image ID or digest reported by Docker for the running container, when available.
   */
  runningImage: string | null;
}

/**
 * Creates the deploy context used by CLI commands.
 *
 * @param runner - Injectable command runner (defaults to spawn-backed runner in CLI wiring).
 * @param moduleUrl - Module URL for resolving bundled assets from the installed package.
 * @returns Deploy context with resolved paths and version metadata.
 */
export function createDeployContext(runner: CommandRunner, moduleUrl: string): DeployContext {
  return {
    deploymentDir: resolveDeploymentDirectory(),
    imageRepository: resolveGhcrImageRepository(),
    cliVersion: readPackageVersion(),
    runner,
    packageRoot: resolvePackageRootFromModuleUrl(moduleUrl)
  };
}

/**
 * Reads the configured APP_VERSION value from the deployment .env file.
 *
 * @param deploymentDir - Managed deployment directory.
 * @returns Image tag configured for compose, defaulting to `latest`.
 */
export function readConfiguredImageTag(deploymentDir: string): string {
  const envPath = path.join(deploymentDir, '.env');
  if (!existsSync(envPath)) {
    return 'latest';
  }

  const contents = readFileSync(envPath, 'utf8');
  const match = contents.match(/^APP_VERSION=(.+)$/m);
  const raw = match?.[1]?.trim().replace(/^["']|["']$/g, '');
  return raw && isValidImageTag(raw) ? raw : 'latest';
}

/**
 * Ensures the managed deployment directory exists with compose.yaml and .env files.
 *
 * @param ctx - Deploy context with paths and bundled asset locations.
 * @param versionTag - Image tag written into a newly created .env file.
 */
export function ensureDeploymentFiles(ctx: DeployContext, versionTag: string): void {
  mkdirSync(ctx.deploymentDir, { recursive: true });

  const composePath = path.join(ctx.deploymentDir, 'compose.yaml');
  const envPath = path.join(ctx.deploymentDir, '.env');
  const assets = bundledDeployAssetPaths(ctx.packageRoot);

  if (!existsSync(composePath)) {
    copyFileSync(assets.composeTemplate, composePath);
  }

  if (!existsSync(envPath)) {
    const example = readFileSync(assets.envExample, 'utf8');
    const envContents = example.includes('APP_VERSION=')
      ? example.replace(/^APP_VERSION=.*$/m, `APP_VERSION=${versionTag}`)
      : `${example.trim()}\nAPP_VERSION=${versionTag}\n`;
    writeFileSync(envPath, envContents, { encoding: 'utf8', mode: 0o600 });
  }
}

/**
 * Installs Team Hub by preparing deployment files and starting the GHCR container.
 *
 * @param ctx - Deploy context.
 * @param options - Install options such as directory override and image tag.
 */
export async function deployInstall(
  ctx: DeployContext,
  options: DeployInstallOptions = {}
): Promise<void> {
  if (options.dir) {
    ctx.deploymentDir = resolveDeploymentDirectory(options.dir);
  }

  const versionTag = options.version ?? ctx.cliVersion;
  if (!isValidImageTag(versionTag)) {
    throw new Error(`Invalid image tag: ${versionTag}`);
  }

  await assertDockerAvailable(ctx.runner);
  await assertDockerComposeAvailable(ctx.runner);

  ensureDeploymentFiles(ctx, versionTag);

  const pull = await runDockerCompose(ctx.runner, ctx.deploymentDir, ['pull']);
  assertComposeSuccess(pull, 'pull container image');

  const up = await runDockerCompose(ctx.runner, ctx.deploymentDir, [
    'up',
    '-d',
    '--remove-orphans'
  ]);
  assertComposeSuccess(up, 'start Team Hub');

  console.log(`Deployment directory: ${ctx.deploymentDir}`);
  console.log(`Configured image: ${formatImageReference(versionTag)}`);
  console.log(
    'Team Hub installation started. Run `team-hub deploy status` to verify container health.'
  );
}

/**
 * Starts the managed Team Hub deployment.
 *
 * @param ctx - Deploy context.
 * @param options - Optional deployment directory override.
 */
export async function deployStart(
  ctx: DeployContext,
  options: { dir?: string } = {}
): Promise<void> {
  if (options.dir) {
    ctx.deploymentDir = resolveDeploymentDirectory(options.dir);
  }

  await assertDockerAvailable(ctx.runner);
  await assertDockerComposeAvailable(ctx.runner);

  const result = await runDockerCompose(ctx.runner, ctx.deploymentDir, [
    'up',
    '-d',
    '--remove-orphans'
  ]);
  assertComposeSuccess(result, 'start Team Hub');
}

/**
 * Stops the managed Team Hub deployment without removing volumes.
 *
 * @param ctx - Deploy context.
 * @param options - Optional deployment directory override.
 */
export async function deployStop(
  ctx: DeployContext,
  options: { dir?: string } = {}
): Promise<void> {
  if (options.dir) {
    ctx.deploymentDir = resolveDeploymentDirectory(options.dir);
  }

  await assertDockerAvailable(ctx.runner);
  await assertDockerComposeAvailable(ctx.runner);

  const result = await runDockerCompose(ctx.runner, ctx.deploymentDir, ['stop']);
  assertComposeSuccess(result, 'stop Team Hub');
}

/**
 * Restarts the managed Team Hub deployment, recreating containers when needed.
 *
 * @param ctx - Deploy context.
 * @param options - Optional deployment directory override.
 */
export async function deployRestart(
  ctx: DeployContext,
  options: { dir?: string } = {}
): Promise<void> {
  if (options.dir) {
    ctx.deploymentDir = resolveDeploymentDirectory(options.dir);
  }

  await assertDockerAvailable(ctx.runner);
  await assertDockerComposeAvailable(ctx.runner);

  const result = await runDockerCompose(ctx.runner, ctx.deploymentDir, [
    'up',
    '-d',
    '--force-recreate',
    '--remove-orphans'
  ]);
  assertComposeSuccess(result, 'restart Team Hub');
}

/**
 * Pulls the configured GHCR image and recreates the managed deployment.
 *
 * @param ctx - Deploy context.
 * @param options - Optional deployment directory override.
 */
export async function deployUpdate(
  ctx: DeployContext,
  options: { dir?: string } = {}
): Promise<void> {
  if (options.dir) {
    ctx.deploymentDir = resolveDeploymentDirectory(options.dir);
  }

  await assertDockerAvailable(ctx.runner);
  await assertDockerComposeAvailable(ctx.runner);

  const previousTag = readConfiguredImageTag(ctx.deploymentDir);
  const previousImage = formatImageReference(previousTag);

  const inspectBefore = await inspectRunningContainer(ctx);
  const runningBefore = inspectBefore?.image ?? null;

  const pull = await runDockerCompose(ctx.runner, ctx.deploymentDir, ['pull']);
  assertComposeSuccess(pull, 'pull container image');

  const up = await runDockerCompose(ctx.runner, ctx.deploymentDir, [
    'up',
    '-d',
    '--remove-orphans'
  ]);
  assertComposeSuccess(up, 'recreate Team Hub with updated image');

  const inspectAfter = await inspectRunningContainer(ctx);
  const runningAfter = inspectAfter?.image ?? null;

  console.log(`Configured image: ${previousImage}`);
  if (runningBefore) {
    console.log(`Previous running image: ${runningBefore}`);
  }
  if (runningAfter) {
    console.log(`Current running image: ${runningAfter}`);
  }
}

/**
 * Collects deployment status from Docker structured output.
 *
 * @param ctx - Deploy context.
 * @param options - Optional deployment directory override.
 * @returns Structured status information for CLI display.
 */
export async function deployStatus(
  ctx: DeployContext,
  options: { dir?: string } = {}
): Promise<DeployStatus> {
  if (options.dir) {
    ctx.deploymentDir = resolveDeploymentDirectory(options.dir);
  }

  const configuredTag = readConfiguredImageTag(ctx.deploymentDir);
  const status: DeployStatus = {
    dockerAvailable: false,
    containerExists: false,
    containerRunning: false,
    containerState: null,
    healthStatus: null,
    configuredImage: formatImageReference(configuredTag),
    runningImage: null
  };

  try {
    await assertDockerAvailable(ctx.runner);
    status.dockerAvailable = true;
  } catch {
    return status;
  }

  const inspect = await inspectRunningContainer(ctx);
  if (!inspect) {
    return status;
  }

  status.containerExists = true;
  status.containerRunning = inspect.state === 'running';
  status.containerState = inspect.state;
  status.healthStatus = inspect.health;
  status.runningImage = inspect.image;
  return status;
}

/**
 * Prints human-readable deployment status lines.
 *
 * @param status - Structured status from {@link deployStatus}.
 */
export function printDeployStatus(status: DeployStatus): void {
  console.log(`Docker available: ${status.dockerAvailable ? 'yes' : 'no'}`);
  console.log(`Configured image: ${status.configuredImage}`);

  if (!status.containerExists) {
    console.log('Container: not found');
    return;
  }

  console.log(`Container state: ${status.containerState ?? 'unknown'}`);
  console.log(`Container running: ${status.containerRunning ? 'yes' : 'no'}`);

  if (status.healthStatus) {
    console.log(`Health status: ${status.healthStatus}`);
  }

  if (status.runningImage) {
    console.log(`Running image: ${status.runningImage}`);
  }
}

/**
 * Follows Team Hub container logs via Docker Compose.
 *
 * @param ctx - Deploy context.
 * @param options - Log options such as tail line count and directory override.
 */
export async function deployLogs(
  ctx: DeployContext,
  options: DeployLogsOptions & { dir?: string } = {}
): Promise<void> {
  if (options.dir) {
    ctx.deploymentDir = resolveDeploymentDirectory(options.dir);
  }

  await assertDockerAvailable(ctx.runner);
  await assertDockerComposeAvailable(ctx.runner);

  const args = ['logs', '--follow'];
  if (options.tail !== undefined) {
    args.push('--tail', String(options.tail));
  }

  const result = await runDockerCompose(ctx.runner, ctx.deploymentDir, args);
  if (result.exitCode !== 0 && result.exitCode !== null) {
    assertComposeSuccess(result, 'follow Team Hub logs');
  }
}

/**
 * Prints CLI, configured, and running image version information.
 *
 * @param ctx - Deploy context.
 * @param options - Optional deployment directory override.
 */
export async function deployVersion(
  ctx: DeployContext,
  options: { dir?: string } = {}
): Promise<void> {
  if (options.dir) {
    ctx.deploymentDir = resolveDeploymentDirectory(options.dir);
  }

  const configuredTag = readConfiguredImageTag(ctx.deploymentDir);
  console.log(`CLI version: ${ctx.cliVersion}`);
  console.log(`Configured container image: ${formatImageReference(configuredTag)}`);
  console.log(`GHCR repository: ${resolveGhcrImageRepository()}`);

  const inspect = await inspectRunningContainer(ctx);
  if (inspect?.image) {
    console.log(`Running container image: ${inspect.image}`);
  }
}

/**
 * Stops the deployment and optionally purges local deployment files and volumes.
 *
 * @param ctx - Deploy context.
 * @param options - Uninstall options including destructive purge behavior.
 */
export async function deployUninstall(
  ctx: DeployContext,
  options: DeployUninstallOptions & { dir?: string } = {}
): Promise<void> {
  if (options.dir) {
    ctx.deploymentDir = resolveDeploymentDirectory(options.dir);
  }

  await assertDockerAvailable(ctx.runner);
  await assertDockerComposeAvailable(ctx.runner);

  const downArgs = ['down', '--remove-orphans'];
  if (options.purge) {
    downArgs.push('--volumes');
  }

  const result = await runDockerCompose(ctx.runner, ctx.deploymentDir, downArgs);
  assertComposeSuccess(result, 'remove Team Hub containers');

  if (options.purge) {
    rmSync(ctx.deploymentDir, { recursive: true, force: true });
    console.log(`Removed deployment directory: ${ctx.deploymentDir}`);
    console.log(`Removed Docker volume: ${POSTGRES_VOLUME_NAME}`);
    return;
  }

  console.log('Team Hub containers stopped and removed.');
  console.log(`Deployment files retained at: ${ctx.deploymentDir}`);
  console.log(`Postgres data volume retained: ${POSTGRES_VOLUME_NAME}`);
  console.log('Re-run with --purge to delete deployment files and named volumes.');
}

interface ContainerInspectSummary {
  /**
   * Docker state string such as `running`.
   */
  state: string;

  /**
   * Health status when configured (`healthy`, `unhealthy`, etc.).
   */
  health: string | null;

  /**
   * Image ID or digest for the container.
   */
  image: string;
}

/**
 * Reads structured container metadata for the Team Hub compose service.
 *
 * @param ctx - Deploy context.
 * @returns Parsed container summary or null when the container does not exist.
 */
async function inspectRunningContainer(
  ctx: DeployContext
): Promise<ContainerInspectSummary | null> {
  const ps = await ctx.runner.run(
    'docker',
    ['ps', '-a', '--filter', 'name=^team-hub$', '--format', '{{.ID}}'],
    { capture: true }
  );

  const containerId = ps.stdout.trim().split('\n').find(Boolean);
  if (!containerId) {
    return null;
  }

  const inspect = await ctx.runner.run('docker', ['inspect', containerId], { capture: true });
  if (inspect.exitCode !== 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(inspect.stdout) as Array<{
      State?: { Status?: string; Health?: { Status?: string } };
      Image?: string;
      Config?: { Image?: string };
    }>;

    const entry = parsed[0];
    if (!entry) {
      return null;
    }

    return {
      state: entry.State?.Status ?? 'unknown',
      health: entry.State?.Health?.Status ?? null,
      image: entry.Config?.Image ?? entry.Image ?? 'unknown'
    };
  } catch {
    return null;
  }
}

/**
 * Prompts the operator to confirm a destructive purge unless `--yes` was supplied.
 *
 * @param options - Uninstall options containing the yes flag.
 * @returns Promise resolving to true when the purge should proceed.
 */
export async function confirmPurge(options: DeployUninstallOptions): Promise<boolean> {
  if (options.yes) {
    return true;
  }

  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = await rl.question(
      'This will delete deployment files and the Postgres data volume. Continue? [y/N] '
    );
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}
