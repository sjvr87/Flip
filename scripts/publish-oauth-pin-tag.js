#!/usr/bin/env node
/**
 * Move the oauth-pin git tag to HEAD so jsDelivr serves stable OAuth metadata
 * where client_id URL matches the document (required by ATProto OAuth).
 *
 * Usage: node scripts/publish-oauth-pin-tag.js
 * Then: git push origin oauth-pin --force
 */
const { execSync } = require('child_process');

const tag = 'oauth-pin';
execSync(`git tag -f ${tag}`, { stdio: 'inherit' });
console.log(`Tagged ${tag} at ${execSync('git rev-parse --short HEAD').toString().trim()}`);
console.log('Run: git push origin oauth-pin --force');
