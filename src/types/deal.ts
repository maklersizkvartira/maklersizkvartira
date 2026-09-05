/**
 * Renting or selling, read off a listing.
 *
 * One line of logic, in one place, for the same reason `sellerTypeOf` is: the
 * field is optional on the wire — a response from a container that predates it
 * carries nothing — and every one of those listings was a rental. Comparing
 * `listing.dealType === 'SALE'` at each call site is correct today and wrong
 * the moment somebody writes `!== 'RENT'` instead, which reads identically and
 * would call every old listing a sale.
 *
 * It is deliberately not in `types/index.ts`: that module is types only, and
 * every file in the app imports from it with `import type`, which erases at
 * build time. Putting a function there would turn all of those into real
 * imports.
 */

import type { DealType, Listing } from './index';

/** The listing's deal type, defaulting to the rental every old row was. */
export function dealTypeOf(listing: Pick<Listing, 'dealType'>): DealType {
  return listing.dealType === 'SALE' ? 'SALE' : 'RENT';
}

/**
 * Whether the price on this listing is a purchase price.
 *
 * The question almost every caller actually has, since what hangs on it is a
 * "per month" suffix, a deposit row, and a utilities line — all of which exist
 * only on the renting side.
 */
export function isForSale(listing: Pick<Listing, 'dealType'>): boolean {
  return dealTypeOf(listing) === 'SALE';
}
