import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:390,height:844}});
await page.route('**/teams/stade-malien?*',async route=>{await new Promise(r=>setTimeout(r,1200));await route.continue();});
await page.goto('http://127.0.0.1:3000/teams',{waitUntil:'networkidle'});
await page.locator('.team-line[href="/teams/stade-malien"]').click();
const loading=page.locator('.basketball-loading');console.log('Loading observed:',await loading.isVisible());if(await loading.isVisible())await page.screenshot({path:'verification/design-rebuild/loader-actual-navigation.png'});
await page.waitForURL('**/teams/stade-malien');console.log('Destination reached:',await page.locator('.club-name-block h1').isVisible());await browser.close();
