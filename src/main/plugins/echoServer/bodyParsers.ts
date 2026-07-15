import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import type { RequestWithRawBody } from './types';

const upload = multer();

/**
 * Stores raw request body bytes on the request for echo data field.
 *
 * @param req - Incoming request.
 * @param _res - Express response (unused).
 * @param buf - Raw body buffer from the parser.
 */
const storeRawBody = (req: Request, _res: Response, buf: Buffer): void => {
  (req as RequestWithRawBody).rawBody = buf;
};

const jsonParser = express.json({ verify: storeRawBody });
const urlencodedParser = express.urlencoded({ extended: false, verify: storeRawBody });
const textParser = express.text({ type: 'text/*', verify: storeRawBody });
const rawParser = express.raw({ type: '*/*', verify: storeRawBody });

/**
 * Returns whether the request is multipart/form-data.
 *
 * @param req - Incoming request.
 */
const isMultipart = (req: Request): boolean =>
  req.is('multipart/form-data') === 'multipart/form-data';

/**
 * Parses request bodies based on Content-Type, capturing raw bytes where applicable.
 *
 * @param req - Incoming request.
 * @param res - Express response.
 * @param next - Continues the middleware chain.
 */
export const bodyParsers = (req: Request, res: Response, next: NextFunction): void => {
  if (isMultipart(req)) {
    upload.any()(req, res, next);
    return;
  }

  if (req.is('application/json')) {
    jsonParser(req, res, next);
    return;
  }

  if (req.is('application/x-www-form-urlencoded')) {
    urlencodedParser(req, res, next);
    return;
  }

  if (req.is('text/*')) {
    textParser(req, res, next);
    return;
  }

  const contentLength = req.headers['content-length'];
  if (contentLength && contentLength !== '0') {
    rawParser(req, res, next);
    return;
  }

  next();
};
