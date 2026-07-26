import { describe, expect, it } from 'vitest';
import reducer, {
  clearOpenApiImportSession,
  selectOpenApiImportSession,
  setOpenApiImportSession,
  type OpenApiImportState
} from './openApiImportSlice';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Builds a minimal root state for selector tests.
 *
 * @param openApiImport - OpenAPI import slice state.
 */
function rootWithOpenApiImport(openApiImport: OpenApiImportState): RootState {
  return { openApiImport } as RootState;
}

describe('openApiImportSlice', () => {
  it('stores and clears a pending import session', () => {
    const session = {
      name: 'petstore.yaml',
      path: '/tmp/petstore.yaml',
      extension: '.yaml',
      contents: 'openapi: 3.0.3'
    };

    const withSession = reducer(undefined, setOpenApiImportSession(session));
    expect(withSession.session).toEqual(session);
    expect(selectOpenApiImportSession(rootWithOpenApiImport(withSession))).toEqual(session);

    const cleared = reducer(withSession, clearOpenApiImportSession());
    expect(cleared.session).toBeNull();
    expect(selectOpenApiImportSession(rootWithOpenApiImport(cleared))).toBeNull();
  });
});
