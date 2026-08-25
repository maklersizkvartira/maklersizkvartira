/**
 * Maklersiz CRM.
 *
 * Vanilla ES modules, no build step, no CDN. Every view is a render function
 * that returns a DOM node; there is no virtual DOM because there is no need
 * for one at this scale.
 *
 * Security notes that shaped this file:
 *  - All rendering goes through `el()` / `text()`, never innerHTML with data,
 *    so a listing title containing markup cannot execute here.
 *  - The password reveal is a deliberate, confirmed, audited action, and the
 *    value is never persisted to storage or logged.
 */

import { Api, ApiError, setUnauthorizedHandler, tokens } from './api.js';
import { actionLabel, DICTIONARIES, setLanguage, state as i18nState, t } from './i18n.js';

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') node.innerHTML = value; // only ever with literals
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const $ = (selector) => document.querySelector(selector);

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
const LOCALES = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };

const num = (value) =>
  new Intl.NumberFormat(LOCALES[i18nState.language] || 'uz-UZ').format(Number(value) || 0);

const money = (value) => `${num(Math.round(Number(value) || 0))} so'm`;

function dateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(LOCALES[i18nState.language] || 'uz-UZ', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function dateOnly(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(LOCALES[i18nState.language] || 'uz-UZ', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function relative(value) {
  if (!value) return '—';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return dateOnly(value);
}

const STATUS_PILL = {
  ACTIVE: 'pill-success',
  APPROVED: 'pill-success',
  SENT: 'pill-success',
  PENDING: 'pill-warning',
  PENDING_VERIFICATION: 'pill-warning',
  WARNING: 'pill-warning',
  UNDER_REVIEW: 'pill-warning',
  QUEUED: 'pill-warning',
  REJECTED: 'pill-danger',
  BANNED: 'pill-danger',
  SUSPENDED: 'pill-danger',
  FAILED: 'pill-danger',
  OPEN: 'pill-danger',
  REGISTRATION_REQUIRED: 'pill-info',
  ARCHIVED: 'pill-muted',
  DRAFT: 'pill-muted',
  SKIPPED: 'pill-muted',
  RESOLVED: 'pill-success',
};

const pill = (value, extraClass) =>
  el('span', { class: `pill ${extraClass || STATUS_PILL[value] || 'pill-muted'}` }, value || '—');

// ---------------------------------------------------------------------------
// Toasts & modals
// ---------------------------------------------------------------------------
function toast(message, tone = '') {
  const host = $('#toasts');
  const node = el('div', { class: `toast ${tone}` }, message);
  host.append(node);
  setTimeout(() => node.remove(), 4000);
}

function reportError(error) {
  if (error instanceof ApiError) {
    toast(error.message || t('common.error'), 'error');
  } else {
    toast(t('common.error'), 'error');
  }
  // Keep the detail in the console for an operator debugging a real incident.
  console.error(error);
}

let openModalNode = null;

function modal({ title, body, actions = [], width }) {
  closeModal();
  const backdrop = el('div', {
    class: 'modal-backdrop',
    onclick: (event) => {
      if (event.target === backdrop) closeModal();
    },
  });
  const box = el('div', {
    class: 'modal',
    role: 'dialog',
    'aria-modal': 'true',
    style: width ? `max-width:${width}px` : undefined,
  });
  box.append(
    el('div', { class: 'modal-head' }, [
      el('h2', {}, title),
      el(
        'button',
        { class: 'btn btn-ghost btn-icon', 'aria-label': t('common.close'), onclick: closeModal },
        '✕',
      ),
    ]),
    el('div', { class: 'modal-body' }, body),
  );
  if (actions.length) box.append(el('div', { class: 'modal-foot' }, actions));
  backdrop.append(box);
  document.body.append(backdrop);
  openModalNode = backdrop;
  box.querySelector('input, select, textarea, button')?.focus();
  return backdrop;
}

function closeModal() {
  openModalNode?.remove();
  openModalNode = null;
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

function confirmDialog(title, message, onConfirm, { danger = true } = {}) {
  modal({
    title,
    body: el('p', { style: 'margin:0;font-size:13px;color:var(--muted)' }, message),
    actions: [
      el('button', { class: 'btn btn-secondary', onclick: closeModal }, t('common.cancel')),
      el(
        'button',
        {
          class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
          onclick: async () => {
            closeModal();
            await onConfirm();
          },
        },
        t('common.confirm'),
      ),
    ],
  });
}

// ---------------------------------------------------------------------------
// Charts — inline SVG, no library
// ---------------------------------------------------------------------------
function barChart(rows, { valueKey = 'count', labelKey = 'date', secondKey = null } = {}) {
  const width = 640;
  const height = 200;
  const padding = { top: 12, right: 8, bottom: 26, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const max = Math.max(
    1,
    ...rows.map((row) => Math.max(Number(row[valueKey]) || 0, secondKey ? Number(row[secondKey]) || 0 : 0)),
  );
  const slot = plotWidth / Math.max(rows.length, 1);
  const barWidth = Math.max(4, slot * (secondKey ? 0.34 : 0.56));

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img');

  const svgEl = (tag, attrs) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };

  // Horizontal gridlines with value labels.
  for (let step = 0; step <= 2; step += 1) {
    const y = padding.top + (plotHeight / 2) * step;
    svg.append(svgEl('line', {
      class: 'axis', x1: padding.left, x2: width - padding.right, y1: y, y2: y,
    }));
    const label = svgEl('text', { class: 'label', x: 2, y: y + 3 });
    label.textContent = String(Math.round(max - (max / 2) * step));
    svg.append(label);
  }

  rows.forEach((row, index) => {
    const x = padding.left + index * slot;
    const value = Number(row[valueKey]) || 0;
    const barHeight = (value / max) * plotHeight;
    svg.append(svgEl('rect', {
      class: 'bar',
      x: x + (slot - (secondKey ? barWidth * 2 + 2 : barWidth)) / 2,
      y: padding.top + plotHeight - barHeight,
      width: barWidth,
      height: Math.max(barHeight, value > 0 ? 2 : 0),
      rx: 2,
    }));

    if (secondKey) {
      const second = Number(row[secondKey]) || 0;
      const secondHeight = (second / max) * plotHeight;
      svg.append(svgEl('rect', {
        class: 'bar-2',
        x: x + (slot - barWidth * 2 - 2) / 2 + barWidth + 2,
        y: padding.top + plotHeight - secondHeight,
        width: barWidth,
        height: Math.max(secondHeight, second > 0 ? 2 : 0),
        rx: 2,
      }));
    }

    const label = svgEl('text', {
      class: 'label',
      x: x + slot / 2,
      y: height - 8,
      'text-anchor': 'middle',
    });
    const raw = String(row[labelKey] ?? '');
    label.textContent = raw.length > 10 ? raw.slice(5) : raw;
    svg.append(label);
  });

  return svg;
}

// ---------------------------------------------------------------------------
// Reusable table
// ---------------------------------------------------------------------------
function dataTable({ columns, rows, emptyMessage }) {
  if (!rows.length) {
    return el('div', { class: 'empty' }, emptyMessage || t('common.empty'));
  }
  const head = el('thead', {}, el('tr', {}, columns.map((column) => el('th', {}, column.label))));
  const bodyRows = rows.map((row) =>
    el(
      'tr',
      {},
      columns.map((column) =>
        el('td', { class: column.cellClass }, column.render(row)),
      ),
    ),
  );
  return el('div', { class: 'table-wrap' }, el('table', {}, [head, el('tbody', {}, bodyRows)]));
}

function pagination(meta, onPage) {
  if (!meta || meta.totalPages <= 1) return null;
  return el('div', { class: 'pagination' }, [
    el(
      'span',
      {},
      t('common.showing', {
        from: (meta.page - 1) * meta.pageSize + 1,
        to: Math.min(meta.page * meta.pageSize, meta.total),
        total: num(meta.total),
      }),
    ),
    el('div', { style: 'display:flex;gap:6px' }, [
      el(
        'button',
        {
          class: 'btn btn-secondary btn-sm',
          disabled: !meta.hasPrevious,
          onclick: () => onPage(meta.page - 1),
        },
        t('common.previous'),
      ),
      el(
        'button',
        {
          class: 'btn btn-secondary btn-sm',
          disabled: !meta.hasNext,
          onclick: () => onPage(meta.page + 1),
        },
        t('common.next'),
      ),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------
const app = {
  admin: null,
  view: 'dashboard',
  filters: {},
};

const THEME_KEY = 'maklersiz.admin.theme';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    /* ignore */
  }
}

function initTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch (error) {
    /* ignore */
  }
  applyTheme(
    stored || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
const VIEWS = {};

VIEWS.dashboard = async (host) => {
  host.append(el('div', { class: 'loading' }, t('common.loading')));

  const [stats, registrations, traffic, districts, activity, settingsRes] = await Promise.all([
    Api.stats(),
    Api.chartRegistrations(7),
    Api.chartTraffic(7),
    Api.chartDistricts(8),
    Api.chartActivity(7),
    Api.settings(),
  ]);
  const data = stats.data;
  let isMonetizationEnabled = settingsRes.is_monetization_enabled;
  clear(host);

  const toggleBtn = el('button', {
    class: `btn ${isMonetizationEnabled ? 'btn-danger' : 'btn-primary'}`,
    style: 'margin-bottom: 20px;',
    onclick: async () => {
      toggleBtn.disabled = true;
      toggleBtn.textContent = '...';
      try {
        await Api.toggleMonetization();
        VIEWS.dashboard(host);
      } catch (e) {
        toast('Xatolik yuz berdi', 'error');
        toggleBtn.disabled = false;
        toggleBtn.textContent = isMonetizationEnabled ? 'Yangi Dizayn (VIP) ni o\'chirish' : 'Yangi Dizayn (VIP) ni yoqish';
      }
    }
  }, isMonetizationEnabled ? 'Yangi Dizayn (VIP) ni o\'chirish' : 'Yangi Dizayn (VIP) ni yoqish');

  host.append(toggleBtn);

  const metric = (labelKey, value, sub, accent) =>
    el('div', { class: `card metric ${accent || ''}` }, [
      el('div', { class: 'label' }, t(`dashboard.${labelKey}`)),
      el('div', { class: 'value' }, num(value)),
      sub ? el('div', { class: 'sub' }, sub) : null,
    ]);

  host.append(
    el('div', { class: 'grid grid-metrics' }, [
      metric('totalUsers', data.totalUsers, `${t('dashboard.activeUsers')}: ${num(data.activeUsers)}`),
      metric('todayNewUsers', data.todayNewUsers, `${t('dashboard.weekNewUsers')}: ${num(data.weekNewUsers)}`, 'accent-brand'),
      metric('owners', data.owners, `${t('dashboard.students')}: ${num(data.students)}`),
      metric('totalListings', data.totalListings, `${t('dashboard.todayNewListings')}: ${num(data.todayNewListings)}`),
      metric('approvedListings', data.approvedListings, null, 'accent-brand'),
      metric('pendingListings', data.pendingListings, null, 'accent-warning'),
      metric('rejectedListings', data.rejectedListings, null, 'accent-danger'),
      metric('featuredListings', data.featuredListings, null, 'accent-info'),
      metric('openReports', data.openReports, null, data.openReports ? 'accent-danger' : ''),
      metric('pendingVerifications', data.pendingVerifications, null, 'accent-warning'),
      metric('visitorsToday', data.visitorsToday),
      metric('totalViews', data.totalViews),
      metric('todayAiQueries', data.todayAiQueries, `${t('dashboard.aiQueries')}: ${num(data.aiQueries)}`),
      metric('smsToday', data.smsToday, `${t('dashboard.smsFailedToday')}: ${num(data.smsFailedToday)}`, data.smsFailedToday ? 'accent-danger' : ''),
      metric('failedLoginsToday', data.failedLoginsToday, null, data.failedLoginsToday > 20 ? 'accent-danger' : ''),
      metric('suspendedUsers', data.suspendedUsers, `${t('dashboard.pendingUsers')}: ${num(data.pendingUsers)}`),
    ]),
  );

  const chartCard = (titleKey, chart) =>
    el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, el('h2', {}, t(`dashboard.${titleKey}`))),
      el('div', { class: 'card-body' }, chart),
    ]);

  host.append(
    el('div', { class: 'grid grid-2', style: 'margin-top:14px' }, [
      chartCard('chartRegistrations', barChart(registrations.data)),
      chartCard('chartTraffic', barChart(traffic.data, { valueKey: 'visitors', secondKey: 'views' })),
      chartCard('chartDistricts', barChart(districts.data, { labelKey: 'district' })),
      chartCard('chartActivity', barChart(activity.data, { valueKey: 'info', secondKey: 'warning' })),
    ]),
  );
};

// ── Users ──────────────────────────────────────────────────────────────────
VIEWS.users = async (host, params = {}) => {
  const filters = { page: 1, pageSize: 25, ...app.filters.users, ...params };
  app.filters.users = filters;

  const card = el('div', { class: 'card' });
  const toolbar = el('div', { class: 'toolbar' });
  const body = el('div', {}, el('div', { class: 'loading' }, t('common.loading')));
  card.append(toolbar, body);
  clear(host).append(card);

  const searchInput = el('input', {
    class: 'input grow',
    type: 'search',
    placeholder: t('common.search'),
    value: filters.search || '',
  });
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(
      () => VIEWS.users(host, { search: searchInput.value, page: 1 }),
      350,
    );
  });

  const roleSelect = el('select', {
    class: 'select',
    style: 'width:auto',
    onchange: (event) => VIEWS.users(host, { role: event.target.value, page: 1 }),
  }, [
    el('option', { value: '' }, t('users.filterRole')),
    ...['STUDENT', 'OWNER', 'TENANT', 'MODERATOR', 'ADMIN'].map((role) =>
      el('option', { value: role, selected: filters.role === role }, role),
    ),
  ]);

  const statusSelect = el('select', {
    class: 'select',
    style: 'width:auto',
    onchange: (event) => VIEWS.users(host, { status: event.target.value, page: 1 }),
  }, [
    el('option', { value: '' }, t('users.filterStatus')),
    ...['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'BANNED', 'REGISTRATION_REQUIRED'].map(
      (status) => el('option', { value: status, selected: filters.status === status }, status),
    ),
  ]);

  toolbar.append(
    searchInput,
    roleSelect,
    statusSelect,
    el('button', { class: 'btn btn-secondary btn-sm', onclick: () => VIEWS.users(host, {}) },
      t('common.refresh')),
  );

  const response = await Api.users(filters);
  clear(body);

  body.append(
    dataTable({
      rows: response.data,
      columns: [
        {
          label: t('users.name'),
          render: (row) =>
            el('div', {}, [
              el('div', { style: 'font-weight:700' }, row.name),
              el('div', { class: 'mono', style: 'color:var(--subtle)' }, row.phone),
            ]),
        },
        { label: t('users.role'), render: (row) => pill(row.role, 'pill-info') },
        { label: t('users.status'), render: (row) => pill(row.status) },
        { label: t('users.trust'), render: (row) => num(row.trustScore) },
        {
          label: t('users.listings'),
          render: (row) => `${num(row.listingsCount)} / ${num(row.approvedListings)}`,
        },
        {
          label: t('users.password'),
          render: (row) =>
            row.hasPassword
              ? el('span', { class: 'pill pill-success' }, t('users.hasPassword'))
              : el('span', { class: 'pill pill-muted' }, t('users.noPassword')),
        },
        { label: t('users.lastLogin'), render: (row) => relative(row.lastLoginAt) },
        {
          label: t('common.actions'),
          cellClass: 'actions',
          render: (row) =>
            el('button', {
              class: 'btn btn-secondary btn-sm',
              onclick: () => openUserModal(row.id, host),
            }, t('common.view')),
        },
      ],
    }),
  );

  const pager = pagination(response.meta, (page) => VIEWS.users(host, { page }));
  if (pager) body.append(pager);
};

async function openUserModal(userId, host) {
  const response = await Api.user(userId);
  const user = response.data;
  const activity = response.activity || [];
  const sessions = response.sessions || [];

  const detail = (label, value) =>
    el('div', { style: 'display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid var(--line)' }, [
      el('span', { style: 'color:var(--muted);font-size:12px' }, label),
      el('span', { style: 'font-weight:600;font-size:12px;text-align:right' }, value ?? '—'),
    ]);

  const body = el('div', {}, [
    el('div', {}, [
      detail(t('users.name'), user.name),
      detail(t('users.phone'), user.phone),
      detail(t('users.role'), user.role),
      detail(t('users.status'), user.status),
      detail(t('users.trust'), num(user.trustScore)),
      detail(t('users.listings'), `${num(user.listingsCount)} (${num(user.approvedListings)})`),
      detail(t('users.registered'), dateTime(user.createdAt)),
      detail(t('users.lastLogin'), user.lastLoginAt ? dateTime(user.lastLoginAt) : t('common.never')),
      detail('IP', user.lastLoginIp || '—'),
      detail(t('users.hasPassword'), user.hasPassword ? t('common.yes') : t('common.no')),
      user.adminNote ? detail(t('users.adminNote'), user.adminNote) : null,
    ]),

    el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:14px' }, [
      user.passwordRevealable
        ? el('button', {
            class: 'btn btn-secondary btn-sm',
            onclick: () => confirmReveal(user),
          }, t('users.revealPassword'))
        : null,

      el('button', {
        class: 'btn btn-secondary btn-sm',
        onclick: () => openSetPasswordModal(user, host),
      }, t('users.resetPassword')),

      el('button', {
        class: 'btn btn-secondary btn-sm',
        onclick: () =>
          confirmDialog(t('users.revokeSessions'), t('users.revokeSessions'), async () => {
            try {
              const result = await Api.revokeSessions(user.id);
              toast(result.message || t('common.save'), 'success');
            } catch (error) {
              reportError(error);
            }
          }, { danger: false }),
      }, t('users.revokeSessions')),

      user.status === 'SUSPENDED' || user.status === 'BANNED'
        ? el('button', {
            class: 'btn btn-secondary btn-sm',
            onclick: async () => {
              try {
                await Api.updateUser(user.id, { status: 'ACTIVE' });
                toast(t('users.reactivate'), 'success');
                closeModal();
                VIEWS.users(host, {});
              } catch (error) {
                reportError(error);
              }
            },
          }, t('users.reactivate'))
        : el('button', {
            class: 'btn btn-danger btn-sm',
            onclick: () => openSuspendModal(user, host),
          }, t('users.suspend')),

      el('button', {
        class: 'btn btn-primary btn-sm',
        onclick: () => openEditUserModal(user, host),
      }, t('users.editUser')),

      app.admin?.role === 'SUPERADMIN'
        ? el('button', {
            class: 'btn btn-danger btn-sm',
            onclick: () =>
              confirmDialog(t('users.deleteUser'), t('users.deleteWarning'), async () => {
                try {
                  await Api.deleteUser(user.id);
                  toast(t('users.deleteUser'), 'success');
                  closeModal();
                  VIEWS.users(host, {});
                } catch (error) {
                  reportError(error);
                }
              }),
          }, t('common.delete'))
        : null,
    ]),

    sessions.length
      ? el('div', { style: 'margin-top:16px' }, [
          el('h3', { style: 'font-size:12px;font-weight:800;margin:0 0 6px' }, t('users.sessions')),
          ...sessions.map((session) =>
            el('div', { style: 'font-size:11px;color:var(--muted);padding:3px 0' },
              `${dateTime(session.createdAt)} · ${session.ip || '—'} · ${(session.userAgent || '').slice(0, 60)}`),
          ),
        ])
      : null,

    el('div', { style: 'margin-top:16px' }, [
      el('h3', { style: 'font-size:12px;font-weight:800;margin:0 0 6px' }, t('users.activity')),
      activity.length
        ? el('div', {}, activity.slice(0, 25).map((entry) =>
            el('div', { style: 'font-size:11px;padding:4px 0;border-bottom:1px solid var(--line)' }, [
              el('span', { class: `severity-dot sev-${entry.severity}` }),
              el('span', { style: 'color:var(--muted)' }, `${dateTime(entry.createdAt)} · `),
              el('span', { style: 'font-weight:700' }, actionLabel(entry.action)),
            ]),
          ))
        : el('p', { style: 'font-size:12px;color:var(--subtle)' }, t('common.empty')),
    ]),
  ]);

  modal({ title: user.name, body, width: 700 });
}

/**
 * Reveal a user's password.
 *
 * The confirmation closes the user modal, so the result must go into a modal
 * of its own — writing it back into the old modal's DOM meant the admin never
 * saw it while the plaintext sat in a detached node.
 *
 * The value lives only in this closure and is dropped when the modal closes.
 */
function confirmReveal(user) {
  confirmDialog(
    t('users.revealPassword'),
    t('users.revealWarning'),
    async () => {
      let result;
      try {
        result = await Api.revealPassword(user.id);
      } catch (error) {
        reportError(error);
        return;
      }

      const value = el('div', { class: 'reveal-value' }, result.password);
      modal({
        title: t('users.revealTitle'),
        width: 460,
        body: el('div', {}, [
          el('p', { style: 'margin:0 0 10px;font-size:12px;color:var(--muted)' }, user.name),
          el('div', { class: 'reveal-box' }, [
            value,
            el('button', {
              class: 'btn btn-secondary btn-sm',
              onclick: async () => {
                try {
                  await navigator.clipboard.writeText(result.password);
                  toast(t('common.copied'), 'success');
                } catch (error) {
                  toast(t('common.error'), 'error');
                }
              },
            }, t('common.copy')),
          ]),
          el('p', { style: 'margin:10px 0 0;font-size:11px;color:var(--warning)' }, result.warning),
        ]),
        actions: [
          el('button', {
            class: 'btn btn-primary',
            onclick: () => {
              // Overwrite the node before tearing the modal down, so the
              // plaintext does not linger in a detached subtree.
              value.textContent = '';
              closeModal();
            },
          }, t('common.close')),
        ],
      });
    },
    { danger: false },
  );
}



/**
 * Full user editor.
 *
 * Only fields the API actually accepts are here — offering a control the
 * backend ignores is worse than not offering it, because the change appears
 * to save. Everything is sent in one PATCH, and only the fields that were
 * actually touched, so an untouched dropdown cannot overwrite a value
 * somebody set from somewhere else.
 */
const USER_ROLES = ['STUDENT', 'TENANT', 'OWNER', 'MODERATOR', 'ADMIN', 'DEVELOPER'];
const USER_STATUSES = [
  'ACTIVE',
  'PENDING_VERIFICATION',
  'SUSPENDED',
  'BANNED',
  'REGISTRATION_REQUIRED',
];
const USER_LANGUAGES = ['uz', 'ru', 'en'];

function selectField(labelText, options, current) {
  const select = el('select', { class: 'input' });
  options.forEach((option) => {
    const node = el('option', { value: option }, option);
    if (option === current) node.selected = true;
    select.append(node);
  });
  return { node: el('label', { class: 'field' }, [el('span', {}, labelText), select]), select };
}

function openEditUserModal(user, host) {
  const name = el('input', { class: 'input', type: 'text', value: user.name || '' });
  const role = selectField(t('users.role'), USER_ROLES, user.role);
  const status = selectField(t('users.status'), USER_STATUSES, user.status);
  const language = selectField(t('users.language'), USER_LANGUAGES, user.language);

  const trust = el('input', {
    class: 'input',
    type: 'number',
    min: '0',
    max: '100',
    value: String(user.trustScore ?? 0),
  });
  const level = el('input', {
    class: 'input',
    type: 'number',
    min: '1',
    max: '5',
    value: String(user.verificationLevel ?? 1),
  });
  const verified = el('input', { type: 'checkbox' });
  verified.checked = Boolean(user.isVerified);
  const note = el('textarea', { class: 'input', rows: '3' });
  note.value = user.adminNote || '';

  modal({
    title: t('users.editUser'),
    body: el('div', {}, [
      el('label', { class: 'field' }, [el('span', {}, t('users.name')), name]),
      el('div', { class: 'field-pair' }, [role.node, status.node]),
      el('div', { class: 'field-pair' }, [
        el('label', { class: 'field' }, [el('span', {}, t('users.trust')), trust]),
        el('label', { class: 'field' }, [el('span', {}, t('users.verificationLevel')), level]),
      ]),
      language.node,
      el('label', { style: 'display:flex;gap:8px;align-items:center;font-size:12px;margin:6px 0 10px' },
        [verified, t('users.isVerified')]),
      el('label', { class: 'field' }, [el('span', {}, t('users.adminNote')), note]),
      el('p', { class: 'hint' }, t('users.editHint')),
    ]),
    actions: [
      el('button', { class: 'btn btn-secondary', onclick: closeModal }, t('common.cancel')),
      el('button', {
        class: 'btn btn-primary',
        onclick: async () => {
          // Send only what changed: a PATCH that repeats every current value
          // would quietly clobber an edit someone else made in between.
          const changes = {};
          if (name.value.trim() !== (user.name || '')) changes.name = name.value.trim();
          if (role.select.value !== user.role) changes.role = role.select.value;
          if (status.select.value !== user.status) changes.status = status.select.value;
          if (language.select.value !== user.language) changes.language = language.select.value;
          if (Number(trust.value) !== Number(user.trustScore ?? 0)) {
            changes.trustScore = Number(trust.value);
          }
          if (Number(level.value) !== Number(user.verificationLevel ?? 1)) {
            changes.verificationLevel = Number(level.value);
          }
          if (verified.checked !== Boolean(user.isVerified)) {
            changes.isVerified = verified.checked;
          }
          if (note.value !== (user.adminNote || '')) changes.adminNote = note.value;

          if (Object.keys(changes).length === 0) {
            closeModal();
            return;
          }
          try {
            await Api.updateUser(user.id, changes);
            toast(t('common.save'), 'success');
            closeModal();
            VIEWS.users(host, {});
          } catch (error) {
            reportError(error);
          }
        },
      }, t('common.save')),
    ],
  });
}

function openSetPasswordModal(user, host) {
  const input = el('input', { class: 'input', type: 'text', minlength: '8' });
  const mustChange = el('input', { type: 'checkbox', checked: true });
  const revoke = el('input', { type: 'checkbox', checked: true });

  modal({
    title: t('users.resetPassword'),
    body: el('div', {}, [
      el('label', { class: 'field' }, [el('span', {}, t('users.newPassword')), input]),
      el('label', { style: 'display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:6px' },
        [mustChange, t('users.mustChange')]),
      el('label', { style: 'display:flex;gap:8px;align-items:center;font-size:12px' },
        [revoke, t('users.revokeOnReset')]),
    ]),
    actions: [
      el('button', { class: 'btn btn-secondary', onclick: closeModal }, t('common.cancel')),
      el('button', {
        class: 'btn btn-primary',
        onclick: async () => {
          try {
            await Api.setUserPassword(user.id, {
              newPassword: input.value,
              mustChange: mustChange.checked,
              revokeSessions: revoke.checked,
            });
            toast(t('common.save'), 'success');
            closeModal();
            VIEWS.users(host, {});
          } catch (error) {
            reportError(error);
          }
        },
      }, t('common.save')),
    ],
  });
}

function openSuspendModal(user, host) {
  const reason = el('input', { class: 'input' });
  modal({
    title: t('users.suspend'),
    body: el('label', { class: 'field' }, [el('span', {}, t('users.suspendReason')), reason]),
    actions: [
      el('button', { class: 'btn btn-secondary', onclick: closeModal }, t('common.cancel')),
      el('button', {
        class: 'btn btn-danger',
        onclick: async () => {
          try {
            await Api.updateUser(user.id, {
              status: 'SUSPENDED',
              suspendedReason: reason.value || undefined,
            });
            toast(t('users.suspend'), 'success');
            closeModal();
            VIEWS.users(host, {});
          } catch (error) {
            reportError(error);
          }
        },
      }, t('common.confirm')),
    ],
  });
}

// ── Listings ───────────────────────────────────────────────────────────────
VIEWS.listings = async (host, params = {}) => {
  const filters = { page: 1, pageSize: 25, ...app.filters.listings, ...params };
  app.filters.listings = filters;

  const card = el('div', { class: 'card' });
  const toolbar = el('div', { class: 'toolbar' });
  const body = el('div', {}, el('div', { class: 'loading' }, t('common.loading')));
  card.append(toolbar, body);
  clear(host).append(card);

  const search = el('input', {
    class: 'input grow',
    type: 'search',
    placeholder: t('common.search'),
    value: filters.search || '',
  });
  let timer = null;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => VIEWS.listings(host, { search: search.value, page: 1 }), 350);
  });

  toolbar.append(
    search,
    el('select', {
      class: 'select', style: 'width:auto',
      onchange: (event) => VIEWS.listings(host, { status: event.target.value, page: 1 }),
    }, [
      el('option', { value: '' }, t('listings.filterStatus')),
      ...['PENDING', 'APPROVED', 'WARNING', 'REJECTED', 'UNDER_REVIEW', 'ARCHIVED'].map((status) =>
        el('option', { value: status, selected: filters.status === status }, status),
      ),
    ]),
    el('select', {
      class: 'select', style: 'width:auto',
      onchange: (event) => VIEWS.listings(host, { sortBy: event.target.value, page: 1 }),
    }, ['NEWEST', 'RISK', 'VIEWS', 'PRICE_HIGH', 'PRICE_LOW', 'OLDEST'].map((sort) =>
      el('option', { value: sort, selected: filters.sortBy === sort }, sort),
    )),
    el('button', { class: 'btn btn-secondary btn-sm', onclick: () => VIEWS.listings(host, {}) },
      t('common.refresh')),
  );

  const response = await Api.listings(filters);
  clear(body);

  body.append(
    dataTable({
      rows: response.data,
      columns: [
        {
          label: t('listings.listing'),
          render: (row) =>
            el('div', { style: 'max-width:320px' }, [
              el('div', { style: 'font-weight:700' }, row.title),
              el('div', { style: 'font-size:11px;color:var(--subtle)' },
                `${row.district || '—'} · ${row.rooms} · ${money(row.price)}`),
              row.isFeatured ? el('span', { class: 'pill pill-warning' }, '★') : null,
            ]),
        },
        {
          label: t('listings.owner'),
          render: (row) =>
            el('div', {}, [
              el('div', { style: 'font-size:12px' }, row.ownerName || '—'),
              el('div', { class: 'mono', style: 'color:var(--subtle)' }, row.ownerPhone || ''),
            ]),
        },
        { label: t('listings.status'), render: (row) => pill(row.status) },
        {
          label: t('listings.risk'),
          render: (row) =>
            el('span', {
              class: `pill ${row.riskScore >= 70 ? 'pill-danger' : row.riskScore >= 40 ? 'pill-warning' : 'pill-success'}`,
            }, String(row.riskScore)),
        },
        { label: t('listings.views'), render: (row) => num(row.viewsCount) },
        {
          label: t('listings.reports'),
          render: (row) =>
            row.reportCount
              ? el('span', { class: 'pill pill-danger' }, String(row.reportCount))
              : '—',
        },
        { label: t('listings.created'), render: (row) => dateOnly(row.createdAt) },
        {
          label: t('common.actions'),
          cellClass: 'actions',
          render: (row) =>
            el('button', {
              class: 'btn btn-secondary btn-sm',
              onclick: () => openListingModal(row, host),
            }, t('common.view')),
        },
      ],
    }),
  );

  const pager = pagination(response.meta, (page) => VIEWS.listings(host, { page }));
  if (pager) body.append(pager);
};

function openListingModal(listing, host) {
  const note = el('input', { class: 'input', value: listing.moderationNote || '' });

  const act = async (fn, message) => {
    try {
      await fn();
      toast(message, 'success');
      closeModal();
      VIEWS.listings(host, {});
    } catch (error) {
      reportError(error);
    }
  };

  modal({
    title: listing.title,
    width: 700,
    body: el('div', {}, [
      listing.images?.length
        ? el('div', { style: 'display:flex;gap:6px;overflow-x:auto;margin-bottom:12px' },
            listing.images.slice(0, 6).map((src) =>
              el('img', {
                src, alt: '', loading: 'lazy',
                style: 'height:90px;border-radius:8px;object-fit:cover',
              })))
        : null,
      el('p', { style: 'font-size:13px;color:var(--muted);white-space:pre-wrap' },
        listing.description),
      el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin:12px 0' }, [
        pill(listing.status),
        el('span', { class: 'pill pill-info' }, `${t('listings.risk')}: ${listing.riskScore}`),
        el('span', { class: 'pill pill-muted' }, money(listing.price)),
        el('span', { class: 'pill pill-muted' }, listing.district || '—'),
      ]),
      listing.aiRiskReasons?.length
        ? el('div', { class: 'alert alert-warning' }, [
            el('strong', {}, `${t('listings.aiReasons')}: `),
            listing.aiRiskReasons.join(' · '),
          ])
        : null,
      el('label', { class: 'field' }, [el('span', {}, t('listings.moderationNote')), note]),
    ]),
    actions: [
      el('button', {
        class: 'btn btn-secondary',
        onclick: () => act(
          () => Api.featureListing(listing.id, {
            isFeatured: !listing.isFeatured, days: 7, promotionWeight: 10,
          }),
          listing.isFeatured ? t('listings.unfeature') : t('listings.feature'),
        ),
      }, listing.isFeatured ? t('listings.unfeature') : t('listings.feature')),
      el('button', {
        class: 'btn btn-danger',
        onclick: () => act(
          () => Api.moderateListing(listing.id, { status: 'REJECTED', note: note.value }),
          t('listings.reject'),
        ),
      }, t('listings.reject')),
      el('button', {
        class: 'btn btn-primary',
        onclick: () => act(
          () => Api.moderateListing(listing.id, { status: 'APPROVED', note: note.value }),
          t('listings.approve'),
        ),
      }, t('listings.approve')),
    ],
  });
}

// ── Audit ──────────────────────────────────────────────────────────────────
VIEWS.audit = async (host, params = {}) => {
  const filters = { page: 1, pageSize: 40, ...app.filters.audit, ...params };
  app.filters.audit = filters;

  const card = el('div', { class: 'card' });
  const toolbar = el('div', { class: 'toolbar' });
  const body = el('div', {}, el('div', { class: 'loading' }, t('common.loading')));
  card.append(
    el('div', { class: 'card-head' }, [
      el('h2', {}, t('audit.title')),
      el('span', { style: 'font-size:11px;color:var(--subtle)' }, t('audit.subtitle')),
    ]),
    toolbar,
    body,
  );
  clear(host).append(card);

  const search = el('input', {
    class: 'input grow', type: 'search',
    placeholder: t('common.search'), value: filters.search || '',
  });
  let timer = null;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => VIEWS.audit(host, { search: search.value, page: 1 }), 350);
  });

  toolbar.append(
    search,
    el('select', {
      class: 'select', style: 'width:auto',
      onchange: (event) => VIEWS.audit(host, { actionGroup: event.target.value, page: 1 }),
    }, [
      el('option', { value: '' }, t('audit.filterGroup')),
      ...['auth', 'user', 'listing', 'admin', 'ai', 'sms', 'security'].map((group) =>
        el('option', { value: group, selected: filters.actionGroup === group },
          t(`audit.groups.${group}`)),
      ),
    ]),
    el('select', {
      class: 'select', style: 'width:auto',
      onchange: (event) => VIEWS.audit(host, { severity: event.target.value, page: 1 }),
    }, [
      el('option', { value: '' }, t('audit.filterSeverity')),
      ...['INFO', 'NOTICE', 'WARNING', 'CRITICAL'].map((severity) =>
        el('option', { value: severity, selected: filters.severity === severity }, severity),
      ),
    ]),
    el('select', {
      class: 'select', style: 'width:auto',
      onchange: (event) => VIEWS.audit(host, { actorType: event.target.value, page: 1 }),
    }, [
      el('option', { value: '' }, t('audit.filterActor')),
      ...['USER', 'ADMIN', 'SYSTEM', 'ANONYMOUS'].map((actor) =>
        el('option', { value: actor, selected: filters.actorType === actor }, actor),
      ),
    ]),
    el('button', { class: 'btn btn-secondary btn-sm', onclick: () => VIEWS.audit(host, {}) },
      t('common.refresh')),
  );

  const response = await Api.audit(filters);
  clear(body);

  body.append(
    dataTable({
      rows: response.data,
      columns: [
        {
          label: t('audit.time'),
          render: (row) =>
            el('div', {}, [
              el('div', { style: 'font-size:12px;font-weight:600' }, dateTime(row.createdAt)),
              el('div', { style: 'font-size:10px;color:var(--subtle)' }, relative(row.createdAt)),
            ]),
        },
        {
          label: t('audit.action'),
          render: (row) =>
            el('div', {}, [
              el('span', { class: `severity-dot sev-${row.severity}` }),
              el('span', { style: 'font-weight:700;font-size:12px' }, actionLabel(row.action)),
              el('div', { class: 'mono', style: 'color:var(--subtle);font-size:10px' }, row.action),
            ]),
        },
        {
          label: t('audit.actor'),
          render: (row) =>
            el('div', {}, [
              el('div', { style: 'font-size:12px' }, row.actorLabel || '—'),
              el('div', { style: 'font-size:10px;color:var(--subtle)' }, row.actorType),
            ]),
        },
        {
          label: t('audit.entity'),
          render: (row) =>
            el('div', { style: 'max-width:220px' }, [
              el('div', { style: 'font-size:12px' }, row.entityLabel || row.entityType || '—'),
              row.summary
                ? el('div', { style: 'font-size:10px;color:var(--subtle)' }, row.summary.slice(0, 90))
                : null,
            ]),
        },
        { label: t('audit.ip'), cellClass: 'mono', render: (row) => row.ip || '—' },
        {
          label: t('audit.details'),
          render: (row) =>
            row.changes || row.meta
              ? el('details', { class: 'changes' }, [
                  el('summary', {}, t('audit.changes')),
                  el('pre', {}, JSON.stringify(row.changes || row.meta, null, 1)),
                ])
              : '—',
        },
      ],
    }),
  );

  const pager = pagination(response.meta, (page) => VIEWS.audit(host, { page }));
  if (pager) body.append(pager);
};

// ── Reports ────────────────────────────────────────────────────────────────
VIEWS.reports = async (host, params = {}) => {
  const filters = { page: 1, pageSize: 25, ...app.filters.reports, ...params };
  app.filters.reports = filters;
  clear(host).append(el('div', { class: 'loading' }, t('common.loading')));

  const response = await Api.reports(filters);
  const card = el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, el('h2', {}, t('reports.title'))),
    dataTable({
      rows: response.data,
      columns: [
        { label: t('listings.listing'), render: (row) => row.listingTitle || '—' },
        { label: t('reports.reason'), render: (row) => pill(row.reason, 'pill-danger') },
        { label: t('reports.reporter'), render: (row) => row.reporterLabel || '—' },
        { label: t('reports.priority'), render: (row) => pill(row.priority, 'pill-warning') },
        { label: t('users.status'), render: (row) => pill(row.status) },
        { label: t('listings.created'), render: (row) => dateOnly(row.createdAt) },
        {
          label: t('common.actions'),
          cellClass: 'actions',
          render: (row) =>
            row.status === 'OPEN' || row.status === 'UNDER_REVIEW'
              ? el('button', {
                  class: 'btn btn-primary btn-sm',
                  onclick: () => openResolveReportModal(row, host),
                }, t('reports.resolve'))
              : '—',
        },
      ],
    }),
  ]);
  clear(host).append(card);
  const pager = pagination(response.meta, (page) => VIEWS.reports(host, { page }));
  if (pager) card.append(pager);
};

function openResolveReportModal(report, host) {
  const note = el('input', { class: 'input' });
  const action = el('select', { class: 'select' }, [
    el('option', { value: 'NONE' }, t('reports.actionNone')),
    el('option', { value: 'APPROVE' }, t('reports.actionApprove')),
    el('option', { value: 'REJECT' }, t('reports.actionReject')),
    el('option', { value: 'DELETE' }, t('reports.actionDelete')),
  ]);

  modal({
    title: t('reports.resolve'),
    body: el('div', {}, [
      el('p', { style: 'font-size:13px;color:var(--muted)' }, report.description || '—'),
      el('label', { class: 'field' }, [el('span', {}, t('reports.note')), note]),
      el('label', { class: 'field' }, [el('span', {}, t('reports.listingAction')), action]),
    ]),
    actions: [
      el('button', { class: 'btn btn-secondary', onclick: closeModal }, t('common.cancel')),
      el('button', {
        class: 'btn btn-primary',
        onclick: async () => {
          try {
            await Api.resolveReport(report.id, {
              status: 'RESOLVED',
              note: note.value || undefined,
              listingAction: action.value,
            });
            toast(t('reports.resolve'), 'success');
            closeModal();
            VIEWS.reports(host, {});
          } catch (error) {
            reportError(error);
          }
        },
      }, t('common.confirm')),
    ],
  });
}

// ── Verifications ──────────────────────────────────────────────────────────
VIEWS.verifications = async (host, params = {}) => {
  const filters = { page: 1, pageSize: 25, ...app.filters.verifications, ...params };
  app.filters.verifications = filters;
  clear(host).append(el('div', { class: 'loading' }, t('common.loading')));

  const response = await Api.verifications(filters);
  const card = el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, el('h2', {}, t('verifications.title'))),
    dataTable({
      rows: response.data,
      columns: [
        {
          label: t('verifications.user'),
          render: (row) =>
            el('div', {}, [
              el('div', { style: 'font-weight:700' }, row.userName || '—'),
              el('div', { class: 'mono', style: 'color:var(--subtle)' }, row.userPhone || ''),
            ]),
        },
        { label: t('verifications.level'), render: (row) => `L${row.targetLevel}` },
        { label: t('verifications.document'), render: (row) => pill(row.documentType, 'pill-info') },
        { label: t('users.status'), render: (row) => pill(row.status) },
        { label: t('listings.created'), render: (row) => dateOnly(row.createdAt) },
        {
          label: t('common.actions'),
          cellClass: 'actions',
          render: (row) =>
            row.status === 'PENDING'
              ? el('div', { style: 'display:flex;gap:5px;justify-content:flex-end' }, [
                  el('button', {
                    class: 'btn btn-primary btn-sm',
                    onclick: async () => {
                      try {
                        await Api.reviewVerification(row.id, { status: 'APPROVED' });
                        toast(t('verifications.approve'), 'success');
                        VIEWS.verifications(host, {});
                      } catch (error) {
                        reportError(error);
                      }
                    },
                  }, t('verifications.approve')),
                  el('button', {
                    class: 'btn btn-danger btn-sm',
                    onclick: async () => {
                      const reason = prompt(t('verifications.rejectionReason'));
                      if (reason === null) return;
                      try {
                        await Api.reviewVerification(row.id, {
                          status: 'REJECTED',
                          rejectionReason: reason || undefined,
                        });
                        toast(t('verifications.reject'), 'success');
                        VIEWS.verifications(host, {});
                      } catch (error) {
                        reportError(error);
                      }
                    },
                  }, t('verifications.reject')),
                ])
              : '—',
        },
      ],
    }),
  ]);
  clear(host).append(card);
  const pager = pagination(response.meta, (page) => VIEWS.verifications(host, { page }));
  if (pager) card.append(pager);
};

// ── Shield AI ──────────────────────────────────────────────────────────────
VIEWS.ai = async (host, params = {}) => {
  const filters = { page: 1, pageSize: 25, ...app.filters.ai, ...params };
  app.filters.ai = filters;
  clear(host).append(el('div', { class: 'loading' }, t('common.loading')));

  const response = await Api.aiSessions(filters);
  const card = el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, el('h2', {}, t('ai.title'))),
    dataTable({
      rows: response.data,
      columns: [
        {
          label: t('ai.user'),
          render: (row) => row.userName || row.guestLabel || t('common.unknown'),
        },
        { label: t('ai.messages'), render: (row) => num(row.messageCount) },
        {
          label: t('ai.intent'),
          render: (row) =>
            row.lastIntent
              ? el('span', { style: 'font-size:11px' },
                  [row.lastIntent.district, row.lastIntent.rooms, row.lastIntent.maxPrice]
                    .filter(Boolean).join(' · '))
              : '—',
        },
        {
          label: t('ai.summary'),
          render: (row) =>
            el('span', { style: 'font-size:11px;color:var(--muted)' },
              (row.summary || '').slice(0, 80) || '—'),
        },
        {
          label: t('users.status'),
          render: (row) =>
            row.closedAt
              ? el('span', { class: 'pill pill-muted' }, t('ai.closed'))
              : el('span', { class: 'pill pill-success' }, t('ai.open')),
        },
        { label: t('listings.created'), render: (row) => dateTime(row.createdAt) },
        {
          label: t('common.actions'),
          cellClass: 'actions',
          render: (row) =>
            el('button', {
              class: 'btn btn-secondary btn-sm',
              onclick: async () => {
                try {
                  const messages = await Api.aiMessages(row.id);
                  modal({
                    title: t('ai.viewChat'),
                    width: 640,
                    body: el('div', {},
                      (messages.data || []).map((message) =>
                        el('div', {
                          style: `margin-bottom:8px;padding:8px 10px;border-radius:8px;background:${
                            message.role === 'user' ? 'var(--surface-2)' : 'var(--brand-soft)'
                          }`,
                        }, [
                          el('div', { style: 'font-size:10px;font-weight:800;color:var(--subtle)' },
                            `${message.role} · ${dateTime(message.createdAt)}`),
                          el('div', { style: 'font-size:12px;white-space:pre-wrap' },
                            message.content),
                        ]))),
                  });
                } catch (error) {
                  reportError(error);
                }
              },
            }, t('common.view')),
        },
      ],
    }),
  ]);
  clear(host).append(card);
  const pager = pagination(response.meta, (page) => VIEWS.ai(host, { page }));
  if (pager) card.append(pager);
};

// ── SMS ────────────────────────────────────────────────────────────────────
VIEWS.sms = async (host, params = {}) => {
  const filters = { page: 1, pageSize: 30, ...app.filters.sms, ...params };
  app.filters.sms = filters;
  clear(host).append(el('div', { class: 'loading' }, t('common.loading')));

  const response = await Api.sms(filters);
  const card = el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, t('sms.title')),
      el('span', { style: 'font-size:11px;color:var(--subtle)' }, t('sms.note')),
    ]),
    dataTable({
      rows: response.data,
      columns: [
        { label: t('sms.phone'), cellClass: 'mono', render: (row) => row.phone },
        { label: t('sms.purpose'), render: (row) => pill(row.purpose, 'pill-info') },
        { label: t('sms.status'), render: (row) => pill(row.status) },
        { label: t('sms.provider'), render: (row) => row.provider },
        { label: t('sms.parts'), render: (row) => num(row.parts) },
        {
          label: t('sms.error'),
          render: (row) =>
            row.error
              ? el('span', { style: 'font-size:11px;color:var(--danger)' }, row.error.slice(0, 60))
              : '—',
        },
        { label: t('audit.time'), render: (row) => dateTime(row.createdAt) },
      ],
    }),
  ]);
  clear(host).append(card);
  const pager = pagination(response.meta, (page) => VIEWS.sms(host, { page }));
  if (pager) card.append(pager);
};

// ── Security ───────────────────────────────────────────────────────────────
VIEWS.security = async (host, params = {}) => {
  const filters = { page: 1, pageSize: 40, ...app.filters.security, ...params };
  app.filters.security = filters;
  clear(host).append(el('div', { class: 'loading' }, t('common.loading')));

  const response = await Api.loginAttempts(filters);
  const onlyFailed = el('input', {
    type: 'checkbox',
    checked: Boolean(filters.onlyFailed),
    onchange: (event) => VIEWS.security(host, { onlyFailed: event.target.checked, page: 1 }),
  });

  const card = el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, t('security.loginAttempts')),
      el('label', { style: 'margin-left:auto;display:flex;gap:6px;align-items:center;font-size:12px' },
        [onlyFailed, t('security.onlyFailed')]),
    ]),
    dataTable({
      rows: response.data,
      columns: [
        { label: t('audit.time'), render: (row) => dateTime(row.createdAt) },
        {
          label: t('security.account'),
          cellClass: 'mono',
          render: (row) => row.phone || row.username || '—',
        },
        {
          label: t('security.portal'),
          render: (row) =>
            el('span', { class: 'pill pill-muted' },
              row.isAdminPortal ? t('security.adminPortal') : t('security.userPortal')),
        },
        {
          label: t('security.result'),
          render: (row) =>
            row.successful
              ? el('span', { class: 'pill pill-success' }, t('security.success'))
              : el('span', { class: 'pill pill-danger' }, t('security.failure')),
        },
        { label: t('security.reason'), render: (row) => row.failureReason || '—' },
        { label: t('audit.ip'), cellClass: 'mono', render: (row) => row.ip || '—' },
        {
          label: 'User agent',
          render: (row) =>
            el('span', { style: 'font-size:10px;color:var(--subtle)' },
              (row.userAgent || '').slice(0, 50)),
        },
      ],
    }),
  ]);
  clear(host).append(card);
  const pager = pagination(response.meta, (page) => VIEWS.security(host, { page }));
  if (pager) card.append(pager);
};

// ── Staff ──────────────────────────────────────────────────────────────────
VIEWS.staff = async (host) => {
  clear(host).append(el('div', { class: 'loading' }, t('common.loading')));
  const response = await Api.staff();

  const card = el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, t('staff.title')),
      el('button', {
        class: 'btn btn-primary btn-sm',
        style: 'margin-left:auto',
        onclick: () => openCreateStaffModal(host),
      }, t('staff.create')),
    ]),
    dataTable({
      rows: response.data,
      columns: [
        { label: t('staff.username'), cellClass: 'mono', render: (row) => row.username },
        { label: t('staff.fullName'), render: (row) => row.fullName },
        { label: t('staff.role'), render: (row) => pill(row.role, 'pill-info') },
        {
          label: t('staff.active'),
          render: (row) =>
            row.isActive
              ? el('span', { class: 'pill pill-success' }, t('common.yes'))
              : el('span', { class: 'pill pill-danger' }, t('common.no')),
        },
        { label: t('staff.lastLogin'), render: (row) => relative(row.lastLoginAt) },
        { label: t('staff.ipAllowlist'), cellClass: 'mono', render: (row) => row.ipAllowlist || '—' },
        {
          label: t('common.actions'),
          cellClass: 'actions',
          render: (row) =>
            row.id === app.admin?.id
              ? '—'
              : el('button', {
                  class: `btn btn-sm ${row.isActive ? 'btn-danger' : 'btn-secondary'}`,
                  onclick: async () => {
                    try {
                      await Api.toggleStaff(row.id, !row.isActive);
                      toast(t('common.save'), 'success');
                      VIEWS.staff(host);
                    } catch (error) {
                      reportError(error);
                    }
                  },
                }, row.isActive ? t('staff.disable') : t('staff.enable')),
        },
      ],
    }),
  ]);
  clear(host).append(card);
};

function openCreateStaffModal(host) {
  const username = el('input', { class: 'input' });
  const fullName = el('input', { class: 'input' });
  const password = el('input', { class: 'input', type: 'text', minlength: '12' });
  const role = el('select', { class: 'select' },
    ['MODERATOR', 'ADMIN', 'SUPERADMIN'].map((value) => el('option', { value }, value)));
  const ipAllowlist = el('input', { class: 'input', placeholder: '203.0.113.0/24' });

  modal({
    title: t('staff.create'),
    body: el('div', {}, [
      el('label', { class: 'field' }, [el('span', {}, t('staff.username')), username]),
      el('label', { class: 'field' }, [el('span', {}, t('staff.fullName')), fullName]),
      el('label', { class: 'field' }, [el('span', {}, t('login.password')), password]),
      el('label', { class: 'field' }, [el('span', {}, t('staff.role')), role]),
      el('label', { class: 'field' }, [el('span', {}, t('staff.ipAllowlist')), ipAllowlist]),
    ]),
    actions: [
      el('button', { class: 'btn btn-secondary', onclick: closeModal }, t('common.cancel')),
      el('button', {
        class: 'btn btn-primary',
        onclick: async () => {
          try {
            await Api.createStaff({
              username: username.value.trim().toLowerCase(),
              fullName: fullName.value.trim(),
              password: password.value,
              role: role.value,
              ipAllowlist: ipAllowlist.value.trim() || undefined,
            });
            toast(t('common.save'), 'success');
            closeModal();
            VIEWS.staff(host);
          } catch (error) {
            reportError(error);
          }
        },
      }, t('common.save')),
    ],
  });
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const NAV = [
  { group: 'overview', items: [{ id: 'dashboard', icon: '▤' }] },
  {
    group: 'moderation',
    items: [
      { id: 'listings', icon: '🏠' },
      { id: 'reports', icon: '⚑' },
      { id: 'verifications', icon: '✓' },
    ],
  },
  { group: 'people', items: [{ id: 'users', icon: '👤' }, { id: 'staff', icon: '🛡', minRole: 'SUPERADMIN' }] },
  {
    group: 'system',
    items: [
      { id: 'audit', icon: '≡' },
      // The server requires ADMIN for these two; showing them to a MODERATOR
      // only produced a 403 they could do nothing about.
      { id: 'security', icon: '🔒', minRole: 'ADMIN' },
      { id: 'ai', icon: '✦' },
      { id: 'sms', icon: '✉', minRole: 'ADMIN' },
    ],
  },
];

const ROLE_RANK = { MODERATOR: 1, ADMIN: 2, SUPERADMIN: 3 };

function canSee(item) {
  if (!item.minRole) return true;
  return (ROLE_RANK[app.admin?.role] || 0) >= ROLE_RANK[item.minRole];
}

function renderNav() {
  const nav = clear($('#sidebarNav'));
  NAV.forEach((section) => {
    const items = section.items.filter(canSee);
    if (!items.length) return;
    nav.append(el('div', { class: 'nav-group-label' }, t(`nav.${section.group}`)));
    items.forEach((item) => {
      nav.append(
        el('button', {
          class: 'nav-item',
          'aria-current': app.view === item.id ? 'page' : undefined,
          onclick: () => navigate(item.id),
        }, [el('span', { 'aria-hidden': 'true' }, item.icon), t(`nav.${item.id}`)]),
      );
    });
  });
}

async function navigate(view) {
  app.view = view;
  renderNav();
  $('#viewTitle').textContent = t(`nav.${view}`);
  $('.sidebar')?.classList.remove('open');
  const host = clear($('#viewHost'));
  try {
    await VIEWS[view](host, {});
  } catch (error) {
    clear(host).append(
      el('div', { class: 'card' }, el('div', { class: 'empty' }, [
        el('p', {}, error instanceof ApiError ? error.message || error.code : t('common.error')),
        el('button', {
          class: 'btn btn-secondary btn-sm',
          onclick: () => navigate(view),
        }, t('common.refresh')),
      ])),
    );
    if (!(error instanceof ApiError) || error.status !== 401) console.error(error);
  }
}

// ---------------------------------------------------------------------------
// Auth screens
// ---------------------------------------------------------------------------
function showLogin(message) {
  $('#shell').classList.add('hidden');
  const screen = $('#loginScreen');
  screen.classList.remove('hidden');
  if (message) {
    const box = $('#loginError');
    box.textContent = message;
    box.classList.remove('hidden');
  }
  $('#loginUsername')?.focus();
}

async function showApp() {
  $('#loginScreen').classList.add('hidden');
  $('#shell').classList.remove('hidden');
  $('#adminName').textContent = app.admin?.fullName || '';
  $('#adminRole').textContent = app.admin?.role || '';
  renderNav();
  await navigate('dashboard');
}

async function handleLogin(event) {
  event.preventDefault();
  const button = $('#loginSubmit');
  const errorBox = $('#loginError');
  errorBox.classList.add('hidden');
  button.disabled = true;
  button.textContent = t('login.submitting');

  try {
    const result = await Api.login($('#loginUsername').value.trim(), $('#loginPassword').value);
    tokens.save(result.accessToken, result.refreshToken);
    app.admin = result.admin;
    $('#loginPassword').value = '';
    await showApp();
  } catch (error) {
    const message =
      error instanceof ApiError && error.message ? error.message : t('login.failed');
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  } finally {
    button.disabled = false;
    button.textContent = t('login.submit');
  }
}

async function bootstrap() {
  if (!tokens.access) {
    showLogin();
    return;
  }
  try {
    const me = await Api.me();
    app.admin = me.data;
    await showApp();
  } catch (error) {
    tokens.clear();
    showLogin();
  }
}

// ---------------------------------------------------------------------------
// Static text
// ---------------------------------------------------------------------------
function applyStaticText() {
  document.title = `${t('app.title')} — ${t('app.subtitle')}`;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-label]').forEach((node) => {
    node.setAttribute('aria-label', t(node.dataset.i18nLabel));
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
function init() {
  initTheme();
  applyStaticText();

  setUnauthorizedHandler(() => {
    app.admin = null;
    showLogin(t('login.failed'));
  });

  $('#loginForm').addEventListener('submit', handleLogin);

  $('#logoutBtn').addEventListener('click', async () => {
    try {
      await Api.logout();
    } catch (error) {
      /* signing out locally must work regardless */
    }
    tokens.clear();
    app.admin = null;
    showLogin();
  });

  $('#themeBtn').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  const languageSelect = $('#languageSelect');
  Object.keys(DICTIONARIES).forEach((code) => {
    languageSelect.append(
      el('option', { value: code, selected: code === i18nState.language }, code.toUpperCase()),
    );
  });
  languageSelect.addEventListener('change', async (event) => {
    setLanguage(event.target.value);
    applyStaticText();
    if (app.admin) {
      renderNav();
      await navigate(app.view);
    }
  });

  $('#sidebarToggle').addEventListener('click', () => {
    $('.sidebar').classList.toggle('open');
  });

  document.documentElement.lang = i18nState.language;
  bootstrap();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
