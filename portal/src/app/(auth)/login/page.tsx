import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  if (await getSession()) redirect("/");
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Sign in to your Kynetic portal.</p>
      {sp.changed ? <p className="mb-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-green-300">Password changed. Please sign in again.</p> : null}
      <LoginForm next={next} />
    </>
  );
}
