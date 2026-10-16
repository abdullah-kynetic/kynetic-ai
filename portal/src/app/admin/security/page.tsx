import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const s = await requireAdmin();
  return (
    <>
      <PageHeader title="Security" description="Your admin account protections." />
      <Card className="max-w-xl"><CardContent className="grid gap-3 pt-5 text-sm">
        <div className="flex items-center justify-between"><span>Two-factor (TOTP)</span><Badge variant={s.totpEnabled ? "success" : "danger"} dot>{s.totpEnabled ? "Enabled" : "Off"}</Badge></div>
        <div className="flex items-center justify-between"><span>Admin session length</span><span className="text-muted">12 hours</span></div>
        <Link href="/account" className="text-brand-hover hover:underline">Change password or sign out everywhere →</Link>
      </CardContent></Card>
    </>
  );
}
