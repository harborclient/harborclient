<script setup lang="ts">
import { withBase } from 'vitepress';

const logoSrc = withBase('/images/logo-white.png');
const SITE_TITLE = 'HarborClient';
const homeHref = withBase('/');
</script>

<template>
  <a class="docs-sidebar-brand" :href="homeHref" :aria-label="SITE_TITLE">
    <img :src="logoSrc" :alt="SITE_TITLE" width="500" height="191" decoding="async" />
  </a>
</template>
