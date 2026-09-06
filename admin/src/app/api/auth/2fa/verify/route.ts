import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SECRET_KEY = process.env.SECRET_KEY || 'uyiz-admin-2fa-super-secret-key-2026';

export async function POST(req: NextRequest) {
  const { username, code } = (await req.json().catch(() => ({}))) as {
    username?: string;
    code?: string;
  };

  if (!username || !code) {
    return NextResponse.json(
      { ok: false, message: 'Foydalanuvchi nomi va kod kiritilishi shart' },
      { status: 400 },
    );
  }

  const cookie = req.cookies.get('2fa_challenge')?.value;
  if (!cookie) {
    return NextResponse.json(
      { ok: false, message: 'Tasdiqlash muddati tugagan. Qaytadan kod so‘rang.' },
      { status: 400 },
    );
  }

  let payload: { username: string; expiresAt: number; hmac: string };
  try {
    payload = JSON.parse(Buffer.from(cookie, 'base64').toString('utf-8'));
  } catch {
    return NextResponse.json({ ok: false, message: 'Noto‘g‘ri ma’lumot' }, { status: 400 });
  }

  if (payload.username.toLowerCase().trim() !== username.toLowerCase().trim()) {
    return NextResponse.json({ ok: false, message: 'Foydalanuvchi mos kelmadi' }, { status: 400 });
  }

  if (Date.now() > payload.expiresAt) {
    const res = NextResponse.json(
      { ok: false, message: 'Kod muddati (1 daqiqa) tugagan. Qaytadan kod jo‘nating.' },
      { status: 400 },
    );
    res.cookies.delete('2fa_challenge');
    return res;
  }

  const expectedHmac = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${payload.username}:${code.trim()}:${payload.expiresAt}`)
    .digest('hex');

  if (expectedHmac !== payload.hmac) {
    return NextResponse.json(
      { ok: false, message: 'Kiritilgan tasdiqlash kodi noto‘g‘ri!' },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete('2fa_challenge');
  return res;
}
