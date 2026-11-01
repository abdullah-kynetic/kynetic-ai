import { ElevenLabsVoiceProvider } from '../adapters/voice/elevenlabs';
import { FakeVoiceProvider } from '../adapters/voice/fake';
import { RetellVoiceProvider } from '../adapters/voice/retell';
import type { VoiceProvider, VoiceProviderId } from '../adapters/voice/types';
import { getEnv } from '../env';

const cached: Partial<Record<VoiceProviderId, VoiceProvider>> = {};

export function isVoiceProviderId(v: string): v is VoiceProviderId {
  return v === 'elevenlabs' || v === 'retell';
}

/**
 * ElevenLabs only when ELEVENLABS_LIVE_ENABLED=true, live mode and credentials are set. Without them only development and test fall
 * back to the in-memory fake; production fails closed so a missing secret cannot accept unsigned
 * calls. Retell (fallback) follows the same rule with `RETELL_API_KEY`.
 */
export function getVoiceProvider(id: VoiceProviderId): VoiceProvider | null {
  if (cached[id]) return cached[id]!;
  const env = getEnv();
  if (id === 'elevenlabs') {
    if (env.PROVIDER_MODE === 'stub') {
      cached[id] = new FakeVoiceProvider();
    } else if (!env.ELEVENLABS_LIVE_ENABLED) {
      // An unconfigured production live deployment must never accept fake webhook signatures.
      if (env.NODE_ENV === 'production') {
        throw new Error(
          'ELEVENLABS_LIVE_ENABLED is false; explicitly select stub mode or authorize live voice'
        );
      }
      cached[id] = new FakeVoiceProvider();
    } else if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_WEBHOOK_SECRET) {
      cached[id] = new ElevenLabsVoiceProvider({
        apiKey: env.ELEVENLABS_API_KEY,
        webhookSecret: env.ELEVENLABS_WEBHOOK_SECRET,
        agentPhoneNumberId: env.ELEVENLABS_AGENT_PHONE_NUMBER_ID
      });
    } else if (env.NODE_ENV === 'production') {
      throw new Error(
        'ELEVENLABS_API_KEY and ELEVENLABS_WEBHOOK_SECRET are required in production'
      );
    } else {
      cached[id] = new FakeVoiceProvider();
    }
    return cached[id]!;
  }
  // Retell is a fallback that stays off until its key is set, so a missing key is not an error.
  if (env.RETELL_API_KEY) {
    cached[id] = new RetellVoiceProvider({
      apiKey: env.RETELL_API_KEY,
      fromNumber: env.RETELL_FROM_NUMBER
    });
    return cached[id]!;
  }
  return null;
}
