import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

/**
 * Registers an IPC handler that validates positional arguments before invoking the callback.
 *
 * @param channel - IPC channel name.
 * @param args - Zod tuple schema for handler arguments.
 * @param fn - Handler invoked with validated arguments.
 */
export function handle<S extends z.ZodTuple>(
  channel: string,
  args: S,
  fn: (event: IpcMainInvokeEvent, ...handlerArgs: z.infer<S>) => unknown
): void {
  ipcMain.handle(channel, (event, ...raw) => {
    const result = args.safeParse(raw);
    if (!result.success) {
      throw new Error(`Invalid IPC argument for "${channel}": ${result.error.message}`);
    }
    return fn(event, ...(result.data as z.infer<S>));
  });
}
