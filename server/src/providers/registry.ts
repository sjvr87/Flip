import {
    isProviderFeatureEnabled,
    isScaffoldProvider,
    listEnabledProviderIds,
    normalizeProviderId,
    ProviderIds,
} from '../config/providers.js';
import type { ProviderId } from '../types.js';
import type { SocialProvider, ProviderConnectResult, ProviderProfile } from './types.js';

export type ProviderRegistry = Map<ProviderId, SocialProvider>;

const registry: ProviderRegistry = new Map();

export function registerProvider(id: ProviderId, provider: SocialProvider): void {
    registry.set(id, provider);
}

export function getProvider(rawId: string): SocialProvider | undefined {
    const id = normalizeProviderId(rawId);
    if (!id) return undefined;
    return registry.get(id);
}

export function listProviderIds(): ProviderId[] {
    return [...registry.keys()];
}

export function listRegisteredEnabledProviderIds(): ProviderId[] {
    return listProviderIds().filter((id) => isProviderFeatureEnabled(id));
}

export function isProviderRegisteredAndEnabled(rawId: string): boolean {
    const id = normalizeProviderId(rawId);
    if (!id) return false;
    return registry.has(id) && isProviderFeatureEnabled(id);
}

export function shouldGuardDelivery(rawId: string): boolean {
    const id = normalizeProviderId(rawId);
    if (!id) return true;
    if (!isProviderFeatureEnabled(id)) return true;
    return isScaffoldProvider(id);
}

export { listEnabledProviderIds, normalizeProviderId, ProviderIds, isScaffoldProvider };

export type { ProviderConnectResult, ProviderProfile, SocialProvider };
