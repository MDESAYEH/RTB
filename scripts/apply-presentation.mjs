import fs from 'node:fs';
const path='app/site.tsx'; let s=fs.readFileSync(path,'utf8');
const start=s.indexOf('        {!live.length ? ('); const end=s.indexOf('        <div className="ticker">',start);
if(start<0||end<0)throw Error('Hero boundary missing');
s=s.slice(0,start)+`        <CampaignHero count={count} seconds={seconds} ended={now > Date.parse(s.end)} />\n`+s.slice(end);
fs.writeFileSync(path,s);
