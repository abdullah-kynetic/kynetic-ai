import Link from "next/link";
import { magicNeedsTotp } from "@/lib/auth/token-info";
import { MagicForm } from "./magic-form";

export const metadata = { title: "Continue sign-in" };

// The token is only peeked here; it is consumed by the POST (so email scanners that GET the link can't burn it).
export default async function MagicPage({ searchParams }: PageProps<"/auth/magic">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const needsTotp = token ? await magicNeedsTotp(token) : null;
  if (needsTotp === null) return (
    <>
      <h1 className="text-xl font-semibold">Link expired</h1>
      <p className="mb-5 mt-1 text-sm text-muted">This sign-in link is invalid, expired, or already used.</p>
      <Link href="/login/magic" className="text-brand-hover hover:underline">Request a new link</Link>
    </>
  );
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Continue to your portal</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Confirm to finish signing in.</p>
      <MagicForm token={token} needsTotp={needsTotp} />
    </>
  );
}
