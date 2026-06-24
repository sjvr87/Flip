// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

// Expo winter runtime reads this at runtime from node_modules (not babel-inlined).
process.env.EXPO_PUBLIC_USE_RN_FETCH ||= '1';

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Bind Metro to all interfaces so the adb-reverse USB path (127.0.0.1:8081)
// works alongside the LAN path (192.168.x.x:8081).  Without this, when
// REACT_NATIVE_PACKAGER_HOSTNAME is set to the LAN IP by the start scripts,
// some Metro versions restrict the listening socket to that single address and
// the device cannot reach the bundler over USB.
config.server = { ...(config.server || {}), host: '0.0.0.0' };

const defaultGetPolyfills = config.serializer.getPolyfills;
config.serializer.getPolyfills = (options) => [
    ...defaultGetPolyfills(options),
    require.resolve('./src/bootstrap/metroPolyfills.js'),
];

module.exports = config;
