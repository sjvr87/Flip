#!/usr/bin/env node
/**
 * Fetch OAuth client metadata the same way Bluesky does during sign-in,
 * and verify client_id, client_uri, redirect_uris, and JSON validity.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function loadExpectedFromRepo() {
    const tsSource = readFileSync(join(repoRoot, 'src/atproto/oauthClientMetadata.ts'), 'utf8');
    const commitMatch = tsSource.match(/JSDELIVR_REF = '([^']+)'/);
    if (!commitMatch) {
        throw new Error('Could not parse JSDELIVR_REF from oauthClientMetadata.ts');
    }
    const ref = commitMatch[1];
    const clientId = `https://cdn.jsdelivr.net/gh/sjvr87/Flip@${ref}/assets/oauth-client-metadata.json`;
    const clientUri = `https://cdn.jsdelivr.net/gh/sjvr87/Flip@${ref}/`;
    return { commit: ref, clientId, clientUri };
}

async function fetchMetadata(url) {
    const res = await fetch(url, { redirect: 'follow' });
    const contentType = res.headers.get('content-type') ?? '';
    const body = await res.text();
    return { status: res.status, contentType, body };
}

function parseJson(body, label) {
    try {
        return JSON.parse(body);
    } catch (error) {
        throw new Error(`${label} is not valid JSON: ${error.message}\n${body.slice(0, 200)}`);
    }
}

async function main() {
    const { commit, clientId, clientUri } = loadExpectedFromRepo();
    console.log(`Commit pin: ${commit}`);
    console.log(`Fetching client_id URL: ${clientId}`);

    const { status, contentType, body } = await fetchMetadata(clientId);
    if (status !== 200) {
        throw new Error(`client_id URL returned HTTP ${status}: ${body.slice(0, 200)}`);
    }
    if (!contentType.includes('application/json')) {
        throw new Error(`client_id URL content-type must be application/json, got: ${contentType}`);
    }

    const hosted = parseJson(body, 'Hosted metadata');
    const local = parseJson(
        readFileSync(join(repoRoot, 'assets/oauth-client-metadata.json'), 'utf8'),
        'Local assets metadata',
    );

    const checks = [
        ['client_id matches URL', hosted.client_id === clientId],
        ['client_uri same jsDelivr origin', new URL(hosted.client_uri).origin === new URL(clientId).origin],
        ['client_uri matches pin', hosted.client_uri === clientUri],
        ['local client_id matches', local.client_id === clientId],
        ['local client_uri matches', local.client_uri === clientUri],
        ['redirect_uris present', Array.isArray(hosted.redirect_uris) && hosted.redirect_uris.length > 0],
        [
            'redirect_uris match',
            JSON.stringify(hosted.redirect_uris) === JSON.stringify(local.redirect_uris),
        ],
    ];

    let failed = false;
    for (const [label, ok] of checks) {
        console.log(`${ok ? 'OK' : 'FAIL'}: ${label}`);
        if (!ok) failed = true;
    }

    const clientUriRes = await fetch(clientUri, { method: 'HEAD', redirect: 'follow' });
    console.log(
        `${clientUriRes.ok ? 'OK' : 'FAIL'}: client_uri reachable (HTTP ${clientUriRes.status})`,
    );
    if (!clientUriRes.ok) failed = true;

    if (failed) {
        process.exitCode = 1;
        console.error('\nOAuth metadata verification failed.');
    } else {
        console.log('\nOAuth metadata verification passed.');
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
