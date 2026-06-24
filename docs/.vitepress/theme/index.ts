import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import DownloadLinks from './DownloadLinks.vue';
import Layout from './Layout.vue';
import PluginCatalog from './PluginCatalog.vue';
import './custom.css';

const syncDocImageLinks = () => {
  document.querySelectorAll<HTMLAnchorElement>('.vp-doc-image-link').forEach((link) => {
    const image = link.querySelector<HTMLImageElement>('img');
    const resolvedSrc = image?.currentSrc || image?.src;

    if (resolvedSrc) {
      link.href = resolvedSrc;
    }
  });
};

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp(ctx) {
    DefaultTheme.enhanceApp?.(ctx);
    ctx.app.component('DownloadLinks', DownloadLinks);
    ctx.app.component('PluginCatalog', PluginCatalog);

    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(syncDocImageLinks);

    ctx.router.onAfterRouteChanged = () => {
      window.requestAnimationFrame(syncDocImageLinks);
    };
  },
} satisfies Theme;
