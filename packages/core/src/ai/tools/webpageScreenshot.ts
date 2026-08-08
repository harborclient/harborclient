import { z } from 'zod';
import type { ITool } from './ITool';

/**
 * Arguments for the webpage_screenshot tool.
 */
export interface WebpageScreenshotToolArgs {
  /**
   * Browser tab id from webpage_tab.
   */
  tabId: string;

  /**
   * When true, scroll-stitch the full document; otherwise capture the visible viewport.
   */
  fullPage?: boolean;

  /**
   * When true, prompt the user to save a PNG file. When false or omitted, open the
   * capture in an Image View tab.
   */
  saveToFile?: boolean;
}

/**
 * Captures a PNG screenshot of an embedded browser tab.
 *
 * @param {string} tabId - Browser tab id from webpage_tab.
 * @param {boolean} [fullPage] - Capture the full scrollable page when true.
 * @param {boolean} [saveToFile] - Prompt to save a file when true; otherwise open Image View.
 */
export const webpageScreenshotTool = {
  name: 'webpage_screenshot',
  definition: {
    type: 'function',
    function: {
      name: 'webpage_screenshot',
      description:
        'Captures a PNG screenshot of an embedded HarborClient browser tab. Pass tabId from webpage_tab. By default opens the capture in an Image View tab. Set saveToFile true only when the user explicitly asks to save a screenshot to disk. Set fullPage true to scroll-stitch the full document (otherwise captures the visible viewport). Do not suggest OS screenshot utilities when this tool is available.',
      parameters: {
        type: 'object',
        properties: {
          tabId: {
            type: 'string',
            description: 'Browser tab id from webpage_tab.'
          },
          fullPage: {
            type: 'boolean',
            description:
              'When true, capture the full scrollable page; otherwise capture the visible viewport.'
          },
          saveToFile: {
            type: 'boolean',
            description:
              'When true, prompt the user to save a PNG file. When false or omitted, open the capture in an Image View tab.'
          }
        },
        required: ['tabId'],
        additionalProperties: false
      }
    }
  },
  inputShape: {
    tabId: z.string(),
    fullPage: z.boolean().optional(),
    saveToFile: z.boolean().optional()
  }
} as const satisfies ITool<'webpage_screenshot'>;
