// How `create-app.ts` can be run directly on a given Node version:
//   'unsupported' - no type stripping (Node 20, 21, 22.0-22.5); use the compiled `npm run dry-run`.
//   'flag'        - needs `--experimental-strip-types` (Node 22.6-22.17, 23.0-23.5).
//   'default'     - strips types without a flag (Node 22.18+, 23.6+, 24+); the flag is still accepted.
export function directTypeScriptRun(version) {
  const match = /^(\d+)\.(\d+)\./.exec(`${version}.`);
  if (!match) return 'unsupported';
  const [major, minor] = [Number(match[1]), Number(match[2])];
  if (major >= 24) return 'default';
  if (major === 23) return minor >= 6 ? 'default' : 'flag';
  if (major === 22) return minor >= 18 ? 'default' : minor >= 6 ? 'flag' : 'unsupported';
  return 'unsupported';
}
