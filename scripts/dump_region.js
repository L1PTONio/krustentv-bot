import fs from 'fs';
const src = fs.readFileSync('index.js','utf8');
const start = 1800; const end = 2020;
console.log('Chars', start, 'to', end);
console.log(src.slice(start,end));

// Also print lines with numbers
const lines = src.split('\n');
for (let i=1;i<=120;i++) console.log(i, lines[i-1]);