#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');
const testArtifactPattern = /\.test\./;

/**
 * Collects publishable dist paths whose basename looks like a test artifact.
 *
 * @param {string} dir Directory to walk.
 * @returns {string[]} Matching file paths.
 */
function findTestArtifacts(dir) {
  const matches = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      matches.push(...findTestArtifacts(path));
      continue;
    }

    if (testArtifactPattern.test(basename(path))) {
      matches.push(path);
    }
  }

  return matches;
}

const artifacts = findTestArtifacts(root);

if (artifacts.length > 0) {
  console.error('Publish guard failed: test artifacts found under dist/:');
  for (const artifact of artifacts) {
    console.error(`  ${artifact}`);
  }
  process.exit(1);
}
