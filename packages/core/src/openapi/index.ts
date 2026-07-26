/**
 * OpenAPI 3.x import helpers shared by main-process detection and the renderer preview.
 */

export {
  canImportOpenApiSpec,
  operationsToCreateRequests,
  parseOpenApiSpec,
  type OpenApiCreateCollectionRequest,
  type ParsedOpenApiOperation,
  type ParsedOpenApiSpec
} from './parse';
