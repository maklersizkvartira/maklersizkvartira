'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Game2048 } from '@/features/game/Game2048';
import { Sparkles, Gamepad2 } from 'lucide-react';

export default function GamePage() {
  const t = useTranslations('nav');

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="2048: Uyiz Imperiyasi"
        subtitle="Adminlar uchun aqlli va qiziqarli ko‘chmas mulk strategik o‘yini. Bloklarni birlashtirib, eng yuqori cho‘qqiga chiqing!"
        eyebrow={
          <div className="flex items-center gap-1 text-brand">
            <Gamepad2 size={13} />
            <span>Tanaffus va Dam Olish</span>
          </div>
        }
      />

      <Game2048 />
    </div>
  );
}
