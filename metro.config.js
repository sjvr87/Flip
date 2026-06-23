// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

// Expo winter runtime reads this at runtime from node_modules (not babel-inlined).
process.env.EXPO_PUBLIC_USE_RN_FETCH ||= '1';

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const defaultGetPolyfills = config.serializer.getPolyfills;
config.serializer.getPolyfills = (options) => [
    ...defaultGetPolyfills(options),
    require.resolve('./src/bootstrap/metroPolyfills.js'),
];

module.exports = config;
