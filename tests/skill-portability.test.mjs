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
  assert.match(text, /MCP first; SDK\/CLI complementary/);
  assert.match(text, /Load only task-relevant detail/);
  assert.equal(readdirSync(resolve(skill, 'references')).filter((name) => name.endsWith('.md')).length, 12);
});
