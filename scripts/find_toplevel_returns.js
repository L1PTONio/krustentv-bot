import fs from 'fs';
const code = fs.readFileSync('index.js', 'utf8');
const lines = code.split('\n');
let funcDepth = 0;
let braceDepth = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // crude detect function starts: 'function', '=>' followed by '{', 'async (' ...
  // count braces
  for (let ch of line) { if (ch === '{') braceDepth++; if (ch === '}') braceDepth--; }
  // detect function-like starts on the line
  if (/\bfunction\b/.test(line) || /=>\s*\{/.test(line) || /async\s*\(/.test(line)) {
    funcDepth = Math.max(funcDepth, braceDepth);
  }
  // check for return at this line
  if (/\breturn\b/.test(line)) {
    if (funcDepth === 0) {
      console.log('Possible top-level return at line', i+1, ':', line.trim());
    }
  }
}
console.log('Scan complete.');