import { describe, expect, it } from 'vitest';
import { browserScreenshotDefaultFileName } from './browserScreenshotFileName';

describe('browserScreenshotDefaultFileName', () => {
  it('returns screenshot.png for empty titles', () => {
    expect(browserScreenshotDefaultFileName('')).toBe('screenshot.png');
    expect(browserScreenshotDefaultFileName('   ')).toBe('screenshot.png');
  });

  it('sanitizes the page title into a png filename', () => {
    expect(browserScreenshotDefaultFileName('HarborClient 2.0')).toBe('HarborClient-20.png');
    expect(browserScreenshotDefaultFileName('Hello / World!')).toBe('Hello-World.png');
  });
});
