'use client';

/**
 * A page's own header, which disappears when the page is mounted as a hub
 * tab — the hub already drew one. The actions survive either way: a
 * "refresh" or "create" button belongs to the tab body, not the heading,
 * so when the heading goes the buttons move to a right-aligned row above
 * the content instead of vanishing with it.
 */

import React from 'react';

import { PageHeader } from '@/shared/ui/PageHeader';

interface SectionHeaderProps {
  embedded?: boolean;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}

export function SectionHeader({ embedded, title, subtitle, actions, icon }: SectionHeaderProps) {
  if (embedded) {
    return actions ? <div className="mb-4 flex flex-wrap justify-end gap-2">{actions}</div> : null;
  }
  return <PageHeader title={title} subtitle={subtitle} actions={actions} icon={icon} />;
}

export default SectionHeader;
