// App-domain query views. The shared Studio frame, settings and service owners are unchanged.
const clone = value => structuredClone(value);
const $ = id => document.getElementById(id);
function el(tag, cls = '', text = '') { const e = document.createElement(tag); e.className = cls; e.textContent = text; return e; }
function button(label, action, cls = 'small-button') { const b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', action); return b; }
const keyOf = movie => `${movie.type}:${movie.id || movie.imdbId}`;
const wrap = (n, length) => ((n % length) + length) % length;

// Editors and nested action controls retain their own input semantics.
function inputOwnedElsewhere(target, root) {
  const control = target?.closest?.('input, textarea, select, a, button, [role="slider"], [role="spinbutton"], [role="combobox"], [role="textbox"], [contenteditable]:not([contenteditable="false"])');
  return Boolean(control && control !== root && !control.classList.contains('cube-cover'));
}

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
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !this.items.length || inputOwnedElsewhere(event.target, root)) return;
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        if (event.key === 'Home') this.select(0);
        else if (event.key === 'End') this.select(this.items.length - 1);
        else this.move(event.key === 'ArrowLeft' ? -1 : 1);
        root.focus({ preventScroll: true });
      } else if (event.key === 'Enter' && event.target === root) { event.preventDefault(); this.onOpen(this.items[this.index]); }
    });
    root.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || inputOwnedElsewhere(event.target, root)) return;
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
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || this.items.length < 2 || inputOwnedElsewhere(event.target, root)) return;
      // Normal vertical wheel belongs to the page. Some browsers already rotate
      // Shift+wheel into deltaX, so use the dominant reported axis in that case.
      if (!event.shiftKey && Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      const raw = event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (!Number.isFinite(raw) || raw === 0) return;
      event.preventDefault();
      const now = performance.now();
      if (this.lastWheel !== undefined && now - this.lastWheel < 180) return;
      // The threshold is CSS pixels; wheel devices can report lines or pages.
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? Math.max(1, root.clientWidth) : 1;
      const delta = raw * unit;
      if (now - (this.lastWheelInput || 0) > 250 || Math.sign(this.wheel || 0) !== Math.sign(delta)) this.wheel = 0;
      this.lastWheelInput = now;
      this.wheel = (this.wheel || 0) + delta;
      if (Math.abs(this.wheel) >= 30) { this.move(this.wheel > 0 ? 1 : -1); this.wheel = 0; this.lastWheel = now; }
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
  const add = button('+ Create cube', () => openNaming()); add.id = 'cube-add';
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
  const addBelow = button('+ Add another cube', () => openNaming(), 'small-button cube-add-below'); addBelow.id = 'cube-add-below'; rows.after(addBelow);
  const naming = el('dialog', 'cube-naming'); naming.id = 'cube-naming'; naming.setAttribute('aria-labelledby', 'cube-name-title');
  const form = el('form'); const heading = el('h2', '', 'Save a filter cube'); heading.id = 'cube-name-title';
  const nameLabel = el('label', '', 'Cube name'); const nameInput = el('input'); nameInput.id = 'cube-name'; nameInput.maxLength = 80; nameInput.required = true; nameLabel.htmlFor = nameInput.id;
  const sourceLabel = el('label', '', 'Browse from'); const source = el('select'); source.id = 'cube-source'; sourceLabel.htmlFor = source.id;
  const explanation = el('p', '', 'Saves the source and current filters, not a fixed list of titles. Results update as your library changes.');
  const confirm = el('button', 'primary-button', 'Add cube'); confirm.type = 'submit'; confirm.id = 'cube-confirm';
  form.noValidate = true;
  const progress = el('p', 'cube-builder-progress'); progress.id = 'cube-builder-progress'; progress.setAttribute('role','status');
  const steps = [el('section','cube-builder-step'), el('section','cube-builder-step'), el('section','cube-builder-step')];
  steps.forEach((step,i)=>{step.dataset.step=String(i); step.setAttribute('aria-label',['Choose source','Set filters','Review and save'][i]);});
  steps[0].append(el('h3','','1. Where should this cube look?'), sourceLabel, source,
    el('p','','Choose a library or catalogue. This does not connect an account or change where your media is stored.'));
  steps[1].append(el('h3','','2. What belongs in this cube?'));
  const fields = {}, ruleGrid = el('div','cube-builder-fields'); steps[1].append(ruleGrid);
  const advanced = el('details','cube-builder-advanced'); advanced.append(el('summary','','More genre rules'));
  const genreGroups = {};
  for (const kind of ['include','exclude']) { const group=el('fieldset','cube-builder-genres'); group.append(el('legend','',kind==='include'?'Also include genres':'Exclude genres'));genreGroups[kind]=group;advanced.append(group); }
  steps[1].append(advanced);
  const review = el('p','cube-builder-review'); review.id='cube-builder-review';
  const preview = el('p','cube-builder-preview'); preview.id='cube-builder-preview'; preview.setAttribute('role','status');
  const previewItems=el('ul','cube-builder-preview-items');
  steps[2].append(el('h3','','3. Review and save'),nameLabel,nameInput,review,preview,previewItems,explanation);
  const feedback=el('p','cube-builder-feedback');feedback.id='cube-builder-feedback';feedback.setAttribute('role','alert');
  const previous=button('Back',()=>showStep(wizardStep-1));previous.id='cube-builder-back';
  const nextStep=button('Next',()=>{if(validStep())showStep(wizardStep+1);});nextStep.id='cube-builder-next';
  const actions=el('div','cube-builder-actions');actions.append(previous,nextStep,confirm,button('Cancel',()=>{if(!busy)naming.close();}));
  form.append(heading,progress,...steps,feedback,actions);naming.append(form);document.body.append(naming);
  let namingId=null,builderQuery=null,wizardStep=0,renameOnly=false,builderOrigin=null,cubeContract=null;
  function addField(key,label,options=null,type='text',limits={}) {
    const wrapper=el('label','',label),control=el(options?'select':'input');control.id=`cube-rule-${key}`;
    if(options) for(const [value,text] of options) {const o=el('option','',text);o.value=value;control.append(o);}
    else {control.type=type;Object.assign(control,limits);}
    wrapper.htmlFor=control.id;wrapper.append(control);ruleGrid.append(wrapper);fields[key]=control;return control;
  }
  function initializeBuilder(contract) {
    const row=contract.properties.rows.items.properties, f=row.filters.properties;
    const labels={type:{'':'Movies and TV','movie':'Movies','series':'TV series'}, watch:{'':'Any watch status',favorites:'Favorites',watching:'In progress',watched:'Watched',unwatched:'Unwatched'},provider:{'':'Any connected data source',nuvio:'Nuvio imported library',cinemeta:'Cinemeta catalogue'},genreMode:{any:'Any included genre',all:'All included genres'},sort:{rank:'Source order',title:'Title', 'year-desc':'Newest first','year-asc':'Oldest first',rating:'Highest rating',runtime:'Shortest first'}};
    for(const key of ['type','provider']) addField(key,key==='type'?'Content type':'Data source',f[key].enum.map(v=>[v,labels[key][v]||v]));
    addField('genre','Primary genre',[['','Any genre']]);
    addField('yearFrom','From year',null,'number',{min:'1800',max:'2999',step:'1',placeholder:'Any year'});
    addField('yearTo','Through year',null,'number',{min:'1800',max:'2999',step:'1',placeholder:'No upper limit'});
    addField('watch','Watch status',f.watch.enum.map(v=>[v,labels.watch[v]||v]));
    addField('rating','Minimum rating',null,'number',{min:String(f.rating.minimum),max:String(f.rating.maximum),step:'0.1'});
    addField('runtime','Maximum minutes',null,'number',{min:'1',max:'1440',step:'1',placeholder:'Any duration'});
    addField('search','Title contains',null,'text',{maxLength:row.search.maxLength});
    addField('sort','Order',row.sort.enum.map(v=>[v,labels.sort[v]||v]));
    addField('genreMode','Included genres match',f.genreMode.enum.map(v=>[v,labels.genreMode[v]||v]));
    const browse=el('label','','Catalogue list'),select=el('select');select.id='cube-browse-list';
    for(const [value,label] of [['top','Popular'],['imdbRating','Featured'],['year','By release year']]){const o=el('option','',label);o.value=value;select.append(o);}
    browse.append(select);steps[0].append(browse);fields.catalog=select;fields.catalogLabel=browse;
    const yearLabel=el('label','','Catalogue year'),year=el('input');year.id='cube-browse-year';year.type='number';year.min='1800';year.max='2999';year.step='1';yearLabel.append(year);steps[0].append(yearLabel);fields.catalogYear=year;fields.catalogYearLabel=yearLabel;
  }
  function builderValue() {
    const value=clone(builderQuery),f=value.filters;
    value.collectionId=source.value;value.search=fields.search.value.trim();value.genre=fields.genre.value;value.sort=fields.sort.value;
    for(const key of ['type','provider','yearFrom','yearTo','watch','runtime','genreMode'])f[key]=fields[key].value;
    f.rating=Number(fields.rating.value||0);
    for(const kind of ['include','exclude'])f[kind]=[...genreGroups[kind].querySelectorAll('input:checked')].map(i=>i.value);
    value.browse=source.value.startsWith('browse-')?{...(value.browse||host.sourceDefaults(source.value)||{}),catalog:fields.catalog.value,year:fields.catalogYear.value,genre:value.browse?.genre||'',search:value.browse?.search||''}:null;
    return value;
  }
  function syncSourceFields(){const catalogue=source.value.startsWith('browse-');fields.catalogLabel.hidden=!catalogue;fields.catalogYearLabel.hidden=!catalogue||fields.catalog.value!=='year';}
  source.addEventListener('change',()=>{if(!builderQuery)return;builderQuery.browse=host.sourceDefaults(source.value);fields.catalog.value=builderQuery.browse?.catalog||'top';fields.catalogYear.value=builderQuery.browse?.year||String(new Date().getFullYear());syncSourceFields();});
  form.addEventListener('change',event=>{if(event.target===fields.catalog)syncSourceFields();const kind=event.target.dataset.cubeGenre;if(kind&&event.target.checked){const other=kind==='include'?'exclude':'include';for(const c of genreGroups[other].querySelectorAll('input'))if(c.value===event.target.value)c.checked=false;}});
  function validStep(){
    feedback.textContent='';
    for(const input of steps[wizardStep].querySelectorAll('input,select'))if(!input.checkValidity()){input.reportValidity();return false;}
    if(wizardStep===1&&fields.yearFrom.value&&fields.yearTo.value&&Number(fields.yearFrom.value)>Number(fields.yearTo.value)){feedback.textContent='Choose an end year on or after the start year.';fields.yearTo.focus();return false;}
    if(wizardStep===2&&!nameInput.value.trim()){feedback.textContent='Give this cube a name.';nameInput.focus();return false;}
    return true;
  }
  function showStep(step){
    wizardStep=Math.max(0,Math.min(2,step));steps.forEach((section,i)=>section.hidden=renameOnly?i!==2:i!==wizardStep);
    progress.textContent=renameOnly?'Rename this cube':`Step ${wizardStep+1} of 3 · ${['Source','Filters','Review and save'][wizardStep]}`;
    previous.hidden=renameOnly||wizardStep===0;nextStep.hidden=renameOnly||wizardStep===2;confirm.hidden=!renameOnly&&wizardStep!==2;
    feedback.textContent='';
    if(wizardStep===2){
      const query=builderValue(),sourceData=sourceFor(query),items=host.evaluate(sourceData.movies,query);
      review.textContent=host.summary(query);previewItems.replaceChildren(...items.slice(0,5).map(m=>el('li','',m.title)));
      preview.textContent=renameOnly?'The query and its identity will stay unchanged.':sourceData.local?`${items.length} matching titles in this library now. The cube stays live as the library changes.`:!sourceData.movies.length?'Catalogue results have not been loaded for this query yet. Saving will load its row, not start playback.':`${items.length} matches among ${sourceData.movies.length} loaded catalogue titles. This is not a count of the whole catalogue.`;
    }
    const focus=steps[wizardStep].querySelector('input,select');focus?.focus();
  }
  naming.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  naming.addEventListener('close',()=>{updateControls();builderOrigin?.isConnected&&builderOrigin.focus({preventScroll:true});});
  const deleting = el('dialog', 'cube-naming'); deleting.id = 'cube-delete';
  const deleteText = el('p'); let deletingId = null;
  deleting.append(el('h2', '', 'Remove this cube row?'), deleteText, button('Remove row', () => removeCube(deletingId)), button('Keep row', () => deleting.close())); document.body.append(deleting);
  const data = () => draft || record;
  const notice = message => { status.textContent = message; if(naming.open)feedback.textContent=message; };
  const sameQuery = (a, b) => JSON.stringify([a.collectionId,a.browse,a.filters,a.search,a.genre,a.sort]) === JSON.stringify([b.collectionId,b.browse,b.filters,b.search,b.genre,b.sort]);
  let pendingSave=null;
  const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
  const equalLayout=(a,b)=>canonical({...a,revision:0})===canonical({...b,revision:0});
  const reconcile=button('Check saved layout',async()=>{
    if(busy||!pendingSave)return;busy=true;updateControls();
    try{const observed=await request();
      if(equalLayout(observed,pendingSave)&&observed.revision>=pendingSave.revision){record=observed;pendingSave=null;activeId=record.selected_id;mode=record.view;draft=null;naming.open&&naming.close();renderRows();notice('Stored cube layout confirmed by readback.');}
      else notice('The stored layout differs from this unconfirmed change. Your edits are preserved; no write was retried.');
    }catch{notice('The saved layout is still unconfirmed. No write was retried.');}finally{busy=false;updateControls();}
  });reconcile.id='cube-reconcile';toolbar.append(reconcile);
  async function request(payload) {
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch('/api/filter-cubes',payload?{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','X-Movie-Night':'1'},body:JSON.stringify(payload)}:{cache:'no-store',signal:controller.signal});
      const value=await response.json();if(!response.ok||value.error){const error=new Error(value.error||'Filter cubes are unavailable.');error.httpStatus=response.status;throw error;}return value;
    }finally{clearTimeout(timeout);}
  }
  async function commit(next, message) {
    if(busy||pendingSave)return false;busy=true;updateControls();
    const attempted={...clone(next),revision:record.revision};
    let phase='write';
    try{
      const saved=await request(attempted);phase='readback';
      const observed=await request();
      if(canonical(saved)!==canonical(observed)||!equalLayout(observed,attempted))throw new Error('readback_mismatch');
      record=observed;notice(message);return true;
    }catch(error){
      if(phase==='write'&&[400,403,409,413].includes(error.httpStatus)){notice(`${error.message} Your edits remain here.`);return false;}
      // An interrupted response can follow a landed write. Reconcile reads only.
      try{const observed=await request();if(equalLayout(observed,attempted)&&observed.revision>=attempted.revision){record=observed;notice(message);return true;}}catch{}
      pendingSave=attempted;notice('Save not confirmed. Your edits are preserved. Check saved layout before another write.');return false;
    }finally{busy=false;updateControls();}
  }
  function updateControls() {
    for (const b of [wallButton,carouselButton,add,addBelow,unlock,save,cancel,querySave,confirm,nextStep,previous]) b.disabled = busy || !record || Boolean(pendingSave);
    // A modal makes the underlying toolbar inert. Move the ONE readback control
    // into its actions while open so recovery works with pointer and keyboard.
    const recoveryHost=naming.open?actions:toolbar;
    if(reconcile.parentElement!==recoveryHost)recoveryHost.append(reconcile);
    reconcile.hidden=!pendingSave;reconcile.disabled=busy;addBelow.hidden=mode!=='carousel';
    if(naming.open)for(const control of form.querySelectorAll('input,select'))control.disabled=busy||Boolean(pendingSave)||(renameOnly&&control===source);
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
      n.actions.hidden = !draft; n.handle.disabled = !draft || busy || Boolean(pendingSave);
      n.up.disabled = busy || Boolean(pendingSave) || data()?.rows[0]?.id === id; n.down.disabled = busy || Boolean(pendingSave) || data()?.rows.at(-1)?.id === id;
    }
  }
  async function switchMode(next) {
    if (!record || busy || pendingSave || draft) return;
    mode = next; updateControls();
    if (next === 'carousel') renderRows();
    else if (activeId && !queryEdit) { const row = data().rows.find(r=>r.id===activeId); if (row) activate(row); }
    await commit({...record,view:next,selected_id:activeId}, next === 'carousel' ? 'Your live filter cubes. Unlock Edit home to arrange rows.' : 'Wall view uses the same source, filters and sorting.');
  }
  function openNaming(id = null, rename = false) {
    if (!record || busy || !cubeContract || pendingSave) return;
    if(queryEdit){notice('Save or cancel current filter edits before opening another cube.');return;}
    namingId=id;renameOnly=Boolean(id&&rename);builderOrigin=document.activeElement;
    const row=id?data().rows.find(r=>r.id===id):null;if(id&&!row)return;
    builderQuery=clone(row||host.current());
    heading.textContent=renameOnly?'Rename cube':row?'Edit cube':'Create a filter cube';
    confirm.textContent=renameOnly?'Save name':row?'Save cube changes':'Create cube';
    nameInput.value=row?.name||'';
    source.replaceChildren(...host.collections().map(c=>{const o=el('option','',c.name);o.value=c.id;return o;}));source.value=builderQuery.collectionId;source.disabled=renameOnly;
    const genres=[...new Set([...document.querySelectorAll('#include-genres input')].map(i=>i.value).concat(builderQuery.filters.include,builderQuery.filters.exclude,builderQuery.genre||[]))].filter(Boolean).sort();
    fields.genre.replaceChildren(...['',...genres].map(v=>{const o=el('option','',v||'Any genre');o.value=v;return o;}));
    for(const key of ['type','provider','yearFrom','yearTo','watch','rating','runtime','genreMode'])fields[key].value=String(builderQuery.filters[key]??'');
    for(const key of ['genre','search','sort'])fields[key].value=builderQuery[key]||'';
    for(const kind of ['include','exclude']){
      const legend=genreGroups[kind].firstChild;genreGroups[kind].replaceChildren(legend);
      for(const genre of genres){const label=el('label','genre-chip'),input=el('input');input.type='checkbox';input.value=genre;input.dataset.cubeGenre=kind;input.checked=builderQuery.filters[kind].includes(genre);label.append(input,el('span','',genre));genreGroups[kind].append(label);}
    }
    fields.catalog.value=builderQuery.browse?.catalog||'top';fields.catalogYear.value=builderQuery.browse?.year||String(new Date().getFullYear());syncSourceFields();
    naming.showModal();updateControls();showStep(renameOnly?2:0);
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||pendingSave||!validStep())return;
    if(!renameOnly&&wizardStep<2){showStep(wizardStep+1);return;}
    const next=clone(data());
    if(renameOnly)next.rows.find(r=>r.id===namingId).name=nameInput.value.trim();
    else{
      const query=builderValue();const row={...query,id:namingId||crypto.randomUUID(),name:nameInput.value.trim(),anchor:namingId?next.rows.find(r=>r.id===namingId)?.anchor||null:null};
      if(namingId)next.rows[next.rows.findIndex(r=>r.id===namingId)]=row;else next.rows.push(row);
      next.selected_id=row.id;next.view='carousel';
    }
    if(draft){draft=next;activeId=next.selected_id;naming.close();mode='carousel';renderRows();notice('Layout changed. Save layout to keep it.');}
    else if(await commit(next,renameOnly?'Cube name saved and read back.':'Cube saved and read back. Its contents stay live.')){activeId=record.selected_id;mode=record.view;naming.close();renderRows();}
    else feedback.textContent=$('cube-status').textContent;
    updateControls();
  });
  function beginEdit() {
    if (!record || busy || pendingSave || queryEdit) { if(queryEdit)notice('Save or cancel the current filter edits first.'); return; }
    draft = clone(record); mode = 'carousel'; renderRows(); updateControls(); notice('Home unlocked. Drag a row handle, use Move up/down, rename, add or remove. Nothing changes until Save layout.');
  }
  async function saveLayout() {
    if (!draft || busy || pendingSave || queryEdit) { if(queryEdit)notice('Save or cancel cube filters before saving the layout.'); return; }
    if (await commit({...draft,view:'carousel'}, 'Home layout saved and read back. Your titles and files were not changed.')) { draft=null; renderRows(); updateControls(); }
  }
  function cancelLayout() { if(busy||pendingSave)return; draft=null; activeId=record.selected_id; queryEdit=null; renderRows(); updateControls(); notice('Layout edits cancelled. Saved rows are unchanged.'); }
  async function removeCube(id) {
    if (!draft || busy || pendingSave) return;
    draft.rows = draft.rows.filter(row=>row.id!==id); if(activeId===id)activeId=draft.selected_id=draft.rows[0]?.id||null;
    if(queryEdit===id)queryEdit=null;
    deleting.close(); renderRows(); updateControls(); notice('Row removed from the draft layout. Save to keep this change, or Cancel to restore it. No media or files were deleted.');
  }
  function moveRow(id, target) {
    if (!draft || busy || pendingSave) return;
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
  function editQuery(row) { openNaming(row.id); }
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
    controls.append(button('Edit cube',()=>editQuery(data().rows.find(r=>r.id===row.id))),prev,next);
    const actions=el('div','cube-row-edit');const up=button('Move up',()=>moveRow(row.id,data().rows.findIndex(r=>r.id===row.id)-1)),down=button('Move down',()=>moveRow(row.id,data().rows.findIndex(r=>r.id===row.id)+1));
    actions.append(up,down,button('Rename',()=>openNaming(row.id,true)),button('Remove',()=>{deletingId=row.id;deleteText.textContent=`Remove “${data().rows.find(r=>r.id===row.id).name}” from the home layout only. Favorites, history, titles and files are unchanged.`;deleting.showModal();}));
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
  try{const response=await fetch('/api/filter-cubes/declaration',{cache:'no-store'});if(!response.ok)throw Error('Cube controls could not load their existing declaration.');cubeContract=await response.json();initializeBuilder(cubeContract);record=await request();mode=record.view;activeId=record.selected_id;if(activeId){const row=record.rows.find(r=>r.id===activeId);if(row)activate(row);}renderRows();if(mode==='carousel')notice('Your live filter cubes. Create another cube or edit any row without chat.');}
  catch(error){notice(error.message+' The existing wall remains available.');updateControls();}
  return {
    isCarousel:()=>mode==='carousel',
    refresh(){if(syncing)return;updateControls();for(const row of data()?.rows||[])if(nodes.get(row.id)?.visible)paintRow(row);},
    detailSourceChanged(){for(const row of data()?.rows||[])if(nodes.get(row.id)?.visible)paintRow(row);},
  };
}
