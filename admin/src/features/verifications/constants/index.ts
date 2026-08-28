import type { VerificationDocumentType, VerificationStatus } from '@/shared/api/types';

/**
 * Wire values and limits for the identity-verification queue.
 *
 * `status` is the only filter `GET /admin/verifications` understands, and it is
 * a bare route parameter compared upper-cased against the column — so an
 * unrecognised value answers with an empty page, not a 422.
 */
export const VERIFICATION_STATUSES: VerificationStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

/** The whole `VerificationDocumentType` enum. */
export const VERIFICATION_DOCUMENT_TYPES: VerificationDocumentType[] = [
  'PASSPORT',
  'ID_CARD',
  'CADASTRE',
  'SELFIE_LIVENESS',
];

/** What the catalogues cover. Guarded because next-intl throws on a missing
 *  key rather than rendering a blank, so a value the backend adds before the
 *  messages catch up has to fall back to its wire form. */
export const TRANSLATED_VERIFICATION_STATUSES = new Set<string>(VERIFICATION_STATUSES);
export const TRANSLATED_DOCUMENT_TYPES = new Set<string>(VERIFICATION_DOCUMENT_TYPES);

/**
 * 10 rows a page, and that is already generous.
 *
 * `documentUrl` and `selfieUrl` are each frequently an ~8,000,000-character
 * base64 data URI — people photograph a passport with a phone and upload it
 * straight through — so a page of ten can be well over a hundred megabytes of
 * JSON. Nothing on this screen puts one in an `<img>` until it is asked for.
 */
export const VERIFICATIONS_PAGE_SIZE = 10;

/** `rejection_reason` is `str | None`, max 500 on the PATCH route. */
export const REJECTION_REASON_MAX = 500;
