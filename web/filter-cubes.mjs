// App-domain query views. The shared Studio frame, settings and service owners are unchanged.
const clone = value => structuredClone(value);
const $ = id => document.getElementById(id);
function el(tag, cls = '', text = '') { const e = document.createElement(tag); e.className = cls; e.textContent = text; return e; }
function button(label, action, cls = 'small-button') { const b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', action); return b; }
const keyOf = movie => `${movie.type}:${movie.id || movie.imdbId}`;
const wrap = (n, length) => ((n % length) + length) % length;

let captionSequence = 0;

export class CenteredCarousel {
  constructor(root, { poster, onSelect = () => {}, onOpen = () => {}, legacyIds = false }) {
    this.root = root; this.poster = poster; this.onSelect = onSelect; this.onOpen = onOpen;
    this.legacyIds = legacyIds; this.items = []; this.index = 0; this.cards = new Map(); this.preloaded = new Set();
    root.classList.add('cube-track'); root.tabIndex = 0;
    root.setAttribute('role', 'group'); root.setAttribute('aria-roledescription', 'carousel');
    root.setAttribute('aria-label', 'Titles. Left and right browse; Enter opens the centred title.');
    root.addEventListener('click', event => {
      if (performance.now() < (this.suppressUntil || 0)) { event.preventDefault(); return; }
      const card = event.target.closest('.cube-cover');
      if (!card || !root.contains(card)) return;
      const index = Number(card.dataset.index);
      if (index === this.index) this.onOpen(this.items[index]);
      else this.select(index);
    });
    root.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !this.items.length) return;
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        if (event.key === 'Home') this.select(0);
        else if (event.key === 'End') this.select(this.items.length - 1);
        else this.move(event.key === 'ArrowLeft' ? -1 : 1);
        root.focus({ preventScroll: true });
      } else if (event.key === 'Enter' && event.target === root) { event.preventDefault(); this.onOpen(this.items[this.index]); }
    });
    root.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, drag: false };
    });
    root.addEventListener('pointermove', event => {
      const p = this.pointer;
      if (!p || p.id !== event.pointerId) return;
      const dx = event.clientX - p.x, dy = event.clientY - p.y;
      if (!p.drag && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) { p.drag = true; root.setPointerCapture?.(p.id); }
      if (p.drag) { root.style.setProperty('--cube-drag', `${Math.max(-90, Math.min(90, dx))}px`); event.preventDefault(); }
    });
    root.addEventListener('pointerup', event => {
      const p = this.pointer; this.pointer = null; root.style.setProperty('--cube-drag', '0px');
      if (!p || p.id !== event.pointerId) return;
      const dx = event.clientX - p.x, dy = event.clientY - p.y;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) { this.suppressUntil = performance.now() + 400; this.move(dx < 0 ? 1 : -1); }
    });
    root.addEventListener('pointercancel', () => { this.pointer = null; root.style.setProperty('--cube-drag', '0px'); });
    root.addEventListener('wheel', event => {
      if (event.ctrlKey || this.items.length < 2 || (!event.shiftKey && Math.abs(event.deltaX) <= Math.abs(event.deltaY))) return;
      event.preventDefault();
      if (performance.now() - (this.lastWheel || 0) < 180) return;
      this.wheel = (this.wheel || 0) + (event.shiftKey ? event.deltaY : event.deltaX);
      if (Math.abs(this.wheel) >= 30) { this.move(this.wheel > 0 ? 1 : -1); this.wheel = 0; this.lastWheel = performance.now(); }
    }, { passive: false });
  }
  setItems(items, anchor = null) {
    const old = anchor || (this.items[this.index] && keyOf(this.items[this.index]));
    this.items = items;
    const index = items.findIndex(movie => keyOf(movie) === old);
    this.index = index < 0 ? Math.min(this.index, Math.max(0, items.length - 1)) : index;
    this.render();
  }
  select(index) {
    if (!this.items.length) return false;
    this.index = wrap(index, this.items.length); this.render();
    this.onSelect(this.items[this.index], this.index); return true;
  }
  move(delta) { return this.select(this.index + delta); }
  render() {
    const count = this.items.length;
    this.root.dataset.count = String(count); this.root.dataset.index = String(this.index);
    this.root.dataset.selected = count ? keyOf(this.items[this.index]) : '';
    // Ordinary visible label, not another live announcer beside the row status.
    if (!this.caption) {
      this.caption = el('p', 'cube-selected-caption');
      this.caption.dir = 'auto';
      do { this.caption.id = `movie-night-carousel-caption-${++captionSequence}`; }
      while (document.getElementById(this.caption.id));
      this.captionAction = el('span', '', 'Details:');
      this.captionAction.id = `${this.caption.id}-action`;
      this.captionAction.hidden = true;
    }
    const title = count ? String(this.items[this.index].title ?? '') : '';
    if (this.caption.textContent !== title) this.caption.textContent = title;
    this.caption.dataset.record = this.root.dataset.selected;
    this.caption.hidden = !count;
    if (!this.root.contains(this.caption)) this.root.append(this.captionAction, this.caption);
    const needed = new Set();
    const left = Math.min(4, Math.floor((count - 1) / 2));
    const right = Math.min(4, Math.ceil((count - 1) / 2));
    if (this.legacyIds) for (const card of this.cards.values()) card.removeAttribute('id');
    if (count) for (let offset = -left; offset <= right; offset++) {
      const index = wrap(this.index + offset, count), movie = this.items[index], key = keyOf(movie);
      needed.add(key); let card = this.cards.get(key);
      if (!card) {
        card = el('button', 'cube-cover'); card.type = 'button';
        card.append(this.poster(movie, true), el('span', 'cube-cover-title', movie.title), el('span', 'cube-cover-meta', [movie.year, movie.type === 'series' ? 'TV series' : 'Film'].filter(Boolean).join(' · ')));
        card.style.setProperty('--cube-offset', String(offset));
        this.root.append(card); this.cards.set(key, card);
      }
      card.dataset.index = String(index); card.dataset.offset = String(offset);
      card.style.setProperty('--cube-offset', String(offset));
      card.style.setProperty('--cube-scale', String(offset === 0 ? 1 : Math.max(.48, .84 - Math.abs(offset) * .08)));
      card.style.zIndex = String(10 - Math.abs(offset));
      card.style.opacity = String(offset === 0 ? 1 : Math.max(.32, .92 - Math.abs(offset) * .13));
      if (offset === 0) {
        card.removeAttribute('aria-label');
        card.setAttribute('aria-labelledby', `${this.captionAction.id} ${this.caption.id}`);
      } else {
        card.removeAttribute('aria-labelledby');
        card.setAttribute('aria-label', `Select: ${movie.title}`);
      }
      card.setAttribute('aria-current', String(offset === 0)); card.tabIndex = offset === 0 ? 0 : -1;
      if (this.legacyIds && Math.abs(offset) <= 1) card.id = offset === 0 ? 'dialog-poster' : offset < 0 ? 'carousel-previous-card' : 'carousel-next-card';
    }
    for (const [key, card] of this.cards) if (!needed.has(key)) { card.remove(); this.cards.delete(key); }
    // Image objects prime only adjacent artwork; media and stream sources are never requested.
    if (count) for (const delta of [-6, -5, 5, 6]) {
      const url = this.items[wrap(this.index + delta, count)].poster;
      if (!url || this.preloaded.has(url)) continue;
      if (this.preloaded.size > 200) this.preloaded.clear();
      this.preloaded.add(url); const image = new Image(); image.referrerPolicy = 'no-referrer'; image.src = url;
    }
  }
  release() { this.root.replaceChildren(); this.cards.clear(); }
}

export async function mountFilterCubes(host) {
  let record = null, draft = null, mode = 'wall', activeId = null, queryEdit = null, busy = false, syncing = false;
  const nodes = new Map(), cache = new Map();
  let concurrent = 0; const queue = [];
  const toolbar = el('div', 'cube-toolbar'); toolbar.id = 'cube-toolbar';
  const viewSwitch = el('div', 'cube-view-switch'); viewSwitch.setAttribute('role', 'group'); viewSwitch.setAttribute('aria-label', 'Library presentation');
  const wallButton = button('Wall', () => switchMode('wall')); wallButton.id = 'cube-view-wall';
  const carouselButton = button('Carousels', () => switchMode('carousel')); carouselButton.id = 'cube-view-carousel';
  viewSwitch.append(wallButton, carouselButton);
  const add = button('+ Filter cube', () => openNaming()); add.id = 'cube-add';
  const unlock = button('Edit home', () => beginEdit()); unlock.id = 'cube-edit';
  const save = button('Save layout', () => saveLayout()); save.id = 'cube-save-layout';
  const cancel = button('Cancel', () => cancelLayout()); cancel.id = 'cube-cancel-layout';
  toolbar.append(viewSwitch, add, unlock, save, cancel);
  $('browse-controls-home').before(toolbar);
  const status = el('p', 'cube-status'); status.id = 'cube-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); toolbar.after(status);
  const queryBanner = el('div', 'cube-query-banner'); queryBanner.hidden = true;
  const queryLabel = el('span'); const querySave = button('Save cube filters', () => saveQuery()); querySave.id = 'cube-save-query';
  queryBanner.append(queryLabel, querySave, button('Cancel filter edits', () => cancelQuery())); status.after(queryBanner);
  const rows = el('div', 'cube-home'); rows.id = 'cube-home'; rows.setAttribute('aria-label', 'Your filter cube rows');
  $('film-grid').before(rows);
  const naming = el('dialog', 'cube-naming'); naming.id = 'cube-naming'; naming.setAttribute('aria-labelledby', 'cube-name-title');
  const form = el('form'); const heading = el('h2', '', 'Save a filter cube'); heading.id = 'cube-name-title';
  const nameLabel = el('label', '', 'Cube name'); const nameInput = el('input'); nameInput.id = 'cube-name'; nameInput.maxLength = 80; nameInput.required = true; nameLabel.htmlFor = nameInput.id;
  const sourceLabel = el('label', '', 'Browse from'); const source = el('select'); source.id = 'cube-source'; sourceLabel.htmlFor = source.id;
  const explanation = el('p', '', 'Saves the source and current filters, not a fixed list of titles. Results update as your library changes.');
  const confirm = el('button', 'primary-button', 'Add cube'); confirm.type = 'submit'; confirm.id = 'cube-confirm';
  form.append(heading, nameLabel, nameInput, sourceLabel, source, explanation, confirm, button('Cancel', () => naming.close())); naming.append(form); document.body.append(naming);
  let namingId = null;
  const deleting = el('dialog', 'cube-naming'); deleting.id = 'cube-delete';
  const deleteText = el('p'); let deletingId = null;
  deleting.append(el('h2', '', 'Remove this cube row?'), deleteText, button('Remove row', () => removeCube(deletingId)), button('Keep row', () => deleting.close())); document.body.append(deleting);
  const data = () => draft || record;
  const notice = message => { status.textContent = message; };
  const sameQuery = (a, b) => JSON.stringify([a.collectionId,a.browse,a.filters,a.search,a.genre,a.sort]) === JSON.stringify([b.collectionId,b.browse,b.filters,b.search,b.genre,b.sort]);
  async function request(payload) {
    const response = await fetch('/api/filter-cubes', payload ? {method:'POST',headers:{'Content-Type':'application/json','X-Movie-Night':'1'},body:JSON.stringify(payload)} : {cache:'no-store'});
    const value = await response.json();
    if (!response.ok || value.error) throw new Error(value.error || 'Filter cubes are unavailable.');
    return value;
  }
  async function commit(next, message) {
    if (busy) return false;
    busy = true; updateControls();
    try { record = await request({...clone(next),revision:record.revision}); notice(message); return true; }
    catch (error) { notice(error.message + ' Your unsaved layout has not been discarded.'); return false; }
    finally { busy = false; updateControls(); }
  }
  function updateControls() {
    for (const b of [wallButton,carouselButton,add,unlock,save,cancel,querySave]) b.disabled = busy || !record;
    wallButton.setAttribute('aria-pressed', String(mode === 'wall')); carouselButton.setAttribute('aria-pressed', String(mode === 'carousel'));
    wallButton.disabled ||= Boolean(draft); carouselButton.disabled ||= Boolean(draft);
    unlock.hidden = mode !== 'carousel' || Boolean(draft); save.hidden = cancel.hidden = !draft;
    rows.hidden = mode !== 'carousel'; $('film-grid').hidden = mode === 'carousel';
    if (mode === 'carousel') { $('browse-more').hidden = true; $('empty-state').hidden = true; }
    host.presentation?.(mode, data()?.rows.length || 0);
    document.body.classList.toggle('cube-home-active', mode === 'carousel');
    document.body.classList.toggle('cube-layout-editing', Boolean(draft));
    queryBanner.hidden = !queryEdit; queryLabel.textContent = queryEdit ? `Editing filters for ${data()?.rows.find(r=>r.id===queryEdit)?.name || 'cube'}. Save to keep these changes.` : '';
    for (const [id, n] of nodes) {
      n.root.classList.toggle('cube-active', id === activeId);
      n.actions.hidden = !draft; n.handle.disabled = !draft || busy;
      n.up.disabled = busy || data()?.rows[0]?.id === id; n.down.disabled = busy || data()?.rows.at(-1)?.id === id;
    }
  }
  async function switchMode(next) {
    if (!record || busy || draft) return;
    mode = next; updateControls();
    if (next === 'carousel') renderRows();
    else if (activeId && !queryEdit) { const row = data().rows.find(r=>r.id===activeId); if (row) activate(row); }
    await commit({...record,view:next,selected_id:activeId}, next === 'carousel' ? 'Your live filter cubes. Unlock Edit home to arrange rows.' : 'Wall view uses the same source, filters and sorting.');
  }
  function openNaming(id = null) {
    if (!record || busy) return;
    namingId = id; const row = id ? data().rows.find(r=>r.id===id) : null;
    heading.textContent = row ? 'Rename filter cube' : 'Save a filter cube'; confirm.textContent = row ? 'Rename cube' : 'Add cube';
    nameInput.value = row?.name || '';
    source.replaceChildren(...host.collections().map(c=>{const o=el('option','',c.name);o.value=c.id;return o;}));
    source.value = row?.collectionId || host.current().collectionId; source.disabled = Boolean(row);
    naming.showModal(); nameInput.focus();
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !nameInput.value.trim()) return;
    const next = clone(data());
    if (namingId) next.rows.find(r=>r.id===namingId).name = nameInput.value.trim();
    else {
      const query = host.current();
      if (query.filters.yearFrom && query.filters.yearTo && Number(query.filters.yearFrom)>Number(query.filters.yearTo)) { notice('Correct the year range before saving a cube.'); naming.close(); return; }
      const row = {...query,id:crypto.randomUUID(),name:nameInput.value.trim(),collectionId:source.value,anchor:null};
      if (source.value !== query.collectionId) row.browse = host.sourceDefaults(source.value);
      next.rows.push(row); activeId = next.selected_id = row.id; next.view = 'carousel';
    }
    if (draft) { draft = next; naming.close(); mode = 'carousel'; renderRows(); notice('Layout changed. Save layout to keep it.'); }
    else if (await commit(next, 'Filter cube saved. Its contents stay live.')) { naming.close(); mode = record.view; renderRows(); }
    updateControls();
  });
  function beginEdit() {
    if (!record || busy || queryEdit) { if(queryEdit)notice('Save or cancel the current filter edits first.'); return; }
    draft = clone(record); mode = 'carousel'; renderRows(); updateControls(); notice('Home unlocked. Drag a row handle, use Move up/down, rename, add or remove. Nothing changes until Save layout.');
  }
  async function saveLayout() {
    if (!draft || busy || queryEdit) { if(queryEdit)notice('Save or cancel cube filters before saving the layout.'); return; }
    if (await commit({...draft,view:'carousel'}, 'Home layout saved and read back. Your titles and files were not changed.')) { draft=null; renderRows(); updateControls(); }
  }
  function cancelLayout() { if(busy)return; draft=null; activeId=record.selected_id; queryEdit=null; renderRows(); updateControls(); notice('Layout edits cancelled. Saved rows are unchanged.'); }
  async function removeCube(id) {
    if (!draft || busy) return;
    draft.rows = draft.rows.filter(row=>row.id!==id); if(activeId===id)activeId=draft.selected_id=draft.rows[0]?.id||null;
    if(queryEdit===id)queryEdit=null;
    deleting.close(); renderRows(); updateControls(); notice('Row removed from the draft layout. Save to keep this change, or Cancel to restore it. No media or files were deleted.');
  }
  function moveRow(id, target) {
    if (!draft || busy) return;
    const from=draft.rows.findIndex(r=>r.id===id); if(from<0)return;
    const [row]=draft.rows.splice(from,1); draft.rows.splice(Math.max(0,Math.min(target,draft.rows.length)),0,row);
    renderRows(); updateControls(); nodes.get(id)?.handle.focus({preventScroll:true}); notice(`${row.name} moved to row ${draft.rows.findIndex(r=>r.id===id)+1}. Save layout to keep the order.`);
  }
  function sourceFor(row) {
    if (!row.collectionId.startsWith('browse-')) {
      const found=host.collections().find(c=>c.id===row.collectionId);
      return found ? {movies:found.movies,hasMore:false,loading:false,error:'',local:true} : {movies:[],hasMore:false,error:'This source is unavailable. The saved cube was preserved.',local:true};
    }
    const key=JSON.stringify([row.collectionId,row.browse]);
    if(cache.has(key)){const v=cache.get(key);cache.delete(key);cache.set(key,v);return v;}
    const source={key,movies:[],hasMore:true,loading:false,error:'',next:0,pages:0}; cache.set(key,source);
    if(cache.size>24){for(const [k,v]of cache){if(k!==key&&!v.loading){cache.delete(k);break;}}}
    return source;
  }
  function effective(row) { return queryEdit===row.id ? {...row,...host.current()} : row; }
  function activate(row, movie=null) {
    if(queryEdit&&queryEdit!==row.id){notice('Save or cancel the current cube filter edits first.');return false;}
    activeId=row.id; const query=effective(row), source=sourceFor(query); syncing=true;
    try{host.activate(query,source,movie);}finally{syncing=false;} updateControls();return true;
  }
  function editQuery(row) { if(!activate(row))return; queryEdit=row.id;updateControls(); host.openFilters(); }
  async function saveQuery() {
    if(!queryEdit||busy)return;const next=clone(data()),index=next.rows.findIndex(r=>r.id===queryEdit);if(index<0)return;
    next.rows[index]={...next.rows[index],...host.current(),anchor:null};
    if(draft){draft=next;queryEdit=null;renderRows();updateControls();notice('Cube filters updated in the draft layout. Save layout to keep them.');}
    else if(await commit(next,'Cube filters saved. Wall and carousel use the same query.')){queryEdit=null;renderRows();updateControls();}
  }
  function cancelQuery(){const row=data()?.rows.find(r=>r.id===queryEdit);queryEdit=null;if(row)activate(row);renderRows();updateControls();notice('Filter edits cancelled.');}
  async function fetchPage(row,source) {
    if(source.local||source.loading||!source.hasMore||!host.catalogueEnabled())return;
    source.loading=true; source.error=''; paintAllForSource(source);
    queue.push(async()=>{
      try {
        if (!host.catalogueEnabled()) throw Error("catalogue_disabled");
        const result=await host.fetchPage(row,source.next);
        if(!Array.isArray(result.movies)||typeof result.has_more!=='boolean'||(result.has_more&&(!Number.isInteger(result.next_skip)||result.next_skip<=source.next)))throw Error();
        const seen=new Set(source.movies.map(keyOf));
        for(const movie of result.movies)if(!seen.has(keyOf(movie))){source.movies.push(movie);seen.add(keyOf(movie));}
        source.hasMore=result.has_more;source.next=result.has_more?result.next_skip:source.next;source.pages++;
      }catch{source.error='The catalogue could not be reached. Cached titles remain available.';}
      finally{source.loading=false;paintAllForSource(source);concurrent--;pump();}
    });pump();
  }
  function pump(){while(concurrent<2&&queue.length){concurrent++;void queue.shift()();}}
  function paintAllForSource(source){for(const row of data()?.rows||[])if(nodes.get(row.id)?.visible&&sourceFor(effective(row))===source)paintRow(row);}
  function paintRow(row){
    const n=nodes.get(row.id);if(!n||!n.visible)return;
    const query=effective(row),source=sourceFor(query),items=host.evaluate(source.movies,query);
    const anchor=n.carousel.items[n.carousel.index]?keyOf(n.carousel.items[n.carousel.index]):row.anchor;
    n.carousel.setItems(items,anchor); n.title.textContent=row.name;
    n.summary.textContent=host.summary(query);
    n.position.textContent=items.length?`${n.carousel.index+1} of ${items.length} matches${source.local?' · loops both ways':` loaded · ${source.hasMore?'more available':'end of catalogue'}`}`:source.loading?'Finding matching titles…':'No matching titles in the loaded source.';
    n.empty.hidden=Boolean(items.length); n.track.hidden=!items.length;
    n.empty.textContent=source.error||(!host.catalogueEnabled()&&!source.local?'Catalogue browsing is disabled in Settings. Your cube is preserved.':'No matches yet. Adjust this cube’s filters or load more catalogue results.');
    n.more.hidden=source.local||!source.hasMore;n.more.disabled=source.loading||!host.catalogueEnabled();n.more.textContent=source.loading?'Loading…':source.error?'Retry catalogue':'Load more matches';
    n.prev.disabled=n.next.disabled=items.length<2;
    if(!source.local&&!source.pages&&!source.error&&!source.loading)void fetchPage(query,source);
  }
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){const id=entry.target.dataset.cubeId,n=nodes.get(id);if(!n)continue;n.visible=entry.isIntersecting;if(n.visible){const row=data()?.rows.find(r=>r.id===id);if(row)paintRow(row);}else n.carousel.release();}},{rootMargin:'500px 0px'});
  function createRow(row){
    const root=el('section','cube-row');root.dataset.cubeId=row.id;root.setAttribute('aria-label',row.name);
    const header=el('header','cube-row-heading'),title=el('h2','',row.name),summary=el('p','cube-row-summary'),copy=el('div','cube-heading-copy');copy.append(title,summary);
    const handle=button('⠿',()=>{},'cube-drag-handle');handle.setAttribute('aria-label',`Drag ${row.name} to reorder`);handle.title='Drag to reorder; Move up/down buttons are also available';
    const track=el('div');const position=el('p','cube-row-position');position.setAttribute('role','status');
    const carousel=new CenteredCarousel(track,{poster:host.poster,onSelect:(movie,index)=>{
      const r=data()?.rows.find(r=>r.id===row.id);if(!r)return;const query=effective(r),s=sourceFor(query);
      position.textContent=`${index+1} of ${carousel.items.length} matches${s.local?' · loops both ways':' loaded'}`;
      if(activate(r,movie)&&!queryEdit){r.anchor=keyOf(movie);}
      if(!s.local&&!s.error&&index>=carousel.items.length-4)void fetchPage(query,s);
    },onOpen:movie=>{const r=data()?.rows.find(r=>r.id===row.id);if(r&&activate(r,movie))host.open(movie);}});
    const controls=el('div','cube-row-controls');const prev=button('←',()=>carousel.move(-1)),next=button('→',()=>carousel.move(1));
    prev.setAttribute('aria-label',`Previous title in ${row.name}`);next.setAttribute('aria-label',`Next title in ${row.name}`);
    controls.append(button('Filters',()=>editQuery(data().rows.find(r=>r.id===row.id))),prev,next);
    const actions=el('div','cube-row-edit');const up=button('Move up',()=>moveRow(row.id,data().rows.findIndex(r=>r.id===row.id)-1)),down=button('Move down',()=>moveRow(row.id,data().rows.findIndex(r=>r.id===row.id)+1));
    actions.append(up,down,button('Rename',()=>openNaming(row.id)),button('Remove',()=>{deletingId=row.id;deleteText.textContent=`Remove “${data().rows.find(r=>r.id===row.id).name}” from the home layout only. Favorites, history, titles and files are unchanged.`;deleting.showModal();}));
    header.append(handle,copy,controls);const empty=el('p','cube-row-empty');const more=button('Load more matches',()=>{const r=data().rows.find(r=>r.id===row.id),q=effective(r);void fetchPage(q,sourceFor(q));});
    const foot=el('div','cube-row-footer');foot.append(position,more);root.append(header,actions,track,empty,foot);
    let drag=null;
    handle.addEventListener('pointerdown',event=>{if(!draft||busy||event.button!==0)return;drag={id:event.pointerId,target:data().rows.findIndex(r=>r.id===row.id)};handle.setPointerCapture(event.pointerId);root.classList.add('is-dragging');event.preventDefault();});
    handle.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.cube-row');for(const n of nodes.values())n.root.classList.remove('drop-target');if(target&&target!==root){drag.target=data().rows.findIndex(r=>r.id===target.dataset.cubeId);target.classList.add('drop-target');}if(event.clientY<70)scrollBy(0,-16);else if(event.clientY>innerHeight-70)scrollBy(0,16);});
    const finish=event=>{if(!drag)return;const target=drag.target;drag=null;root.classList.remove('is-dragging');for(const n of nodes.values())n.root.classList.remove('drop-target');if(event.type==='pointerup')moveRow(row.id,target);};
    handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
    const n={root,title,summary,handle,track,carousel,position,empty,more,prev,next,actions,up,down,visible:false};nodes.set(row.id,n);observer.observe(root);return n;
  }
  function renderRows(){
    if(!record)return;const keep=new Set(data().rows.map(r=>r.id));
    for(const [id,n]of nodes)if(!keep.has(id)){observer.unobserve(n.root);n.root.remove();nodes.delete(id);}
    rows.querySelector('.cube-welcome')?.remove();
    for(const row of data().rows){const n=nodes.get(row.id)||createRow(row);n.title.textContent=row.name;n.root.setAttribute('aria-label',row.name);rows.append(n.root);if(n.visible)paintRow(row);}
    if(!data().rows.length){const welcome=el('section','cube-welcome');welcome.append(el('p','eyebrow','Your home, your filters'),el('h2','','Build your first filter cube'),el('p','','Choose a source and filters above, then save them as a cube. Add more cubes for different moods, decades or watch status. Each becomes a live carousel row.'),button('Create a filter cube',()=>openNaming()));rows.append(welcome);}
    updateControls();
  }
  try{record=await request();mode=record.view;activeId=record.selected_id;if(activeId){const row=record.rows.find(r=>r.id===activeId);if(row)activate(row);}renderRows();if(mode==='carousel')notice('Live filter cubes. The centred title is selected; select it again for details.');}
  catch(error){notice(error.message+' The existing wall remains available.');updateControls();}
  return {
    isCarousel:()=>mode==='carousel',
    refresh(){if(syncing)return;updateControls();for(const row of data()?.rows||[])if(nodes.get(row.id)?.visible)paintRow(row);},
    detailSourceChanged(){for(const row of data()?.rows||[])if(nodes.get(row.id)?.visible)paintRow(row);},
  };
}
