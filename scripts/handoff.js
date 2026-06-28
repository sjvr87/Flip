#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');

const DEFAULT_REPO = process.env.FLIP_HANDOFF_REPO || 'sjvr87/Flip';
const DEFAULT_ISSUE = Number.parseInt(process.env.FLIP_HANDOFF_ISSUE || '24', 10);

function usage() {
    console.log(`Usage:
  node ./scripts/handoff.js post --task "<task>" --status "<status>" --diff "<summary>" --metro "<errors|NONE>" --logcat "<errors|NONE>" --next "<risky step>"
  node ./scripts/handoff.js view

Optional:
  --repo owner/name    (default: ${DEFAULT_REPO})
  --issue number       (default: ${DEFAULT_ISSUE})`);
}

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith('--')) {
            args._.push(token);
            continue;
        }
        const key = token.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
            args[key] = next;
            i += 1;
        } else {
            args[key] = true;
        }
    }
    return args;
}

function required(args, key) {
    const value = args[key];
    if (!value || typeof value !== 'string' || !value.trim()) {
        console.error(`Missing required argument: --${key}`);
        usage();
        process.exit(2);
    }
    return value.trim();
}

function buildPacket(args) {
    const task = required(args, 'task');
    const status = required(args, 'status');
    const diff = required(args, 'diff');
    const metro = required(args, 'metro');
    const logcat = required(args, 'logcat');
    const next = required(args, 'next');

    return `## 🤝 CURSOR HANDOFF PACKET

**Task:** ${task}

**Status:** ${status}

**Proposed change (diff summary):**
\`\`\`
${diff}
\`\`\`

**Metro errors/warnings:**
\`\`\`
${metro}
\`\`\`

**logcat errors:**
\`\`\`
${logcat}
\`\`\`

**Risky next step:**
${next}

**Waiting for:** Copilot ✅ / ❌ before proceeding.`;
}

function runGh(commandArgs) {
    const result = spawnSync('gh', commandArgs, { encoding: 'utf8' });
    return {
        status: result.status ?? 1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        error: result.error,
    };
}

function post(args) {
    const repo = typeof args.repo === 'string' ? args.repo : DEFAULT_REPO;
    const issue = Number.parseInt(typeof args.issue === 'string' ? args.issue : `${DEFAULT_ISSUE}`, 10);
    if (!Number.isFinite(issue) || issue < 1) {
        console.error(`Invalid --issue: ${args.issue}`);
        process.exit(2);
    }

    const body = buildPacket(args);
    const result = runGh(['issue', 'comment', `${issue}`, '--repo', repo, '--body', body]);
    if (result.status === 0) {
        process.stdout.write(result.stdout);
        return;
    }

    console.error('Failed to post handoff packet via gh.');
    if (result.error) console.error(result.error.message);
    if (result.stderr) console.error(result.stderr.trim());
    console.error('\nCopy/paste fallback body:\n');
    console.error(body);
    process.exit(result.status || 1);
}

function view(args) {
    const repo = typeof args.repo === 'string' ? args.repo : DEFAULT_REPO;
    const issue = Number.parseInt(typeof args.issue === 'string' ? args.issue : `${DEFAULT_ISSUE}`, 10);
    const result = runGh(['issue', 'view', `${issue}`, '--repo', repo, '--comments']);
    process.stdout.write(result.stdout);
    if (result.status !== 0) {
        if (result.error) console.error(result.error.message);
        if (result.stderr) console.error(result.stderr.trim());
        process.exit(result.status || 1);
    }
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
if (!command || command === '--help' || command === '-h' || command === 'help') {
    usage();
    process.exit(0);
}

if (command === 'post') {
    post(args);
} else if (command === 'view') {
    view(args);
} else {
    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(2);
}
