// Extracts inline <script> blocks (without src) from index.html and syntax-checks them with node --check
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const file = process.argv[2] || '/home/z/my-project/download/redeem-order-service/index.html';
const html = fs.readFileSync(file, 'utf8');

const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, i = 0, failed = 0;
const tmpDir = '/home/z/my-project/scripts/_extracted';
fs.mkdirSync(tmpDir, { recursive: true });

while ((m = re.exec(html)) !== null) {
  const code = m[1];
  if (!code.trim()) continue;
  i++;
  const tmp = path.join(tmpDir, 'block-' + i + '.js');
  fs.writeFileSync(tmp, code);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log('OK   block ' + i + ' (' + code.split('\n').length + ' lines)');
  } catch (e) {
    failed++;
    console.error('FAIL block ' + i + ':');
    console.error(String(e.stderr || e.message).split('\n').slice(0, 12).join('\n'));
  }
}
console.log('Total inline blocks: ' + i + (failed ? ', FAILED: ' + failed : ', all passed'));
process.exit(failed ? 1 : 0);
