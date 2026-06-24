// Bootstrap before expo-router / expo winter — expo/fetch breaks ATProto DID resolution on Android.
// Use require() only: ESM `import` hoisting runs modules before InitializeCore.
require('react-native/Libraries/Core/InitializeCore');

const { ensureQueueMicrotask } = require('./src/bootstrap/ensureQueueMicrotask');
ensureQueueMicrotask();

require('./src/bootstrap/abortSignalPolyfill');
require('./src/bootstrap/nativeFetch');
require('@expo/metro-runtime');

const { renderRootComponent } = require('expo-router/build/renderRootComponent');
const { App } = require('./src/bootstrap/rootApp');

renderRootComponent(App);
