import { createRequire } from 'node:module';
const root = createRequire(new URL('../package.json', import.meta.url));
const web = createRequire(new URL('../apps/web/package.json', import.meta.url));
const [major, minor, patch] = process.versions.node.split('.').map(Number);
if (major !== 22 || minor < 22 || (minor === 22 && patch < 2)) throw new Error('Use Node 22.22.2+ in the Node 22 LTS line (.node-version).');
for (const name of ['react', 'react-dom']) {
  const rootPath = root.resolve(name + '/package.json');
  const webPath = web.resolve(name + '/package.json');
  const expected = web('./package.json').dependencies[name];
  if (rootPath !== webPath || web(name + '/package.json').version !== expected) {
    throw new Error(name + ' resolution drift: reinstall using the pinned Bun version and frozen lockfile.');
  }
}
console.log('Node and shared React resolution checks passed.');
