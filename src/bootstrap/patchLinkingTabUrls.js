'use strict';

/**
 * Swallow flip:// tab URL events before React Navigation linking.dispatch runs.
 * Shadow queueMicrotask during routingQueue.run so React 19 / RN bridgeless never see a broken global.
 */

const TAB_NAMES = new Set(['explore', 'create', 'notifications', 'profile', 'index', 'home']);

const TAB_HREFS = new Set(['/explore', '/create', '/notifications', '/profile', '/', '/index']);

function tabNameFromUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }
    try {
        const parsed = new URL(url.includes(':/') ? url : `flip://${url}`);
        if (parsed.protocol !== 'flip:' && parsed.protocol !== 'app.flip:') {
            return null;
        }
        if (TAB_NAMES.has(parsed.hostname)) {
            return parsed.hostname;
        }
        const segment = parsed.pathname.replace(/^\//, '').split('/')[0];
        return segment && TAB_NAMES.has(segment) ? segment : null;
    } catch {
        return null;
    }
}

function isFlipTabUrl(url) {
    return tabNameFromUrl(url) !== null;
}

function isTabRouterHref(href) {
    if (typeof href !== 'string') {
        return false;
    }
    const path = href.split('?')[0];
    return TAB_HREFS.has(path);
}

function withQueueMicrotaskShadow(impl, fn) {
    const { ensureQueueMicrotask, boundQueueMicrotask } = require('./ensureQueueMicrotask');
    ensureQueueMicrotask();
    const safe = typeof impl === 'function' ? impl : boundQueueMicrotask;
    try {
        global.queueMicrotask = safe;
        globalThis.queueMicrotask = safe;
        return fn();
    } finally {
        try {
            ensureQueueMicrotask();
        } catch {
            // tests / web
        }
        // Never restore Hermes/RN native queueMicrotask stubs — they can be typeof "function"
        // yet throw "undefined is not a function" when React Navigation dispatches.
    }
}

function wrapNavigationDispatch(navigation, impl) {
    if (!navigation || navigation.__flipDispatchWrapped) {
        return;
    }
    const originalDispatch = navigation.dispatch.bind(navigation);
    navigation.dispatch = function flipWrappedDispatch(action) {
        return withQueueMicrotaskShadow(impl, () => originalDispatch(action));
    };
    navigation.__flipDispatchWrapped = true;
}

function patchLinkingAddEventListener() {
    try {
        const { Linking } = require('react-native');
        if (!Linking || Linking.__flipTabUrlPatch) {
            return;
        }

        const original = Linking.addEventListener.bind(Linking);
        Linking.addEventListener = function patchedAddEventListener(type, handler) {
            if (type !== 'url' || typeof handler !== 'function') {
                return original(type, handler);
            }

            const wrapped = (event) => {
                const url = event && event.url;
                if (isFlipTabUrl(url)) {
                    if (typeof __DEV__ !== 'undefined' && __DEV__) {
                        console.log(
                            '[linking] swallow flip:// tab URL event (tab bar handles navigation):',
                            url,
                        );
                    }
                    return;
                }
                try {
                    require('./ensureQueueMicrotask').ensureQueueMicrotask();
                } catch {
                    // tests / web
                }
                return handler(event);
            };

            return original(type, wrapped);
        };

        Linking.__flipTabUrlPatch = true;
    } catch {
        // tests / web
    }
}

function patchRoutingQueue() {
    try {
        const { routingQueue } = require('expo-router/build/global-state/routingQueue');
        if (!routingQueue || routingQueue.__flipPatched) {
            return;
        }

        const { ensureQueueMicrotask, boundQueueMicrotask } = require('./ensureQueueMicrotask');
        const originalAdd = routingQueue.add.bind(routingQueue);
        routingQueue.add = function patchedAdd(action) {
            ensureQueueMicrotask();
            return originalAdd(action);
        };

        const originalRun = routingQueue.run.bind(routingQueue);
        routingQueue.run = function patchedRun(ref) {
            return withQueueMicrotaskShadow(boundQueueMicrotask, () => {
                ensureQueueMicrotask();
                if (ref?.current) {
                    wrapNavigationDispatch(ref.current, boundQueueMicrotask);
                }
                return originalRun(ref);
            });
        };

        routingQueue.__flipPatched = true;
    } catch {
        // expo-router not loaded yet
    }
}

function installLinkingPatches() {
    patchLinkingAddEventListener();
}

function installRoutingQueuePatch() {
    patchRoutingQueue();
}

module.exports = {
    installLinkingPatches,
    installRoutingQueuePatch,
    isFlipTabUrl,
    isTabRouterHref,
};
