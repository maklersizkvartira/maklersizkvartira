import { NextResponse } from 'next/server';

/**
 * Liveness probe for the panel's own Next.js server.
 *
 * This says nothing about the FastAPI backend — the only routes under `/api`
 * here are the three that handle the refresh cookie, everything else goes
 * straight to `env.API_URL` from the browser.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'maklersiz-admin' });
}
