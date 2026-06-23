// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// adb reverse forwards the phone's 127.0.0.1:8081 to this PC on IPv4 loopback.
// Default Expo/Metro on Windows can listen on ::1 only; bind all interfaces so USB dev works.
config.server = {
  ...config.server,
  host: '0.0.0.0',
};

module.exports = config;
