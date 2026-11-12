import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Set up two-factor" };

export default async function MfaSetupPage() {
  const s = await requireUser();
  redirect(s.role === "admin" ? "/admin" : "/");
}
