import { defineConfig } from 'vitepress';
import pkg from '../../package.json';
import { toAnchor } from '../../scripts/docs-slugger.mjs';
import { sidebar } from './sidebar.generated';

const siteBase = '/harborclient/core/';

const withSiteBase = (path: string) => {
  if (!path.startsWith('/') || path.startsWith(siteBase) || path.startsWith('//')) {
    return path;
  }

  return `${siteBase.replace(/\/$/, '')}${path}`;
};

export default defineConfig({
  title: '@harborclient/core',
  description:
    'Platform-neutral HarborClient engine: types, request orchestration helpers, and shared utilities.',
  base: siteBase,
  appearance: 'force-dark',
  cleanUrls: true,
  vite: {
    publicDir: '.vitepress/static',
  },
  head: [
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        href: 'https://raw.githubusercontent.com/harborclient/harborclient/main/images/logo.png',
      },
    ],
  ],
  ignoreDeadLinks: [/^https?:\/\/localhost(?::\d+)?(?:\/|$)/],
  markdown: {
    anchor: {
      slugify: toAnchor,
    },
    config(md) {
      const defaultRender =
        md.renderer.rules.image ??
        ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

      md.renderer.rules.image = (tokens, idx, options, env, self) => {
        const renderedImage = defaultRender(tokens, idx, options, env, self);
        const token = tokens[idx];
        const src = token.attrGet('src');
        const isAlreadyLinked =
          tokens[idx - 1]?.type === 'link_open' && tokens[idx + 1]?.type === 'link_close';

        if (!src || isAlreadyLinked) {
          return renderedImage;
        }

        return `<a class="vp-doc-image-link" href="${md.utils.escapeHtml(withSiteBase(src))}" target="_blank" rel="noopener noreferrer">${renderedImage}</a>`;
      };
    },
    gfmAlerts: true,
    languageAlias: {
      env: 'dotenv',
    },
  },
  themeConfig: {
    logo: {
      src: 'https://raw.githubusercontent.com/harborclient/harborclient/main/images/logo.png',
      alt: '@harborclient/core',
    },
    siteTitle: false,
    nav: [
      {
        text: `v${pkg.version}`,
        link: 'https://github.com/harborclient/harborclient/releases',
      },
    ],
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/harborclient/harborclient',
        ariaLabel: '@harborclient/core on GitHub',
      },
    ],
    sidebar,
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    search: {
      provider: 'local',
    },
  },
});
