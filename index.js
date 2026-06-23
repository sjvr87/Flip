// Bootstrap before expo-router / expo winter — expo/fetch breaks ATProto DID resolution on Android.
// Materialize RN's lazy global.fetch before nativeFetch captures it (RN 0.85 setUpXHR).
require('react-native/Libraries/Core/InitializeCore');
import './src/bootstrap/abortSignalPolyfill';
import './src/bootstrap/nativeFetch';
import 'expo-router/entry';
