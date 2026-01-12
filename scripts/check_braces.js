import fs from 'fs';
const src = fs.readFileSync('index.js','utf8');
let curly = 0, paren = 0, square = 0;
for (let i=0;i<src.length;i++){
  const ch = src[i];
  if (ch==='(') paren++;
  if (ch===')') paren--;
  if (ch==='{') curly++;
  if (ch==='}') curly--;
  if (ch==='[') square++;
  if (ch===']') square--;
  if (paren<0 || curly<0 || square<0) {
    console.log('Unbalanced at index', i, 'char', ch);
    // print surrounding context
    console.log(src.slice(Math.max(0,i-80), Math.min(src.length, i+80)));
    process.exit(1);
  }
}
console.log('Final counts -> curly:', curly, 'paren:', paren, 'square:', square);
if (curly !== 0 || paren !== 0 || square !== 0) {
  console.log('Possible unbalanced braces.');
}
else console.log('Brace counts balanced.');