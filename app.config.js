const appJson = require('./app.json');

// Expo 56 installs expo/fetch by default; ATProto OAuth needs RN fetch for DID resolution.
if (!process.env.EXPO_PUBLIC_USE_RN_FETCH) {
    process.env.EXPO_PUBLIC_USE_RN_FETCH = '1';
}

module.exports = appJson;
