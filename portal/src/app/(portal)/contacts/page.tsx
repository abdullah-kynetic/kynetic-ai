import { Mail, Phone, Users } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { listContacts } from "@/lib/data/client";
import { PageHeader } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Contacts" };
export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const s = await requireClient();
  const list = await listContacts(s);
  return (
    <>
      <PageHeader title="Contacts" description="Your business contacts on file with Kynetic." />
      {list.length === 0 ? <EmptyState icon={Users} title="No contacts yet" /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((c) => (
            <Card key={c.id}><CardContent className="pt-5">
              <div className="flex items-center gap-2"><span className="font-medium">{c.name}</span>{c.isPrimary ? <Badge variant="brand">Primary</Badge> : null}</div>
              {c.title ? <div className="text-sm text-muted">{c.title}</div> : null}
              <div className="mt-3 grid gap-1.5 text-sm text-muted">
                {c.email ? <span className="flex items-center gap-2"><Mail className="size-4" />{c.email}</span> : null}
                {c.phone ? <span className="flex items-center gap-2"><Phone className="size-4" />{c.phone}</span> : null}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </>
  );
}
