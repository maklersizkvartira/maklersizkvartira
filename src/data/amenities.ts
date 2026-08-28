/**
 * The seven amenities a listing can carry, declared once.
 *
 * They used to be declared three times over: an inline tuple array inside the
 * create wizard, a six-entry constant on the detail page, and four
 * hand-written checkboxes in the edit modal. The copies had already drifted —
 * an owner who ticked air conditioning, a washing machine or internet while
 * posting could never untick any of them afterwards, because the edit form did
 * not know those fields existed, and the detail page never showed whether
 * utilities were included in the amenity grid at all.
 *
 * `key` is the field name on the listing payload, not a display slug. The
 * store turns a selected amenity straight into a query parameter of the same
 * name (`filters.amenities.map((a) => [a, true])`) and the API's create,
 * update and filter schemas read the same camelCase names, so any other
 * spelling here is dropped silently somewhere between the checkbox and the
 * database rather than failing loudly.
 *
 * Two label keys, because the same flag is worded differently depending on who
 * is reading it: `owner.create.amenities.*` is the question put to an owner
 * filling the form ("utilities included in the price"), while
 * `listings.amenities.*` is the statement made to a tenant reading the
 * finished listing ("utilities").
 */

import type { ComponentType } from 'react';
import {
  AirVent,
  Car,
  PawPrint,
  Receipt,
  Sofa,
  WashingMachine,
  Wifi,
} from 'lucide-react';

export type AmenityKey =
  | 'furnished'
  | 'utilitiesIncluded'
  | 'airConditioning'
  | 'washingMachine'
  | 'internet'
  | 'parking'
  | 'petsAllowed';

export interface AmenityDefinition {
  /** Field name on the listing payload and on the filter query string. */
  key: AmenityKey;
  /** Wording for the owner's own form. */
  labelKey: string;
  /** Wording for a published listing. */
  listingLabelKey: string;
  Icon: ComponentType<{ className?: string }>;
}

export const AMENITIES: readonly AmenityDefinition[] = [
  {
    key: 'furnished',
    labelKey: 'owner.create.amenities.furnished',
    listingLabelKey: 'listings.amenities.furnished',
    Icon: Sofa,
  },
  {
    key: 'utilitiesIncluded',
    labelKey: 'owner.create.amenities.utilities',
    listingLabelKey: 'listings.amenities.utilitiesIncluded',
    Icon: Receipt,
  },
  {
    key: 'airConditioning',
    labelKey: 'owner.create.amenities.airConditioning',
    listingLabelKey: 'listings.amenities.airConditioning',
    Icon: AirVent,
  },
  {
    key: 'washingMachine',
    labelKey: 'owner.create.amenities.washingMachine',
    listingLabelKey: 'listings.amenities.washingMachine',
    Icon: WashingMachine,
  },
  {
    key: 'internet',
    labelKey: 'owner.create.amenities.internet',
    listingLabelKey: 'listings.amenities.internet',
    Icon: Wifi,
  },
  {
    key: 'parking',
    labelKey: 'owner.create.amenities.parking',
    listingLabelKey: 'listings.amenities.parking',
    Icon: Car,
  },
  {
    key: 'petsAllowed',
    labelKey: 'owner.create.amenities.pets',
    listingLabelKey: 'listings.amenities.petsAllowed',
    Icon: PawPrint,
  },
];

export type AmenityState = Record<AmenityKey, boolean>;

/**
 * Every amenity off.
 *
 * The wizard used to default six of the seven to `true`, so an owner who never
 * scrolled past the price published a flat that claimed parking, a washing
 * machine, air conditioning and included utilities. An amenity is a promise to
 * a tenant; it has to be opted into.
 */
export const NO_AMENITIES: AmenityState = {
  furnished: false,
  utilitiesIncluded: false,
  airConditioning: false,
  washingMachine: false,
  internet: false,
  parking: false,
  petsAllowed: false,
};

/** Reads the seven flags off a listing (or any payload that carries them). */
export function amenityStateFrom(source: Partial<Record<AmenityKey, unknown>>): AmenityState {
  const state = { ...NO_AMENITIES };
  for (const amenity of AMENITIES) {
    state[amenity.key] = Boolean(source[amenity.key]);
  }
  return state;
}
