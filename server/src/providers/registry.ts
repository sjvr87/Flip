import type { SocialProvider, ProviderConnectResult, ProviderProfile } from '../providers/types.js';

export type ProviderRegistry = Map<string, SocialProvider>;

const registry: ProviderRegistry = new Map();

export function registerProvider(id: string, provider: SocialProvider): void {
    registry.set(id, provider);
}

export function getProvider(id: string): SocialProvider | undefined {
    return registry.get(id);
}

export function listProviderIds(): string[] {
    return [...registry.keys()];
}

export type { ProviderConnectResult, ProviderProfile, SocialProvider };
