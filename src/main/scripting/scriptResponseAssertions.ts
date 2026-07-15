/// <reference types="chai" />

import { wrapCallablePropertyGetter } from './scriptAssertionCompat';
import type { SendResult } from '#/shared/types';

/**
 * Brand symbol marking objects that are valid subjects for response assertion matchers.
 */
export const RESPONSE_ASSERTION_BRAND = Symbol('hc.response.assertion');

/**
 * Branded response snapshot used as the Chai assertion subject for `hc.response.to`.
 */
export interface ResponseAssertionSubject {
  code: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  responseTime: number;
  sizeBytes: number;
  [RESPONSE_ASSERTION_BRAND]: true;
}

/**
 * Error message when response matchers are invoked on a non-response subject.
 */
const RESPONSE_SCOPE_ERROR =
  'response assertions require hc.response; use hc.response.to.have.status(...)';

/**
 * Returns whether a value is a branded response assertion subject.
 *
 * @param value - Assertion subject from Chai.
 * @returns True when the value was created by {@link createResponseAssertionSubject}.
 */
export function isResponseAssertionSubject(value: unknown): value is ResponseAssertionSubject {
  return (
    typeof value === 'object' &&
    value !== null &&
    RESPONSE_ASSERTION_BRAND in value &&
    (value as ResponseAssertionSubject)[RESPONSE_ASSERTION_BRAND] === true
  );
}

/**
 * Returns a header value by case-insensitive name.
 *
 * @param headers - Flat response header map.
 * @param name - Header name to look up.
 * @returns Header value or undefined when absent.
 */
function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) {
      return value;
    }
  }
  return undefined;
}

/**
 * Parses the response body as JSON, throwing when invalid.
 *
 * @param body - Raw response body text.
 * @returns Parsed JSON value.
 */
function parseJsonBody(body: string): unknown {
  return JSON.parse(body);
}

/**
 * Returns whether the Content-Type header indicates JSON.
 *
 * @param headers - Flat response header map.
 * @returns True when content-type includes "json".
 */
function isJsonContentType(headers: Record<string, string>): boolean {
  const contentType = getHeader(headers, 'content-type');
  return contentType !== undefined && contentType.toLowerCase().includes('json');
}

/**
 * Deep-compares two values using JSON serialization (matches Chai eql semantics for plain objects).
 *
 * @param actual - Parsed response JSON.
 * @param expected - Expected object shape.
 * @returns True when deeply equal.
 */
function deepEqualJson(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * Builds a branded response facade from a send result for Chai assertion subjects.
 *
 * @param resp - HTTP response from the completed send.
 * @returns Branded subject passed to `scriptExpect` for `hc.response.to`.
 */
export function createResponseAssertionSubject(resp: SendResult): ResponseAssertionSubject {
  const subject: ResponseAssertionSubject = {
    code: resp.status,
    statusText: resp.statusText,
    headers: resp.headers,
    body: resp.body,
    responseTime: resp.timeMs,
    sizeBytes: resp.sizeBytes,
    [RESPONSE_ASSERTION_BRAND]: true
  };
  return subject;
}

/**
 * Chai utils with chain-name arguments supported by the Chai 4 runtime.
 */
type ResponsePluginUtils = Chai.ChaiUtils & {
  addMethod(ctx: object, name: string, method: (...args: unknown[]) => void, chain?: string): void;
  addProperty(
    ctx: object,
    name: string,
    getter: (this: Chai.AssertionStatic) => void,
    chain?: string
  ): void;
  overwriteProperty(
    ctx: object,
    name: string,
    getter: (this: Chai.AssertionStatic, superFn: () => unknown) => void,
    chain?: string
  ): void;
};

/**
 * Runs a Chai assertion with optional expected/actual placeholders for strict typing.
 *
 * @param assertion - Chai assertion instance.
 * @param expr - Expression that must be truthy for the assertion to pass.
 * @param message - Failure message when expr is false.
 * @param negateMessage - Failure message when expr is true under negation.
 * @param expected - Optional expected value for message interpolation.
 * @param actual - Optional actual value for message interpolation.
 */
function assertMatch(
  assertion: Chai.AssertionStatic,
  expr: boolean,
  message: string,
  negateMessage: string,
  expected?: unknown,
  actual?: unknown
): void {
  assertion.assert(expr, message, negateMessage, expected, actual);
}

/**
 * Reads the branded response subject from a Chai assertion or throws a scope error.
 *
 * @param assertion - Chai assertion instance (`this` inside a matcher).
 * @param utils - Chai plugin utilities.
 * @returns Branded response subject.
 */
function requireResponseSubject(
  assertion: Chai.AssertionStatic,
  utils: Chai.ChaiUtils
): ResponseAssertionSubject {
  const subject = utils.flag(assertion, 'object');
  if (!isResponseAssertionSubject(subject)) {
    throw new Error(RESPONSE_SCOPE_ERROR);
  }
  return subject;
}

/**
 * Registers Postman-style response matchers on the Chai Assertion prototype.
 *
 * Must run before SES `lockdown()` in the script runner import chain.
 *
 * @param chai - Chai module instance from the script sandbox host.
 */
export function installResponseAssertions(chai: Chai.ChaiStatic): void {
  const { Assertion } = chai;
  const utils = chai.util as ResponsePluginUtils;

  /**
   * Asserts HTTP status code or status text.
   *
   * @param codeOrText - Numeric status code or status text string.
   */
  utils.addMethod(
    Assertion.prototype,
    'status',
    function statusMatcher(this: Chai.AssertionStatic, codeOrText: unknown) {
      const res = requireResponseSubject(this, utils);
      if (typeof codeOrText === 'number') {
        assertMatch(
          this,
          res.code === codeOrText,
          `expected response to have status code #{exp} but got #{act}`,
          `expected response to not have status code #{exp}`,
          codeOrText,
          res.code
        );
      } else {
        const expected = String(codeOrText).toLowerCase();
        const actual = res.statusText.toLowerCase();
        assertMatch(
          this,
          actual === expected,
          `expected response to have status text #{exp} but got #{act}`,
          `expected response to not have status text #{exp}`,
          codeOrText,
          res.statusText
        );
      }
    },
    'have'
  );

  /**
   * Asserts response header presence or header value.
   *
   * @param name - Header name (case-insensitive).
   * @param value - Optional expected header value.
   */
  utils.addMethod(
    Assertion.prototype,
    'header',
    function headerMatcher(this: Chai.AssertionStatic, name: unknown, value?: unknown) {
      const res = requireResponseSubject(this, utils);
      const headerName = String(name);
      const actual = getHeader(res.headers, headerName);
      if (value === undefined) {
        assertMatch(
          this,
          actual !== undefined,
          `expected response to have header #{exp}`,
          `expected response to not have header #{exp}`,
          headerName
        );
      } else {
        const expected = String(value);
        assertMatch(
          this,
          actual === expected,
          `expected response header #{exp} to equal #{act}`,
          `expected response header #{exp} to not equal #{act}`,
          `${headerName}=${expected}`,
          actual === undefined ? undefined : `${headerName}=${actual}`
        );
      }
    },
    'have'
  );

  /**
   * Asserts response body content.
   *
   * @param expected - When omitted, body must be non-empty; string for exact match; RegExp for pattern.
   */
  utils.addMethod(
    Assertion.prototype,
    'body',
    function bodyMatcher(this: Chai.AssertionStatic, expected?: unknown) {
      const res = requireResponseSubject(this, utils);
      if (expected === undefined) {
        assertMatch(
          this,
          res.body.length > 0,
          'expected response to have a body',
          'expected response to not have a body'
        );
      } else if (expected instanceof RegExp) {
        assertMatch(
          this,
          expected.test(res.body),
          `expected response body to match #{exp}`,
          `expected response body to not match #{exp}`,
          expected,
          res.body
        );
      } else {
        const expectedText = String(expected);
        assertMatch(
          this,
          res.body === expectedText,
          `expected response body to equal #{exp}`,
          `expected response body to not equal #{exp}`,
          expectedText,
          res.body
        );
      }
    },
    'have'
  );

  /**
   * Asserts the response body is valid JSON, optionally deep-equal to an expected object.
   *
   * @param expected - When provided, parsed body must deeply equal this value.
   */
  utils.addMethod(
    Assertion.prototype,
    'jsonBody',
    function jsonBodyMatcher(this: Chai.AssertionStatic, expected?: unknown) {
      const res = requireResponseSubject(this, utils);
      let parsed: unknown;
      try {
        parsed = parseJsonBody(res.body);
      } catch {
        assertMatch(
          this,
          false,
          'expected response body to be valid JSON',
          'expected response body to not be valid JSON'
        );
        return;
      }
      if (expected !== undefined) {
        assertMatch(
          this,
          deepEqualJson(parsed, expected),
          `expected response JSON body to deeply equal #{exp}`,
          `expected response JSON body to not deeply equal #{exp}`,
          expected,
          parsed
        );
      }
    },
    'have'
  );

  /**
   * Registers a boolean status-class property on the assertion chain after `be`.
   *
   * @param name - Property name exposed as `.to.be.<name>`.
   * @param predicate - Returns true when the response matches the status class.
   * @param label - Human-readable label for assertion messages.
   */
  function addStatusClassProperty(
    name: string,
    predicate: (code: number) => boolean,
    label: string
  ): void {
    utils.addProperty(
      Assertion.prototype,
      name,
      wrapCallablePropertyGetter(function statusClassProperty(this: Chai.AssertionStatic) {
        const res = requireResponseSubject(this, utils);
        assertMatch(
          this,
          predicate(res.code),
          `expected response to be ${label} but got status #{act}`,
          `expected response to not be ${label}`,
          undefined,
          res.code
        );
      }),
      'be'
    );
  }

  addStatusClassProperty('success', (code) => code >= 200 && code < 300, 'successful (2xx)');
  addStatusClassProperty('redirection', (code) => code >= 300 && code < 400, 'a redirection (3xx)');
  addStatusClassProperty(
    'clientError',
    (code) => code >= 400 && code < 500,
    'a client error (4xx)'
  );
  addStatusClassProperty(
    'serverError',
    (code) => code >= 500 && code < 600,
    'a server error (5xx)'
  );
  addStatusClassProperty('error', (code) => code >= 400, 'an error (4xx or 5xx)');

  /**
   * Extends Chai's truthy `.to.be.ok` with a 2xx check when the subject is hc.response.
   */
  Assertion.overwriteProperty('ok', function okProperty(superFn) {
    return function okPropertyGetter(this: Chai.AssertionStatic) {
      const subject = utils.flag(this, 'object');
      if (!isResponseAssertionSubject(subject)) {
        superFn.call(this);
        return;
      }
      assertMatch(
        this,
        subject.code >= 200 && subject.code < 300,
        'expected response to be ok (2xx) but got status #{act}',
        'expected response to not be ok (2xx)',
        undefined,
        subject.code
      );
    };
  });

  addStatusClassProperty('accepted', (code) => code === 202, 'Accepted (202)');
  addStatusClassProperty('badRequest', (code) => code === 400, 'Bad Request (400)');
  addStatusClassProperty('unauthorized', (code) => code === 401, 'Unauthorized (401)');
  addStatusClassProperty('forbidden', (code) => code === 403, 'Forbidden (403)');
  addStatusClassProperty('notFound', (code) => code === 404, 'Not Found (404)');
  addStatusClassProperty('rateLimited', (code) => code === 429, 'Too Many Requests (429)');

  utils.addProperty(
    Assertion.prototype,
    'json',
    wrapCallablePropertyGetter(function jsonProperty(this: Chai.AssertionStatic) {
      const res = requireResponseSubject(this, utils);
      let parses = false;
      try {
        parseJsonBody(res.body);
        parses = true;
      } catch {
        parses = false;
      }
      const hasJsonType = isJsonContentType(res.headers);
      assertMatch(
        this,
        hasJsonType && parses,
        'expected response to be JSON (content-type and valid JSON body)',
        'expected response to not be JSON'
      );
    }),
    'be'
  );

  utils.addProperty(
    Assertion.prototype,
    'withBody',
    wrapCallablePropertyGetter(function withBodyProperty(this: Chai.AssertionStatic) {
      const res = requireResponseSubject(this, utils);
      assertMatch(
        this,
        res.body.length > 0,
        'expected response to have a body',
        'expected response to not have a body'
      );
    }),
    'be'
  );
}
