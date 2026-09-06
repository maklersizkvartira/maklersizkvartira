import { humaniseEnum } from '@/shared/lib/enum-label';

/**
 * The part of a `useTranslations('auditActions')` translator this file needs.
 * Messages are not type-augmented in this app, so its keys are plain strings.
 */
interface EnumTranslator {
  (key: string): string;
  has(key: string): boolean;
}

/**
 * One audit action, as a word rather than a constant.
 *
 * `auditActions` is a flat namespace keyed by the AuditAction enum itself, so
 * this cannot go through `enumLabeller` — that helper builds `prefix.VALUE` and
 * there is no prefix here. It keeps the same two-part contract: ask the
 * catalogue first, humanise what it does not cover.
 *
 * The fallback is `humaniseEnum`, not the raw constant the audit feed used to
 * print: an action the backend grew after this build was cut reads as
 * 'Listing favorited' rather than as 'LISTING_FAVORITED', which is a gap in the
 * catalogue rather than something that looks like a bug in the panel.
 */
export function auditActionLabel(ta: EnumTranslator, action: string): string {
  return ta.has(action) ? ta(action) : humaniseEnum(action);
}
