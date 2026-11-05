import { NextResponse } from 'next/server';
import {
  getVerifiedSessionUser,
  personaSwitchingEnabled,
  isOpenPersona,
  OPEN_AS_COOKIE
} from '@/server/auth';
import { VIEW_AS_COOKIE } from '@/server/impersonation';
import { getEnv } from '@/server/env';

// A verified admin can choose a local development persona only when explicitly enabled.
export async function GET(request: Request, { params }: { params: Promise<{ persona: string }> }) {
  if (!personaSwitchingEnabled()) return new NextResponse(null, { status: 404 });
  const user = await getVerifiedSessionUser(request.headers);
  if (!user) return new NextResponse(null, { status: 401 });
  if (user.kyneticRole !== 'admin' || user.twoFactor !== 'verified')
    return new NextResponse(null, { status: 403 });
  const { persona } = await params;
  const base = getEnv().APP_BASE_URL;
  if (!isOpenPersona(persona)) return NextResponse.redirect(new URL('/dashboard', base), 303);
  const response = NextResponse.redirect(
    new URL(persona === 'admin' || persona === 'va' ? '/admin' : '/dashboard', base),
    303
  );
  response.cookies.set(OPEN_AS_COOKIE, persona, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: base.startsWith('https://'),
    maxAge: 3600
  });
  response.cookies.delete(VIEW_AS_COOKIE);
  return response;
}
