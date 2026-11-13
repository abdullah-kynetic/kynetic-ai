// Fail fast: a missing or malformed variable stops the server at boot.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { validateBoot } = await import('@/server/boot');
  validateBoot();
  const { wireEmail } = await import('@/server/email/wire');
  wireEmail();
  const { wireLlm } = await import('@/server/llm/wire');
  wireLlm();
}
