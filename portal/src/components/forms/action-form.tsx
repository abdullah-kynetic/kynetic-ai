"use client";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type State = { ok?: boolean; error?: string; message?: string; code?: string; secret?: string; codes?: string[] } | undefined;
type Action = (prev: State, fd: FormData) => Promise<State>;

/** Server-action form with inline error, toast on success, optional reset. */
export function ActionForm({
  action, children, submit = "Save", submitVariant, className, resetOnSuccess, hidden, onResult, pendingLabel, footer,
}: {
  action: Action; children?: React.ReactNode; submit?: string; submitVariant?: ButtonProps["variant"]; className?: string;
  resetOnSuccess?: boolean; hidden?: Record<string, string>; onResult?: (s: NonNullable<State>) => void; pendingLabel?: string; footer?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state) return;
    if (state.ok && state.message) toast.success(state.message);
    if (state.ok && resetOnSuccess) ref.current?.reset();
    onResult?.(state);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form ref={ref} action={formAction} className={cn("grid gap-4", className)}>
      {hidden ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
      {children}
      {state?.error ? <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-text">{state.error}</p> : null}
      {state?.ok && state.message && !state.secret ? <p className="text-sm text-success-text">{state.message}</p> : null}
      <div className="flex items-center gap-3">
        {submit ? <Button type="submit" variant={submitVariant} disabled={pending}>{pending ? (pendingLabel ?? "Working…") : submit}</Button> : null}
        {footer}
      </div>
    </form>
  );
}

/** One-click action button (delete, revoke, disable) with optional confirm. */
export function ActionButton({ action, hidden, label, variant = "ghost", size = "sm", confirm }: {
  action: Action; hidden: Record<string, string>; label: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"]; confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.ok && state.message) toast.success(state.message);
  }, [state]);
  return (
    <form action={formAction} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Button type="submit" variant={variant} size={size} disabled={pending}>{label}</Button>
    </form>
  );
}
