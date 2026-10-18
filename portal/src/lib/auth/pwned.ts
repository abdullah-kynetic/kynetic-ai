import { createHash } from "node:crypto";

/**
 * Have I Been Pwned "range" lookup (k-anonymity): only the first 5 hex characters of the password's SHA-1
 * leave the server, never the password or its full hash. NIST SP 800-63B asks for new passwords to be screened
 * against breached lists. Fails open (returns false) on any network error so an outage never blocks a reset.
 * Set PWNED_CHECK=off to disable (used by the test suite, which has no internet dependency).
 */
export async function isPwned(
  password: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 2500,
): Promise<boolean> {
  if (process.env.PWNED_CHECK === "off") return false;
  const sha = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha.slice(0, 5);
  const suffix = sha.slice(5);
  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "kynetic-portal" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [hash, count] = line.trim().split(":");
      return hash === suffix && Number(count) > 0; // padded decoy rows have a count of 0
    });
  } catch {
    return false;
  }
}
