import { signInWithGoogle } from "@/lib/auth/actions";

export function GoogleButton() {
  return (
    <form action={signInWithGoogle} className="mt-4">
      <div className="mb-4 flex items-center gap-3 text-xs text-subtle"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
      <button type="submit" className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-foreground/15 bg-transparent text-sm font-semibold text-foreground transition-colors hover:border-foreground/30 hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.5 6.6 2.5 12s4.2 9.6 9.5 9.6c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z" /></svg>
        Continue with Google
      </button>
      <p className="mt-2 text-center text-xs text-subtle">Only for people Kynetic has invited.</p>
    </form>
  );
}
