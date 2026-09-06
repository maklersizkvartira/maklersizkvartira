import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_2FA_BOT_TOKEN || '8891827398:AAHC5Yp7J9hFRMWUVIBo5BSaHTjEOvaK_3M';
const TARGET_CHANNEL_ID = process.env.TELEGRAM_2FA_CHANNEL_ID || process.env.TELEGRAM_ADMIN_CHANNEL_ID || '-1004486550551';
const SECRET_KEY = process.env.SECRET_KEY || 'uyiz-admin-2fa-super-secret-key-2026';

export async function POST(req: NextRequest) {
  const { username } = (await req.json().catch(() => ({}))) as { username?: string };
  if (!username) {
    return NextResponse.json({ ok: false, error: 'username_required' }, { status: 400 });
  }

  // Generate a random 6-digit verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 60 * 1000; // 1 minute (60 seconds)

  const message =
    `🔐━━━━━━━━━━━━━━━━━━━━━━🔐\n` +
    `   🛡️ <b>UYIZ.UZ — 2FA XAVFSIZLIK KODI</b> 🛡️\n` +
    `🔐━━━━━━━━━━━━━━━━━━━━━━🔐\n\n` +
    `⚡ <b>Tasdiqlash kodi:</b> <code>${code}</code>\n` +
    `👤 <b>Admin:</b> <code>${username}</code>\n` +
    `⏱ <b>Amal qilish muddati:</b> 1 daqiqa (60 soniya)\n` +
    `📍 <b>Tizim:</b> Admin Panelga kirish\n\n` +
    `⚠️ <i>DIQQAT: Ushbu kod faqat admin kirishi uchun. Agar bu so‘rovni siz yubormagan bo‘lsangiz, zudlik bilan parolingizni yangilang!</i>\n` +
    `🔐━━━━━━━━━━━━━━━━━━━━━━🔐`;

  let anySent = false;
  let sendDescription: string | undefined;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TARGET_CHANNEL_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    const data = (await resp.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    anySent = data?.ok ?? false;
    sendDescription = data?.description;
  } catch (err: unknown) {
    sendDescription = err instanceof Error ? err.message : String(err);
  }

  const sendResults = [{ chatId: TARGET_CHANNEL_ID, ok: anySent, description: sendDescription }];

  // HMAC payload: username + code + expiresAt
  const signaturePayload = `${username}:${code}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY).update(signaturePayload).digest('hex');
  const tokenData = Buffer.from(JSON.stringify({ username, expiresAt, hmac })).toString('base64');

  const res = NextResponse.json({
    ok: true,
    expiresIn: 60,
    sentToTelegram: anySent,
    results: sendResults,
  });

  // Short-lived cookie for 2FA challenge (2 minutes max)
  res.cookies.set('2fa_challenge', tokenData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 120,
  });

  return res;
}
