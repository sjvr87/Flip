// Bootstrap before expo-router so Hermes missing AbortSignal APIs are polyfilled
// before ATProto OAuth issuer verification runs on Android.
import './src/bootstrap/abortSignalPolyfill';
import 'expo-router/entry';
