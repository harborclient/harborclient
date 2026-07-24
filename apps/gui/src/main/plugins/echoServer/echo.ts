import type { EchoResponse, RequestWithRawBody } from './types';

/**
 * Flattens Express query params to a string map (duplicate keys use last value).
 *
 * @param query - Express parsed query object.
 * @returns String map of query arguments.
 */
export const normalizeQuery = (query: RequestWithRawBody['query']): Record<string, string> => {
  const args: Record<string, string> = {};

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      args[key] = value;
    } else if (Array.isArray(value)) {
      const last = value[value.length - 1];
      if (typeof last === 'string') {
        args[key] = last;
      }
    } else if (value !== null && typeof value === 'object') {
      args[key] = String(value);
    }
  }

  return args;
};

/**
 * Returns whether the content type is JSON.
 *
 * @param contentType - Raw Content-Type header value.
 */
const isJsonContentType = (contentType: string | undefined): boolean =>
  contentType?.includes('application/json') ?? false;

/**
 * Normalizes Express header map to string values.
 *
 * @param headers - Express request headers.
 */
const normalizeHeaders = (headers: RequestWithRawBody['headers']): Record<string, string> => {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = value.join(', ');
    }
  }

  return result;
};

/**
 * Extracts non-file form fields from a parsed multipart or urlencoded body.
 *
 * @param req - Incoming request with optional multer files.
 */
const extractForm = (req: RequestWithRawBody): Record<string, string> => {
  const contentType = req.headers['content-type'] ?? '';
  const isFormBody =
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');

  if (!isFormBody) {
    return {};
  }

  const form: Record<string, string> = {};
  const fileFieldNames = new Set(
    (req.files as Express.Multer.File[] | undefined)?.map((file) => file.fieldname) ?? []
  );

  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    for (const [key, value] of Object.entries(req.body)) {
      if (fileFieldNames.has(key)) {
        continue;
      }
      if (typeof value === 'string') {
        form[key] = value;
      }
    }
  }

  return form;
};

/**
 * Maps uploaded files to fieldname -> original filename.
 *
 * @param req - Incoming request with optional multer files.
 */
const extractFiles = (req: RequestWithRawBody): Record<string, string> => {
  const files: Record<string, string> = {};
  const uploaded = req.files as Express.Multer.File[] | undefined;

  if (uploaded) {
    for (const file of uploaded) {
      files[file.fieldname] = file.originalname;
    }
  }

  return files;
};

/**
 * Extracts parsed JSON body when Content-Type is application/json.
 *
 * @param req - Incoming request with parsed body.
 */
const extractJson = (req: RequestWithRawBody): Record<string, unknown> | null => {
  const contentType = req.headers['content-type'];

  if (!isJsonContentType(contentType)) {
    return null;
  }

  if (
    req.body &&
    typeof req.body === 'object' &&
    !Buffer.isBuffer(req.body) &&
    !Array.isArray(req.body)
  ) {
    return req.body as Record<string, unknown>;
  }

  return null;
};

/**
 * Builds an httpbin-style echo response from the incoming request.
 *
 * @param req - Parsed Express request with optional raw body.
 * @returns Default echo JSON payload.
 */
export const buildEchoResponse = (req: RequestWithRawBody): EchoResponse => {
  const host = req.get('host') ?? '';
  const url = `${req.protocol}://${host}${req.originalUrl}`;

  return {
    args: normalizeQuery(req.query),
    data: req.rawBody?.toString('utf8') ?? '',
    files: extractFiles(req),
    form: extractForm(req),
    headers: normalizeHeaders(req.headers),
    json: extractJson(req),
    origin: req.ip ?? req.socket.remoteAddress ?? '',
    url
  };
};
