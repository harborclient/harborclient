import { describe, expect, it } from 'vitest';
import { canImportOpenApiSpec } from '@harborclient/core/openapi';

/**
 * Ensures main-process OpenAPI detection stays ahead of the plugin-file fallback:
 * OpenAPI 3.x YAML/JSON must be recognized while Postman-shaped JSON is not.
 */
describe('OpenAPI import detection', () => {
  it('recognizes OpenAPI 3.x YAML before it would fall through as a plugin file', () => {
    expect(
      canImportOpenApiSpec(`
openapi: 3.0.3
info:
  title: Demo
paths: {}
`)
    ).toBe(true);
  });

  it('does not claim Postman collections or HarborClient exports', () => {
    expect(canImportOpenApiSpec('{"info":{"name":"Demo"},"item":[]}')).toBe(false);
    expect(
      canImportOpenApiSpec('{"harborclientExport":"collection","harborclientVersion":1}')
    ).toBe(false);
  });
});
