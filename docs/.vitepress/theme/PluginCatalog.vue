<script setup lang="ts">
import catalog from '../static/plugin_catalog.json';

/** One plugin row from the generated marketplace catalog. */
type CatalogEntry = (typeof catalog.plugins)[number];
</script>

<template>
  <p>
    Browse HarborClient plugins hosted on GitHub. Install them from
    <strong>Settings → Plugins → Browse plugins</strong> in the desktop app.
  </p>

  <p v-if="catalog.updatedAt" class="text-muted">
    Catalog updated {{ new Date(catalog.updatedAt).toLocaleDateString() }}.
  </p>

  <p v-if="catalog.plugins.length === 0">
    No plugins are listed yet. Be the first to
    <a href="/plugin_development#publish-to-the-marketplace">submit a plugin</a>.
  </p>

  <table v-else>
    <thead>
      <tr>
        <th scope="col">Plugin</th>
        <th scope="col">Summary</th>
        <th scope="col">Author</th>
        <th scope="col">Repository</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="entry in catalog.plugins as CatalogEntry[]" :key="entry.id">
        <td>
          <strong>{{ entry.name }}</strong>
          <div class="text-muted">{{ entry.categories.join(', ') }}</div>
        </td>
        <td>{{ entry.summary }}</td>
        <td>{{ entry.author }}</td>
        <td>
          <a :href="entry.repoUrl" target="_blank" rel="noopener noreferrer">{{ entry.repoUrl }}</a>
        </td>
      </tr>
    </tbody>
  </table>

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
</style>
