import {chromium} from '@playwright/test';
import fs from 'node:fs';
const out='verification/design-rebuild';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:out+'/home-first-desktop.png'});await page.screenshot({path:out+'/home-full-desktop.png',fullPage:true});
for(const [name,css] of [['paper','.event-home>section.tipoff-hero{background:#f0efe9}.tipoff-word{color:#ff5e24}.tipoff-arc{stroke:#ff5e24}'],['ink','.event-home>section.tipoff-hero{background:#101b22;color:#f0efe9}.tipoff-word{color:#ff5e24}.tipoff-kicker b,.tipoff-action,.tipoff-bottom{border-color:#f0efe965}.tipoff-word span{color:#d8ee55}']]){const style=await page.addStyleTag({content:css});await page.screenshot({path:out+'/exploration-'+name+'.png'});await style.evaluate(e=>e.remove());}
await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/home-first-mobile.png'});await page.screenshot({path:out+'/home-full-mobile.png',fullPage:true});
for(const path of ['/teams','/the-road','/standings','/stats','/news']){await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:3000'+path,{waitUntil:'networkidle'});await page.screenshot({path:out+'/'+path.slice(1)+'.png'});}
await browser.close();
