import { getVoiceProvider, registerVoiceProcessor } from './calls';
import { registerTwilioProcessor } from './messaging';
import { getSmsProvider } from './messaging/provider';

export type ProviderBoot = { voice: boolean; sms: boolean };

/**
 * Registers one provider's webhook processor. A provider that cannot start (a missing key makes the
 * production getters throw) is logged and skipped, so the worker still boots and keeps running
 * backups, reports and digests. This only affects registration at boot. Calls stay fail-closed:
 * runOutboundCall asks getVoiceProvider for each attempt, which keeps throwing without the key, so no
 * call is placed and the job fails visibly.
 */
export function registerIfAvailable(
  name: string,
  register: () => void,
  log: (line: string) => void = console.error
): boolean {
  try {
    register();
    return true;
  } catch (e) {
    log(
      JSON.stringify({
        level: 'error',
        msg: 'provider unavailable; its processor was not registered',
        provider: name,
        error: e instanceof Error ? e.message : 'unknown'
      })
    );
    return false;
  }
}

export function registerProviderProcessors(log?: (line: string) => void): ProviderBoot {
  return {
    voice: registerIfAvailable(
      'elevenlabs',
      () => registerVoiceProcessor({ provider: getVoiceProvider('elevenlabs')! }),
      log
    ),
    sms: registerIfAvailable(
      'twilio',
      () => registerTwilioProcessor({ provider: getSmsProvider() }),
      log
    )
  };
}
