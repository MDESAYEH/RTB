import { test } from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {securityPolicy} from "../lib/security-policy";
import {publicApiLimit,publicClientKey,reserveLive} from "../lib/public-api-limit";
import {createTournamentStore} from "../lib/store";
test("production CSP requires nonce scripts, blocks eval and objects, retains video frames",()=>{
 const policy=securityPolicy("random-nonce");
 const scripts=policy.split(";").find(s=>s.trim().startsWith("script-src"))!;
 assert.ok(scripts.includes("'nonce-random-nonce'"));assert.ok(scripts.includes("'strict-dynamic'"));
 assert.ok(!scripts.includes("unsafe-inline"));assert.ok(!policy.includes("unsafe-eval"));assert.ok(policy.includes("object-src 'none'"));assert.ok(policy.includes("youtube-nocookie.com"));assert.ok(securityPolicy("dev",true).includes("unsafe-eval"));
});
test("public throttling ignores untrusted IP headers and caps/reclaims shared live leases",async()=>{
 const oldVercel=process.env.VERCEL,oldTrust=process.env.TRUST_PROXY_IP;
 delete process.env.VERCEL;delete process.env.TRUST_PROXY_IP;
 const request=new Request("https://example.test/api/live",{headers:{"x-real-ip":"1.2.3.4"}});
 assert.equal(publicClientKey(request),"shared");
 process.env.TRUST_PROXY_IP="1";
 const repository=createTournamentStore(()=>({kind:"sqlite",path:join(mkdtempSync(join(tmpdir(),"rtb-security-")),"test.db")}));
 try {
   await repository.settings();
   assert.notEqual(publicClientKey(request),"1.2.3.4");
   assert.throws(()=>publicClientKey(new Request("https://example.test")));
   const releases=[];
   for(let i=0;i<8;i++){const release=await reserveLive(request,repository);assert.ok(release);releases.push(release);}
   assert.equal(await reserveLive(request,repository),null);
   await releases.pop()!();const replacement=await reserveLive(request,repository);assert.ok(replacement);await replacement();
   for(const release of releases)await release();
   for(let i=0;i<60;i++)assert.equal(await publicApiLimit(request,"live",repository),null);
   const rejected=await publicApiLimit(request,"live",repository);assert.equal(rejected?.status,429);assert.equal(rejected?.headers.get("retry-after"),"60");
 } finally {await repository.db.close();if(oldVercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=oldVercel;if(oldTrust===undefined)delete process.env.TRUST_PROXY_IP;else process.env.TRUST_PROXY_IP=oldTrust;}
});
