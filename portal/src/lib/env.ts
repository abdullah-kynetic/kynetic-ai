import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export const env = {
  get appUrl() { return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""); },
  get isProd() { return process.env.NODE_ENV === "production"; },
  /** 32-byte base64 key for AES-256-GCM (TOTP secrets). */
  get encryptionKey() { return Buffer.from(req("ENCRYPTION_KEY"), "base64"); },
  /** HMAC secret for signed file URLs. */
  get fileSigningSecret() { return req("FILE_SIGNING_SECRET"); },
  get resendApiKey() { return process.env.RESEND_API_KEY || ""; },
  get emailFrom() { return process.env.EMAIL_FROM || "Kynetic AI <portal@kyneticai.com>"; },
  get uploadDir() { return process.env.UPLOAD_DIR || "./.data/uploads"; },
  get maxUploadBytes() { return Number(process.env.MAX_UPLOAD_MB ?? 25) * 1024 * 1024; },
  get r2() {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
    if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
      return { accountId: R2_ACCOUNT_ID, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET };
    }
    return null;
  },
};
