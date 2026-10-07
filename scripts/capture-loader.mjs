import {chromium} from '@playwright/test';import fs from 'node:fs';
const out='verification/design-rebuild',browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
await page.goto('http://127.0.0.1:3000/');await page.evaluate(()=>document.fonts.ready);
const html=fs.readFileSync(out+'/loader-markup.html','utf8');const css=fs.readFileSync('app/basketball-loading.css','utf8');
await page.locator('body').evaluate((el,html)=>el.innerHTML=html,html);await page.addStyleTag({content:css});await page.screenshot({path:out+'/loader-desktop.png'});
await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/loader-mobile.png'});
console.log(await page.locator('.loading-ball-route').evaluate(el=>({animation:getComputedStyle(el).animationName,overflow:document.documentElement.scrollWidth>innerWidth})));await browser.close();
