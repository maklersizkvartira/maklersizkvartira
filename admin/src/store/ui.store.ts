import { create } from 'zustand';

/**
 * Chrome state that outlives a single component: the two sidebar modes and the
 * toast queue.
 *
 * The sidebar has two independent booleans because it has two behaviours.
 * `sidebarOpen` is the mobile drawer, which is closed by default and dismissed
 * on navigation. `sidebarCollapsed` is the desktop rail, which is remembered
 * because an admin who narrowed it wants it narrow on the next page too — and
 * it is read back from localStorage on mount rather than persisted through
 * middleware, so the server render and the first client render agree.
 */

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  /** Milliseconds. 0 pins the toast until it is dismissed by hand. */
  duration?: number;
}

export type SidebarPosition = 'left' | 'right';
export type HeaderPosition = 'top' | 'bottom';

const COLLAPSED_KEY = 'sidebar-collapsed';
const SIDEBAR_POSITION_KEY = 'sidebar-position';
const HEADER_POSITION_KEY = 'header-position';

function writeStorage(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode, or storage disabled. The chrome just forgets; nothing breaks.
  }
}

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Private mode, or storage disabled. The rail just forgets; nothing breaks.
  }
}

interface UIState {
  /** Mobile drawer. */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  /** Desktop rail. */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  /** Call once on mount to pick the remembered rail width up from storage. */
  hydrateSidebar: () => void;

  /** Theme palette (appearance panel). Shared by the sidebar footer, the
   *  header and the command palette, so it lives here rather than being
   *  prop-drilled from DashboardLayout. */
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  activityOpen: boolean;
  setActivityOpen: (open: boolean) => void;
  /** ⌘K search / actions palette. */
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  /** Drag-to-dock placement of the floating sidebar and header, remembered
   *  per device — read back from storage on mount by DashboardLayout. */
  sidebarPosition: SidebarPosition;
  setSidebarPosition: (position: SidebarPosition) => void;
  headerPosition: HeaderPosition;
  setHeaderPosition: (position: HeaderPosition) => void;
  /** Full-screen "how to move the sidebar" coach-mark, launched from Appearance. */
  sidebarCoachOpen: boolean;
  setSidebarCoachOpen: (open: boolean) => void;

  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

let toastSeq = 0;

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // Always false on the first render, on the server and in the browser alike;
  // `hydrateSidebar` corrects it after mount so hydration cannot mismatch.
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => {
    writeCollapsed(collapsed);
    set({ sidebarCollapsed: collapsed });
  },
  toggleSidebarCollapsed: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      writeCollapsed(next);
      return { sidebarCollapsed: next };
    }),
  hydrateSidebar: () => set({ sidebarCollapsed: readCollapsed() }),

  paletteOpen: false,
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  activityOpen: false,
  setActivityOpen: (open) => set({ activityOpen: open }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  sidebarPosition: 'left',
  setSidebarPosition: (position) => {
    writeStorage(SIDEBAR_POSITION_KEY, position);
    set({ sidebarPosition: position });
  },
  headerPosition: 'top',
  setHeaderPosition: (position) => {
    writeStorage(HEADER_POSITION_KEY, position);
    set({ headerPosition: position });
  },
  sidebarCoachOpen: false,
  setSidebarCoachOpen: (open) => set({ sidebarCoachOpen: open }),

  toasts: [],
  addToast: (toast) => {
    // A counter, not Math.random: two failures raised in the same tick used to
    // be able to collide on an id and React would then reuse one list node.
    const id = `t${++toastSeq}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}));
