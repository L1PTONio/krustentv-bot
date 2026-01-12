import fs from 'fs';
import vm from 'vm';
const path = './index.js';
const code = fs.readFileSync(path, 'utf8');
try {
  const m = new vm.SourceTextModule(code, { url: `file://${process.cwd().replace(/\\/g,'/')}/${path}` });
  console.log('Module parsed OK (did not throw at construction).');
} catch (e) {
  console.error('Compile error:', e && e.stack ? e.stack : e);
}