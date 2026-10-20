import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getClientDetail } from "@/lib/data/admin";

/** Per-request cached admin load of one client. Id comes from the URL but only ever feeds an admin-scoped lookup. */
export const loadDetail = cache(async (id: string) => {
  const s = await requireAdmin();
  const d = await getClientDetail(s, id);
  if (!d) notFound();
  return d;
});
