/**
 * CI typecheck for Phase 1 multiverse client modules.
 * Full-repo `tsc --noEmit` has pre-existing errors outside this scope.
 */
const { execSync } = require('child_process');

let output = '';
try {
    execSync('npx tsc --noEmit', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
}

const multiverseErrors = output
    .split(/\r?\n/)
    .filter((line) => line.includes('error TS') && line.includes('src/multiverse/'));

if (multiverseErrors.length > 0) {
    console.error(multiverseErrors.join('\n'));
    process.exit(1);
}

console.log('[typecheck-multiverse] No TypeScript errors in src/multiverse/');
