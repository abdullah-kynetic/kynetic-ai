import { ElevenLabsVoiceProvider } from '../adapters/voice/elevenlabs';
import { FakeVoiceProvider } from '../adapters/voice/fake';
import type { VoiceProvider, VoiceProviderId } from '../adapters/voice/types';
import { getEnv } from '../env';

const cached: Partial<Record<VoiceProviderId, VoiceProvider>> = {};

export function isVoiceProviderId(v: string): v is VoiceProviderId {
  return v === 'elevenlabs' || v === 'retell';
}

/**
 * ElevenLabs when its key and webhook secret are set. Without them only development and test fall
 * back to the in-memory fake; production fails closed so a missing secret cannot accept unsigned
 * calls. Retell (M4-02) registers here when its adapter lands; until then it answers `null`.
 */
export function getVoiceProvider(id: VoiceProviderId): VoiceProvider | null {
  if (cached[id]) return cached[id]!;
  if (id !== 'elevenlabs') return null;
  const env = getEnv();
  if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_WEBHOOK_SECRET) {
    cached[id] = new ElevenLabsVoiceProvider({
      apiKey: env.ELEVENLABS_API_KEY,
      webhookSecret: env.ELEVENLABS_WEBHOOK_SECRET,
      agentPhoneNumberId: env.ELEVENLABS_AGENT_PHONE_NUMBER_ID
    });
  } else if (env.NODE_ENV === 'production') {
    throw new Error('ELEVENLABS_API_KEY and ELEVENLABS_WEBHOOK_SECRET are required in production');
  } else {
    cached[id] = new FakeVoiceProvider();
  }
  return cached[id]!;
}
