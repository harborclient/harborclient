/**
 * HarborClient product entrypoint — routes argv to GUI, CLI, help, or version.
 *
 * This module is the Electron main-process entry. It must stay free of heavy
 * GUI imports so CLI and help paths exit before the desktop graph loads.
 */
import { app } from 'electron';
import { classifyArgv, getUserArgv } from './classifyArgv';
import { printHelp, printVersion } from './help';
import { runCliProcess } from './runCliProcess';

/**
 * Classifies launch argv and either prints meta output, re-execs the CLI, or
 * dynamically loads the GUI main process.
 *
 * @returns Promise that settles when routing has started the chosen path.
 */
async function bootstrap(): Promise<void> {
  const userArgv = getUserArgv();
  const route = classifyArgv(userArgv);

  if (route === 'help') {
    printHelp();
    app.exit(0);
    return;
  }

  if (route === 'version') {
    printVersion(app.getVersion());
    app.exit(0);
    return;
  }

  if (route === 'cli') {
    const code = await runCliProcess(userArgv);
    app.exit(code);
    return;
  }

  // GUI path — load only after classification so CLI/help never take the lock.
  await import('../../gui/src/main/index');
}

void bootstrap().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  app.exit(1);
});
