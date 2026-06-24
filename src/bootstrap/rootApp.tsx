/**
 * Custom expo-router root — StartupErrorBoundary wraps ExpoRoot so NavigationContainer
 * render failures show a recovery screen instead of a crash loop.
 */
import { StartupErrorBoundary } from '@/components/StartupErrorBoundary';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { Head } from 'expo-router/build/head';
import 'expo-router/build/fast-refresh';
import { useEffect } from 'react';
import { installRoutingQueuePatch } from './patchLinkingTabUrls';
import { ctx } from 'expo-router/_ctx';

export function App() {
    useEffect(() => { installRoutingQueuePatch(); }, []);
    return (
        <StartupErrorBoundary label="Flip navigation">
            <Head.Provider>
                <ExpoRoot context={ctx} />
            </Head.Provider>
        </StartupErrorBoundary>
    );
}
