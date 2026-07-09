import { create, insertMultiple, search, type AnyOrama, type AnySchema } from '@orama/orama';

import { DEFAULT_SEARCH_OPTIONS } from '#/shared/search/types';

/**
 * In-memory Orama database used by HarborClient search builders.
 */
export type HarborSearchIndex = AnyOrama;

/**
 * One normalized full-text hit with the indexed document payload.
 */
export interface TextSearchHit<TDoc extends { id: string }> {
  /** Domain id stored on the indexed document. */
  id: string;
  /** Orama relevance score for ordering within a domain. */
  score: number;
  /** Indexed document fields used for subtitles and navigation. */
  document: TDoc;
}

/**
 * Optional query tuning passed to {@link searchTextIndex}.
 */
export interface TextSearchQueryOptions {
  /** Indexed properties to search; defaults to all string fields. */
  properties?: string[];
  /** Orama threshold: 0 requires every term, 1 matches any term. */
  threshold?: number;
}

/**
 * Creates an in-memory Orama full-text index from a schema and document batch.
 *
 * @param schema - Orama schema describing searchable and stored fields.
 * @param documents - Rows to index; each must include a string `id`.
 */
export function createTextSearchIndex<TSchema extends AnySchema>(
  schema: TSchema,
  documents: Array<Record<string, unknown> & { id: string }>
): HarborSearchIndex {
  const db = create({ schema }) as HarborSearchIndex;
  if (documents.length > 0) {
    insertMultiple(db, documents as never);
  }
  return db;
}

/**
 * Runs a full-text search and maps Orama hits to stable domain ids and scores.
 *
 * @param db - Orama index created by {@link createTextSearchIndex}.
 * @param term - Raw user search text.
 * @param options - Optional property list and boolean threshold override.
 */
export function searchTextIndex<TDoc extends { id: string }>(
  db: HarborSearchIndex,
  term: string,
  options?: TextSearchQueryOptions
): TextSearchHit<TDoc>[] {
  const trimmed = term.trim();
  if (!trimmed) {
    return [];
  }

  const results = search(db, {
    term: trimmed,
    properties: (options?.properties ?? '*') as never,
    tolerance: DEFAULT_SEARCH_OPTIONS.tolerance,
    threshold: options?.threshold ?? DEFAULT_SEARCH_OPTIONS.threshold
  });

  if (results instanceof Promise) {
    throw new Error('Orama search returned a Promise; HarborClient expects synchronous search.');
  }

  return results.hits.map((hit) => ({
    id: String((hit.document as TDoc).id),
    score: hit.score,
    document: hit.document as TDoc
  }));
}
