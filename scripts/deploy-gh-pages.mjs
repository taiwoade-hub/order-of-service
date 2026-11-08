import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const deployDir = path.join(rootDir, '.gh-pages-deploy');
const publicDir = path.join(rootDir, 'public');

console.log('🚀 Preparing GitHub Pages deployment...');

// Clean any previous deploy directory
if (fs.existsSync(deployDir)) {
  fs.rmSync(deployDir, { recursive: true, force: true });
}
fs.mkdirSync(deployDir, { recursive: true });

// Copy all public assets to deploy directory
const publicFiles = fs.readdirSync(publicDir);
for (const file of publicFiles) {
  const src = path.join(publicDir, file);
  if (file === 'order-of-service.html') {
    // Primary index.html and fallback 404.html for GitHub Pages
    fs.copyFileSync(src, path.join(deployDir, 'index.html'));
    fs.copyFileSync(src, path.join(deployDir, '404.html'));
    fs.copyFileSync(src, path.join(deployDir, 'order-of-service.html'));
  } else {
    const dest = path.join(deployDir, file);
    fs.cpSync(src, dest, { recursive: true });
  }
}

// Add .nojekyll so GitHub Pages does not run Jekyll engine
fs.writeFileSync(path.join(deployDir, '.nojekyll'), '');

console.log('📦 Static files packaged for gh-pages:');
fs.readdirSync(deployDir).forEach(f => console.log('   - ' + f));

// Git operations
const remoteUrl = execSync('git config --get remote.origin.url', { cwd: rootDir }).toString().trim();
const commitSha = execSync('git rev-parse --short HEAD', { cwd: rootDir }).toString().trim();

console.log(`🔗 Remote target: ${remoteUrl}`);
console.log(`📌 Source commit: ${commitSha}`);

try {
  execSync('git init -b gh-pages', { cwd: deployDir, stdio: 'pipe' });
  execSync(`git remote add origin ${remoteUrl}`, { cwd: deployDir, stdio: 'pipe' });
  execSync('git add -A', { cwd: deployDir, stdio: 'pipe' });
  execSync(`git commit -m "deploy: release to GitHub Pages (${commitSha})"`, { cwd: deployDir, stdio: 'pipe' });
  
  console.log('📤 Pushing to origin/gh-pages...');
  execSync('git push -f origin gh-pages', { cwd: deployDir, stdio: 'inherit' });
  
  console.log('✅ Successfully deployed to GitHub Pages!');
  console.log(`🌐 GitHub Pages URL: https://taiwoade-hub.github.io/order-of-service/`);
} finally {
  // Cleanup deploy directory
  if (fs.existsSync(deployDir)) {
    fs.rmSync(deployDir, { recursive: true, force: true });
  }
}
