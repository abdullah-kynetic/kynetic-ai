import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-glow px-4 py-10">
      <Logo className="mb-8" />
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl sm:p-7">{children}</div>
      <p className="mt-6 text-xs text-subtle">Kynetic AI · Client portal</p>
    </div>
  );
}
