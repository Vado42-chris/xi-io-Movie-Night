import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Film, Layers, Plug, RefreshCw, Search, Settings as SettingsIcon, SlidersHorizontal, Sparkles, X } from 'lucide-react';

import declarationSource from '../../xiio/settings.schema.json';
import { qualify, defaults, fields as declaredFields, document as declaredDocument, supportsTransfer, readExportDocument, importDocument, importRequest } from '../../web/settings-contract.mjs';

const DECLARATION = qualify(declarationSource);
export const DEFAULT_SETTINGS = defaults(DECLARATION);
// Icons are presentation. Sections, fields, defaults and rules come from one declaration.
const SECTION_ICONS = { Film, Layers, SlidersHorizontal, Plug, Sparkles };
const SECTIONS = DECLARATION['x-xiio'].section_order.map(id => {
  const section = DECLARATION.properties[id];
  return { id, label: section.title, summary: section.description, icon: SECTION_ICONS[section['x-xiio'].icon] || SettingsIcon };
});
const FIELDS = declaredFields(DECLARATION);

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

function settingsDocument(value) { return declaredDocument(DECLARATION, value); }

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
  const operate = async (operation, payload) => {
    if (!['reset', 'import'].includes(operation)) throw new Error('Unsupported settings operation.');
    const value = settingsDocument(await readDocument(await fetch(`/api/settings/${operation}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Movie-Night': '1' },
      body: JSON.stringify(payload),
    })));
    setRecord(value); setReady(true); setError(''); return value;
  };
  return { record, ready, error, reload, save,
    reset: (scope, revision) => operate('reset', { scope, revision }),
    importPreferences: (settings, revision) => operate('import', importRequest(DECLARATION, settings, revision)),
  };
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
  const [resetScope, setResetScope] = useState(null);
  const [imported, setImported] = useState(false);
  const importFile = useRef(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  function acceptRecord(value) {
    touched.current = false; setImported(false); setResetScope(null);
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
      const value = imported ? await store.importPreferences(draft, baseRevision) : await store.save(draft, baseRevision);
      acceptRecord(value);
      onPreviewAppearance?.(null); setFeedback('Saved and read back on Aries.');
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

  async function resetPreferences() {
    if (!resetScope || busy || dirty || !store.ready) return;
    setBusy('reset'); setFailure('');
    try {
      const value = await store.reset(resetScope, baseRevision);
      const label = SECTIONS.find(item => item.id === resetScope)?.label || 'Application';
      acceptRecord(value); onPreviewAppearance?.(null);
      setFeedback(`${label} defaults saved and read back. Other preferences and your files were preserved.`);
      checkConnections();
    } catch (err) { setFailure(err.message); setConflict(err.code === 'revision_conflict'); }
    finally { setBusy(''); setResetScope(null); }
  }
  async function exportPreferences() {
    if (busy || !store.ready) return;
    setBusy('export'); setFailure('');
    try {
      const value = await readDocument(await fetch('/api/settings/export', { cache: 'no-store' }));
      readExportDocument(DECLARATION, value);
      const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'movie-night-preferences.json';
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback('Exported saved preferences only. Credentials, history and files are not included.');
    } catch (err) { setFailure(err.message); }
    finally { setBusy(''); }
  }
  async function previewImport(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || busy || !store.ready || dirty || !supportsTransfer(DECLARATION, 'import')) return;
    setBusy('import'); setFailure('');
    try {
      if (file.size > 16384) throw new Error('The preferences file is too large. Nothing was changed.');
      const settings = importDocument(DECLARATION, JSON.parse(await file.text()));
      touched.current = true; setDraft(settings); setImported(true); setResetScope(null);
      setFeedback('Import preview only. Review these preferences, then Save changes to apply.');
    } catch (err) { setFailure(err.message || 'The preferences file could not be read.'); }
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
      <p className="settings-notice" role="status">Showing Movie Night’s local settings. The shared OS settings catalogue is not connected in this build.</p>
      <div className="movie-settings-search"><Search size={18} /><input type="search" aria-label="Search Movie Night settings" placeholder="Search settings, plugins, playback…" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <div className="settings-transfer" aria-label="Preference file actions">
        <button type="button" className="shell-button" disabled={!store.ready || Boolean(busy) || !supportsTransfer(DECLARATION, 'export')} onClick={exportPreferences}>Export preferences</button>
        <button type="button" className="shell-button" disabled={!store.ready || Boolean(busy) || dirty || !supportsTransfer(DECLARATION, 'import')} onClick={() => importFile.current?.click()}>Import preferences</button>
        <input ref={importFile} type="file" accept="application/json,.json" hidden aria-label="Import preferences file" onChange={previewImport} />
        <span>Preferences only, never credentials or library files.</span>
      </div>
      <div className="movie-settings-body"><nav aria-label="Settings sections">{SECTIONS.map(item => { const Icon = item.icon; return <button key={item.id} type="button" aria-label={item.label} title={context === item.id ? "Settings for the current view" : undefined} aria-current={!query && section === item.id ? 'page' : undefined} onClick={() => { setSection(item.id); setQuery(''); setResetScope(null); }}><Icon size={18} /><span>{item.label}</span>{context === item.id && <i aria-hidden="true" />}</button>; })}</nav>
        <div className="movie-settings-content">
          {!store.ready && <p className="settings-notice" role="status">{store.error || 'Loading your preferences…'} {store.error && <button type="button" onClick={reload} disabled={Boolean(busy)}>{busy === 'reload' ? 'Loading…' : 'Try again'}</button>}</p>}
          {groups.map(group => <section className="settings-group" key={group.id} aria-labelledby={`settings-heading-${group.id}`}><h3 id={`settings-heading-${group.id}`}>{group.label}</h3><p className="settings-summary">{group.summary}</p>
            {fields.filter(field => field.section === group.id).map(field => <div className="settings-row" key={field.key}><div><label htmlFor={`setting-${field.section}-${field.key}`}>{field.label}</label><p>{field.hint}</p></div>{fieldEditor(field)}</div>)}
            {group.id === 'appearance' && <p className="settings-notice">{native && transparency?.available ? 'Native glass is available on this display.' : native ? 'Solid is active until native transparency is available on this display.' : 'Native glass is available in the Movie Night desktop app.'} Appearance changes are previewed until you save.</p>}
            {group.id === 'plugins' && <div className="settings-connections"><div className="settings-connections-heading"><h4>Connections on Aries</h4><button type="button" className="settings-refresh" onClick={checkConnections} disabled={checking}><RefreshCw size={15} />{checking ? 'Checking…' : 'Check connections'}</button></div>{connections?.error && <p className="settings-notice">{connections.error}</p>}{connections?.plugins?.map(plugin => <div className="settings-connection" key={plugin.id}><span className={`connection-indicator ${plugin.enabled && plugin.available ? 'ready' : ''}`} /><div><strong>{plugin.name}</strong><p>{plugin.message || plugin.status}</p></div><span className="connection-label">{!plugin.enabled ? 'Off' : plugin.id === 'torrentio' && plugin.configured ? 'Configured' : plugin.available ? 'Ready' : plugin.configured ? 'Configured' : 'Unavailable'}</span></div>)}<p className="settings-notice">Your existing Nuvio credentials are reused privately on Aries. These controls change Movie Night only. Source availability is checked when you choose a movie.</p></div>}
            {group.id === 'concierge' && <><p className="settings-notice" role="status">{!draft.plugins.ollama_enabled ? 'Enable Ollama concierge in Plugins & connections to choose a model.' : checking ? 'Checking which models are installed…' : !modelsChecked ? 'The installed model list is unavailable right now.' : !installedModels.length ? 'No installed models were found on Aries.' : !installedModels.includes(draft.concierge.model) ? 'Your saved model is not installed. Choose one of the installed models to use the concierge.' : 'Only models installed on Aries are offered.'} <button type="button" onClick={checkConnections} disabled={checking || Boolean(busy)}>Check models</button></p><p className="settings-notice">The concierge uses the current filtered selection supplied by the wall. Changing the model does not change that selection or start playback.</p></>}
          </section>)}
          {!query && store.ready && <section className="settings-reset" aria-label="Reset selected section">
            <h3>Reset {SECTIONS.find(item => item.id === section)?.label}</h3>
            <p>Only this section in Movie Night on this device changes. Other preferences, accounts, favorites, history and files remain untouched.</p>
            {dirty && <p>Save or cancel your edits before resetting a section.</p>}
            {!resetScope ? <button type="button" className="shell-button" disabled={Boolean(busy) || dirty || conflict} onClick={() => setResetScope(section)}>Review section reset</button> : <div role="group" aria-label="Confirm scoped reset">
              <ul>{FIELDS.filter(field => field.section === resetScope).map(field => <li key={field.key}>{field.label}: <strong>{String(baseline[field.section][field.key])}</strong> → <strong>{String(DEFAULT_SETTINGS[field.section][field.key])}</strong></li>)}</ul>
              <button type="button" className="shell-button" disabled={Boolean(busy)} onClick={() => setResetScope(null)}>Cancel reset</button>
              <button type="button" className="shell-primary" disabled={Boolean(busy)} onClick={resetPreferences}>Confirm section reset</button>
            </div>}
          </section>}
          {!groups.length && <p className="settings-empty">No matching settings. Try “volume,” “glass,” or a plugin name.</p>}
        </div>
      </div>
      <footer className="movie-settings-footer"><div aria-live="polite">{failure ? <p className="settings-error">{failure} {conflict && <>Reload replaces your unsaved changes. <button type="button" onClick={reload} disabled={Boolean(busy)}>Reload current settings</button></>}</p> : feedback ? <p className="settings-saved"><Check size={16} />{feedback}</p> : <p>{!store.ready ? 'Waiting for your saved preferences.' : dirty ? 'Unsaved changes' : 'Preferences apply to Movie Night on Aries.'}</p>}</div><button type="button" className="shell-button" onClick={close} disabled={Boolean(busy)}>{dirty ? 'Cancel' : 'Done'}</button><button type="submit" className="shell-primary" disabled={!store.ready || Boolean(busy) || !dirty || conflict}>{busy === 'save' ? 'Saving…' : busy === 'reload' ? 'Loading…' : 'Save changes'}</button></footer>
    </form>
  </dialog>;
}
