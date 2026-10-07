import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome'}),results=[];
for(const mode of ['normal','no-page-js','no-fonts']){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 if(mode==='no-page-js')await page.route(/\/_next\/static\/.*\.js(?:\?|$)/,r=>r.abort());
 if(mode==='no-fonts')await page.route(/\.woff2?(?:\?|$)/,r=>r.abort());
 const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{window.__diag={lcp:0,element:'',cls:0};new PerformanceObserver(l=>{for(const e of l.getEntries()){window.__diag.lcp=e.startTime;window.__diag.element=e.element?.outerHTML?.slice(0,250);}}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__diag.cls+=e.value;}).observe({type:'layout-shift',buffered:true});});
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(6500);
 results.push({mode,...await page.evaluate(()=>window.__diag)});
 await context.close();
}
await browser.close();writeFileSync('verification/phase3/render-diagnostics.json',JSON.stringify({note:'Diagnostic only; blocking JS/fonts changes rendering and is not a shippable mode or an isolated hydration duration measurement.',results},null,2));console.log(JSON.stringify(results));
