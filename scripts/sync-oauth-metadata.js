#!/usr/bin/env node
/**
 * Keep OAuth client metadata in sync for web hosting.
 * Source of truth: assets/oauth-client-metadata.json
 * Copies to public/ (Expo static) and optionally dist/ (Heroku deploy root).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'assets', 'oauth-client-metadata.json');
const targets = [path.join(root, 'public', 'oauth-client-metadata.json')];

if (process.argv.includes('--dist')) {
  targets.push(path.join(root, 'dist', 'oauth-client-metadata.json'));
}

if (!fs.existsSync(source)) {
  console.error('Missing source:', source);
  process.exit(1);
}

const json = fs.readFileSync(source, 'utf8');
JSON.parse(json);

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, json.endsWith('\n') ? json : `${json}\n`);
  console.log('synced', path.relative(root, target));
}
