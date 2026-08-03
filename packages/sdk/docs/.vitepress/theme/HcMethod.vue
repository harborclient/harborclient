<script setup lang="ts">
/**
 * Renders a full `hc.*` API reference block from `hc_manifest.json`.
 *
 * Descriptions and examples go through markdown-it / Shiki so links and
 * fenced code match ordinary VitePress markdown pages.
 */
import { computed, ref, watchEffect } from 'vue';
import MarkdownIt from 'markdown-it';
import { codeToHtml } from 'shiki';
import manifest from '../hc_manifest.json';
import type { HcManifest, HcMethodEntry, HcMethodExample } from './HcMethod.types';

const hcManifest = manifest as HcManifest;

const markdown = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false
});

const props = defineProps<{
  /**
   * Manifest key without the `hc.` prefix (for example `ui.registerModal`).
   */
  name: string;

  /**
   * Optional heading level override when the page nesting differs from the
   * default stored on the entry.
   */
  level?: 2 | 3 | 4;
}>();

/**
 * Converts a heading to the anchor id used across SDK / site docs.
 *
 * @param value Heading text.
 * @returns Anchor id.
 */
const toAnchor = (value: string): string =>
  value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~]/g, '')
    .trim()
    .toLowerCase()
    .replace(/&amp;/g, '')
    .replace(/&/g, '')
    .replace(/\s/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]/gu, '')
    .trim()
    .replace(/^-+|-+$/g, '');

/**
 * Looks up the manifest entry for the requested API name.
 */
const entry = computed((): HcMethodEntry => {
  const found = hcManifest[props.name];

  if (!found) {
    throw new Error(`HcMethod: unknown API "${props.name}". Add it to hc_manifest.json.`);
  }

  return found;
});

/**
 * Effective heading level for this page placement.
 */
const headingLevel = computed(() => props.level ?? entry.value.level);

/**
 * Stable in-page anchor matching historical markdown headings.
 */
const anchorId = computed(() => toAnchor(entry.value.title));

/**
 * Heading HTML tag name (`h2` / `h3` / `h4`).
 */
const headingTag = computed(() => `h${headingLevel.value}`);

/**
 * Renders the entry description as HTML (links, emphasis, inline code, lists).
 */
const descriptionHtml = computed(() => markdown.render(entry.value.description));

/**
 * Shiki-highlighted HTML for each example (empty until async highlight finishes).
 */
const exampleHtmls = ref<string[]>([]);

/**
 * Formats an example language alias for Shiki / the lang label.
 *
 * @param lang Example language.
 * @returns Language id.
 */
const exampleLang = (lang?: string): string => {
  const value = (lang || 'typescript').toLowerCase();

  if (value === 'ts' || value === 'tsx') {
    return value === 'tsx' ? 'tsx' : 'typescript';
  }

  if (value === 'js' || value === 'jsx') {
    return value === 'jsx' ? 'jsx' : 'javascript';
  }

  return value;
};

/**
 * Highlights one example with Shiki (dual light/dark themes for VitePress).
 *
 * @param example Manifest example entry.
 * @returns HTML for a VitePress-style code block wrapper.
 */
const highlightExample = async (example: HcMethodExample): Promise<string> => {
  const lang = exampleLang(example.lang);

  try {
    const highlighted = await codeToHtml(example.code, {
      lang,
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      },
      defaultColor: false,
      cssVariablePrefix: '--shiki-'
    });

    return [
      `<div class="language-${lang} vp-adaptive-theme">`,
      `<button title="Copy Code" class="copy"></button>`,
      `<span class="lang">${lang}</span>`,
      highlighted,
      `</div>`
    ].join('');
  } catch {
    const escaped = example.code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return [
      `<div class="language-${lang} vp-adaptive-theme">`,
      `<button title="Copy Code" class="copy"></button>`,
      `<span class="lang">${lang}</span>`,
      `<pre class="shiki vp-code" tabindex="0"><code>${escaped}</code></pre>`,
      `</div>`
    ].join('');
  }
};

/**
 * Re-highlights examples whenever the active manifest entry changes.
 */
watchEffect((onCleanup) => {
  let cancelled = false;
  const examples = entry.value.examples ?? [];

  onCleanup(() => {
    cancelled = true;
  });

  if (examples.length === 0) {
    exampleHtmls.value = [];
    return;
  }

  void Promise.all(examples.map((example) => highlightExample(example))).then((htmls) => {
    if (!cancelled) {
      exampleHtmls.value = htmls;
    }
  });
});

/**
 * Renders a table cell that may contain inline markdown.
 *
 * @param text Cell text.
 * @returns Inline HTML.
 */
const renderInline = (text: string): string => markdown.renderInline(text);
</script>

<template>
  <section class="hc-method" :data-hc-method="name">
    <component :is="headingTag" :id="anchorId" tabindex="-1">
      {{ entry.title }}
      <a
        class="header-anchor"
        :href="`#${anchorId}`"
        :aria-label="`Permalink to &quot;${entry.title}&quot;`"
      />
    </component>

    <p class="hc-method__since">
      Available since <code>v{{ entry.since }}</code>
    </p>

    <p v-if="entry.signature">
      <strong>Signature:</strong>
      <code>{{ entry.signature }}</code>
    </p>

    <p v-if="entry.manifest">
      <strong>Manifest:</strong>
      <code>{{ entry.manifest }}</code>
    </p>

    <p
      v-if="
        entry.permission &&
        !entry.description.includes('Requires the `' + entry.permission + '` permission')
      "
    >
      Requires the <code>{{ entry.permission }}</code> permission.
    </p>

    <div v-if="entry.params?.length" class="hc-method__table-wrap">
      <table tabindex="0">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="param in entry.params" :key="`p-${param.name}`">
            <td>
              <code>{{ param.name }}</code>
            </td>
            <td>
              <code>{{ param.type.replace(/^`|`$/g, '') }}</code>
            </td>
            <td v-html="renderInline(param.description)" />
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="entry.fields?.length" class="hc-method__table-wrap">
      <table tabindex="0">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="field in entry.fields" :key="`f-${field.name}`">
            <td>
              <code>{{ field.name }}</code>
            </td>
            <td>
              <code>{{ field.type.replace(/^`|`$/g, '') }}</code>
            </td>
            <td v-html="renderInline(field.description)" />
          </tr>
        </tbody>
      </table>
    </div>

    <div class="hc-method__description" v-html="descriptionHtml" />

    <div
      v-for="(example, index) in entry.examples ?? []"
      :key="`ex-${index}`"
      class="hc-method__example"
    >
      <p v-if="example.caption" class="hc-method__example-caption">
        {{ example.caption }}
      </p>
      <div v-if="exampleHtmls[index]" v-html="exampleHtmls[index]" />
      <div v-else :class="`language-${exampleLang(example.lang)} vp-adaptive-theme`">
        <span class="lang">{{ exampleLang(example.lang) }}</span>
        <pre class="shiki vp-code" tabindex="0"><code>{{ example.code }}</code></pre>
      </div>
    </div>

    <p v-if="entry.seeAlso?.length" class="hc-method__see-also">
      <strong>See also:</strong>
      <template v-for="(related, index) in entry.seeAlso" :key="related">
        <code>hc.{{ related }}</code>
        <span v-if="index < (entry.seeAlso?.length ?? 0) - 1">, </span>
      </template>
    </p>
  </section>
</template>

<style scoped>
.hc-method {
  margin: 1.5rem 0 2rem;
}

.hc-method__since {
  color: var(--vp-c-text-2);
  margin-top: 0.25rem;
}

.hc-method__table-wrap {
  overflow-x: auto;
  margin: 1rem 0;
}

.hc-method__description :deep(a) {
  color: var(--vp-c-brand-1);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.hc-method__example {
  margin: 1rem 0;
}

.hc-method__example-caption {
  margin-bottom: 0.5rem;
  color: var(--vp-c-text-2);
}

/*
 * Dual-theme Shiki output only sets CSS variables. VitePress page fences get
 * color from theme CSS; v-html examples need the same mapping locally.
 */
.hc-method__example :deep(.shiki),
.hc-method__example :deep(.shiki span) {
  color: var(--shiki-dark, var(--shiki-light, inherit));
  background-color: var(--shiki-dark-bg, var(--shiki-light-bg, transparent));
}

:global(html:not(.dark)) .hc-method__example :deep(.shiki),
:global(html:not(.dark)) .hc-method__example :deep(.shiki span) {
  color: var(--shiki-light, inherit);
  background-color: var(--shiki-light-bg, transparent);
}

:global(html.dark) .hc-method__example :deep(.shiki),
:global(html.dark) .hc-method__example :deep(.shiki span) {
  color: var(--shiki-dark, inherit);
  background-color: var(--shiki-dark-bg, transparent);
}

.hc-method__see-also {
  margin-top: 1rem;
}
</style>
