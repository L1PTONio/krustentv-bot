import fs from 'fs';
const src = fs.readFileSync('index.js','utf8');
const stack = [];
let lastWord = '';
for (let i=0;i<src.length;i++){
  const ch = src[i];
  if (/\w/.test(ch)) lastWord += ch; else { if (lastWord.length>0) lastWord = lastWord; lastWord = ''; }
  // detect 'function' keyword ending at i
  if (i>=7 && src.slice(i-8+1,i+1)==='function') {
    lastWord = 'function';
  }
  // detect => operator
  if (src.slice(i-1,i+1)==='=>') {
    lastWord = 'arrow';
  }
  if (ch === '{') {
    const isFunc = (lastWord==='function' || lastWord==='arrow' || /\basync\b/.test(src.slice(Math.max(0,i-20),i)));
    stack.push({pos:i,isFunction:isFunc});
    lastWord = '';
  }
  if (ch === '}') {
    stack.pop();
  }
}
// Now find return occurrences and check stack at that point by re-scanning but tracking stack similarly
let res = [];
stack.length = 0;
lastWord = '';
for (let i=0;i<src.length;i++){
  const ch = src[i];
  if (/\w/.test(ch)) lastWord += ch; else { if (lastWord.length>0) {} lastWord = ''; }
  if (i>=7 && src.slice(i-8+1,i+1)==='function') lastWord = 'function';
  if (src.slice(i-1,i+1)==='=>') lastWord = 'arrow';
  if (ch === '{') {
    const isFunc = (lastWord==='function' || lastWord==='arrow' || /\basync\b/.test(src.slice(Math.max(0,i-20),i)));
    stack.push({pos:i,isFunction:isFunc});
    lastWord = '';
  }
  if (ch === '}') stack.pop();
  // check for return token starting here
  if (src.slice(i,i+6)==='return' && /\breturn\b/.test(src.slice(i,i+6))) {
    // determine if any function block exists in stack
    const inFunc = stack.some(s=>s.isFunction);
    // get line number
    const pre = src.slice(0,i);
    const line = pre.split('\n').length;
    const lineText = src.split('\n')[line-1];
    res.push({index:i,line,lineText:lineText.trim(),inFunc});
  }
}
console.log('Found',res.length,'return tokens. Listing those not in a detected function:');
res.filter(r=>!r.inFunc).forEach(r=>console.log('Line',r.line,':',r.lineText));
console.log('\n(Also reporting all returns with inFunc flag for inspection)');
res.forEach(r=>console.log('Line',r.line, r.inFunc ? 'inFunc' : 'TOPLEVEL', ':', r.lineText));
