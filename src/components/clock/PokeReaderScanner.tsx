import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { parseEggSeedStr } from '../../engine/math/uint';
import { MAX_FRAME } from '../../engine/core/pokemonMath';
import type { OverlayFields } from '../../services/overlayParser';
import type { ScanPhotoResult, VerifyLevel } from '../../services/overlayOcr';
import { useDialogFocus } from '../common/useDialogFocus';

const labels: Record<keyof OverlayFields, string> = {
  seed: 'Initial Seed',
  frame: 'Advances / Frame',
  egg3: 'Egg Seed [3]',
  egg2: 'Egg Seed [2]',
  egg1: 'Egg Seed [1]',
  egg0: 'Egg Seed [0]',
};

const btn = 'rounded-lg border border-zinc-600 px-3 py-2 disabled:opacity-40';
const HEX_CONFUSION: Record<string, string> = { '8': 'B', B: '8', '0': 'D', D: '0' };

export default function PokeReaderScanner({ close }: { close: () => void }) {
  const {
    lang,
    activeProfile,
    setInitialSeedHex,
    setStartFrame,
    updateActiveEggSeed,
  } = useApp();
  const it = lang === 'it';
  const dialog = useDialogFocus(true);

  const [fields, setFields] = useState<OverlayFields>({});
  const [crops, setCrops] = useState<ScanPhotoResult['crops']>({});
  const [uncertain, setUncertain] = useState<ScanPhotoResult['uncertain']>({});
  const [verifyLevel, setVerifyLevel] = useState<VerifyLevel>('none');
  const [matchedNibbles, setMatchedNibbles] = useState(0);
  const [raw, setRaw] = useState('');
  const [photo, setPhoto] = useState('');
  const [status, setStatus] = useState('loading');
  const [progress, setProgress] = useState(0);

  const alive = useRef(false);
  const busy = useRef(false);
  const activeWorker = useRef<{ terminate: () => Promise<unknown> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    import('../../services/overlayOcr')
      .then((m) => m.ensureOcrCached())
      .then(
        () => {
          if (!cancelled && !busy.current) setStatus('ready');
        },
        () => {
          if (!cancelled) setStatus('unavailable');
        },
      );
    return () => {
      cancelled = true;
      alive.current = false;
      const w = activeWorker.current;
      activeWorker.current = null;
      if (w) void w.terminate().catch(() => {});
    };
  }, []);

  async function read(file: File) {
    if (busy.current) return;
    busy.current = true;
    const url = URL.createObjectURL(file);
    setPhoto('');
    setFields({});
    setCrops({});
    setUncertain({});
    setVerifyLevel('none');
    setMatchedNibbles(0);
    setRaw('');
    let loaded = false;
    let worker: { terminate: () => Promise<unknown> } | null = null;
    try {
      setStatus('reading');
      setProgress(0);
      const mod = await import('../../services/overlayOcr');
      const ocrWorker = await mod.loadOcr((v) => {
        if (alive.current) setProgress(v);
      });
      worker = ocrWorker;
      activeWorker.current = ocrWorker;
      if (!alive.current) return;
      loaded = true;
      const result = await mod.scanPhoto(ocrWorker, url);
      if (alive.current) {
        setRaw(result.raw);
        setFields(result.fields);
        setCrops(result.crops);
        setUncertain(result.uncertain);
        setVerifyLevel(result.verifyLevel);
        setMatchedNibbles(result.matchedNibbles);
        setPhoto(result.previewUrl);
        setStatus(Object.keys(result.fields).length ? 'done' : 'empty');
      }
    } catch {
      if (alive.current) setStatus(loaded ? 'failed' : 'unavailable');
    } finally {
      URL.revokeObjectURL(url);
      if (activeWorker.current === worker) activeWorker.current = null;
      if (worker) void worker.terminate().catch(() => {});
      busy.current = false;
    }
  }

  const words = [fields.egg3, fields.egg2, fields.egg1, fields.egg0];
  const egg = words.every((w) => w && /^[0-9a-f]{8}$/i.test(w))
    ? parseEggSeedStr(words.join(','))
    : null;

  const [openedProfile] = useState(() => ({
    id: activeProfile.id,
    game: activeProfile.gameVersion,
  }));
  const sameProfile =
    openedProfile.id === activeProfile.id &&
    openedProfile.game === activeProfile.gameVersion;

  const seedValid = fields.seed !== undefined && /^[0-9A-F]{8}$/.test(fields.seed);
  const frameValid =
    fields.frame !== undefined && /^\d+$/.test(fields.frame) && Number(fields.frame) <= MAX_FRAME;

  const apply = (fn: () => void, shouldClose = true) => {
    if (!sameProfile) return;
    fn();
    if (shouldClose) close();
    else setStatus('applied');
  };

  const messages: Record<string, string> = {
    loading: it ? 'Preparazione OCR…' : 'Preparing OCR…',
    reading: (it ? 'Lettura in corso… ' : 'Reading… ') + progress + '%',
    empty: it
      ? 'Nessun campo rilevato — avvicinati allo schermo o riprova su uno sfondo più scuro'
      : 'No fields detected — move closer or try a darker background.',
    unavailable: it
      ? 'OCR indisponibile. Per il primo download riapri lo scanner online.'
      : 'OCR unavailable. Reopen online for the first download.',
    failed: it ? 'Foto illeggibile. Riprova.' : 'Unable to read photo. Try again.',
    applied: it ? 'Applicato' : 'Applied',
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/90 p-3"
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="OCR"
        tabIndex={-1}
        className="mx-auto max-w-xl space-y-3 rounded-xl bg-zinc-950 p-3"
      >
        <h2>OCR · {activeProfile.name}</h2>
        <div className="flex gap-2">
          {[true, false].map((camera) => (
            <label
              key={String(camera)}
              className={
                btn +
                ' cursor-pointer focus-within:ring-2 ' +
                (camera ? 'bg-amber-300 text-black' : '')
              }
              onClick={() => {
                if (!busy.current) setPhoto('');
              }}
            >
              {camera ? 'Camera' : it ? 'Apri foto' : 'Open photo'}
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                capture={camera ? 'environment' : undefined}
                disabled={status === 'reading' || status === 'unavailable'}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void read(f);
                  e.target.value = '';
                }}
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-zinc-400">
          {it
            ? 'Inquadra lo schermo frontalmente (evita riflessi forti).'
            : 'Frame the screen straight-on (avoid strong glare).'}
        </p>
        <p role="status">{messages[status] ?? ''}</p>
        {!sameProfile && (
          <p role="alert">
            {it
              ? 'Profilo cambiato. Riapri lo scanner.'
              : 'Profile changed. Reopen the scanner.'}
          </p>
        )}

        {Object.entries(labels).map(([k, label]) => {
          const key = k as keyof OverlayFields;
          if (
            fields[key] === undefined &&
            !(key.startsWith('egg') && words.some((v) => v !== undefined))
          ) {
            return null;
          }
          const isHex = key === 'seed' || key.startsWith('egg');
          const val = fields[key] ?? '';
          const eggKey = key.startsWith('egg') ? (key as 'egg3' | 'egg2' | 'egg1' | 'egg0') : null;
          const eggUncertain = eggKey ? (uncertain[eggKey] ?? []) : [];
          const quickSwaps =
            key.startsWith('egg') || (key === 'seed' && verifyLevel !== 'exact')
              ? [...val]
                  .map((ch, pos) => ({ ch, pos, alt: HEX_CONFUSION[ch] }))
                  .filter((item): item is { ch: string; pos: number; alt: string } => !!item.alt)
              : [];
          return (
            <div key={key} className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-300">{label}</span>
                {key === 'seed' &&
                  (verifyLevel === 'exact' ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/40">
                      {it ? 'Verificato SFMT ✓' : 'SFMT Verified ✓'}
                    </span>
                  ) : verifyLevel === 'probable' ? (
                    <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300 border border-sky-500/40">
                      {it
                        ? `Probabile SFMT (${matchedNibbles}/16)`
                        : `SFMT Probable (${matchedNibbles}/16)`}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 border border-amber-500/40">
                      {it ? 'Non verificato — controlla il ritaglio' : 'Unverified — check crop'}
                    </span>
                  ))}
                {eggKey && eggUncertain.length > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 border border-amber-500/40">
                    {it
                      ? `Controlla #${eggUncertain.map((n) => n + 1).join(', #')}`
                      : `Check #${eggUncertain.map((n) => n + 1).join(', #')}`}
                  </span>
                )}
              </div>
              {crops[key] && (
                <img
                  src={crops[key]}
                  alt={label}
                  className="max-h-12 w-auto rounded border border-zinc-700"
                  style={{ imageRendering: 'pixelated' }}
                />
              )}
              <label className="flex items-center justify-between gap-2">
                <span className="sr-only">{label}</span>
                <input
                  className="w-full rounded bg-zinc-800 p-2 font-mono tracking-wider"
                  maxLength={isHex ? 8 : 10}
                  value={val}
                  onChange={(e) => {
                    if (key === 'seed' || key === 'frame') {
                      setVerifyLevel('none');
                      setMatchedNibbles(0);
                    }
                    if (eggKey) {
                      setUncertain((prev) => ({ ...prev, [eggKey]: [] }));
                    }
                    setFields({ ...fields, [key]: e.target.value.toUpperCase() });
                  }}
                />
              </label>
              {quickSwaps.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {quickSwaps.map(({ ch, pos, alt }) => (
                    <button
                      key={pos}
                      type="button"
                      className={
                        'rounded border px-2 py-1 font-mono text-xs active:scale-95 ' +
                        (eggUncertain.includes(pos)
                          ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                          : 'border-zinc-700 bg-zinc-900 text-zinc-200')
                      }
                      onClick={() => {
                        if (key === 'seed') {
                          setVerifyLevel('none');
                          setMatchedNibbles(0);
                        }
                        if (eggKey) {
                          setUncertain((prev) => ({
                            ...prev,
                            [eggKey]: (prev[eggKey] ?? []).filter((idx) => idx !== pos),
                          }));
                        }
                        setFields({
                          ...fields,
                          [key]: val.slice(0, pos) + alt + val.slice(pos + 1),
                        });
                      }}
                    >
                      #{pos + 1} · {ch}→{alt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex flex-wrap gap-2">
          {fields.seed !== undefined && fields.frame !== undefined && (
            <button
              type="button"
              className={
                btn +
                (verifyLevel === 'exact'
                  ? ' bg-emerald-500 font-bold text-zinc-950 border-emerald-400'
                  : ' border-amber-500/60 bg-amber-500/15 font-semibold text-amber-200')
              }
              disabled={!sameProfile || !seedValid || !frameValid}
              onClick={() =>
                apply(() => {
                  setInitialSeedHex(fields.seed!);
                  setStartFrame(Number(fields.frame));
                })
              }
            >
              {it ? 'Applica Seed + Frame' : 'Apply Seed + Frame'}
            </button>
          )}
          {fields.seed !== undefined && (
            <button
              type="button"
              className={
                btn +
                (fields.frame !== undefined
                  ? ''
                  : verifyLevel === 'exact'
                    ? ' bg-emerald-500 font-bold text-zinc-950 border-emerald-400'
                    : ' border-amber-500/60 bg-amber-500/15 font-semibold text-amber-200')
              }
              disabled={!sameProfile || !seedValid}
              onClick={() => apply(() => setInitialSeedHex(fields.seed!))}
            >
              {it ? 'Applica' : 'Apply'} Initial Seed
            </button>
          )}
          {fields.frame !== undefined && (
            <button
              type="button"
              className={btn}
              disabled={!sameProfile || !frameValid}
              onClick={() => apply(() => setStartFrame(Number(fields.frame)))}
            >
              {it ? 'Applica' : 'Apply'} Frame
            </button>
          )}
          {words.some((w) => w !== undefined) && (
            <button
              type="button"
              className={
                btn +
                (Object.values(uncertain).some((arr) => (arr?.length ?? 0) > 0)
                  ? ' border-amber-500/60 bg-amber-500/15 font-semibold text-amber-200'
                  : ' bg-emerald-500 font-bold text-zinc-950 border-emerald-400')
              }
              disabled={!sameProfile || !egg}
              onClick={() => apply(() => updateActiveEggSeed(egg!))}
            >
              {it ? 'Applica' : 'Apply'} Egg Seed
            </button>
          )}
        </div>

        {photo && (
          <details open={Object.keys(fields).length > 0 && !crops.seed && !crops.egg3}>
            <summary className="cursor-pointer text-xs text-zinc-400">
              {it ? 'Foto originale' : 'Original photo'}
            </summary>
            <img
              className="mt-2 max-h-[35vh] max-w-full object-contain"
              src={photo}
              alt="Overlay"
            />
          </details>
        )}
        {(raw || status === 'empty') && (
          <details>
            <summary className="cursor-pointer text-xs text-zinc-400">
              {it ? 'Testo OCR' : 'OCR text'}
            </summary>
            <pre className="mt-1 whitespace-pre-wrap text-xs text-zinc-400">{raw}</pre>
          </details>
        )}
        <button className={btn} type="button" onClick={close}>
          {it ? 'Chiudi' : 'Close'}
        </button>
      </div>
    </div>
  );
}
