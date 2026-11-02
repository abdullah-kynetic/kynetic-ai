import { NextResponse } from 'next/server';
import { isOpenPersona, OPEN_AS_COOKIE } from '@/server/auth';
import { VIEW_AS_COOKIE } from '@/server/impersonation';
import { getEnv } from '@/server/env';

// Open mode has no sign-in. This switches which existing user the portal acts as, so one person can
// see the Kynetic admin side and a client's side. See server/auth/open-mode.ts.
export async function GET(_request: Request, { params }: { params: Promise<{ persona: string }> }) {
  const { persona } = await params;
  const base = getEnv().APP_BASE_URL;
  if (!isOpenPersona(persona)) return NextResponse.redirect(new URL('/dashboard', base), 303);
  const response = NextResponse.redirect(
    new URL(persona === 'admin' || persona === 'va' ? '/admin' : '/dashboard', base),
    303
  );
  response.cookies.set(OPEN_AS_COOKIE, persona, { path: '/', sameSite: 'lax', maxAge: 31_536_000 });
  response.cookies.delete(VIEW_AS_COOKIE);
  return response;
}
