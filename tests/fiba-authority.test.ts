import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseEventPage,parseStandingsPage} from "../lib/providers/fiba/parser";
import {buildPlan} from "../lib/providers/fiba/plan";
import {parseOfficialProfile} from "../lib/providers/fiba/team-details";
import {gameSchema,teamSchema} from "../lib/domain";
import {parseNews,planNews} from "../lib/providers/fiba/news";
const fixture=(n:string)=>readFileSync(new URL(`./fixtures/${n}`,import.meta.url),"utf8");
test("official authority corrects manually edited identity and existing fixture without duplicates",()=>{
  const event=parseEventPage(fixture("fiba-games.html"));
  const standings=parseStandingsPage(fixture("fiba-standings.html"));
  const itt=event.teams.find(t=>t.slug === "al-ittihad")!,stade=event.teams.find(t=>t.slug === "stade-malien")!;
  itt.countryName="Libya";itt.sourceLogo="https://assets.fiba.basketball/official.webp";
  event.games=[{...event.games[0],gameId:999,teamA:itt,teamB:stade,gameDateTimeUTC:"2026-10-21T15:00:00Z",hasTimeGameDateTime:true,teamAScore:15,teamBScore:10,isLive:true}];
  const teams=[teamSchema.parse({id:"al-ittihad",name:"Wrong name",country:"Wrong country",group:"B",fibaTeamId:itt.teamId}),teamSchema.parse({id:"stade-malien",name:"Stade Malien",country:"Mali",group:"A"})];
  const game=gameSchema.parse({id:"manual-fixture",home:"al-ittihad",away:"stade-malien",group:"A",date:"2026-10-22T15:00:00Z",homeScore:1,awayScore:2});
  const plan=buildPlan(event,standings,{settings:{groups:["A","B"]},teams,games:[game],overridden:new Set(["teams:al-ittihad","games:manual-fixture"])},{authoritative:true});
  const fixed=plan.entries.find(e=>e.id === "al-ittihad")!;
  assert.equal(fixed.action,"update");assert.equal((fixed.value as typeof teams[number]).name,"Al Ittihad");assert.equal((fixed.value as typeof teams[number]).country,"Libya");assert.equal((fixed.value as typeof teams[number]).sourceLogo,itt.sourceLogo);
  const updated=plan.entries.find(e=>e.kind === "games")!;assert.equal(updated.id,"manual-fixture");assert.equal(updated.action,"update");assert.equal((updated.value as typeof game).homeScore,15);
});
test("official news wins over local edits when authoritative",()=>{
 const n=parseNews(`<script type="application/ld+json">{"@type":"Article","about":"Official title","abstract":"Summary","datePublished":"2026-10-01T00:00:00Z"}</script>`,"https://www.fiba.basketball/en/news/story");
 const entry=planNews([n],[{...n,title:"Wrong"}],new Set([`news:${n.id}`]),true)[0];assert.equal(entry.action,"update");assert.equal((entry.value as typeof n).title,n.title);
});
test("official profile country must match the requested team identity",()=>{
 const payload=JSON.stringify('0:'+JSON.stringify({profile:{teamId:123,countryName:"Libya"}}));
 const html=`<script>self.__next_f.push([1,${payload}])</script>`;
 assert.equal(parseOfficialProfile(html,123).countryName,"Libya");assert.throws(()=>parseOfficialProfile(html,456));
});
