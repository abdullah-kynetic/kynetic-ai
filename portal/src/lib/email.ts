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

const notice = (title: string, body: string) => ({
  text: `${title}\n\n${body}\n\nIf this wasn't you, contact Kynetic AI right away.\n— Kynetic AI`,
  html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#111">
<h2 style="margin:0 0 12px">${title}</h2><p>${body}</p>
<p style="color:#666;font-size:12px">If this wasn't you, contact Kynetic AI right away.<br>— Kynetic AI</p></div>`,
});

export const emails = {
  passwordChanged: () => ({ subject: "Your Kynetic Portal password was changed", ...notice("Password changed", "The password for your Kynetic Portal account was just changed, and any other devices were signed out.") }),
  mfaEnrolled: () => ({ subject: "Two-factor authentication turned on", ...notice("Two-factor authentication is on", "An authenticator app is now required to sign in to your Kynetic Portal admin account.") }),
  recoveryUsed: (left: number) => ({ subject: "A recovery code was used to sign in", ...notice("Recovery code used", `A one-time recovery code was just used to sign in to your admin account. You have ${left} unused code${left === 1 ? "" : "s"} left.${left <= 2 ? " Generate a new set from your Account page soon." : ""}`) }),
  recoveryRegenerated: () => ({ subject: "Your recovery codes were replaced", ...notice("Recovery codes replaced", "A new set of recovery codes was generated for your admin account. Older codes no longer work.") }),
  emailChanged: (newEmail: string) => ({ subject: "The email on your Kynetic Portal account was changed", ...notice("Account email changed", `The sign-in email for your Kynetic Portal account was changed to ${newEmail}.`) }),
  magic: (url: string) => ({ subject: "Your Kynetic Portal sign-in link", ...wrap("Sign in to Kynetic Portal", "This link expires in 15 minutes and works once.", "Sign in", url) }),
  reset: (url: string) => ({ subject: "Reset your Kynetic Portal password", ...wrap("Reset your password", "This link expires in 30 minutes and works once.", "Choose a new password", url) }),
  invite: (url: string, clientName: string) => ({ subject: `You're invited to the ${clientName} portal`, ...wrap("Welcome to Kynetic Portal", `You've been invited to view ${clientName}'s project with Kynetic AI. The link expires in 7 days.`, "Set up your account", url) }),
};
