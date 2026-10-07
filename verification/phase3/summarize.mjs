import {readFileSync,writeFileSync} from 'node:fs';
const report={};
for(const stage of ['baseline','optimized','final']){
const {results}=JSON.parse(readFileSync(`verification/phase3/${stage}.json`));
report[stage]=results.map(r=>({lcp:r.lcp.at(-1).time,cls:r.cls,ttfb:r.navigation.responseStart,renderDelay:r.lcp.at(-1).time-r.navigation.responseStart,js:r.resources.filter(x=>x.type==='script').reduce((n,x)=>n+x.bytes,0),fonts:r.resources.filter(x=>x.url.includes('.woff')).reduce((n,x)=>n+x.bytes,0),tasks:r.longTasks.reduce((n,x)=>n+x.duration,0),longest:Math.max(...r.longTasks.map(x=>x.duration)),scripts:r.resources.filter(x=>x.type==='script').map(x=>({name:x.url.split('/').at(-1),bytes:x.bytes}))}));
}
writeFileSync('verification/phase3/comparison.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
