import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import Layout from './Layout.vue';
import './custom.css';

const storybookHref = () => `${import.meta.env.BASE_URL}storybook/index.html`;

const isStorybookPath = (href: string) => {
  try {
    const url = new URL(href, window.location.origin);
    return /\/storybook(?:\/index\.html|\/?)$/.test(url.pathname);
  } catch {
    return false;
  }
};

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

    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(syncDocImageLinks);

    const previousBeforeRouteChange = ctx.router.onBeforeRouteChange;

    ctx.router.onBeforeRouteChange = async (href) => {
      if (isStorybookPath(href)) {
        window.location.assign(storybookHref());
        return false;
      }

      return (await previousBeforeRouteChange?.(href)) ?? undefined;
    };

    ctx.router.onAfterRouteChanged = () => {
      window.requestAnimationFrame(syncDocImageLinks);
    };
  }
} satisfies Theme;
