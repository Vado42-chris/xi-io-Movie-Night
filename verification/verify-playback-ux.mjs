import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { constrainMiniPlayer, shouldHideControls, trackLabel, trackNotice, mountMiniPlayerGeometry } from '../web/player-mini.mjs';

test('mini geometry stays entirely inside allocated 320-to-4k viewports', () => {
  for (const [vw,vh] of [[320,340],[390,600],[480,420],[768,700],[1280,720],[1920,1080],[3840,2160]]) {
    for (const raw of [{},{x:-1000,y:-1000,width:10000},{x:20000,y:20000,width:-30},{x:42,y:37,width:400}]) {
      const b=constrainMiniPlayer(vw,vh,raw);
      assert.ok(b.width>0 && b.height>0 && b.x>=0 && b.y>=0);
      assert.ok(b.x+b.width<=vw+1,JSON.stringify({vw,vh,b}));
      assert.ok(b.y+b.height<=vh+1,JSON.stringify({vw,vh,b}));
    }
  }
});
test('visible controls hide on idle despite hover/focus-from-pointer, but never while interacting or using keyboard', () => {
  const base={native:true,playing:true,mini:false,menuOpen:false,keyboardFocus:false,pointerDown:false};
  assert.equal(shouldHideControls(base),true);
  for (const field of ['native','playing']) assert.equal(shouldHideControls({...base,[field]:false}),false);
  for (const field of ['mini','menuOpen','keyboardFocus','pointerDown']) assert.equal(shouldHideControls({...base,[field]:true}),false);
});
test('track labels name common mpv language codes and preserve genuinely untagged status',()=>{
  assert.equal(trackLabel({language:'spa',title:'Latin America',codec:'aac'}),'Spanish · Latin America · aac');
  assert.equal(trackLabel({language:'eng'}),'English');
  assert.equal(trackLabel({language:''}),'Language not tagged');
  assert.equal(trackLabel({language:'und'}),'und');
});
test('a foreign one-track file never falsely advertises alternate audio or subtitles',()=>{
  assert.match(trackNotice([{type:'audio',language:'spa'}],true,true),/one audio track and no selectable subtitles/);
  assert.match(trackNotice([{type:'audio',language:'spa'}],false,true),/could not read track/);
  assert.match(trackNotice([{type:'audio',language:'spa'},{type:'sub',language:'eng'}],true,true),/available subtitle/);
  assert.match(trackNotice([{type:'audio',language:'spa'},{type:'audio',language:'eng'}],true,true),/Choose an audio track/);
});
test('mini move/resize pointer and keyboard controls modify the same CSS geometry only',()=>{
  class FakeHandle {
    constructor(){this.events=new Map()}
    addEventListener(k,fn){this.events.set(k,fn)}
    removeEventListener(k){this.events.delete(k)}
    setPointerCapture(){}
    emit(k,arg={}){this.events.get(k)?.({preventDefault(){},...arg})}
  }
  const move=new FakeHandle(),resize=new FakeHandle(), events=new Map(), styles=new Map();
  const win={innerWidth:900,innerHeight:650,addEventListener(k,fn){events.set(k,fn)},removeEventListener(k){events.delete(k)}};
  const doc={body:{style:{setProperty(k,v){styles.set(k,v)}}}};
  const ui=mountMiniPlayerGeometry({win,doc,moveHandle:move,resizeHandle:resize});
  const start=ui.activate();
  move.emit('pointerdown',{pointerId:7,button:0,clientX:100,clientY:100});
  events.get('pointermove')({pointerId:7,clientX:70,clientY:55,preventDefault(){}});
  assert.ok(ui.geometry().x < start.x);
  assert.ok(ui.geometry().y < start.y);
  events.get('pointerup')({pointerId:7});
  const shifted=ui.geometry();
  resize.emit('keydown',{key:'ArrowRight',shiftKey:true});
  assert.ok(ui.geometry().width>=shifted.width);
  assert.ok(styles.get('--movie-mini-video-height').endsWith('px'));
  assert.ok(ui.geometry().x>=0);
  ui.destroy();
  assert.equal(events.size,0);
});
test('app routes and native render logic preserve one player and no new remote shell',()=>{
  const js=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
  const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
  const server=readFileSync(new URL('../server.py',import.meta.url),'utf8');
  assert.match(js,/shouldHideControls/);
  assert.match(js,/chooseAnotherStream/);
  assert.match(js,/miniLayout = mountMiniPlayerGeometry/);
  assert.match(js,/Hide playback controls without stopping/);
  assert.match(css,/native-player-mode\.player-controls-hidden #native-video-placeholder/);
  assert.match(css,/--movie-mini-video-height/);
  assert.match(html,/id="player-mini-move"/);
  assert.match(html,/id="player-mini-resize"/);
  assert.ok(server.includes('/player-mini.mjs'));
  assert.doesNotMatch(js,/\/cli\/v1\//);
});
