import {
  MEDIA_ERROR_STATUS,
  extensionOf,
  mediaMessages,
  mediaRules,
  type MediaErrorCode,
  type MediaLimits,
} from '@amoris/contracts';
import type { FastifyError } from 'fastify';
import { mediaLimitsOf, type Config } from '../../config.js';
import { sanitizeFileName } from './fileName.js';

/** Errori di `@fastify/multipart` resi con codice stabile e messaggio in italiano. */

/** Il limite del plugin è il massimo fra i limiti dei tipi: il tipo preciso si controlla dopo. */
export function maxMediaBytes(limits: MediaLimits): number {
  return Math.max(...mediaRules(limits).map((rule) => rule.maxBytes));
}

export interface TranslatedError {
  readonly status: number;
  readonly code: MediaErrorCode;
  readonly message: string;
}

const LIMIT_CODES = new Set(['FST_FILES_LIMIT', 'FST_PARTS_LIMIT', 'FST_FIELDS_LIMIT']);
const TRUNCATED_CODES = new Set([
  'FST_MP_PREMATURE_CLOSE',
  'FST_PROTO_VIOLATION',
  'FST_INVALID_JSON_FIELD_ERROR',
]);
/** I messaggi esatti di busboy e del plugin per un corpo troncato o malformato. */
const TRUNCATED_MESSAGES =
  /^(Unexpected end of (multipart data|form)|Part terminated early due to unexpected end of multipart data|Malformed part header|Premature close)$/;

/** Le sole rotte che leggono un caricamento multipart: solo lì gli errori del plugin si traducono. */
export function isMediaUploadRoute(method: string, url: string | undefined): boolean {
  return (method === 'POST' && url === '/media') || (method === 'PUT' && url === '/media/:id/file');
}

const translated = (code: MediaErrorCode, message: string): TranslatedError => ({
  status: MEDIA_ERROR_STATUS[code],
  code,
  message,
});

/** Il limite del tipo, ricavato dall'estensione del file che ha superato il massimo. */
function tooLargeMessage(caught: FastifyError, limits: MediaLimits): string {
  const fileName = (caught as { part?: { filename?: unknown } }).part?.filename;
  if (typeof fileName === 'string') {
    const extension = extensionOf(sanitizeFileName(fileName));
    const rule = mediaRules(limits).find((candidate) => candidate.extensions.includes(extension));
    if (rule) return mediaMessages.tooLarge(sanitizeFileName(fileName), rule);
  }
  return mediaMessages.tooLargeAny(maxMediaBytes(limits));
}

export function mediaMultipartError(
  caught: FastifyError,
  config: Config,
  onUploadRoute: boolean,
): TranslatedError | null {
  if (!onUploadRoute) return null;
  const code = caught.code ?? '';
  if (code === 'FST_REQ_FILE_TOO_LARGE') {
    return translated('MEDIA_TOO_LARGE', tooLargeMessage(caught, mediaLimitsOf(config)));
  }
  if (code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
    return translated('MEDIA_NOT_MULTIPART', mediaMessages.notMultipart());
  }
  if (LIMIT_CODES.has(code)) {
    return translated('MEDIA_TOO_MANY_PARTS', mediaMessages.tooManyParts());
  }
  if (
    TRUNCATED_CODES.has(code) ||
    (!caught.statusCode && TRUNCATED_MESSAGES.test(caught.message))
  ) {
    return translated('MEDIA_UPLOAD_INVALID', mediaMessages.uploadInvalid());
  }
  return null;
}
