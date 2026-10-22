import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Film, Layers, Plug, RefreshCw, Search, Settings as SettingsIcon, SlidersHorizontal, Sparkles, X } from 'lucide-react';

export const DEFAULT_SETTINGS = {
  appearance: { mode: 'glass', opacity: 82 },
  browsing: { start_view: 'curated', catalog: 'top', card_size: 'comfortable', show_ratings: true },
  playback: { preferred_quality: 'balanced', prefer_small_encodes: true, default_volume: 100, seek_seconds: 10 },
  plugins: { torrentio_enabled: true, cinemeta_enabled: true, ollama_enabled: true },
  concierge: { model: 'llama3.1:8b' },
};

const SECTIONS = [
  { id: 'browsing', label: 'Browsing', icon: Film, summary: 'Choose how your wall opens and how titles are presented.' },
  { id: 'appearance', label: 'Appearance', icon: Layers, summary: 'Set the window material and the strength of its background.' },
  { id: 'playback', label: 'Playback', icon: SlidersHorizontal, summary: 'Choose your source preferences and playback defaults.' },
  { id: 'plugins', label: 'Plugins & connections', icon: Plug, summary: 'Manage the services Movie Night uses on Aries.' },
  { id: 'concierge', label: '@ibal concierge', icon: Sparkles, summary: 'Choose the installed local model that helps curate your lists.' },
];

// One field registry supplies navigation, search, labels and editor controls.
// Its host owns persistence. The window frame only opens this destination.
const FIELDS = [
  { section: 'appearance', key: 'mode', label: 'Window material', hint: 'Glass lets the desktop show through the background. Text, posters and video stay solid.', type: 'select', options: [['glass', 'Glass'], ['solid', 'Solid']] },
  { section: 'appearance', key: 'opacity', label: 'Background opacity', hint: 'Lower values reveal more of the desktop. Preview changes here before saving.', type: 'range', min: 60, max: 95, step: 1, suffix: '%' },
  { section: 'browsing', key: 'start_view', label: 'Open Movie Night to', hint: 'Applies the next time the wall opens.', type: 'select', options: [['curated', 'My collections'], ['browse-movie', 'All movies'], ['browse-series', 'TV series'], ['nuvio-library', 'Nuvio library'], ['personal-favorites', 'Favorites'], ['personal-recent', 'Recent']] },
  { section: 'browsing', key: 'catalog', label: 'Default catalogue', hint: 'Used for Movies or TV the next time the wall opens.', type: 'select', options: [['top', 'Popular'], ['imdbRating', 'Featured'], ['year', 'By year']] },
  { section: 'browsing', key: 'card_size', label: 'Poster size', hint: 'Adjust the number of posters that fit across your wall.', type: 'select', options: [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['large', 'Large']] },
  { section: 'browsing', key: 'show_ratings', label: 'Show ratings', hint: 'Display available ratings below the posters.', type: 'toggle' },
  { section: 'playback', key: 'preferred_quality', label: 'Preferred source quality', hint: 'Applies when choosing a new movie. Other cached qualities remain available as a fallback.', type: 'select', options: [['balanced', 'Balanced'], ['2160p', '4K · 2160p'], ['1080p', 'Full HD · 1080p'], ['720p', 'HD · 720p']] },
  { section: 'playback', key: 'prefer_small_encodes', label: 'Prefer smaller encodes', hint: 'Prefer lighter encodes over large remux files within the source selection order.', type: 'toggle' },
  { section: 'playback', key: 'default_volume', label: 'Starting volume', hint: 'Used for the next movie you start. Saving does not change a movie already playing.', type: 'range', min: 0, max: 100, step: 5, suffix: '%' },
  { section: 'playback', key: 'seek_seconds', label: 'Skip interval', hint: 'Sets the distance for the player’s back and forward buttons.', type: 'select-number', options: [[5, '5 seconds'], [10, '10 seconds'], [30, '30 seconds']] },
  { section: 'plugins', key: 'cinemeta_enabled', label: 'Cinemeta catalogues', hint: 'Movie and TV discovery, cover art and title details. No API key is required.', type: 'toggle' },
  { section: 'plugins', key: 'torrentio_enabled', label: 'Torrentio with Real-Debrid', hint: 'Use the existing connection to find cached sources when you select a movie.', type: 'toggle' },
  { section: 'plugins', key: 'ollama_enabled', label: 'Ollama concierge', hint: 'Allow @ibal to use the local Ollama service for list suggestions.', type: 'toggle' },
  { section: 'concierge', key: 'model', label: 'Ollama model', hint: 'Choose an installed model. Changes apply to your next concierge request.', type: 'model' },
];

function copy(value) { return JSON.parse(JSON.stringify(value)); }

async function readDocument(response) {
  let value;
  try { value = await response.json(); }
  catch { throw new Error('The settings response could not be read. Please try again.'); }
  if (!response.ok || !value || typeof value !== 'object' || value.error) {
    const error = new Error(typeof value?.error === 'string' ? value.error : 'Settings are unavailable just now.');
    error.code = value?.code;
    throw error;
  }
  return value;
}

function settingsDocument(value) {
  const complete = Number.isInteger(value.revision) && value.revision >= 0 && FIELDS.every(field => {
    const current = value.settings?.[field.section]?.[field.key];
    if (field.type === 'toggle') return typeof current === 'boolean';
    if (field.type === 'range') return Number.isInteger(current) && current >= field.min && current <= field.max;
    if (field.type === 'model') return typeof current === 'string' && current.trim().length > 0 && current.length <= 160;
    return field.options.some(([option]) => option === current);
  });
  if (!complete) throw new Error('The settings response was incomplete. Please reload your preferences.');
  return value;
}

export function useMovieSettings() {
  const [record, setRecord] = useState({ revision: 0, settings: copy(DEFAULT_SETTINGS) });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const reload = async () => {
    try {
      const value = settingsDocument(await readDocument(await fetch('/api/settings', { cache: 'no-store' })));
      setRecord(value); setReady(true); setError(''); return value;
    } catch (err) { setError(err.message); throw err; }
  };
  useEffect(() => { reload().catch(() => {}); }, []);
  const save = async (settings, revision) => {
    const value = settingsDocument(await readDocument(await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Movie-Night': '1' },
      body: JSON.stringify({ revision, settings }),
    })));
    setRecord(value); setReady(true); setError(''); return value;
  };
  return { record, ready, error, reload, save };
}

export default function MovieSettings({ open, context = 'browsing', store, transparency, native, onClose, onPreviewAppearance }) {
  const dialog = useRef(null);
  const [section, setSection] = useState(context);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(() => copy(store.record.settings));
  const [baseline, setBaseline] = useState(() => copy(store.record.settings));
  const touched = useRef(false);
  const [baseRevision, setBaseRevision] = useState(store.record.revision);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState('');
  const [conflict, setConflict] = useState(false);
  const [connections, setConnections] = useState(null);
  const [checking, setChecking] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  function acceptRecord(value) {
    touched.current = false;
    setDraft(copy(value.settings)); setBaseline(copy(value.settings)); setBaseRevision(value.revision);
  }

  async function checkConnections() {
    if (checking) return;
    setChecking(true);
    try {
      setConnections(await readDocument(await fetch('/api/settings/plugins', { cache: 'no-store' })));
    } catch (err) { setConnections({ error: err.message, plugins: [], models: [] }); }
    finally { setChecking(false); }
  }

  useEffect(() => {
    if (open) {
      setSection(SECTIONS.some(item => item.id === context) ? context : 'browsing');
      acceptRecord(store.record);
      setQuery(''); setFailure(''); setFeedback(''); setConflict(false);
      if (!dialog.current.open) dialog.current.showModal();
      checkConnections();
    } else {
      onPreviewAppearance?.(null);
      if (dialog.current?.open) dialog.current.close();
    }
  }, [open]);

  useEffect(() => {
    // Server defaults arriving after the dialog opens are not user edits.
    // Synchronize untouched drafts against their own baseline, never against
    // a moving record that can incorrectly turn a fresh dialog dirty.
    if (open && store.ready && !touched.current) acceptRecord(store.record);
  }, [open, store.ready, store.record]);

  function change(field, value) {
    if (!store.ready || busy) return;
    touched.current = true;
    const next = { ...draft, [field.section]: { ...draft[field.section], [field.key]: value } };
    setDraft(next); setFeedback(''); if (!conflict) setFailure('');
    if (field.section === 'appearance') onPreviewAppearance?.(next.appearance);
  }
  function close() { if (busy) return; onPreviewAppearance?.(null); onClose(); }

  async function save(event) {
    event.preventDefault(); if (!store.ready || busy || !dirty || conflict) return;
    setBusy('save'); setFailure(''); setConflict(false);
    try {
      const value = await store.save(draft, baseRevision);
      acceptRecord(value);
      onPreviewAppearance?.(null); setFeedback('Saved on Aries.');
      checkConnections();
    } catch (err) { setFailure(err.message); setConflict(err.code === 'revision_conflict'); }
    finally { setBusy(''); }
  }

  async function reload() {
    if (busy) return;
    setBusy('reload'); setFeedback('');
    try {
      const value = await store.reload(); acceptRecord(value);
      setFailure(''); setConflict(false); setFeedback('Current settings loaded.'); onPreviewAppearance?.(null);
    } catch (err) { setFailure(err.message); }
    finally { setBusy(''); }
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const fields = useMemo(() => FIELDS.filter(field => normalizedQuery
    ? `${field.label} ${field.hint} ${field.section} ${field.options?.flat().join(' ') || ''}`.toLocaleLowerCase().includes(normalizedQuery)
    : field.section === section), [section, normalizedQuery]);
  const groups = SECTIONS.filter(item => fields.some(field => field.section === item.id));
  const installedModels = Array.from(new Set(Array.isArray(connections?.models) ? connections.models.filter(value => typeof value === 'string' && value.trim()) : []));
  const modelsChecked = !connections?.error && (installedModels.length > 0 || connections?.plugins?.some(plugin => plugin.id === 'ollama' && plugin.connection_checked === true));
  const models = Array.from(new Set([draft.concierge.model, ...installedModels]));

  function fieldEditor(field) {
    const value = draft[field.section][field.key];
    const id = `setting-${field.section}-${field.key}`;
    const disabled = !store.ready || Boolean(busy);
    if (field.type === 'toggle') return <button id={id} type="button" role="switch" aria-checked={value} className="setting-switch" disabled={disabled} onClick={() => change(field, !value)}><span /></button>;
    if (field.type === 'range') return <div className="setting-range"><output htmlFor={id}>{value}{field.suffix}</output><input id={id} type="range" min={field.min} max={field.max} step={field.step} value={value} disabled={disabled || (field.section === 'appearance' && draft.appearance.mode === 'solid')} onChange={event => change(field, Number(event.target.value))} /></div>;
    const options = field.type === 'model' ? models.map(name => [name, installedModels.includes(name) ? name : `${name} · ${checking || !connections ? 'checking' : !modelsChecked ? 'unverified' : 'not installed'}`]) : field.options;
    return <select id={id} value={value} disabled={disabled || (field.type === 'model' && (!draft.plugins.ollama_enabled || checking || !installedModels.length))} onChange={event => change(field, field.type === 'select-number' ? Number(event.target.value) : event.target.value)}>{options.map(([key, label]) => <option key={key} value={key} disabled={field.type === 'model' && !installedModels.includes(key)}>{label}</option>)}</select>;
  }

  return <dialog ref={dialog} id="movie-settings" className="movie-settings" aria-labelledby="movie-settings-title" onCancel={event => { event.preventDefault(); close(); }} onClose={() => { if (open) close(); }}>
    <form className="movie-settings-form" onSubmit={save}>
      <header className="movie-settings-heading"><div className="movie-settings-mark"><SettingsIcon size={22} /></div><div><p>Movie Night · Aries</p><h2 id="movie-settings-title">Settings</h2></div><button type="button" className="shell-icon-button" aria-label="Close settings" onClick={close} disabled={Boolean(busy)}><X size={21} /></button></header>
      <div className="movie-settings-search"><Search size={18} /><input type="search" aria-label="Search Movie Night settings" placeholder="Search settings, plugins, playback…" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <div className="movie-settings-body"><nav aria-label="Settings sections">{SECTIONS.map(item => { const Icon = item.icon; return <button key={item.id} type="button" aria-label={item.label} title={context === item.id ? "Settings for the current view" : undefined} aria-current={!query && section === item.id ? 'page' : undefined} onClick={() => { setSection(item.id); setQuery(''); }}><Icon size={18} /><span>{item.label}</span>{context === item.id && <i aria-hidden="true" />}</button>; })}</nav>
        <div className="movie-settings-content">
          {!store.ready && <p className="settings-notice" role="status">{store.error || 'Loading your preferences…'} {store.error && <button type="button" onClick={reload} disabled={Boolean(busy)}>{busy === 'reload' ? 'Loading…' : 'Try again'}</button>}</p>}
          {groups.map(group => <section className="settings-group" key={group.id} aria-labelledby={`settings-heading-${group.id}`}><h3 id={`settings-heading-${group.id}`}>{group.label}</h3><p className="settings-summary">{group.summary}</p>
            {fields.filter(field => field.section === group.id).map(field => <div className="settings-row" key={field.key}><div><label htmlFor={`setting-${field.section}-${field.key}`}>{field.label}</label><p>{field.hint}</p></div>{fieldEditor(field)}</div>)}
            {group.id === 'appearance' && <p className="settings-notice">{native && transparency?.available ? 'Native glass is available on this display.' : native ? 'Solid is active until native transparency is available on this display.' : 'Native glass is available in the Movie Night desktop app.'} Appearance changes are previewed until you save.</p>}
            {group.id === 'plugins' && <div className="settings-connections"><div className="settings-connections-heading"><h4>Connections on Aries</h4><button type="button" className="settings-refresh" onClick={checkConnections} disabled={checking}><RefreshCw size={15} />{checking ? 'Checking…' : 'Check connections'}</button></div>{connections?.error && <p className="settings-notice">{connections.error}</p>}{connections?.plugins?.map(plugin => <div className="settings-connection" key={plugin.id}><span className={`connection-indicator ${plugin.enabled && plugin.available ? 'ready' : ''}`} /><div><strong>{plugin.name}</strong><p>{plugin.message || plugin.status}</p></div><span className="connection-label">{!plugin.enabled ? 'Off' : plugin.id === 'torrentio' && plugin.configured ? 'Configured' : plugin.available ? 'Ready' : plugin.configured ? 'Configured' : 'Unavailable'}</span></div>)}<p className="settings-notice">Your existing Nuvio credentials are reused privately on Aries. These controls change Movie Night only. Source availability is checked when you choose a movie.</p></div>}
            {group.id === 'concierge' && <><p className="settings-notice" role="status">{!draft.plugins.ollama_enabled ? 'Enable Ollama concierge in Plugins & connections to choose a model.' : checking ? 'Checking which models are installed…' : !modelsChecked ? 'The installed model list is unavailable right now.' : !installedModels.length ? 'No installed models were found on Aries.' : !installedModels.includes(draft.concierge.model) ? 'Your saved model is not installed. Choose one of the installed models to use the concierge.' : 'Only models installed on Aries are offered.'} <button type="button" onClick={checkConnections} disabled={checking || Boolean(busy)}>Check models</button></p><p className="settings-notice">The concierge currently curates from your original 100-film collection. Changing the model does not expand that catalogue.</p></>}
          </section>)}
          {!groups.length && <p className="settings-empty">No matching settings. Try “volume,” “glass,” or a plugin name.</p>}
        </div>
      </div>
      <footer className="movie-settings-footer"><div aria-live="polite">{failure ? <p className="settings-error">{failure} {conflict && <>Reload replaces your unsaved changes. <button type="button" onClick={reload} disabled={Boolean(busy)}>Reload current settings</button></>}</p> : feedback ? <p className="settings-saved"><Check size={16} />{feedback}</p> : <p>{!store.ready ? 'Waiting for your saved preferences.' : dirty ? 'Unsaved changes' : 'Preferences apply to Movie Night on Aries.'}</p>}</div><button type="button" className="shell-button" onClick={close} disabled={Boolean(busy)}>{dirty ? 'Cancel' : 'Done'}</button><button type="submit" className="shell-primary" disabled={!store.ready || Boolean(busy) || !dirty || conflict}>{busy === 'save' ? 'Saving…' : busy === 'reload' ? 'Loading…' : 'Save changes'}</button></footer>
    </form>
  </dialog>;
}
