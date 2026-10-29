import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const skill = resolve(root, 'skills/make-custom-apps');

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.name === 'node_modules') return [];
    return entry.isDirectory() ? markdownFiles(path) : path.endsWith('.md') ? [path] : [];
  });
}

function links(file) {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((match) => match[1]);
}

test('the standalone skill has no broken repository-relative references', () => {
  const broken = [];
  let checked = 0;
  for (const file of markdownFiles(skill)) {
    for (const link of links(file)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(link)) continue;
      const [path, fragment] = link.split('#', 2);
      const target = path ? resolve(dirname(file), decodeURIComponent(path)) : file;
      checked += 1;
      if (!existsSync(target)) {
        broken.push(`${file.slice(root.length)} -> ${link}`);
      } else if (fragment && statSync(target).isFile() && target.endsWith('.md')) {
        const headings = [...readFileSync(target, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) =>
          match[1].toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-'));
        if (!headings.includes(decodeURIComponent(fragment))) broken.push(`${file.slice(root.length)} -> ${link}`);
      }
    }
  }
  assert.ok(checked > 0, 'No local links were checked');
  assert.deepEqual(broken, [], `Broken standalone references:\n${broken.join('\n')}`);
});

test('documented repository npm commands are available after migration', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const names = new Set();
  for (const file of [resolve(root, 'README.md'), ...markdownFiles(skill)]) {
    for (const match of readFileSync(file, 'utf8').matchAll(/npm run ([A-Za-z0-9:_-]+)/g)) names.add(match[1]);
  }
  assert.ok(names.has('check:custom-apps'), 'Inherited command must remain covered');
  for (const name of names) assert.ok(pkg.scripts[name], `Missing documented npm command: ${name}`);
});

test('keeps the discoverable skill identity and progressive-disclosure structure', () => {
  const text = readFileSync(resolve(skill, 'SKILL.md'), 'utf8');
  assert.match(text, /^---\nname: make-custom-apps\n/);
  const description = text.match(/^description: (.+)$/m)?.[1];
  assert.ok(description && description.length <= 1024);
  assert.ok(text.split('\n').length < 500);
  assert.match(text, /Load only task-relevant detail/);
});

test('baseline references are linked from SKILL.md, every reference is reachable, and core and review references resolve', () => {
  const skillFile = resolve(skill, 'SKILL.md');
  const referencesDir = resolve(skill, 'references');
  const baseline = [
    'research-and-inventory', 'source-hierarchy', 'base-and-connections', 'requests-and-responses',
    'modules-and-pagination', 'parameters-and-rpcs', 'webhooks-and-polling', 'iml-functions',
    'sdk-endpoints', 'tooling-and-release', 'review-and-qa', 'maintenance',
  ].map((name) => `${name}.md`);
  const required = [...baseline, 'review-sweeps.md'];
  const present = readdirSync(referencesDir).filter((name) => name.endsWith('.md'));
  const localTargets = (file) =>
    links(file)
      .filter((link) => !/^[a-z][a-z0-9+.-]*:/i.test(link) && !link.startsWith('#'))
      .map((link) => resolve(dirname(file), decodeURIComponent(link.split('#', 1)[0])))
      .filter((target) => target.endsWith('.md') && existsSync(target));
  // Local Markdown reachable from the entry point, directly or through other docs (cycle-safe).
  const reachable = new Set([skillFile]);
  const queue = [skillFile];
  while (queue.length) {
    for (const target of localTargets(queue.shift())) {
      if (!reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }
  // Baseline and the review workflow must be linked directly from the entry point.
  const linked = new Set(localTargets(skillFile));

  // Baseline and the review workflow must exist and be reachable from the skill entry point.
  for (const name of required) {
    const target = resolve(referencesDir, name);
    assert.ok(present.includes(name), `Missing required reference: ${name}`);
    assert.ok(linked.has(target), `Required reference is not linked from SKILL.md: ${name}`);
  }
  // Additional references may be reached through another reference or index, but none may be orphaned.
  for (const name of present) {
    assert.ok(reachable.has(resolve(referencesDir, name)), `Unreachable reference: ${name}`);
  }
  // Review workflow routes to the current-knowledge index and its worked examples, and back.
  const sweeps = resolve(referencesDir, 'review-sweeps.md');
  const sweepTargets = links(sweeps).map((link) => resolve(dirname(sweeps), link.split('#', 1)[0]));
  for (const target of [
    resolve(skill, 'examples/current-knowledge/README.md'),
    resolve(skill, 'examples/current-knowledge/guides/role-application-examples.md'),
  ]) {
    assert.ok(sweepTargets.includes(target), `review-sweeps.md does not link ${target.slice(root.length)}`);
    assert.ok(existsSync(target), `Missing review target: ${target.slice(root.length)}`);
  }
  const index = resolve(skill, 'examples/current-knowledge/README.md');
  const indexTargets = links(index).map((link) => resolve(dirname(index), link.split('#', 1)[0]));
  assert.ok(indexTargets.includes(sweeps), 'Current-knowledge index does not route to review-sweeps.md');
});
