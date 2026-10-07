import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const stage = process.argv[2] || 'baseline';
const base=process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
mkdirSync('verification/phase3', { recursive: true });
const browser = await chromium.launch({channel:'chrome'});
const results=[];
for(let sample=0;sample<3;sample++) {
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');
 await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1600000/8,uploadThroughput:750000/8});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{
  window.__profile={lcp:[],cls:0,longTasks:[]};
  new PerformanceObserver(list=>{for(const e of list.getEntries())window.__profile.lcp.push({time:e.startTime,size:e.size,url:e.url,element:e.element?.outerHTML?.slice(0,500),font:e.element?getComputedStyle(e.element).fontFamily:null});}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__profile.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
  new PerformanceObserver(list=>{for(const e of list.getEntries())window.__profile.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
 });
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 await page.locator('footer').waitFor();
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForTimeout(3500);
 results.push(await page.evaluate(()=>({
  ...window.__profile,navigation:performance.getEntriesByType('navigation')[0].toJSON(),
  resources:performance.getEntriesByType('resource').map(r=>({url:r.name,type:r.initiatorType,start:r.startTime,request:r.requestStart,response:r.responseStart,end:r.responseEnd,bytes:r.encodedBodySize,blocking:r.renderBlockingStatus})),
  fonts:[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status,display:f.display})),
  images:[...document.querySelectorAll('.hero img')].map(i=>({src:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight})),
  preloads:[...document.querySelectorAll('link[rel=preload]')].map(l=>({href:l.href,as:l.as})),
 })));
 if(sample===0) await page.screenshot({path:`verification/phase3/${stage}-390.png`,fullPage:false});
 await context.close();
}
await browser.close();
writeFileSync(`verification/phase3/${stage}.json`,JSON.stringify({conditions:'cold cache;390x844;CPU4x;RTT150ms;1.6Mbps;3 samples',results},null,2));
console.log(JSON.stringify(results.map(r=>({lcp:r.lcp.at(-1),cls:r.cls,ttfb:r.navigation.responseStart,fonts:r.resources.filter(x=>x.url.includes('.woff')).map(x=>({url:x.url,start:x.start,end:x.end,bytes:x.bytes})),css:r.resources.filter(x=>x.url.includes('.css'))}))));
