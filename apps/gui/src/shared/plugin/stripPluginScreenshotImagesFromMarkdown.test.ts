import { describe, expect, it } from 'vitest';

import { stripPluginScreenshotImagesFromMarkdown } from './stripPluginScreenshotImagesFromMarkdown';

describe('stripPluginScreenshotImagesFromMarkdown', () => {
  it('strips inline screenshot images when the path is declared in manifest refs', () => {
    const markdown = '# Theme\n\n![Screenshot](screenshot.png)\n\nA cozy theme.';
    const result = stripPluginScreenshotImagesFromMarkdown(markdown, ['screenshot.png']);

    expect(result).toBe('# Theme\n\nA cozy theme.');
  });

  it('strips relative path variants such as ./screenshot.png', () => {
    const markdown = '![Preview](./screenshot.png)\n\nBody text.';
    const result = stripPluginScreenshotImagesFromMarkdown(markdown, ['screenshot.png']);

    expect(result).toBe('Body text.');
  });

  it('strips absolute raw GitHub URLs that match catalog screenshot refs', () => {
    const url = 'https://raw.githubusercontent.com/harborclient/plugin-nord/v1.0.4/screenshot.png';
    const markdown = `# Nord\n\n![Screenshot](${url})\n\nDark theme.`;
    const result = stripPluginScreenshotImagesFromMarkdown(markdown, [url]);

    expect(result).toBe('# Nord\n\nDark theme.');
  });

  it('matches README-relative paths against absolute catalog screenshot URLs by basename', () => {
    const url = 'https://raw.githubusercontent.com/harborclient/plugin-nord/v1.0.4/screenshot.png';
    const markdown = '![Screenshot](screenshot.png)\n\nDark theme.';
    const result = stripPluginScreenshotImagesFromMarkdown(markdown, [url]);

    expect(result).toBe('Dark theme.');
  });

  it('keeps unrelated images with different filenames', () => {
    const markdown = '![Logo](logo.png)\n\n![Screenshot](screenshot.png)';
    const result = stripPluginScreenshotImagesFromMarkdown(markdown, ['screenshot.png']);

    expect(result).toBe('![Logo](logo.png)');
  });

  it('strips reference-style images and their link definitions', () => {
    const markdown = [
      '![Screenshot][shot]',
      '',
      'Description text.',
      '',
      '[shot]: screenshot.png "Theme preview"'
    ].join('\n');
    const result = stripPluginScreenshotImagesFromMarkdown(markdown, ['screenshot.png']);

    expect(result).toBe('Description text.');
  });

  it('returns an empty string when the description was only a screenshot image', () => {
    const markdown = '![Screenshot](screenshot.png)';
    const result = stripPluginScreenshotImagesFromMarkdown(markdown, ['screenshot.png']);

    expect(result).toBe('');
  });

  it('strips multiple manifest screenshot paths', () => {
    const markdown = [
      '![One](assets/one.png)',
      '',
      '![Two](assets/two.png)',
      '',
      'Features listed here.'
    ].join('\n');
    const result = stripPluginScreenshotImagesFromMarkdown(markdown, [
      'assets/one.png',
      'assets/two.png'
    ]);

    expect(result).toBe('Features listed here.');
  });

  it('returns trimmed input unchanged when no screenshot refs are provided', () => {
    const markdown = '![Screenshot](screenshot.png)\n\nBody.';
    const result = stripPluginScreenshotImagesFromMarkdown(markdown, []);

    expect(result).toBe('![Screenshot](screenshot.png)\n\nBody.');
  });
});
