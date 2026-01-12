import fs from 'fs';
import { parse } from 'acorn';
const code = fs.readFileSync('index.js','utf8');
try {
  parse(code, { ecmaVersion: 2024, sourceType: 'module' });
  console.log('Parsed OK');
} catch (e) {
  console.error('Parse error:', e.message);
  console.error('Loc:', e.loc);
}
