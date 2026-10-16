import "server-only";
import { Resend } from "resend";
import { env } from "./env";

type Mail = { to: string; subject: string; text: string; html?: string };

/** Sends via Resend when RESEND_API_KEY is set; otherwise logs to the server console (stub). */
export async function sendEmail(mail: Mail): Promise<void> {
  if (!env.resendApiKey) {
    console.log(`[email:stub] to=${mail.to} subject=${JSON.stringify(mail.subject)}\n${mail.text}\n[/email:stub]`);
    return;
  }
  const resend = new Resend(env.resendApiKey);
  const { error } = await resend.emails.send({ from: env.emailFrom, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
  if (error) console.error("[email] resend failed", error.name, error.message);
}

const wrap = (title: string, body: string, cta: string, url: string) => ({
  text: `${title}\n\n${body}\n\n${cta}: ${url}\n\nIf you did not expect this email you can ignore it.\n— Kynetic AI`,
  html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#111">
<h2 style="margin:0 0 12px">${title}</h2><p>${body}</p>
<p><a href="${url}" style="display:inline-block;background:#6d5efc;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${cta}</a></p>
<p style="color:#666;font-size:12px">If you did not expect this email you can ignore it.<br>— Kynetic AI</p></div>`,
});

export const emails = {
  magic: (url: string) => ({ subject: "Your Kynetic Portal sign-in link", ...wrap("Sign in to Kynetic Portal", "This link expires in 15 minutes and works once.", "Sign in", url) }),
  reset: (url: string) => ({ subject: "Reset your Kynetic Portal password", ...wrap("Reset your password", "This link expires in 30 minutes and works once.", "Choose a new password", url) }),
  invite: (url: string, clientName: string) => ({ subject: `You're invited to the ${clientName} portal`, ...wrap("Welcome to Kynetic Portal", `You've been invited to view ${clientName}'s project with Kynetic AI. The link expires in 7 days.`, "Set up your account", url) }),
};
