import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nextSeriesEpisode, chooseEligibleNextSource } from '../web/episode-autonext.mjs';

const series = { imdbId:'tt1234567', title:'Sample Show', episodesLoaded:true, episodes:[
  {id:'tt1234567:1:1',season:1,episode:1,title:'Opening'},
  {id:'tt1234567:1:2',season:1,episode:2,title:'Second'},
  {id:'tt1234567:2:1',season:2,episode:1,title:'Season Premiere'},
  {id:'tt1234567:2:3',season:2,episode:3,title:'Later'},
]};
const current = {imdb_id:'tt1234567',type:'series',season:1,episode:1};
const sourceId='b'.repeat(32);
test('same-series contiguous episode advances',()=>{
 const n=nextSeriesEpisode(series,current);
 assert.equal(n.season,1);assert.equal(n.episode,2);assert.equal(n.episode_title,'Second');
});
test('end of season advances to confirmed next season premiere',()=>{
 const n=nextSeriesEpisode(series,{...current,episode:2});
 assert.equal(n.season,2);assert.equal(n.episode,1);
});
test('gap or absent metadata never jumps arbitrarily',()=>{
 assert.equal(nextSeriesEpisode(series,{...current,season:2,episode:1}),null);
 assert.equal(nextSeriesEpisode({...series,episodesLoaded:false},current),null);
 assert.equal(nextSeriesEpisode({...series,episodes:[]},current),null);
 assert.equal(nextSeriesEpisode({...series,episodes:[{id:'tt1234567:1:2',season:1,episode:2},{id:'tt1234567:1:2',season:1,episode:2}]},current),null);
});
test('cross-series, movie and invalid identity denied',()=>{
 assert.equal(nextSeriesEpisode(series,{...current,imdb_id:'tt7654321'}),null);
 assert.equal(nextSeriesEpisode(series,{...current,type:'movie'}),null);
 assert.equal(nextSeriesEpisode(series,{...current,episode:0}),null);
 assert.equal(nextSeriesEpisode({...series,imdbId:'not-imdb'},current),null);
});
test('only verified next episode identity and eligible source accepted',()=>{
 const n=nextSeriesEpisode(series,current);
 const {episode_title,...target}=n;
 const r={...target,sources:[{id:sourceId,quality:'1080p'}]};
 assert.equal(chooseEligibleNextSource(r,n).id,sourceId);
 assert.equal(chooseEligibleNextSource({...r,episode:3},n),null);
 assert.equal(chooseEligibleNextSource({...r,type:'movie'},n),null);
 assert.equal(chooseEligibleNextSource({...r,sources:[{id:'bad',quality:'1080p'}]},n),null);
 assert.equal(chooseEligibleNextSource({...r,sources:[{id:sourceId,quality:'unknown'}]},n),null);
});
test('language hint or matching quality may prioritize without inventing tracks',()=>{
 const n=nextSeriesEpisode(series,current);
 const b={...n,sources:[{id:'a'.repeat(32),quality:'720p',languages:['French']},{id:sourceId,quality:'1080p',languages:['English']}]};
 assert.equal(chooseEligibleNextSource(b,n,{languages:['English'],quality:'720p'}).id,sourceId);
 assert.equal(chooseEligibleNextSource(b,n,{quality:'1080p'}).id,sourceId);
});
test('wiring retains no new remote endpoint or automation authority',()=>{
 const server=fs.readFileSync(new URL('../server.py',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 const player=fs.readFileSync(new URL('../player/aries_adapter.py',import.meta.url),'utf8');
 for(const f of ['/episode-autonext.mjs','/episode-auto-ui.mjs'])assert.ok(server.includes(f));
 for(const id of ['player-auto-next','player-next-now','player-next-cancel'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(app,/mountEpisodeAutoContinue/);
 assert.match(player,/"keep-open", "yes" if kind == "series" else "no"/);
 assert.match(player,/"eof-reached"/);
});
