// Bootstrap before expo-router so Hermes missing AbortSignal APIs are polyfilled
// before ATProto OAuth issuer verification runs on Android.
import 'react-native/Libraries/Core/InitializeCore';
import './src/bootstrap/abortSignalPolyfill';
import 'expo-router/entry';
