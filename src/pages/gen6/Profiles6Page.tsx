import { useRef, useState } from 'react';
import { Download, Plus, Upload } from 'lucide-react';
import { isGen6GameVersion } from '../../engine/core/types';
import { exportProfiles6Json, importProfiles6Json, type ProfileStore6, type TrainerProfile6 } from '../../services/gen6Storage';
import { computeTsvTrv } from '../../services/profileStorage';
import { useApp } from '../../store/AppContext';
import { buttonClass, cardClass, fieldClass, labelClass, NumberField, primaryClass } from './fields';

export function Profiles6Page({ store, updateStore }: {
  store: ProfileStore6;
  updateStore: (store: ProfileStore6) => void;
}) {
  const { i18n } = useApp();
  const [editing, setEditing] = useState<TrainerProfile6 | null>(null);
  const [notice, setNotice] = useState('');
  const [importError, setImportError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { t } = i18n;

  function exportFile() {
    const url = URL.createObjectURL(new Blob([exportProfiles6Json(store)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gen6_rng_profiles.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function importFile(file: File) {
    setNotice('');
    setImportError(false);
    try {
      updateStore(importProfiles6Json(await file.text()));
      setEditing(null);
      setNotice(t('gen6.profileImported'));
    } catch {
      setImportError(true);
    }
  }

  return <div className="tool-workspace profiles-workspace">
    <div className="profile-header flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-base font-bold">{t('profiles.title')}</h1>
      <button type="button" className={primaryClass} onClick={() => setEditing({
        id: crypto.randomUUID(), name: '', gameVersion: 'X', tid: 0, sid: 0, shinyCharm: false,
      })}>
        <Plus size={16} aria-hidden="true" />{t('profiles.newProfile')}
      </button>
    </div>
    {editing && <form className={`profile-editor ${cardClass}`} onSubmit={event => {
      event.preventDefault();
      const name = editing.name.trim();
      if (!name) return;
      const profiles = [...store.profiles];
      const index = profiles.findIndex(profile => profile.id === editing.id);
      if (index === -1) profiles.push({ ...editing, name });
      else profiles[index] = { ...editing, name };
      updateStore({ ...store, profiles, activeProfileId: editing.id });
      setEditing(null);
      setNotice(t('gen6.profileSaved'));
    }}>
      <label className={labelClass}><span>{t('profiles.name')}</span>
        <input className={fieldClass} maxLength={64} required value={editing.name}
          onChange={event => setEditing({ ...editing, name: event.target.value })} />
      </label>
      <label className={labelClass}><span>{t('profiles.version')}</span>
        <select aria-label={t('profiles.version')} className={fieldClass} value={editing.gameVersion} onChange={event => {
          if (isGen6GameVersion(event.target.value)) setEditing({ ...editing, gameVersion: event.target.value });
        }}>
          {(['X', 'Y', 'OR', 'AS'] as const).map(game => <option key={game} value={game}>{t(`gen6.gameNames.${game}`)}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label={t('profiles.tid')} value={editing.tid} max={65535} onChange={tid => setEditing({ ...editing, tid })} />
        <NumberField label={t('profiles.sid')} value={editing.sid} max={65535} onChange={sid => setEditing({ ...editing, sid })} />
      </div>
      <label className="flex min-h-9 items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-amber-400" checked={editing.shinyCharm}
          onChange={event => setEditing({ ...editing, shinyCharm: event.target.checked })} />
        {t('profiles.shinyCharm')}
      </label>
      <p className="text-xs text-zinc-400">TSV <output className="ml-1 font-mono text-amber-300">
        {computeTsvTrv(editing.tid, editing.sid).tsv}</output></p>
      <div className="flex gap-2">
        <button type="submit" className={primaryClass} disabled={!editing.name.trim()}>{t('app.save')}</button>
        <button type="button" className={buttonClass} onClick={() => setEditing(null)}>{t('app.cancel')}</button>
      </div>
    </form>}
    <ul className="profile-list space-y-2">
      {store.profiles.map(profile => <li key={profile.id} className="flex gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2">
        <button type="button" aria-pressed={profile.id === store.activeProfileId}
          onClick={() => updateStore({ ...store, activeProfileId: profile.id })}
          className="min-w-0 flex-1 rounded-xl px-2 py-1 text-left hover:bg-zinc-800 aria-pressed:bg-amber-500/10">
          <span className="block truncate text-sm font-semibold">{profile.name}</span>
          <span className="block truncate text-xs text-zinc-400">{t(`gen6.gameNames.${profile.gameVersion}`)} · TSV {computeTsvTrv(profile.tid, profile.sid).tsv}</span>
        </button>
        <button type="button" className={buttonClass} aria-label={`${t('app.edit')} ${profile.name}`}
          onClick={() => setEditing({ ...profile })}>{t('app.edit')}</button>
      </li>)}
    </ul>
    <div className={`profile-settings ${cardClass}`}>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={exportFile}><Download size={15} aria-hidden="true" />{t('profiles.exportJson')}</button>
        <button type="button" className={buttonClass} onClick={() => fileInput.current?.click()}><Upload size={15} aria-hidden="true" />{t('profiles.importJson')}</button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void importFile(file);
        }} />
      </div>
      {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
      {importError && <p role="alert" className="text-sm text-rose-300">{t('gen6.profileImportError')}</p>}
    </div>
  </div>;
}
