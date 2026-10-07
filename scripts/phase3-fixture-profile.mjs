// Only public records are copied; old QA credentials/sessions are never reused.
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,copyFileSync,existsSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
const source=JSON.parse(await (await import('node:fs/promises')).readFile('verification/phase2/qa-database.json','utf8')).database;
const root=resolve('data/phase3-profile-'+Date.now());mkdirSync(root,{recursive:true});
const read=new DatabaseSync(source,{readOnly:true});
const target=new DatabaseSync(resolve(root,'road.db'));
target.exec('CREATE TABLE records(kind TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(kind,id))');
const rows=read.prepare('SELECT kind,id,body FROM records').all();
for(const row of rows)target.prepare('INSERT INTO records VALUES(?,?,?)').run(row.kind,row.id,row.body);
read.close();target.close();
const media=resolve(source,'../media');
if(existsSync(media)){mkdirSync(resolve(root,'media'));for(const name of readdirSync(media))copyFileSync(resolve(media,name),resolve(root,'media',name));}
const origin='http://127.0.0.1:3002';let logs='';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3002'],{env:{...process.env,DATABASE_PATH:resolve(root,'road.db'),SITE_URL:origin},stdio:['ignore','pipe','pipe']});
server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
try{
 for(let n=0;n<100;n++){try{if((await fetch(origin+'/api/data')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 const code=await new Promise(r=>{const p=spawn(process.execPath,['scripts/phase3-profile.mjs',process.argv[2]||'optimized-fixture'],{env:{...process.env,E2E_BASE_URL:origin},stdio:'inherit'});p.on('exit',r);});
 if(code!==0)throw Error('Profile failed');
}finally{server.kill();writeFileSync('verification/phase3/fixture-server.log',logs);}
