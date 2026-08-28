'use client';

import { Fragment, type ReactNode } from 'react';

/**
 * `changes` and `meta` on an audit row are free-form JSON whose shape varies
 * per action, so there is no schema to render against — only the value itself.
 *
 * Rendering it raw is safe: the backend redacts every secret to the literal
 * string '[redacted]' before the row is written, so nothing reaches this
 * component that was not already cleared for a human to read.
 *
 * `JSON.stringify` with an indent would also be honest, but a diff like
 * `{"status": {"from": "PENDING", "to": "APPROVED"}}` is what most rows carry,
 * and a key/value tree reads that at a glance where a wall of braces does not.
 */

/** Depth at which nesting stops earning its indent and the subtree is printed
 *  as compact JSON instead. Real audit payloads are one or two levels deep. */
const MAX_DEPTH = 4;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function Scalar({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
  }
  if (typeof value === 'boolean') {
    return (
      <span style={{ color: value ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
        {String(value)}
      </span>
    );
  }
  if (typeof value === 'number') {
    return <span style={{ color: 'var(--chart-3)' }}>{value}</span>;
  }
  const text = String(value);
  // The backend's own redaction marker, called out so nobody reads it as data.
  if (text === '[redacted]') {
    return (
      <span className="font-semibold" style={{ color: 'var(--color-warning)' }}>
        {text}
      </span>
    );
  }
  return <span style={{ color: 'var(--color-text-primary)' }}>{text}</span>;
}

function Node({ value, depth }: { value: unknown; depth: number }): ReactNode {
  if (depth >= MAX_DEPTH && (isPlainObject(value) || Array.isArray(value))) {
    return (
      <span className="font-mono text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
        {JSON.stringify(value)}
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
    }
    return (
      <ul className="flex flex-col gap-1">
        {value.map((entry, index) => (
          <li key={index} className="flex gap-2 min-w-0">
            <span className="shrink-0 font-mono text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {index}
            </span>
            <div className="min-w-0 flex-1">
              <Node value={entry} depth={depth + 1} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
    }
    return (
      <dl className="flex flex-col gap-1.5">
        {entries.map(([key, entry]) => (
          <Fragment key={key}>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 min-w-0">
              <dt
                className="shrink-0 font-mono text-[11px] sm:min-w-[9rem] sm:text-right"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {key}
              </dt>
              <dd className="min-w-0 flex-1 text-[13px] break-words">
                <Node value={entry} depth={depth + 1} />
              </dd>
            </div>
          </Fragment>
        ))}
      </dl>
    );
  }

  return <Scalar value={value} />;
}

export function JsonTree({ value }: { value: unknown }) {
  return (
    <div
      className="rounded-[var(--radius-md)] px-3 py-2.5 overflow-x-auto"
      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
    >
      <Node value={value} depth={0} />
    </div>
  );
}
