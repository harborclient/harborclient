import type { RunResultsExport } from '../collectionRunner';
import type { CollectionExport, EnvironmentExport, RequestExport } from '../types';
import type { SnippetExport } from '../types/snippet';
import { validateSnippetExport } from './snippet';
import {
  validateCollectionExport,
  validateEnvironmentExport,
  validateRequestExport,
  validateRunResultsExport
} from './validate';

/**
 * Parses a JSON string into an unknown value.
 *
 * @param input - UTF-8 JSON text.
 * @param label - Entity label used in parse error messages (for example "collection").
 * @returns Parsed JSON value.
 * @throws When the input is not valid JSON.
 */
function parseJsonInput(input: string, label: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error(`Invalid ${label} file: file is not valid JSON`);
  }
}

/**
 * Resolves a string or already-parsed value to the unknown payload for validation.
 *
 * @param input - UTF-8 JSON text or a previously parsed value.
 * @param label - Entity label used in parse error messages.
 * @returns Payload ready for schema validation.
 * @throws When a string input is not valid JSON.
 */
function resolveParseInput(input: string | unknown, label: string): unknown {
  return typeof input === 'string' ? parseJsonInput(input, label) : input;
}

/**
 * Parses and validates a HarborClient collection export.
 *
 * @param input - UTF-8 JSON text or a previously parsed JSON value.
 * @returns Normalized collection export payload.
 * @throws When the input is not valid JSON or fails collection schema validation.
 */
export function parseCollection(input: string | unknown): CollectionExport {
  return validateCollectionExport(resolveParseInput(input, 'collection'));
}

/**
 * Parses and validates a HarborClient request export.
 *
 * @param input - UTF-8 JSON text or a previously parsed JSON value.
 * @returns Normalized request export payload.
 * @throws When the input is not valid JSON or fails request schema validation.
 */
export function parseRequest(input: string | unknown): RequestExport {
  return validateRequestExport(resolveParseInput(input, 'request'));
}

/**
 * Parses and validates a HarborClient environment export.
 *
 * @param input - UTF-8 JSON text or a previously parsed JSON value.
 * @returns Normalized environment export payload.
 * @throws When the input is not valid JSON or fails environment schema validation.
 */
export function parseEnvironment(input: string | unknown): EnvironmentExport {
  return validateEnvironmentExport(resolveParseInput(input, 'environment'));
}

/**
 * Parses and validates a HarborClient run-results export.
 *
 * @param input - UTF-8 JSON text or a previously parsed JSON value.
 * @returns Normalized run-results export payload.
 * @throws When the input is not valid JSON or fails run-results schema validation.
 */
export function parseRunResults(input: string | unknown): RunResultsExport {
  return validateRunResultsExport(resolveParseInput(input, 'run results'));
}

/**
 * Parses and validates a HarborClient snippet export.
 *
 * @param input - UTF-8 JSON text or a previously parsed JSON value.
 * @returns Normalized snippet export payload.
 * @throws When the input is not valid JSON or fails snippet validation.
 */
export function parseSnippet(input: string | unknown): SnippetExport {
  return validateSnippetExport(resolveParseInput(input, 'snippet'));
}
