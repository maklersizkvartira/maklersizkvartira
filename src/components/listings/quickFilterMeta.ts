/**
 * The label and the glyph each quick filter wears, in one table.
 *
 * The filter sets themselves live in the store, next to the filter shape they
 * write (`QUICK_FILTER_DELTAS`, `QUICK_FILTER_RAIL`, `railFor`). What could
 * not live there is this: a label key and a React icon component would drag
 * the icon package into a module the store's every consumer imports.
 *
 * It sits in its own file rather than inside ListingsPage because the map's
 * filter sheet now draws the same rail. Two copies of this table is how the
 * catalogue and the map end up calling the same search two different things.
 */

import {
  Flower2,
  GraduationCap,
  Handshake,
  Home,
  Landmark,
  LayoutGrid,
  ShieldCheck,
  Sofa,
  TrainFront,
  TrendingDown,
  Users,
} from 'lucide-react';

import type { TranslationKey } from '../../i18n';
import type { QuickFilterId } from '../../stores/useAppStore';

export interface QuickFilterMeta {
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
}

export const QUICK_META: Record<QuickFilterId, QuickFilterMeta> = {
  // 'all' is the rail's own entry and has no tile or menu item to match.
  all: { labelKey: 'listings.filters.quick.all', icon: LayoutGrid },
  roommate: { labelKey: 'listings.filters.quick.roommate', icon: Handshake },
  student: { labelKey: 'listings.filters.quick.student', icon: GraduationCap },
  family: { labelKey: 'listings.filters.quick.family', icon: Users },
  metro: { labelKey: 'listings.filters.quick.metro', icon: TrainFront },
  qizlarga: { labelKey: 'listings.filters.quick.qizlarga', icon: Flower2 },
  komfort: { labelKey: 'listings.filters.quick.komfort', icon: Sofa },
  center: { labelKey: 'listings.filters.quick.center', icon: Landmark },
  // The chip rail keeps a line glyph: the home cards' painted
  // illustrations are unreadable at the 16px a chip gives them.
  hovli: { labelKey: 'listings.filters.quick.hovli', icon: Home },
  budget: { labelKey: 'listings.filters.quick.budget', icon: TrendingDown },
  premium: { labelKey: 'listings.filters.quick.premium', icon: ShieldCheck },
};
