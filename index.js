// Bootstrap before expo-router / expo winter — expo/fetch breaks ATProto DID resolution on Android.
// Use require() only: ESM `import` hoisting runs modules before InitializeCore.
const {
    ensureQueueMicrotask,
    boundQueueMicrotask,
    patchPolyfillGlobalQueueMicrotask,
} = require('./src/bootstrap/ensureQueueMicrotask');
patchPolyfillGlobalQueueMicrotask();

require('react-native/Libraries/Core/InitializeCore');
ensureQueueMicrotask();

require('./src/bootstrap/abortSignalPolyfill');
require('./src/bootstrap/nativeFetch');
require('@expo/metro-runtime');
// Re-apply AbortSignal patches — @expo/metro-runtime may replace globals.
require('./src/bootstrap/abortSignalPolyfill').ensureAbortSignalPolyfills();
if (typeof global.__flipBindQueueMicrotask === 'function') {
    global.__flipBindQueueMicrotask(boundQueueMicrotask);
}
ensureQueueMicrotask();

if (typeof setImmediate === 'function') {
    setImmediate(ensureQueueMicrotask);
    setImmediate(() => setImmediate(ensureQueueMicrotask));
}

require('./src/bootstrap/patchNavigationEvents').installNavigationEventsPatch();

const { renderRootComponent } = require('expo-router/build/renderRootComponent');
ensureQueueMicrotask();
const { App } = require('./src/bootstrap/rootApp');

renderRootComponent(App);
