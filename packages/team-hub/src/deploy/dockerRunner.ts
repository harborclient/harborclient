import { spawn, type SpawnOptions } from 'node:child_process';

export interface CommandResult {
  /**
   * Process exit code, or null when the process was terminated by a signal.
   */
  exitCode: number | null;

  /**
   * Captured standard output when stdio was configured for capture.
   */
  stdout: string;

  /**
   * Captured standard error when stdio was configured for capture.
   */
  stderr: string;
}

export interface CommandRunner {
  /**
   * Runs an external command and optionally streams stdio to the parent process.
   *
   * @param file - Executable name or path.
   * @param args - Argument vector passed directly to spawn (never via a shell).
   * @param options - Spawn options including working directory and stdio mode.
   * @returns Promise resolving to exit metadata and captured output when applicable.
   */
  run(
    file: string,
    args: string[],
    options?: SpawnOptions & { capture?: boolean }
  ): Promise<CommandResult>;
}

/**
 * Default command runner backed by Node child_process.spawn without a shell.
 */
export class SpawnCommandRunner implements CommandRunner {
  /**
   * Spawns a subprocess and waits for completion.
   *
   * @param file - Executable name or path.
   * @param args - Argument vector.
   * @param options - Spawn options; set capture=true to collect stdout/stderr.
   * @returns Process result including exit code and captured streams.
   */
  run(
    file: string,
    args: string[],
    options: SpawnOptions & { capture?: boolean } = {}
  ): Promise<CommandResult> {
    const { capture = false, ...spawnOptions } = options;

    return new Promise((resolve, reject) => {
      const child = spawn(file, args, {
        ...spawnOptions,
        stdio: capture ? ['ignore', 'pipe', 'pipe'] : (spawnOptions.stdio ?? 'inherit')
      });

      let stdout = '';
      let stderr = '';

      if (capture) {
        child.stdout?.on('data', (chunk: Buffer | string) => {
          stdout += String(chunk);
        });
        child.stderr?.on('data', (chunk: Buffer | string) => {
          stderr += String(chunk);
        });
      }

      child.on('error', (error: NodeJS.ErrnoException) => {
        reject(error);
      });

      child.on('close', (exitCode, signal) => {
        if (signal === 'SIGINT') {
          process.exit(130);
        }

        resolve({
          exitCode,
          stdout,
          stderr
        });
      });
    });
  }
}

/**
 * Error thrown when Docker or Docker Compose is missing or cannot be executed.
 */
export class DockerUnavailableError extends Error {
  /**
   * @param message - Human-readable explanation for operators.
   */
  constructor(message: string) {
    super(message);
    this.name = 'DockerUnavailableError';
  }
}

/**
 * Verifies that the Docker CLI is installed and reachable by the current user.
 *
 * @param runner - Command runner used to invoke Docker.
 * @throws DockerUnavailableError when Docker is missing or the daemon is unreachable.
 */
export async function assertDockerAvailable(runner: CommandRunner): Promise<void> {
  try {
    const result = await runner.run('docker', ['info'], { capture: true });
    if (result.exitCode !== 0) {
      throw new DockerUnavailableError(
        'Docker is installed but the daemon is not reachable. Ensure Docker is running and your user can access /var/run/docker.sock (you may need to add your account to the docker group).'
      );
    }
  } catch (error) {
    if (error instanceof DockerUnavailableError) {
      throw error;
    }

    const errno = (error as NodeJS.ErrnoException).code;
    if (errno === 'ENOENT') {
      throw new DockerUnavailableError(
        'Docker was not found on PATH. Install Docker Engine and the Compose plugin before using Team Hub deployment commands.'
      );
    }

    throw new DockerUnavailableError(
      `Unable to run Docker: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Verifies that the Docker Compose plugin is available.
 *
 * @param runner - Command runner used to invoke Docker Compose.
 * @throws DockerUnavailableError when the compose subcommand is unavailable.
 */
export async function assertDockerComposeAvailable(runner: CommandRunner): Promise<void> {
  try {
    const result = await runner.run('docker', ['compose', 'version'], { capture: true });
    if (result.exitCode !== 0) {
      throw new DockerUnavailableError(
        'Docker Compose plugin is not available. Install docker-compose-plugin and verify `docker compose version` succeeds.'
      );
    }
  } catch (error) {
    if (error instanceof DockerUnavailableError) {
      throw error;
    }

    const errno = (error as NodeJS.ErrnoException).code;
    if (errno === 'ENOENT') {
      throw new DockerUnavailableError(
        'Docker Compose was not found. Install the Docker Compose plugin (docker-compose-plugin package).'
      );
    }

    throw error;
  }
}

/**
 * Runs a Docker Compose command in the managed deployment directory.
 *
 * @param runner - Command runner used to invoke Docker Compose.
 * @param deploymentDir - Directory containing compose.yaml.
 * @param args - Compose subcommand arguments (for example `up`, `-d`).
 * @param options - Additional spawn options such as stdio inheritance for logs.
 * @returns Process result from the compose invocation.
 */
export async function runDockerCompose(
  runner: CommandRunner,
  deploymentDir: string,
  args: string[],
  options: SpawnOptions & { capture?: boolean } = {}
): Promise<CommandResult> {
  return runner.run('docker', ['compose', ...args], {
    cwd: deploymentDir,
    ...options
  });
}

/**
 * Ensures a compose invocation succeeded and throws a descriptive error otherwise.
 *
 * @param result - Result returned by {@link runDockerCompose}.
 * @param action - Short description of the attempted operation for error messages.
 * @throws Error when the compose command exited with a non-zero status.
 */
export function assertComposeSuccess(result: CommandResult, action: string): void {
  if (result.exitCode === 0) {
    return;
  }

  const details = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n');
  throw new Error(
    details
      ? `Failed to ${action}.\n${details}`
      : `Failed to ${action} (exit code ${result.exitCode}).`
  );
}
