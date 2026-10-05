import path from 'path';
import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const data = new Uint8Array(fs.readFileSync('C:/git_project/garment/garment-erp/electron/verify_noresize.pdf'));
const pdf = await pdfjsLib.getDocument({ data }).promise;
const page = await pdf.getPage(1);
const vp = page.getViewport({ scale: 1.0 });
const tc = await page.getTextContent();
let minX=1e9,maxX=-1e9;
tc.items.forEach(it=>{const x=it.transform[4],x2=x+it.width;minX=Math.min(minX,x);maxX=Math.max(maxX,x2)});
console.log('pageW=',vp.width.toFixed(1),'contentSpanX=',(maxX-minX).toFixed(1),'usedPct=',((maxX-minX)/vp.width*100).toFixed(1)+'%');
const right=tc.items.slice().sort((a,b)=>b.transform[4]-a.transform[4]).slice(0,3);
right.forEach(i=>console.log('  right x='+i.transform[4].toFixed(1)+' :',String(i.str).slice(0,30)));
process.exit(0);