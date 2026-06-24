// Bootstrap before expo-router / expo winter — expo/fetch breaks ATProto DID resolution on Android.
// Use require() only: ESM `import` hoisting runs modules before InitializeCore.
require('react-native/Libraries/Core/InitializeCore');

const { ensureQueueMicrotask, boundQueueMicrotask } = require('./src/bootstrap/ensureQueueMicrotask');
ensureQueueMicrotask();

require('./src/bootstrap/abortSignalPolyfill');
require('./src/bootstrap/nativeFetch');
require('@expo/metro-runtime');
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
const { App } = require('./src/bootstrap/rootApp');

renderRootComponent(App);
