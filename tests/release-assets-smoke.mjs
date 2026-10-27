import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workspace = mkdtempSync(join(tmpdir(), 'zeitspur-release-'));
const bin = join(workspace, 'bin');
mkdirSync(bin);
const tag = 'v0.33.0';
for (const type of ['static','portable']) {
  writeFileSync(join(workspace, `zeitspur-${tag}-${type}.zip`), 'zip fixture');
}
// Stub GH to verify the command choices without accessing GitHub.
const cli = join(bin, 'gh');
writeFileSync(cli, `#!/bin/sh\nprintf '%s\\n' "$*" >> "$GH_MOCK_LOG"\nif [ "$1" = release ] && [ "$2" = view ]; then\n  [ "$GH_MOCK_EXISTS" = yes ]\n  exit $?\nfi\nexit 0\n`, { mode: 0o755 });
const log = join(workspace, 'commands.log');
// Execute the exact inline GitHub Actions step (not a separate helper script).
// This matters when recovering an older tag that predates the workflow fix.
const workflow = readFileSync(new URL('../.github/workflows/docker-release.yml',import.meta.url),'utf8');
const marker = '      - name: Publish or attach GitHub release assets';
const step = workflow.slice(workflow.indexOf(marker));
const match = step.match(/        run: \|\n((?:          [^\n]*\n?)*)/);
assert.ok(match, 'release upload step must be inline');
const script = match[1].split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
const inlineScript = join(workspace,'release-step.sh');
writeFileSync(inlineScript,script);
function runScript(exists, releaseTag=tag) {
  writeFileSync(log, '');
  const result = spawnSync('bash', [inlineScript], {cwd:workspace,encoding:'utf8',env:{
    ...process.env,PATH:`${bin}:${process.env.PATH}`,RELEASE_TAG:releaseTag,
    GH_MOCK_LOG:log, GH_MOCK_EXISTS:exists
  }});
  return { ...result, lines: readFileSync(log,'utf8').trim().split('\n').filter(Boolean) };
}
const already = runScript('yes');
assert.equal(already.status, 0,already.stderr);
assert.ok(already.lines[0].includes('release view v0.33.0'));
assert.ok(already.lines[1].includes('release upload v0.33.0'));
assert.ok(already.lines[1].includes('--clobber'));
assert.equal(already.lines.length,2);
const missing=runScript('no');
assert.equal(missing.status,0,missing.stderr);
assert.ok(missing.lines[1].includes('release create v0.33.0'));
assert.ok(missing.lines[1].includes('--verify-tag'));
assert.equal(missing.lines.length,2);
const invalid = runScript('yes','main');
assert.notEqual(invalid.status,0);
assert.equal(invalid.lines.length,0);
console.log('PASS: releases are created only when missing; existing releases receive ZIP assets');
