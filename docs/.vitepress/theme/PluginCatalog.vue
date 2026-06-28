<script setup lang="ts">
import catalog from '../static/plugin_catalog.json';
import { buildPluginInstallDeepLink } from '../../../src/shared/deepLink.ts';
import {
  PLUGIN_CATALOG_CATEGORY_LABELS,
  type PluginCatalogCategory,
} from '../../../src/shared/plugin/catalogCategories.ts';

/** One plugin row from the generated marketplace catalog. */
type CatalogEntry = (typeof catalog.plugins)[number];

const DOWNLOAD_URL = 'https://github.com/harborclient/harborclient/releases/latest';

/**
 * Returns a human-readable label for a marketplace category slug.
 *
 * @param slug - Raw category slug from the catalog entry.
 * @returns Display label, or the slug when it is not recognized.
 */
function categoryLabel(slug: string): string {
  if (slug in PLUGIN_CATALOG_CATEGORY_LABELS) {
    return PLUGIN_CATALOG_CATEGORY_LABELS[slug as PluginCatalogCategory];
  }
  return slug;
}
</script>

<template>
  <p>
    Browse HarborClient plugins hosted on GitHub. Click <strong>Install in HarborClient</strong> to
    open the desktop app and install a plugin, or open
    <strong>Settings → Plugins → Marketplace</strong> inside the app.
  </p>

  <p class="text-muted">
    Don't have HarborClient yet?
    <a :href="DOWNLOAD_URL" target="_blank" rel="noopener noreferrer">Download the app</a>.
  </p>

  <p v-if="catalog.updatedAt" class="text-muted">
    Catalog updated {{ new Date(catalog.updatedAt).toLocaleDateString() }}.
  </p>

  <p v-if="catalog.plugins.length === 0">
    No plugins are listed yet. Be the first to
    <a href="/plugin_development#publish-to-the-marketplace">submit a plugin</a>.
  </p>

  <div v-else class="plugin-list">
    <article
      v-for="entry in catalog.plugins as CatalogEntry[]"
      :key="entry.id"
      class="plugin-entry"
    >
      <h3 :id="entry.id">{{ entry.name }}</h3>

      <img
        v-if="entry.screenshot"
        :src="entry.screenshot"
        :alt="`Screenshot of ${entry.name}`"
        class="catalog-screenshot"
      />

      <p class="plugin-summary">{{ entry.summary }}</p>

      <p class="plugin-actions">
        <a :href="buildPluginInstallDeepLink(entry.id)" class="install-link">
          Install in HarborClient
        </a>
      </p>

      <dl class="plugin-meta">
        <dt>Version</dt>
        <dd>{{ entry.version }}</dd>

        <dt>Publisher</dt>
        <dd>{{ entry.author }}</dd>

        <dt v-if="entry.categories.length > 0">Categories</dt>
        <dd v-if="entry.categories.length > 0" class="plugin-categories">
          <span v-for="category in entry.categories" :key="category" class="plugin-category">
            {{ categoryLabel(category) }}
          </span>
        </dd>

        <dt>Repository</dt>
        <dd>
          <a :href="entry.repoUrl" target="_blank" rel="noopener noreferrer">{{
            entry.repoUrl
          }}</a>
          <span v-if="entry.ref" class="text-muted"> ({{ entry.ref }})</span>
        </dd>

        <template v-if="entry.homepage">
          <dt>Homepage</dt>
          <dd>
            <a :href="entry.homepage" target="_blank" rel="noopener noreferrer">{{
              entry.homepage
            }}</a>
          </dd>
        </template>

        <template v-if="entry.minAppVersion">
          <dt>Min HarborClient version</dt>
          <dd>{{ entry.minAppVersion }}</dd>
        </template>
      </dl>
    </article>
  </div>

  <h2>Submit your plugin</h2>
  <p>
    Host your plugin in a public GitHub repository, then open a pull request that adds an entry to
    <a
      href="https://github.com/harborclient/harborclient/blob/main/plugins/catalog.json"
      target="_blank"
      rel="noopener noreferrer"
      ><code>plugins/catalog.json</code></a
    >. See
    <a href="/plugin_development#publish-to-the-marketplace">Publish to the marketplace</a>
    for the required fields and review process.
  </p>
</template>

<style scoped>
.text-muted {
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.plugin-entry {
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.plugin-entry:first-child {
  padding-top: 0.5rem;
}

.plugin-entry:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.plugin-entry h3 {
  margin: 0 0 1rem;
}

.plugin-summary {
  margin: 0 0 1rem;
  max-width: 48rem;
}

.plugin-actions {
  margin: 0 0 1rem;
}

.install-link {
  display: inline-block;
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 0.375rem;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.4;
  text-decoration: none;
}

.install-link:hover {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-default-bg);
}

.catalog-screenshot {
  display: block;
  width: 100%;
  max-width: min(640px, 100%);
  margin-bottom: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.375rem;
  object-fit: cover;
  object-position: top;
}

.plugin-meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.375rem 1rem;
  margin: 0;
  font-size: 0.875rem;
}

.plugin-meta dt {
  margin: 0;
  color: var(--vp-c-text-2);
}

.plugin-meta dd {
  margin: 0;
}

.plugin-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.plugin-category {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.25rem;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
  line-height: 1.4;
}
</style>
