import { describe, expect, it } from 'vitest';
import {
  createRendererNavigationPolicy,
  isAllowedExternalUrl,
  isAllowedRendererNavigation
} from './navigationSecurity';

describe('isAllowedExternalUrl', () => {
  it('allows https URLs', () => {
    expect(isAllowedExternalUrl('https://example.com/path')).toBe(true);
  });

  it('allows http URLs', () => {
    expect(isAllowedExternalUrl('http://example.com/path')).toBe(true);
  });

  it('allows mailto URLs', () => {
    expect(isAllowedExternalUrl('mailto:user@example.com')).toBe(true);
  });

  it('denies javascript URLs', () => {
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('denies file URLs', () => {
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false);
  });

  it('denies data URLs', () => {
    expect(isAllowedExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('denies smb URLs', () => {
    expect(isAllowedExternalUrl('smb://share/resource')).toBe(false);
  });

  it('denies empty URLs', () => {
    expect(isAllowedExternalUrl('   ')).toBe(false);
  });
});

describe('isAllowedRendererNavigation', () => {
  const devPolicy = createRendererNavigationPolicy({
    isDev: true,
    devRendererUrl: 'http://127.0.0.1:5173/',
    indexPath: '/app/out/renderer/index.html',
    rendererRoot: '/app/out/renderer'
  });

  const filePolicy = createRendererNavigationPolicy({
    isDev: false,
    devRendererUrl: undefined,
    indexPath: '/app/out/renderer/index.html',
    rendererRoot: '/app/out/renderer'
  });

  it('allows same-origin dev server navigation', () => {
    expect(isAllowedRendererNavigation('http://127.0.0.1:5173/', devPolicy)).toBe(true);
    expect(isAllowedRendererNavigation('http://127.0.0.1:5173/src/main.tsx', devPolicy)).toBe(true);
  });

  it('denies external navigation in dev mode', () => {
    expect(isAllowedRendererNavigation('https://evil.com', devPolicy)).toBe(false);
  });

  it('allows packaged index.html navigation', () => {
    expect(isAllowedRendererNavigation('file:///app/out/renderer/index.html', filePolicy)).toBe(
      true
    );
  });

  it('allows hash-only changes on the packaged index', () => {
    expect(
      isAllowedRendererNavigation('file:///app/out/renderer/index.html#section', filePolicy)
    ).toBe(true);
  });

  it('allows file URLs under the renderer root', () => {
    expect(isAllowedRendererNavigation('file:///app/out/renderer/assets/app.js', filePolicy)).toBe(
      true
    );
  });

  it('denies file URLs outside the renderer root', () => {
    expect(isAllowedRendererNavigation('file:///etc/passwd', filePolicy)).toBe(false);
  });

  it('denies https navigation in production mode', () => {
    expect(isAllowedRendererNavigation('https://evil.com', filePolicy)).toBe(false);
  });
});

describe('createRendererNavigationPolicy', () => {
  it('uses dev-server origin when dev URL is present', () => {
    const policy = createRendererNavigationPolicy({
      isDev: true,
      devRendererUrl: 'http://localhost:5173/',
      indexPath: '/app/out/renderer/index.html',
      rendererRoot: '/app/out/renderer'
    });

    expect(policy).toEqual({
      mode: 'dev',
      devServerOrigin: 'http://localhost:5173'
    });
  });

  it('uses file policy when not in dev', () => {
    const policy = createRendererNavigationPolicy({
      isDev: false,
      devRendererUrl: undefined,
      indexPath: '/app/out/renderer/index.html',
      rendererRoot: '/app/out/renderer'
    });

    expect(policy).toEqual({
      mode: 'file',
      indexPath: '/app/out/renderer/index.html',
      rendererRoot: '/app/out/renderer'
    });
  });
});
