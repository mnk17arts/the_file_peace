import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('verify privacy contract: zero external font or script CDN links in index.html', () => {
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  assert.equal(indexHtml.includes('fonts.googleapis.com'), false, 'index.html must not request fonts.googleapis.com');
  assert.equal(indexHtml.includes('fonts.gstatic.com'), false, 'index.html must not request fonts.gstatic.com');
  assert.equal(indexHtml.includes('unpkg.com'), false, 'index.html must not request unpkg.com');
  assert.equal(indexHtml.includes('cdn.jsdelivr.net'), false, 'index.html must not request cdn.jsdelivr.net');
});

test('verify local WebAssembly and FFmpeg assets exist in public folder', () => {
  const coreJsPath = path.join(rootDir, 'public', 'ffmpeg-core.js');
  const coreWasmPath = path.join(rootDir, 'public', 'ffmpeg-core.wasm');

  assert.equal(fs.existsSync(coreJsPath), true, 'public/ffmpeg-core.js must exist');
  assert.equal(fs.existsSync(coreWasmPath), true, 'public/ffmpeg-core.wasm must exist');
  assert.ok(fs.statSync(coreJsPath).size > 1000, 'public/ffmpeg-core.js must not be empty');
  assert.ok(fs.statSync(coreWasmPath).size > 1000000, 'public/ffmpeg-core.wasm must be valid WebAssembly binary');
});

test('verify tool routes in toolsRegistry.js are defined in App.jsx', () => {
  const registryContent = fs.readFileSync(path.join(rootDir, 'src', 'data', 'toolsRegistry.js'), 'utf8');
  const appContent = fs.readFileSync(path.join(rootDir, 'src', 'App.jsx'), 'utf8');

  // Strip comments so commented-out tools are not tested
  const cleanRegistry = registryContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const routeMatches = [...cleanRegistry.matchAll(/to:\s*["']\/([^"']+)["']/g)].map(m => m[1]);
  assert.ok(routeMatches.length > 0, 'toolsRegistry.js should define tool links');

  for (const route of routeMatches) {
    const routeRegex = new RegExp(`path=["']${route}["']`);
    assert.ok(
      routeRegex.test(appContent),
      `Route "/${route}" found in toolsRegistry.js must be declared in App.jsx`
    );
  }
});

test('verify version synchronization between package.json and README.md', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');

  assert.ok(
    readme.includes(`v${pkg.version}`),
    `README.md should mention current package version v${pkg.version}`
  );
});

test('verify production build distribution integrity', () => {
  const distDir = path.join(rootDir, 'dist');
  assert.ok(fs.existsSync(distDir), 'dist/ directory must exist');
  assert.ok(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html must exist');
  
  const distHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  assert.ok(distHtml.includes('The File Peace'), 'dist/index.html should have site title');

  const assetsDir = path.join(distDir, 'assets');
  assert.ok(fs.existsSync(assetsDir), 'dist/assets must exist');
  const files = fs.readdirSync(assetsDir);
  
  // Ensure only minified pdf worker is emitted, not the duplicate unminified one
  const unminifiedWorker = files.find(f => f.startsWith('pdf.worker-') && f.endsWith('.mjs'));
  assert.equal(unminifiedWorker, undefined, 'dist/assets should not bundle duplicate unminified pdf worker');
});
