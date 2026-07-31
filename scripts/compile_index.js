import fs from 'fs';
import vm from 'vm';
const path = './index.js';
const code = fs.readFileSync(path, 'utf8');
try {
  new vm.SourceTextModule(code, { url: `file://${process.cwd().replace(/\\/g,'/')}/${path}` });
  console.log('Module parsed OK (did not throw at construction).');
} catch (error) {
  console.error('Compile error:', error && error.stack ? error.stack : error);
}