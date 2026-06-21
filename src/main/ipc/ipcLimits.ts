import { HARD_MAX_RESPONSE_SIZE_MB } from '#/main/http';

/**
 * Maximum request body string length accepted over IPC (characters).
 * Aligned with {@link HARD_MAX_RESPONSE_SIZE_MB} so outbound body size matches
 * the hard response-size ceiling.
 */
export const MAX_IPC_REQUEST_BODY_CHARS = HARD_MAX_RESPONSE_SIZE_MB * 1024 * 1024;

/**
 * Maximum pre/post script source length accepted over IPC (characters).
 */
export const MAX_IPC_SCRIPT_CHARS = 512 * 1024;

/**
 * Maximum URL string length accepted over IPC (characters).
 */
export const MAX_IPC_URL_CHARS = 8192;

/**
 * Maximum request comment/description length accepted over IPC (characters).
 */
export const MAX_IPC_COMMENT_CHARS = 64 * 1024;
