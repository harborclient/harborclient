/**
 * Harbor-native portable JSON filestore: parse, validate, and stringify
 * HarborClient export envelopes (collections, requests, environments, run results, snippets).
 *
 * Does not convert Postman, Bruno, HAR, or other third-party formats.
 */

export {
  HARBORCLIENT_EXPORT_KINDS,
  type HarborclientExportKind,
  isHarborclientExportKind,
  readHarborclientExport
} from '../harborclientExport';
export { readHarborclientExport as detectExport } from '../harborclientExport';

export {
  parseCollection,
  parseEnvironment,
  parseRequest,
  parseRunResults,
  parseSnippet
} from './parse';
export {
  type StringifyExportOptions,
  stringifyCollection,
  stringifyEnvironment,
  stringifyRequest,
  stringifyRunResults,
  stringifySnippet
} from './stringify';
export {
  collectionExportContainsScripts,
  maskVariablesForExport,
  requestExportContainsScripts,
  validateCollectionExport,
  validateEnvironmentExport,
  validateRequestExport,
  validateRunResultsExport
} from './validate';
export { validateSnippetExport } from './snippet';
export { normalizeVariable } from './variables';
export {
  collectionExportSchema,
  environmentExportSchema,
  exportedDocuments,
  exportedFolders,
  exportedRequests,
  findDuplicateFolderIndex,
  findDuplicateFolderUuidIndex,
  formatCollectionImportError,
  formatEnvironmentImportError,
  formatRequestImportError,
  formatRunResultsImportError,
  importVariables,
  optionalDocumentUuid,
  requestExportSchema,
  runResultsExportSchema,
  saveRunResultInputSchema
} from './schemas';
export { authConfig, bodyType, exportScriptRefArray, httpMethod, keyValue } from './storageSchemas';
