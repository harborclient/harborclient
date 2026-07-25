<script setup lang="ts">
import { withBase } from 'vitepress';

const LOGO_URL = '__LOGO_URL__';
const SITE_TITLE = '__SITE_TITLE__';
const homeHref = withBase('/');
</script>

<template>
  <a class="docs-sidebar-brand" :href="homeHref" :aria-label="SITE_TITLE">
    <img :src="LOGO_URL" :alt="SITE_TITLE" width="500" height="191" decoding="async" />
  </a>
</template>
