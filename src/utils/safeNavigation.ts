import type { Href } from 'expo-router';
import { router } from 'expo-router';

import { ensureQueueMicrotask } from '@/utils/safeQueueMicrotask';

/** Defer router.push so linking.dispatch never races a broken queueMicrotask on Android. */
export function safeRouterPush(href: Href) {
    ensureQueueMicrotask();
    const run = () => {
        ensureQueueMicrotask();
        router.push(href);
    };
    if (typeof setImmediate === 'function') {
        setImmediate(run);
    } else {
        setTimeout(run, 0);
    }
}
