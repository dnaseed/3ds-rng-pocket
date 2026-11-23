import { Download, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { NumberStepper } from '../components/common/NumberStepper';
import {
  computeTsvTrv,
  exportProfilesJson,
  importProfilesJson,
  solveTidSidFromG7Tid,
  type TrainerProfile,
} from '../services/profileStorage';
import { DEFAULT_SEED_API_BASE } from '../services/sfmtSeedApi';
import { useApp } from '../store/AppContext';

export function ProfilesPage() {
  const {
    i18n,
    lang,
    setLang,
    clockStyle,
    setClockStyle,
    apiBaseUrl,
    setApiBaseUrl,
    profileStore,
    activeProfile,
    selectProfile,
    upsertProfile,
    deleteProfile,
    replaceProfileStore,
  } = useApp();

  const [editing, setEditing] = useState<TrainerProfile | null>(null);
  const [editingG7Tid, setEditingG7Tid] = useState(0);
  const [otherTsvText, setOtherTsvText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startEdit = (p: TrainerProfile) => {
    setEditing({ ...p });
    setEditingG7Tid(computeTsvTrv(p.tid, p.sid).g7tid);
    setOtherTsvText(p.otherTsvs.join(', '));
  };

  const startNew = () => {
    const fresh: TrainerProfile = {
      id: `prof-${Date.now()}`,
      name: `Trainer ${profileStore.profiles.length + 1}`,
      gameVersion: 'US',
      tid: 0,
      sid: 0,
      tsv: 0,
      trv: 0,
      shinyCharm: false,
      eggSeed: [0, 0, 0, 0],
      otherTsvs: [],
    };
    setEditing(fresh);
    setEditingG7Tid(0);
    setOtherTsvText('');
  };

  const saveEditing = () => {
    if (!editing) return;
    const otherTsvs = otherTsvText
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < 4096);
    upsertProfile({
      ...editing,
      name: editing.name.trim() || 'Trainer',
      otherTsvs,
    });
    setEditing(null);
  };

  const handleExport = () => {
    const json = exportProfilesJson(profileStore);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usum_rng_profiles.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    setImportSuccess(false);
    try {
      const text = await file.text();
      const imported = importProfilesJson(text);
      replaceProfileStore(imported);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 2000);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  return (
    <div className="tool-workspace profiles-workspace pb-4">
      <div className="profile-header">
        {/* Profile List Header */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-zinc-100">{i18n.t('profiles.title')}</h2>
          <button
            type="button"
            onClick={startNew}
            className="h-10 px-3 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            <span>{i18n.t('profiles.newProfile')}</span>
          </button>
        </div>
      </div>

      {/* Edit Modal / Card */}
      {editing && (
        <div className="profile-editor rounded-2xl bg-zinc-900 border border-amber-500/40 p-4 space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">
              {i18n.t('profiles.name')}
            </label>
            <input
              type="text"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-700 px-3 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'US', label: 'Ultra Sun' },
                { id: 'UM', label: 'Ultra Moon' },
                { id: 'S', label: 'Sun' },
                { id: 'M', label: 'Moon' },
              ] as const
            ).map((ver) => (
              <button
                key={ver.id}
                type="button"
                onClick={() => setEditing({ ...editing, gameVersion: ver.id })}
                className={`h-11 rounded-xl text-xs font-bold border transition ${
                  editing.gameVersion === ver.id
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                {ver.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NumberStepper
              label={i18n.t('profiles.tsv')}
              value={editing.tsv}
              min={0}
              max={4095}
              onChange={(tsv) => {
                const solved =
                  editingG7Tid > 0 || editing.tid > 0 || editing.sid > 0
                    ? solveTidSidFromG7Tid(editingG7Tid, tsv, editing.trv)
                    : null;
                setEditing({
                  ...editing,
                  tsv,
                  ...(solved ? { tid: solved.tid, sid: solved.sid } : {}),
                });
              }}
            />
            <NumberStepper
              label={i18n.t('profiles.trv')}
              value={editing.trv}
              min={0}
              max={15}
              onChange={(trv) => {
                const solved =
                  editingG7Tid > 0 || editing.tid > 0 || editing.sid > 0
                    ? solveTidSidFromG7Tid(editingG7Tid, editing.tsv, trv)
                    : null;
                setEditing({
                  ...editing,
                  trv,
                  ...(solved ? { tid: solved.tid, sid: solved.sid } : {}),
                });
              }}
            />
          </div>

          <NumberStepper
            label={i18n.t('profiles.g7tid')}
            value={editingG7Tid}
            min={0}
            max={999999}
            onChange={(g7tid) => {
              setEditingG7Tid(g7tid);
              const solved = solveTidSidFromG7Tid(g7tid, editing.tsv, editing.trv);
              if (solved) {
                setEditing({ ...editing, tid: solved.tid, sid: solved.sid });
              }
            }}
          />

          <div className="grid grid-cols-2 gap-2">
            <NumberStepper
              label={i18n.t('profiles.tid')}
              value={editing.tid}
              min={0}
              max={65535}
              onChange={(tid) => {
                const calc = computeTsvTrv(tid, editing.sid);
                setEditing({ ...editing, tid, tsv: calc.tsv, trv: calc.trv });
                setEditingG7Tid(calc.g7tid);
              }}
            />
            <NumberStepper
              label={i18n.t('profiles.sid')}
              value={editing.sid}
              min={0}
              max={65535}
              onChange={(sid) => {
                const calc = computeTsvTrv(editing.tid, sid);
                setEditing({ ...editing, sid, tsv: calc.tsv, trv: calc.trv });
                setEditingG7Tid(calc.g7tid);
              }}
            />
          </div>

          <label className="flex items-center justify-between min-h-11 px-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-sm text-zinc-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              {i18n.t('profiles.shinyCharm')}
            </span>
            <input
              type="checkbox"
              checked={editing.shinyCharm}
              onChange={(e) => setEditing({ ...editing, shinyCharm: e.target.checked })}
              className="w-5 h-5 accent-amber-500"
            />
          </label>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">
              {i18n.t('profiles.otherTsvs')}
            </label>
            <input
              type="text"
              value={otherTsvText}
              onChange={(e) => setOtherTsvText(e.target.value)}
              placeholder="1234, 0512"
              className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-700 px-3 font-mono text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="flex-1 h-11 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-200"
            >
              {i18n.t('app.cancel')}
            </button>
            <button
              type="button"
              onClick={saveEditing}
              className="flex-1 h-11 rounded-xl bg-amber-500 text-xs font-bold text-zinc-950"
            >
              {i18n.t('app.save')}
            </button>
          </div>
        </div>
      )}

      <div className="profile-list space-y-4">
        {/* Existing Profiles */}
        <div className="space-y-2">
          {profileStore.profiles.map((p) => {
            const isActive = p.id === activeProfile.id;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-3 flex items-center justify-between gap-2 transition ${
                  isActive
                    ? 'bg-zinc-900 border-amber-500/60'
                    : 'bg-zinc-900/60 border-zinc-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectProfile(p.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        p.gameVersion === 'US'
                          ? 'bg-orange-500/20 text-orange-300'
                          : p.gameVersion === 'UM'
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : p.gameVersion === 'S'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-sky-500/20 text-sky-300'
                      }`}
                    >
                      {p.gameVersion}
                    </span>
                    <span className="font-semibold text-sm text-zinc-100 truncate">{p.name}</span>
                    {p.shinyCharm && <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-zinc-400 mt-1">
                    TSV {String(p.tsv).padStart(4, '0')} · TRV {p.trv}
                    {(p.tid > 0 || p.sid > 0) &&
                      ` · G7TID ${String(computeTsvTrv(p.tid, p.sid).g7tid).padStart(6, '0')}`}
                  </div>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="h-9 px-3 rounded-xl bg-zinc-800 text-xs font-medium text-zinc-200"
                  >
                    {i18n.t('app.edit')}
                  </button>
                  {profileStore.profiles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (editing?.id === p.id) setEditing(null);
                        deleteProfile(p.id);
                      }}
                      className="h-9 w-9 flex items-center justify-center rounded-xl bg-zinc-800 text-rose-400"
                      aria-label={i18n.t('app.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Export / Import JSON */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="h-11 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <Download className="w-4 h-4" />
            <span>{i18n.t('profiles.exportJson')}</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-11 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <Upload className="w-4 h-4" />
            <span>{i18n.t('profiles.importJson')}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              void handleImportFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {importError && <p className="text-xs text-rose-400">{importError}</p>}
        {importSuccess && <p className="text-xs text-emerald-400">{i18n.t('profiles.imported')}</p>}
      </div>

      {/* App Settings */}
      <div className="profile-settings rounded-2xl bg-zinc-900/80 border border-zinc-800 p-3.5 space-y-3">
        <h3 className="text-sm font-bold text-zinc-200">{i18n.t('profiles.settings')}</h3>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-400">{i18n.t('profiles.language')}</span>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
            {(['it', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className="choice-button h-8 px-3 rounded-lg text-xs font-bold uppercase"
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-400">{i18n.t('profiles.clockStyle')}</span>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
            {(
              [
                { id: 'svg', label: i18n.t('seed.useSvg') },
                { id: 'sprite', label: i18n.t('seed.useSprite') },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setClockStyle(opt.id)}
                aria-pressed={clockStyle === opt.id}
                className="choice-button h-8 px-2.5 rounded-lg text-xs font-semibold"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">{i18n.t('profiles.apiEndpoint')}</label>
          <input
            type="url"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder={DEFAULT_SEED_API_BASE}
            className="w-full h-10 rounded-xl bg-zinc-950 border border-zinc-800 px-3 font-mono text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>
    </div>
  );
}
