// Learn more https://docs.expo.io/guides/customizing-metro
const http = require('node:http');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
const defaultEnhanceMiddleware = config.server.enhanceMiddleware;
const warmUpPort = config.server.port ?? 8081;

let bundleWarmUpStarted = false;

function warmUpBundle(platform) {
    const request = http.get(
        `http://127.0.0.1:${warmUpPort}/index.bundle?platform=${platform}&dev=true&minify=false&lazy=true&transform.engine=hermes`,
        (response) => {
            response.resume();
        },
    );

    request.on('error', () => {});
}

config.server.enhanceMiddleware = (middleware, server) => {
    if (!bundleWarmUpStarted) {
        bundleWarmUpStarted = true;
        const timer = setTimeout(() => {
            warmUpBundle('android');
            warmUpBundle('ios');
        }, 1000);
        timer.unref?.();
    }

    return defaultEnhanceMiddleware ? defaultEnhanceMiddleware(middleware, server) : middleware;
};

module.exports = config;
