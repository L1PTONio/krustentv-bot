import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const src = fs.readFileSync('index.js','utf8');
let lo = 0, hi = src.length;
let attempt = 0;

async function testSlice(start, end) {
  const fragment = src.slice(start,end);
  const temp = `// TEMP SLICE\n${fragment}\n// EOF`;
  fs.writeFileSync('index_temp.js', temp);
  try {
    await import(`file://${process.cwd().replace(/\\/g,'/')}/index_temp.js`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.stack ? e.stack : e };
  }
}

(async function(){
  // Narrow down by binary search on position
  let a = 0, b = src.length;
  let errPos = -1;
  for (let i=0;i<20;i++) {
    const mid = Math.floor((a+b)/2);
    attempt++;
    console.log(`Attempt ${attempt}: testing [${a},${mid})`);
    const r = await testSlice(a, mid);
    if (!r.ok) {
      // error in first half
      b = mid;
      errPos = mid;
      console.log('Error found in first half');
    } else {
      // first half ok; error must be in second half
      a = mid;
      console.log('First half OK; moving right');
    }
    if (b - a < 100) break;
  }
  console.log('Narrowed range approx:', a, b);
  console.log('Snippet around error:');
  console.log(src.slice(Math.max(0,a-200), Math.min(src.length, b+200)));
})();