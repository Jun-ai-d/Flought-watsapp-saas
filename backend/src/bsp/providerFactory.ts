import { BSPProvider } from './BSPProvider';
import { MetaProvider } from './MetaProvider';
import { WidgetProvider } from './WidgetProvider';

const providerInstances = new Map<string, BSPProvider>();

export function getBSPProvider(providerName: string): BSPProvider {
  const normalizedName = providerName.toLowerCase();
  
  if (providerInstances.has(normalizedName)) {
    return providerInstances.get(normalizedName)!;
  }

  let provider: BSPProvider;
  switch (normalizedName) {
    case 'meta':
      provider = new MetaProvider();
      break;
    case 'widget':
      provider = new WidgetProvider();
      break;
    default:
      throw new Error(`Unknown BSP provider: ${providerName}`);
  }
  
  providerInstances.set(normalizedName, provider);
  return provider;
}
