/**
 * CHAT SNAP / YIN-YANG WORK PROJECTION
 * One conversation, two orientations. Snapping does not create a second chat.
 */
export const CHAT_SNAP_SCHEMA='xiio.chat-snap/v1';
export const CHAT_MODE=Object.freeze({FREE:'FREE',WORK:'WORK'});
export const VIEW=Object.freeze({GOLDEN:'GOLDEN',SUBTERRANEAN:'SUBTERRANEAN'});
export const DEVICE=Object.freeze({MOBILE:'MOBILE',TABLET:'TABLET',DESKTOP:'DESKTOP'});
/* What one target is to one conversation. Declared beside DEVICE because both
   answer "where is this thing", and a surface that has to guess either one is a
   surface that will render a crew it cannot name. */
export const RELATION=Object.freeze({LEAD:'LEAD',CHILD:'CHILD',PEER:'PEER',UNRELATED:'UNRELATED'});

export function freeChat({conversation_ref}={}){
  if(!conversation_ref) return {ok:false,first_red:'CONVERSATION_REQUIRED'};
  return {ok:true,schema:CHAT_SNAP_SCHEMA,conversation_ref,mode:CHAT_MODE.FREE,target_ref:null,work_ref:null,projection_ref:null,effect_ceiling:'DRAFT',crew:[],views:[VIEW.GOLDEN]};
}

export function snapChat(chat,{target_ref,work_ref,projection_ref,generation=1}={}){
  if(!chat?.conversation_ref) return {ok:false,first_red:'CONVERSATION_REQUIRED'};
  if(!target_ref) return {ok:false,first_red:'TARGET_REQUIRED'};
  if(!work_ref) return {ok:false,first_red:'WORK_REQUIRED'};
  if(!projection_ref) return {ok:false,first_red:'SUBTERRANEAN_PROJECTION_REQUIRED'};
  /* A re-snap keeps the crew it already had. Re-snapping the same window is the
     same lead, and dropping its children on a re-bind would silently disband a
     crew every time the binding was refreshed. */
  return {...chat,ok:true,mode:CHAT_MODE.WORK,target_ref,work_ref,projection_ref,generation,effect_ceiling:'DRAFT',crew:chat.crew??[],views:[VIEW.GOLDEN,VIEW.SUBTERRANEAN]};
}

export function unsnapChat(chat){
  /* Detaching releases the crew with the binding. `freeChat` returns no crew,
     so a free conversation cannot keep leading windows it is no longer on. */
  return freeChat({conversation_ref:chat?.conversation_ref});
}

/* ── THE CREW ───────────────────────────────────────────────────────────────
 *
 * A chat bound to a window IS that window's LEAD. The windows snapped under it
 * are its CREW, and the lead governs them: one conversation, one rail, however
 * many windows are working under it.
 *
 * A crew is held by `target_ref` — never by element, never by position — for the
 * same reason a window's address is held that way: a window that was moved is
 * the same window, and a child that was re-snapped is the same child. It lives
 * in the contract rather than in the store because "who leads whom" is a fact
 * about the conversation, not about this browser tab.
 *
 * Every refusal below fails closed and names itself, so a surface that offers
 * adoption can say why it was refused instead of silently doing nothing.
 */
export function adoptChild(chat,child_ref){
  if(chat?.mode!==CHAT_MODE.WORK||!chat.target_ref) return {...chat,ok:false,first_red:'LEAD_NOT_BOUND'};
  if(!child_ref) return {...chat,ok:false,first_red:'CHILD_REQUIRED'};
  if(child_ref===chat.target_ref) return {...chat,ok:false,first_red:'SELF_CHILD'};
  const crew=chat.crew??[];
  if(crew.includes(child_ref)) return {...chat,ok:false,first_red:'CHILD_ALREADY_ADOPTED'};
  return {...chat,ok:true,crew:[...crew,child_ref]};
}

export function releaseChild(chat,child_ref){
  const crew=chat?.crew??[];
  if(!crew.includes(child_ref)) return {...chat,ok:false,first_red:'CHILD_NOT_ADOPTED'};
  return {...chat,ok:true,crew:crew.filter(ref=>ref!==child_ref)};
}

/* What one target is to this conversation. A target that is neither the lead
   nor a child is UNRELATED, which is a real answer and never rounded to PEER —
   two windows that happen to sit near each other are not a crew. */
export function relationOf(chat,target_ref){
  if(!chat?.conversation_ref||!target_ref) return RELATION.UNRELATED;
  if(chat.target_ref===target_ref) return RELATION.LEAD;
  return (chat.crew??[]).includes(target_ref)?RELATION.CHILD:RELATION.UNRELATED;
}

export function projectionForDevice(chat,device){
  if(!Object.values(DEVICE).includes(device)) return {ok:false,first_red:'DEVICE_REQUIRED'};
  const work=chat?.mode===CHAT_MODE.WORK;
  const crew=work?(chat.crew??[]):[];
  const leading=crew.length>0;
  return {
    ok:true,device,conversation_ref:chat?.conversation_ref,
    golden:{visible:true,role:'conversation',tone:'BRIGHT'},
    subterranean:{visible:work,role:'work_projection',tone:'DARK'},
    relation:work?'CROSS_AT_SEAM':'UNPAIRED',
    /* A lead with a crew is a different SHAPE on every device, and it is answered
       here — once — so a desktop and a phone cannot disagree about the same
       conversation. This function was declared with the three device layouts and
       then never called by anything, which is why the same conversation rendered
       identically everywhere and a phone was handed a desktop it had no room for. */
    layout:device===DEVICE.DESKTOP?(leading?'LEAD_RAIL_WITH_CHILDREN':work?'SIDE_BY_SIDE':'SINGLE')
      :device===DEVICE.TABLET?(leading?'LEAD_SPLIT_OR_TOGGLE':work?'SPLIT_OR_TOGGLE':'SINGLE')
      :(leading?'LEAD_TOGGLE_STACK':work?'TOGGLE_STACK':'SINGLE'),
    /* On a phone there is no room for columns, so the lead is the FACE and the
       crew sits behind it — one child at a time, reached by a single toggle.
       That is the whole of the mobile answer: not a smaller desktop, a different
       shape. A phone that tries to show the lead and its children side by side
       shows neither. */
    crew,crew_size:crew.length,leading,
    target_ref:chat?.target_ref??null,work_ref:chat?.work_ref??null,projection_ref:chat?.projection_ref??null,
  };
}

export function classifyPair(a,b){
  if(!a?.conversation_ref||!b?.conversation_ref) return 'UNOBSERVED';
  if(a.conversation_ref!==b.conversation_ref) return 'TARGET_SPLIT';
  if(a.mode!=='WORK'||b.mode!=='WORK') return 'UNPAIRED';
  if(a.target_ref!==b.target_ref||a.work_ref!==b.work_ref||a.projection_ref!==b.projection_ref) return 'DRIFT';
  if(a.effect_ceiling!=='DRAFT'||b.effect_ceiling!=='DRAFT') return 'AUTHORITY_VIOLATION';
  return 'CONSERVED';
}

export const METAPHOR=Object.freeze({
  chat:'CONVERSATION',
  snap:'SNAP',
  golden:'SURFACE',
  subterranean:'SUBTERRANEAN',
  seam:'SEAM',
  law:'ONE_CONVERSATION_TWO_OPPOSING_PROJECTIONS_MEET_AT_THE_SEAM_AND_NEVER_BLEND'
});