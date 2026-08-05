import type { HttpMethod } from '@harborclient/core/types';
import { formatResponseBody } from './formatResponseBody';
import { runCollection } from './runCollection';
import { runServersCommand } from './runServers';
import { runWorkflowCommand } from './runWorkflow';
import { sendAdHocRequest } from './sendAdHoc';

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/**
 * Prints CLI usage help to stderr.
 *
 * End users normally see product help via `harborclient --help`. This text is
 * for direct `pnpm cli` / internal CLI entry invocations.
 */
function printHelp(): void {
  console.error(`HarborClient CLI

Usage:
  harborclient <METHOD> <url> [options]
  harborclient run <collection> [options]
  harborclient workflow run <workflow> [options]
  harborclient servers run <server> [options]

Ad-hoc options:
  -H, --header <Name: value>   Add a request header (repeatable)
  -d, --data <body>            Request body
  --json <body>                JSON body (sets Content-Type)
  --timeout <ms>               Request timeout in milliseconds
  --no-verify-ssl              Disable TLS certificate verification
  -v, --verbose                Print response headers
  -p, --pretty                 Pretty-print JSON response bodies
  -h, --help                   Show this help

Collection run options:
  run <name-or-uuid>           Run all requests in a saved collection
  --user-data <path>           Override Electron userData directory
  --stop-on-failure            Stop after the first failed request

Workflow run options:
  workflow run <name-or-uuid>  Run a saved workflow headlessly
  --user-data <path>           Override Electron userData directory
  --stop-on-failure            Stop after the first failed request
  --export <dir>               Write a workflow-run JSON export to this directory

Live server options:
  servers run <name-or-uuid>   Start a saved live server until Ctrl+C
  --user-data <path>           Override Electron userData directory

Examples:
  harborclient GET https://httpbin.org/get
  harborclient GET https://httpbin.org/get -p
  harborclient POST https://httpbin.org/post --json '{"ok":true}'
  harborclient run "My Collection"
  harborclient workflow run "My Workflow" --export ./results
  harborclient servers run "Echo Server"
`);
}

/**
 * Parses `servers …` subcommands after the leading `servers` token.
 *
 * @param argv - Arguments following `servers`.
 * @returns Process exit code.
 */
async function runServersArgv(argv: string[]): Promise<number> {
  if (argv[0] !== 'run') {
    console.error(`Unknown servers subcommand: ${argv[0] ?? '(missing)'}`);
    printHelp();
    return 1;
  }

  const serverRef = argv[1];
  if (!serverRef) {
    console.error('Missing live server name or uuid');
    printHelp();
    return 1;
  }

  let userDataPath: string | undefined;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--user-data') {
      userDataPath = argv[++i];
      if (userDataPath == null) {
        console.error('Missing value for --user-data');
        return 1;
      }
    } else {
      console.error(`Unknown option: ${arg}`);
      return 1;
    }
  }

  return runServersCommand({ serverRef, userDataPath });
}

/**
 * Parses `workflow …` subcommands after the leading `workflow` token.
 *
 * @param argv - Arguments following `workflow`.
 * @returns Process exit code.
 */
async function runWorkflowArgv(argv: string[]): Promise<number> {
  if (argv[0] !== 'run') {
    console.error(`Unknown workflow subcommand: ${argv[0] ?? '(missing)'}`);
    printHelp();
    return 1;
  }

  const workflowRef = argv[1];
  if (!workflowRef) {
    console.error('Missing workflow name or uuid');
    printHelp();
    return 1;
  }

  let userDataPath: string | undefined;
  let stopOnFailure = false;
  let exportDirectory: string | undefined;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--user-data') {
      userDataPath = argv[++i];
      if (userDataPath == null) {
        console.error('Missing value for --user-data');
        return 1;
      }
    } else if (arg === '--stop-on-failure') {
      stopOnFailure = true;
    } else if (arg === '--export') {
      exportDirectory = argv[++i];
      if (exportDirectory == null) {
        console.error('Missing value for --export');
        return 1;
      }
    } else {
      console.error(`Unknown option: ${arg}`);
      return 1;
    }
  }

  return runWorkflowCommand({ workflowRef, userDataPath, stopOnFailure, exportDirectory });
}

/**
 * Parses CLI argv into an ad-hoc, collection-run, workflow-run, or servers-run
 * command and executes it.
 *
 * @param argv - Process arguments excluding node and script path.
 * @returns Process exit code.
 */
export async function runCli(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    printHelp();
    return argv.length === 0 ? 1 : 0;
  }

  if (argv[0] === 'workflow') {
    return runWorkflowArgv(argv.slice(1));
  }

  if (argv[0] === 'servers') {
    return runServersArgv(argv.slice(1));
  }

  if (argv[0] === 'run') {
    const collectionRef = argv[1];
    if (!collectionRef) {
      console.error('Missing collection name or uuid');
      printHelp();
      return 1;
    }
    let userDataPath: string | undefined;
    let stopOnFailure = false;
    for (let i = 2; i < argv.length; i++) {
      const arg = argv[i]!;
      if (arg === '--user-data') {
        userDataPath = argv[++i];
      } else if (arg === '--stop-on-failure') {
        stopOnFailure = true;
      } else {
        console.error(`Unknown option: ${arg}`);
        return 1;
      }
    }
    return runCollection({ collectionRef, userDataPath, stopOnFailure });
  }

  const methodToken = argv[0]!.toUpperCase();
  if (!HTTP_METHODS.has(methodToken)) {
    console.error(`Unknown command or method: ${argv[0]}`);
    printHelp();
    return 1;
  }

  const url = argv[1];
  if (!url) {
    console.error('Missing URL');
    printHelp();
    return 1;
  }

  const headers: string[] = [];
  let body: string | undefined;
  let json = false;
  let timeoutMs: number | undefined;
  let verifySsl: boolean | undefined;
  let verbose = false;
  let pretty = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '-H' || arg === '--header') {
      const value = argv[++i];
      if (!value) {
        console.error('Missing value for --header');
        return 1;
      }
      headers.push(value);
    } else if (arg === '-d' || arg === '--data') {
      body = argv[++i];
      if (body == null) {
        console.error('Missing value for --data');
        return 1;
      }
    } else if (arg === '--json') {
      body = argv[++i];
      if (body == null) {
        console.error('Missing value for --json');
        return 1;
      }
      json = true;
    } else if (arg === '--timeout') {
      timeoutMs = Number(argv[++i]);
      if (!Number.isFinite(timeoutMs)) {
        console.error('Invalid --timeout value');
        return 1;
      }
    } else if (arg === '--no-verify-ssl') {
      verifySsl = false;
    } else if (arg === '-v' || arg === '--verbose') {
      verbose = true;
    } else if (arg === '-p' || arg === '--pretty') {
      pretty = true;
    } else {
      console.error(`Unknown option: ${arg}`);
      return 1;
    }
  }

  const result = await sendAdHocRequest({
    method: methodToken as HttpMethod,
    url,
    headers,
    body,
    json,
    timeoutMs,
    verifySsl
  });

  if (result.error) {
    console.error(result.error);
    return 1;
  }

  if (verbose) {
    console.error(`HTTP ${result.status} ${result.statusText}`);
    for (const [key, value] of Object.entries(result.headers)) {
      console.error(`${key}: ${value}`);
    }
    console.error('');
  }

  process.stdout.write(formatResponseBody(result.body, pretty));

  return result.status >= 400 ? 1 : 0;
}

runCli(process.argv.slice(2))
  .then((code) => {
    process.exit(code);
  })
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
