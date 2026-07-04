import { BSPProvider } from './BSPProvider';
import { GupshupProvider } from './GupshupProvider';

export function getBSPProvider(providerName: string): BSPProvider {
  switch (providerName.toLowerCase()) {
    case 'gupshup':
      return new GupshupProvider();
    // Future providers
    // case 'twilio': return new TwilioProvider();
    // case 'telnyx': return new TelnyxProvider();
    default:
      throw new Error(`Unknown BSP provider: ${providerName}`);
  }
}
