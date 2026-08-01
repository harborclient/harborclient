import type { CreateWebsiteInput, UpdateWebsiteInput, Website } from '../website';

/**
 * IPC surface for local website persistence.
 */
export interface ApiWebsites {
  /**
   * Lists all websites from the local registry.
   */
  listWebsites: () => Promise<Website[]>;

  /**
   * Creates a website and returns the refreshed list.
   */
  createWebsite: (input: CreateWebsiteInput) => Promise<Website[]>;

  /**
   * Updates a website and returns the refreshed list.
   */
  updateWebsite: (input: UpdateWebsiteInput) => Promise<Website[]>;

  /**
   * Deletes a website (moves it to trash) and returns the refreshed list.
   */
  deleteWebsite: (id: number) => Promise<Website[]>;

  /**
   * Moves a live page to another provider and returns the refreshed list.
   */
  moveWebsite: (id: number, targetConnectionId: string) => Promise<Website[]>;

  /**
   * Imports a HarborClient live-page export from a file selected via a native dialog.
   *
   * @returns The imported or updated website, or null when the dialog was canceled.
   */
  importWebsite: () => Promise<Website | null>;
}
