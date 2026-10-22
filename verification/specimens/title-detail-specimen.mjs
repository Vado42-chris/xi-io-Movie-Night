// Explicit UI fixtures, never playback/account callbacks or persistent user state.
import { CenteredCarousel } from '/filter-cubes.mjs';
const $ = id => document.getElementById(id);
const make = (tag, cls, text='') => { const node=document.createElement(tag);node.className=cls;node.textContent=text;return node; };
const records = Array.from({length:13},(_,i)=>({id:`sample-${i+1}`,imdbId:`sample-${i+1}`,type:'series',title:`Example series ${String(i+1).padStart(2,'0')}`,year:null,poster:''}));
let selected=records[6], episode=null;
function poster(record) {
 const wrap=make('span','poster-wrap');const placeholder=make('span','poster-placeholder');
 placeholder.append(make('span','',record.type==='series'?'TV':'Film'),make('span','',record.title));wrap.append(placeholder);return wrap;
}
function renderEpisodes() {
 const state=$('specimen-state').value,season=Number($('specimen-season').value);episode=null;
 $('episode-selected').textContent='No episode selected';$('episode-rows').replaceChildren();
 $('episode-rows').setAttribute('aria-busy',String(state==='loading'));
 const notices={ready:'Example season data. Nothing is queued or playing.',loading:'Loading-state specimen. No provider request is running.',empty:'No episode metadata is available for this season.',error:'Episode metadata is unavailable. Keep the selected series and season; do not substitute a different episode.'};
 $('episode-status').textContent=notices[state];if(state!=='ready')return;
 const count=season===0?2:6;
 for(let i=1;i<=count;i++){
  const button=make('button','episode-row');button.type='button';button.dataset.episode=String(i);button.setAttribute('aria-pressed','false');
  button.setAttribute('aria-label',`Select ${season===0?'special':`season ${season} episode`} ${i}`);
  const copy=make('span','episode-copy');copy.append(make('strong','',season===0?`Example special ${i}`:`Example episode ${i}`),make('span','',i===1&&season===1?'Resume state example · progress is illustrative':'Synopsis slot · sample metadata'));
  button.append(make('span','episode-number',season===0?`SP ${i}`:`E${String(i).padStart(2,'0')}`),copy);
  button.addEventListener('click',()=>{episode={series:selected.id,season,episode:i};for(const item of $('episode-rows').children)item.setAttribute('aria-pressed',String(item===button));$('episode-selected').textContent=`Selected sample: ${season===0?'Special':`Season ${season}, episode`} ${i}. Playback remains unbound.`;});
  $('episode-rows').append(button);
 }
}
function renderRecommendations(){
 const state=$('specimen-state').value;$('recommendation-rows').replaceChildren();
 const notices={ready:'Sample recommendation slots, not a live provider ranking.',loading:'Loading-state specimen. No recommendation request is running.',empty:'No related films were found in the available result set.',error:'Recommendations are unavailable. The current film and its controls remain accessible.'};
 $('recommendation-status').textContent=notices[state];if(state!=='ready')return;
 for(const record of records.filter(row=>row.id!==selected.id).slice(0,8)){
  const button=make('button','related-title');button.type='button';button.setAttribute('aria-label',`Inspect sample recommendation: ${record.title}`);
  button.append(poster(record),make('strong','',record.title),make('span','','Shared-genre example'));
  button.addEventListener('click',()=>{carousel.setItems(records,`${record.type}:${record.id}`);select(record);$('specimen-title').focus();});$('recommendation-rows').append(button);
 }
}
function select(record){selected=record;$('specimen-title').textContent=record.title;$('specimen-type').textContent=record.type==='series'?'TV series · episode selection':'Movie · recommendations';$('specimen-position').textContent=`${records.indexOf(record)+1} of ${records.length} sample titles`;
 $('specimen-episodes').hidden=record.type!=='series';$('specimen-recommendations').hidden=record.type!=='movie';renderEpisodes();renderRecommendations();}
const carousel=new CenteredCarousel($('carousel-cards'),{poster,onSelect:select,onOpen:record=>{select(record);$('specimen-title').focus();}});
$('specimen-previous').addEventListener('click',()=>carousel.move(-1));$('specimen-next').addEventListener('click',()=>carousel.move(1));
$('specimen-season').addEventListener('change',renderEpisodes);$('specimen-state').addEventListener('change',()=>{renderEpisodes();renderRecommendations();});
$('specimen-kind').addEventListener('change',()=>{const index=records.indexOf(selected),kind=$('specimen-kind').value;records.forEach((record,i)=>{record.type=kind;record.title=`Example ${kind==='series'?'series':'film'} ${String(i+1).padStart(2,'0')}`;});carousel.release();carousel.setItems(records,`${kind}:${records[index].id}`);select(records[index]);});
carousel.setItems(records,`series:${selected.id}`);select(selected);
