import React, { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, X, Check, BookmarkPlus } from 'lucide-react';
import ChatSnapControl from '@/components/chat/ChatSnapControl';

const HISTORY = 'movie-night.concierge.history/v1';
function remembered() {
  try {
    const rows = JSON.parse(localStorage.getItem(HISTORY) || '[]');
    return Array.isArray(rows) ? rows.filter(x => ['user', 'assistant'].includes(x.role) && typeof x.content === 'string').slice(-40) : [];
  } catch { return []; }
}

export default function Concierge({ onClose, onCollectionSaved, onOpenSettings, selection, getCubeContext, onReviewCube }) {
  const [messages, setMessages] = useState(remembered);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [saved, setSaved] = useState(false);
  const [cubeOperation, setCubeOperation] = useState(null);
  const [cubeOutcome, setCubeOutcome] = useState(null);
  const [reviewNotes, setReviewNotes] = useState([]);
  const [reviewing, setReviewing] = useState(false);
  const bottom = useRef(null);

  useEffect(() => {
    let mounted = true;
    let generation = 0;
    const refresh = () => {
      const current = ++generation;
      fetch('/api/concierge/status', { cache: 'no-store' }).then(r => r.json()).then(x => { if (mounted && current === generation) setStatus(x); }).catch(() => { if (mounted && current === generation) setStatus({ available: false }); });
    };
    refresh();
    window.addEventListener('movie-night:settings-changed', refresh);
    return () => { mounted = false; window.removeEventListener('movie-night:settings-changed', refresh); };
  }, []);
  useEffect(() => {
    try { localStorage.setItem(HISTORY, JSON.stringify(messages.slice(-40))); } catch { /* Session-only history remains usable. */ }
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, busy]);

  async function ask(event) {
    event.preventDefault();
    if (busy || reviewing || !prompt.trim() || status?.available === false) return;
    const next = [...messages, { role: 'user', content: prompt.trim().slice(0, 2000) }];
    setMessages(next); setPrompt(''); setBusy(true); setError(''); setProposal(null); setSaved(false); setCubeOperation(null); setCubeOutcome(null); setReviewNotes([]);
    try {
      const response = await fetch('/api/concierge/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Movie-Night': '1' },
        body: JSON.stringify({ messages: next.slice(-12), ...(getCubeContext?.() ? { cube_context: getCubeContext() } : {}), ...(selection ? { context: { ids: selection.ids, selected: selection.selected } } : {}) }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || 'Ollama could not answer just now.');
      setMessages([...next, { role: 'assistant', content: result.message || 'Here is a collection for you.' }]);
      if (result.cube_operation) { setCubeOperation(result.cube_operation); setReviewNotes(Array.isArray(result.review_notes) ? result.review_notes : []); }
      else if (result.collection?.movies?.length) setProposal(result.collection);
    } catch (err) { setError(err.message || 'The concierge is unavailable.'); }
    finally { setBusy(false); }
  }

  async function reviewCube() {
    if(!cubeOperation||reviewing||cubeOutcome?.status==='confirmed'||typeof onReviewCube!=='function')return;
    setReviewing(true);setError('');
    try {
      const result=await onReviewCube(cubeOperation);setCubeOutcome(result);
      if(result?.status==='confirmed')setMessages(current=>[...current,{role:'assistant',content:`Cube ${result.action==='remove'?'removed':result.action==='edit'?'updated':'created'} and independently read back. ID: ${result.cube_id}. Revision: ${result.revision}.`}]);
    }catch(err){setError(err.message||'The cube review could not open. Nothing was changed.');}
    finally{setReviewing(false);}
  }

  async function saveCollection() {
    if (!proposal || busy || saved) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/concierge/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Movie-Night': '1' },
        body: JSON.stringify({ name: proposal.name, description: proposal.description || '', imdb_ids: proposal.movies.map(m => m.imdb_id) }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || 'The collection could not be saved.');
      setSaved(true); onCollectionSaved?.(result.collection?.id || result.id);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <section className="concierge" aria-label="Ibal movie concierge">
    <header className="concierge-heading">
      <div className="concierge-mark"><Sparkles size={20} /></div>
      <div><h2>@ibal</h2><p>{status?.available ? 'Your movie concierge · Ollama' : 'Your movie concierge'}</p></div>
      <button className="shell-icon-button" aria-label="Close concierge" onClick={onClose}><X size={20} /></button>
    </header>
    <div className="concierge-runtime" role="status"><span className={status?.available ? 'model-online' : 'model-unavailable'}>{status?.available ? 'Local model ready' : status ? 'Local model unavailable' : 'Checking local model…'}</span><span>{status?.model || ''}</span></div>
    {selection && <div className="concierge-context"><strong>{selection.name}</strong><span>{selection.count} matching titles{selection.limited ? ' · first 1,000 available to chat' : ''}</span>{selection.title && <span>Looking at {selection.title}</span>}<small>Recommendations use this selection. No cloud fallback.</small></div>}
    <div className="chat-snap-controls"><ChatSnapControl /></div>
    <div className="concierge-transcript" aria-live="polite" aria-busy={busy}>
      {status?.enabled === false && <p className="concierge-error" role="status">Ollama concierge is turned off. Enable it in Settings → Plugins &amp; connections.</p>}
      {!messages.length && <div className="concierge-welcome"><Sparkles size={28} /><h3>What are you in the mood for?</h3><p>Ask for a collection, tell me what you enjoy, or narrow tonight’s choices.</p><button onClick={() => setPrompt('Make me a list of ten thoughtful science-fiction films from this wall.')}>Thoughtful science fiction</button><button onClick={() => setPrompt('Pick six lighter films for a relaxed movie night.')}>A relaxed movie night</button></div>}
      {messages.map((message, i) => <article className={`chat-message ${message.role}`} key={i}><span>{message.role === 'user' ? 'You' : '@ibal'}</span><p>{message.content}</p></article>)}
      {busy && <p className="concierge-thinking">{proposal ? 'Saving your collection…' : 'Preparing your request…'}</p>}
      {cubeOperation && <div className="collection-proposal cube-proposal" aria-label="Proposed live cube operation">
        <h3>{cubeOperation.action==='remove'?'Remove selected cube':cubeOperation.row?.name || 'Proposed live cube'}</h3>
        <p>Source: {cubeOperation.source_scope}. Expected revision: {cubeOperation.expected_revision}.</p>
        {cubeOperation.row && <p>{[cubeOperation.row.filters?.type, cubeOperation.row.genre, ...(cubeOperation.row.filters?.include||[]), cubeOperation.row.filters?.yearFrom ? `From ${cubeOperation.row.filters.yearFrom}` : '', cubeOperation.row.filters?.yearTo ? `Through ${cubeOperation.row.filters.yearTo==='present'?'the current year':cubeOperation.row.filters.yearTo}` : 'No upper year limit'].filter(Boolean).join(' · ')}</p>}
        {reviewNotes.map((note, i) => <p key={i} className="cube-review-note" role="note">{note}</p>)}
        <p>This is a proposal, not a saved change. Review the complete filters in your existing cube editor.</p>
        <button className="shell-primary" type="button" onClick={reviewCube} disabled={reviewing||cubeOutcome?.status==='confirmed'||!onReviewCube}>{cubeOutcome?.status==='confirmed'?'Confirmed by storage readback':reviewing?'Review open in workspace':'Review cube change'}</button>
        {cubeOutcome && <p className="cube-operation-result" role="status">{cubeOutcome.status==='confirmed'?`Cube ${cubeOutcome.cube_id} · revision ${cubeOutcome.revision}`:cubeOutcome.status==='unconfirmed'?'Outcome unconfirmed. Check saved layout before another write.':cubeOutcome.status==='refused'?'The service refused this change. Your saved cube was not replaced.':'Review cancelled before a confirmed change.'}</p>}
      </div>}
      {proposal && <div className="collection-proposal"><h3>{proposal.name}</h3><p>{proposal.movies.length} titles · ready to browse</p><div className="proposal-posters">{proposal.movies.slice(0, 6).map(movie => <img key={movie.imdb_id} src={movie.poster} alt={movie.title} loading="lazy" />)}</div><button className="shell-primary" disabled={busy || saved} onClick={saveCollection}>{saved ? <Check size={18} /> : <BookmarkPlus size={18} />}{saved ? 'Added to your wall' : 'Save this collection'}</button></div>}
      {error && <p className="concierge-error" role="alert">{error}</p>}
      <div ref={bottom} />
    </div>
    <form className="concierge-composer" onSubmit={ask}><label htmlFor="concierge-prompt" className="sr-only">Ask your movie concierge</label><textarea id="concierge-prompt" disabled={status?.available === false} value={prompt} maxLength={2000} rows={3} placeholder="Make me a list of…" onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(event); } }} /><button type="submit" className="shell-primary" disabled={busy || reviewing || !prompt.trim() || status?.available === false}><Send size={18} />Ask @ibal</button></form>
  </section>;
}
