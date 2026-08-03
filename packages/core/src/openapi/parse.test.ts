import { describe, expect, it } from 'vitest';
import { canImportOpenApiSpec, operationsToCreateRequests, parseOpenApiSpec } from './parse';

const PETSTORE_SPEC = `
openapi: 3.0.3
info:
  title: Petstore
  version: 1.0.0
servers:
  - url: https://api.example.com/v1
paths:
  /pets:
    get:
      tags: [pets]
      summary: List pets
      parameters:
        - in: query
          name: limit
          schema:
            type: integer
            example: 10
      responses:
        '200':
          description: OK
    post:
      tags: [pets]
      operationId: createPet
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
      responses:
        '201':
          description: Created
  /users:
    get:
      tags: [users]
      summary: List users
      responses:
        '200':
          description: OK
`;

const SSE_SPEC = `
openapi: 3.0.3
info:
  title: Events API
  version: 1.0.0
servers:
  - url: https://api.example.com
paths:
  /events:
    get:
      summary: Subscribe to events
      responses:
        '200':
          description: Event stream
          content:
            text/event-stream:
              schema:
                type: string
  /pets:
    get:
      summary: List pets
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
`;

describe('parseOpenApiSpec', () => {
  it('parses YAML OpenAPI 3 specs into tagged operations', () => {
    const parsed = parseOpenApiSpec(PETSTORE_SPEC);

    expect(parsed.title).toBe('Petstore');
    expect(parsed.baseUrl).toBe('https://api.example.com/v1');
    expect(parsed.operations).toHaveLength(3);

    const listPets = parsed.operations.find((operation) => operation.name === 'List pets');
    expect(listPets?.method).toBe('GET');
    expect(listPets?.url).toBe('https://api.example.com/v1/pets');
    expect(listPets?.folder).toBe('pets');
    expect(listPets?.params).toEqual([{ key: 'limit', value: '10' }]);
    expect(listPets?.protocol).toBeUndefined();

    const createPet = parsed.operations.find((operation) => operation.name === 'createPet');
    expect(createPet?.method).toBe('POST');
    expect(createPet?.bodyType).toBe('json');
    expect(createPet?.body).toContain('"name"');
  });

  it('marks text/event-stream responses as SSE and adds Accept when missing', () => {
    const parsed = parseOpenApiSpec(SSE_SPEC);
    const subscribe = parsed.operations.find(
      (operation) => operation.name === 'Subscribe to events'
    );
    const listPets = parsed.operations.find((operation) => operation.name === 'List pets');

    expect(subscribe?.protocol).toBe('sse');
    expect(subscribe?.headers).toEqual({ Accept: 'text/event-stream' });
    expect(listPets?.protocol).toBeUndefined();
    expect(listPets?.headers).toBeUndefined();

    const createRequests = operationsToCreateRequests(parsed.operations);
    expect(createRequests.find((request) => request.name === 'Subscribe to events')?.protocol).toBe(
      'sse'
    );
    expect(
      createRequests.find((request) => request.name === 'List pets')?.protocol
    ).toBeUndefined();
  });

  it('rejects unsupported OpenAPI versions', () => {
    expect(() => parseOpenApiSpec('{"openapi":"2.0","paths":{}}')).toThrow(/OpenAPI 3.x/);
  });
});

describe('canImportOpenApiSpec', () => {
  it('returns true for OpenAPI 3 YAML specs', () => {
    expect(canImportOpenApiSpec(PETSTORE_SPEC)).toBe(true);
  });

  it('returns true for OpenAPI 3 JSON specs', () => {
    expect(canImportOpenApiSpec('{"openapi":"3.1.0","paths":{}}')).toBe(true);
  });

  it('returns false for OpenAPI 2.0, HarborClient exports, Postman collections, and empty files', () => {
    expect(canImportOpenApiSpec('{"openapi":"2.0","paths":{}}')).toBe(false);
    expect(
      canImportOpenApiSpec('{"harborclientExport":"collection","harborclientVersion":1}')
    ).toBe(false);
    expect(canImportOpenApiSpec('{"info":{"name":"Demo"},"item":[]}')).toBe(false);
    expect(canImportOpenApiSpec('')).toBe(false);
  });
});
