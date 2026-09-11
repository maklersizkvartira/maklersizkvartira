/**
 * The facts the public offer (`/yordam/oferta`) is built on.
 *
 * The offer exists for the acquiring bank. An internet-acquiring application
 * is judged on a public page that names the operator and its requisites, says
 * what is sold and for how much, how a payment is taken, what stops a
 * fraudulent one and how money comes back. The three language versions are
 * prose, but the figures in them are contractual: a Russian page quoting a
 * different price or a different Top count from the Uzbek one is a defect a
 * reviewer will find. So the figures live here once and the prose reads them.
 *
 * Nothing on the site sells these plans yet. The payment integration comes
 * after the acquiring contract is signed, and when it does it has to honour
 * what the offer promises — no auto-renewal, activation only on the bank's
 * confirmation, one live plan of a kind per account, the failed-attempt
 * limit. Those rules are written in the offer text; this file only holds the
 * numbers.
 */

export const OFFER_UPDATED_AT = '2026-09-11';

export const OFFER_OPERATOR = {
  /** Registered name, without the legal form — each language adds its own. */
  name: 'ZAYNIDDIN EXPORT',
  tin: '312871833',
  account: '20208000407423037001',
  bankMfo: '01125',
  /**
   * The registered address from the state registration certificate.
   *
   * Empty until the owner supplies it, and each language leaves the line out
   * rather than printing a blank. Banks do expect it on the offer, so an empty
   * value here is a gap in the application, not a finished state.
   */
  legalAddress: '',
  phones: ['+998 93 718 88 85', '+998 77 785 07 37'],
  email: 'support@uyiz.uz',
  telegram: '@uyiz',
  site: 'https://uyiz.uz',
} as const;

/** Every plan runs this many calendar days from activation. */
export const PLAN_DAYS = 30;

/** How long one Top keeps a listing at the head of the results. */
export const TOP_HOURS = 72;

export const OFFER_PLANS = {
  /** Unlimited Uyiz AI, for any signed-in user. */
  ai: { price: 12_990 },
  /** An owner posting their own home. */
  owner: { price: 19_990, tops: 7 },
  /** Agencies and agents. */
  agency: { price: 35_990, tops: 9 },
} as const;

/**
 * A price with its thousands grouped: "12 990".
 *
 * The default separator is a no-break space, so a price never breaks across a
 * line on a phone and leaves "12" at the end of one row and "990 so‘m" on the
 * next.
 */
export function groupDigits(value: number, separator = ' '): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}
