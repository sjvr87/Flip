// Bootstrap before expo-router / expo winter — expo/fetch breaks ATProto DID resolution on Android.
// Use require() only: ESM `import` hoisting runs modules before InitializeCore.
require('react-native/Libraries/Core/InitializeCore');
require('./src/bootstrap/abortSignalPolyfill');
require('./src/bootstrap/nativeFetch');
require('expo-router/entry');
