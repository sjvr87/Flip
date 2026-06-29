/**
 * CI typecheck for changed TypeScript files.
 * Full-repo `tsc --noEmit` currently has pre-existing errors outside the files touched by a PR.
 */
const { execFileSync, execSync } = require('child_process');
const fs = require('fs');

function readEventPayload() {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath || !fs.existsSync(eventPath)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    } catch {
        return null;
    }
}

function getDiffRange(payload) {
    if (payload?.pull_request?.base?.sha && payload?.pull_request?.head?.sha) {
        return `${payload.pull_request.base.sha}...${payload.pull_request.head.sha}`;
    }

    const before = payload?.before;
    const after = payload?.after;
    const hasBeforeSha = before && !/^0+$/.test(before);

    if (hasBeforeSha && after) {
        return `${before}...${after}`;
    }

    if (hasBeforeSha) {
        return `${before}...HEAD`;
    }

    try {
        execFileSync('git', ['rev-parse', 'HEAD^'], { stdio: 'ignore' });
        return 'HEAD^...HEAD';
    } catch {
        return null;
    }
}

function getChangedTypeScriptFiles(range) {
    if (!range) {
        return [];
    }

    try {
        const output = execFileSync('git', ['diff', '--name-only', range, '--', '*.ts', '*.tsx'], {
            encoding: 'utf8',
        });

        return output
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
    } catch {
        return [];
    }
}

const payload = readEventPayload();
const diffRange = getDiffRange(payload);
const changedFiles = getChangedTypeScriptFiles(diffRange);

if (changedFiles.length === 0) {
    console.log('[typecheck-changed] No changed TypeScript files to validate.');
    process.exit(0);
}

const changedFileSet = new Set(changedFiles.map((file) => file.replace(/\\/g, '/')));
let output = '';

try {
    execSync('npx tsc --noEmit --pretty false', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log(
        `[typecheck-changed] No TypeScript errors in ${changedFiles.length} changed file(s).`,
    );
    process.exit(0);
} catch (error) {
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
}

const diagnosticHeader = /^(.*?):\d+:\d+ - error TS\d+:/;
const relevantLines = [];
let includeCurrentDiagnostic = false;
let matchedDiagnostics = 0;

for (const line of output.split(/\r?\n/)) {
    const match = line.match(diagnosticHeader);

    if (match) {
        matchedDiagnostics += 1;
        includeCurrentDiagnostic = changedFileSet.has(match[1].replace(/\\/g, '/'));
    }

    if (includeCurrentDiagnostic) {
        relevantLines.push(line);
    }
}

if (matchedDiagnostics === 0 && output.includes('error TS')) {
    console.error('[typecheck-changed] Unable to parse TypeScript diagnostics; failing closed.');
    console.error(output.trimEnd());
    process.exit(1);
}

if (relevantLines.length > 0) {
    console.error(relevantLines.join('\n').trimEnd());
    process.exit(1);
}

console.log(`[typecheck-changed] No TypeScript errors in ${changedFiles.length} changed file(s).`);
