import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import pkg from '../../package.json';
import { toAnchor } from '../../scripts/docs-slugger.mjs';
import { sidebar } from './sidebar.generated';

const require = createRequire(import.meta.url);
const dayjsDir = path.dirname(require.resolve('dayjs/package.json'));

const siteBase = '/harborclient/sdk/';
const storybookEntryPath = '/storybook/index.html';

const storybookDevFallback = (base: string): Plugin => ({
  name: 'vitepress-storybook-dev-fallback',
  configureServer(server) {
    const basePath = base.replace(/\/$/, '');
    const storybookIndex = `${basePath}/storybook/index.html`;

    server.middlewares.use((req, _res, next) => {
      const pathname = req.url?.split('?')[0] ?? '';
      const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';

      if (pathname === `${basePath}/storybook` || pathname === `${basePath}/storybook/`) {
        req.url = storybookIndex + query;
      }

      next();
    });
  }
});

const withSiteBase = (path: string) => {
  if (!path.startsWith('/') || path.startsWith(siteBase) || path.startsWith('//')) {
    return path;
  }

  return `${siteBase.replace(/\/$/, '')}${path}`;
};

export default withMermaid(
  defineConfig({
    title: '@harborclient/sdk',
    description: 'TypeScript SDK and React runtime helpers for HarborClient plugin development.',
    base: siteBase,
    appearance: 'force-dark',
    cleanUrls: true,
    vite: {
      publicDir: '.vitepress/static',
      optimizeDeps: {
        include: ['mermaid']
      },
      resolve: {
        alias: {
          dayjs: `${dayjsDir}/`
        }
      },
      plugins: [storybookDevFallback(siteBase)]
    },
    head: [
      ['link', { rel: 'icon', href: withSiteBase('/images/favicon.ico') }],
      [
        'link',
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '16x16',
          href: withSiteBase('/images/favicon-16x16.png')
        }
      ],
      [
        'link',
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '32x32',
          href: withSiteBase('/images/favicon-32x32.png')
        }
      ],
      [
        'link',
        {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: withSiteBase('/images/apple-touch-icon.png')
        }
      ]
    ],
    ignoreDeadLinks: [
      /^https?:\/\/localhost(?::\d+)?(?:\/|$)/,
      /^\/storybook\//,
      /^\/harborclient\/sdk\/storybook\//
    ],
    markdown: {
      anchor: {
        slugify: toAnchor
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

          return `<a class="vp-doc-image-link" href="${md.utils.escapeHtml(
            withSiteBase(src)
          )}" target="_blank" rel="noopener noreferrer">${renderedImage}</a>`;
        };
      },
      gfmAlerts: true,
      languageAlias: {
        env: 'dotenv'
      }
    },
    themeConfig: {
      logo: false,
      nav: [
        {
          text: 'Components',
          link: storybookEntryPath
        },
        {
          text: `v${pkg.version}`,
          link: 'https://github.com/harborclient/harborclient/releases?q=sdk-v'
        }
      ],
      socialLinks: [
        {
          icon: 'github',
          link: 'https://github.com/harborclient/harborclient',
          ariaLabel: 'HarborClient on GitHub'
        }
      ],
      sidebar,
      outline: {
        level: [2, 3],
        label: 'On this page'
      },
      search: {
        provider: 'local'
      }
    },
    mermaid: {
      theme: 'dark'
    }
  })
);
