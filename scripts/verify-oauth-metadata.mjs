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
    const local = parseJson(
        readFileSync(join(repoRoot, 'assets/oauth-client-metadata.json'), 'utf8'),
        'Local assets metadata',
    );
    const clientId = local.client_id;
    if (!clientId || typeof clientId !== 'string') {
        throw new Error('assets/oauth-client-metadata.json missing client_id');
    }
    const clientUri = local.client_uri;
    if (!clientUri || typeof clientUri !== 'string') {
        throw new Error('assets/oauth-client-metadata.json missing client_uri');
    }
    return { clientId, clientUri, local };
}

async function fetchMetadata(url) {
    const res = await fetch(url, { redirect: 'follow' });
    const contentType = res.headers.get('content-type') ?? '';
    const body = await res.text();
    return { status: res.status, contentType, body };
}

function parseJson(body, label) {
    const normalized = body.replace(/^\uFEFF/, '');
    try {
        return JSON.parse(normalized);
    } catch (error) {
        throw new Error(`${label} is not valid JSON: ${error.message}\n${body.slice(0, 200)}`);
    }
}

function reverseFqdnScheme(clientIdUrl) {
    const host = new URL(clientIdUrl).hostname;
    return `${host.split('.').reverse().join('.')}:`;
}

async function main() {
    const { clientId, clientUri, local } = loadExpectedFromRepo();
    console.log(`client_id URL: ${clientId}`);
    console.log(`Fetching hosted metadata…`);

    const { status, contentType, body } = await fetchMetadata(clientId);
    if (status !== 200) {
        throw new Error(`client_id URL returned HTTP ${status}: ${body.slice(0, 200)}`);
    }
    if (!contentType.includes('application/json')) {
        throw new Error(`client_id URL content-type must be application/json, got: ${contentType}`);
    }

    const hosted = parseJson(body, 'Hosted metadata');
    const expectedRedirectScheme = reverseFqdnScheme(clientId);

    const checks = [
        ['client_id matches URL', hosted.client_id === clientId],
        ['client_uri same origin as client_id', new URL(hosted.client_uri).origin === new URL(clientId).origin],
        ['client_uri matches assets', hosted.client_uri === clientUri],
        ['local client_id matches', local.client_id === clientId],
        ['local client_uri matches', local.client_uri === clientUri],
        ['redirect_uris present', Array.isArray(hosted.redirect_uris) && hosted.redirect_uris.length > 0],
        [
            'redirect_uris match',
            JSON.stringify(hosted.redirect_uris) === JSON.stringify(local.redirect_uris),
        ],
        [
            `redirect scheme matches client_id FQDN (${expectedRedirectScheme})`,
            hosted.redirect_uris?.every((uri) => uri.startsWith(expectedRedirectScheme)),
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
