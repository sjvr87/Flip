#!/usr/bin/env node
/**
 * Publish OAuth client metadata to jsDelivr via a new immutable git tag.
 * jsDelivr permanently caches each tag URL — moving oauth-pin does not update CDN.
 * Bump OAUTH_PIN_TAG in assets + oauthClientMetadata.ts, then run this script.
 *
 * Usage: node scripts/publish-oauth-pin-tag.js
 * Then: git push origin <tag>
 */
const { execSync } = require('child_process');

const tag = process.argv[2] || 'oauth-pin-2';
execSync(`git tag -f ${tag}`, { stdio: 'inherit' });
console.log(`Tagged ${tag} at ${execSync('git rev-parse --short HEAD').toString().trim()}`);
console.log(`Run: git push origin ${tag}`);
