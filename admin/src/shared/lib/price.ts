/**
 * A listing's price, printed with the unit it is quoted in.
 *
 * The `price` column holds two different units and the currency lives in a
 * second column, so a bare number taken from it means nothing: 700 is either
 * seven hundred dollars or seven hundred so'm, and the difference is four
 * orders of magnitude. The Top-promotion queue printed exactly that bare
 * number — on the one screen where a moderator decides whether to push a
 * listing to the top of the public catalogue.
 *
 * Nothing here converts. A price quoted in dollars is a dollar price; the
 * panel shows what the owner set, the same rule the public site follows.
 */
export function formatListingPrice(
  price: number | null | undefined,
  currency: string | null | undefined,
  locale: string,
): string | null {
  if (price === null || price === undefined || !Number.isFinite(price)) return null;
  // The column is a bare `String(3)` with no constraint, so trim and fold the
  // case rather than testing for the exact literal.
  const code = String(currency ?? '').trim().toUpperCase() === 'USD' ? 'USD' : 'UZS';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(price);
}
