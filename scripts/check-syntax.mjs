import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from '@babel/parser';

const root = new URL('..', import.meta.url).pathname;

function collectJavaScript(directory) {
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJavaScript(path));
    } else if (entry.name.endsWith('.js')) {
      results.push(path);
    }
  }
  return results;
}

for (const file of collectJavaScript(join(root, 'api'))) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

const htmlPath = join(root, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const scriptMatch = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('index.html의 Babel script를 찾지 못했습니다.');
parse(scriptMatch[1], {
  sourceType: 'script',
  plugins: ['jsx']
});

console.log('Syntax check passed:', collectJavaScript(join(root, 'api')).length, 'API files + index.html JSX');
