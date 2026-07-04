import { BSPProvider } from './BSPProvider';
import { GupshupProvider } from './GupshupProvider';
import { MetaProvider } from './MetaProvider';

const providerInstances = new Map<string, BSPProvider>();

export function getBSPProvider(providerName: string): BSPProvider {
  const normalizedName = providerName.toLowerCase();
  
  if (providerInstances.has(normalizedName)) {
    return providerInstances.get(normalizedName)!;
  }

  let provider: BSPProvider;
  switch (normalizedName) {
    case 'gupshup':
      provider = new GupshupProvider();
      break;
    case 'meta':
      provider = new MetaProvider();
      break;
    default:
      throw new Error(`Unknown BSP provider: ${providerName}`);
  }
  
  providerInstances.set(normalizedName, provider);
  return provider;
}
