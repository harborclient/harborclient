import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signPlugin } from './sign.js';
import { verifyPlugin } from './verify.js';

const SIGN_USAGE =
  'Usage: hc-plugin-sign [--dir <pluginDir>] [--private-key <path>] [--key-id <id>] [--signature <path>]';
const VERIFY_USAGE =
  'Usage: hc-plugin-verify --dir <pluginDir> --public-key <path> [--public-key <path> ...] [--signature <path>] [--allow-unsigned]';
const PLUGIN_SIGNING_KEY_ENV = 'HARBORCLIENT_PLUGIN_SIGNING_KEY';

/**
 * Parsed CLI arguments shared by sign and verify commands.
 */
interface ParsedCliArgs {
  dir?: string;
  privateKeyPath?: string;
  publicKeyPaths: string[];
  keyId?: string;
  signaturePath?: string;
  allowUnsigned: boolean;
}

/**
 * Runtime context for the sign CLI.
 */
export interface RunSignCliOptions {
  cwd?: string;
}

/**
 * Parses supported CLI flags from process argv.
 *
 * @param argv - Raw process argv including node and script paths.
 */
function parseCliArgs(argv: string[]): ParsedCliArgs {
  const parsed: ParsedCliArgs = {
    publicKeyPaths: [],
    allowUnsigned: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    switch (arg) {
      case '--dir': {
        parsed.dir = argv[index + 1];
        index += 1;
        break;
      }
      case '--private-key': {
        parsed.privateKeyPath = argv[index + 1];
        index += 1;
        break;
      }
      case '--public-key': {
        const value = argv[index + 1];
        if (value) {
          parsed.publicKeyPaths.push(value);
        }
        index += 1;
        break;
      }
      case '--key-id': {
        parsed.keyId = argv[index + 1];
        index += 1;
        break;
      }
      case '--signature': {
        parsed.signaturePath = argv[index + 1];
        index += 1;
        break;
      }
      case '--allow-unsigned': {
        parsed.allowUnsigned = true;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

/**
 * Resolves the private key path from the environment or CLI fallback.
 *
 * @param parsed - Parsed CLI arguments.
 */
function resolvePrivateKeyPath(parsed: ParsedCliArgs): string | undefined {
  const fromEnv = process.env[PLUGIN_SIGNING_KEY_ENV]?.trim();
  return fromEnv || parsed.privateKeyPath;
}

/**
 * Reads a PEM key file from disk.
 *
 * @param path - Absolute or relative key file path.
 * @param cwd - Directory used to resolve relative paths.
 */
function readKeyFile(path: string, cwd = process.cwd()): string {
  return readFileSync(resolve(cwd, path), 'utf8');
}

/**
 * Runs the plugin sign CLI and returns a process exit code.
 *
 * @param argv - Raw process argv including node and script paths.
 * @param options - Runtime context for path resolution.
 */
export async function runSignCli(argv: string[], options: RunSignCliOptions = {}): Promise<number> {
  let parsed: ParsedCliArgs;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error(SIGN_USAGE);
    return 1;
  }

  const cwd = options.cwd ?? process.cwd();
  const pluginDir = resolve(cwd, parsed.dir ?? '.');
  const privateKeyPath = resolvePrivateKeyPath(parsed);

  if (!privateKeyPath) {
    console.error(SIGN_USAGE);
    return 1;
  }

  try {
    const result = await signPlugin({
      pluginDir,
      privateKeyPem: readKeyFile(privateKeyPath, cwd),
      keyId: parsed.keyId,
      signaturePath: parsed.signaturePath ? resolve(cwd, parsed.signaturePath) : undefined
    });
    console.log(`Wrote ${result.signaturePath}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 2;
  }
}

/**
 * Runs the plugin verify CLI and returns a process exit code.
 *
 * @param argv - Raw process argv including node and script paths.
 */
export async function runVerifyCli(argv: string[]): Promise<number> {
  let parsed: ParsedCliArgs;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error(VERIFY_USAGE);
    return 1;
  }

  if (!parsed.dir || parsed.publicKeyPaths.length === 0) {
    console.error(VERIFY_USAGE);
    return 1;
  }

  try {
    const result = await verifyPlugin({
      pluginDir: parsed.dir,
      trustedPublicKeysPem: parsed.publicKeyPaths.map((path) => readKeyFile(path)),
      signaturePath: parsed.signaturePath
    });

    if (result.status === 'valid') {
      const keyLabel = result.keyId ? ` (keyId: ${result.keyId})` : '';
      console.log(`Plugin signature is valid${keyLabel}.`);
      return 0;
    }

    if (result.status === 'unsigned') {
      console.error('Plugin is unsigned.');
      return parsed.allowUnsigned ? 0 : 4;
    }

    console.error(result.error ?? 'Plugin signature is invalid.');
    return 3;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 3;
  }
}
