// Bootstrap before expo-router / expo winter — expo/fetch breaks ATProto DID resolution on Android.
import './src/bootstrap/nativeFetch';
import 'expo-router/entry';
