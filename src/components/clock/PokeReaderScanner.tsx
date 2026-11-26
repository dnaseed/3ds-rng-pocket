import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ImagePlus,
  Loader2,
  ScanText,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { parseEggSeedStr } from '../../engine/math/uint';
import { MAX_FRAME } from '../../engine/core/pokemonMath';
import type { OverlayFields } from '../../services/overlayParser';
import type { ScanPhotoResult, VerifyLevel } from '../../services/overlayOcr';
import { ScannerModalShell } from '../common/ScannerModalShell';

const labels: Record<keyof OverlayFields, string> = {
  seed: 'Initial Seed',
  frame: 'Advances / Frame',
  egg3: 'Egg Seed [3]',
  egg2: 'Egg Seed [2]',
  egg1: 'Egg Seed [1]',
  egg0: 'Egg Seed [0]',
};

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
  const hasEggFields = words.some((w) => w !== undefined);
  const hasEggUncertain = Object.values(uncertain).some((arr) => (arr?.length ?? 0) > 0);

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
  const hasSeedAndFrame = fields.seed !== undefined && fields.frame !== undefined;
  const pairVerified = hasSeedAndFrame && verifyLevel === 'exact';

  const apply = (fn: () => void, shouldClose = true) => {
    if (!sameProfile) return;
    fn();
    if (shouldClose) close();
    else setStatus('applied');
  };

  const messages: Record<string, string> = {
    loading: it ? 'Preparazione OCR…' : 'Preparing OCR…',
    reading: `${it ? 'Lettura in corso…' : 'Reading…'} ${progress}%`,
    empty: it
      ? 'Nessun campo rilevato — avvicinati allo schermo o riprova su uno sfondo più scuro'
      : 'No fields detected — move closer or try a darker background.',
    unavailable: it
      ? 'OCR indisponibile. Per il primo download riapri lo scanner online.'
      : 'OCR unavailable. Reopen online for the first download.',
    failed: it ? 'Foto illeggibile. Riprova.' : 'Unable to read photo. Try again.',
    applied: it ? 'Applicato' : 'Applied',
  };

  const captureDisabled = status === 'reading' || status === 'unavailable';
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <ScannerModalShell
      icon={<ScanText className="w-4 h-4 text-amber-400" aria-hidden="true" />}
      title={it ? 'Scansiona overlay' : 'Scan overlay'}
      subtitle={activeProfile.name}
      closeLabel={it ? 'Chiudi' : 'Close'}
      onClose={close}
    >
      {/* 50/50 Camera / Open photo acquisition bar */}
      <div className="flex gap-2">
        {[true, false].map((camera) => (
          <label
            key={String(camera)}
            className={`min-h-11 flex-1 rounded-xl px-3 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer focus-within:ring-2 focus-within:ring-amber-400/60 active:scale-95 transition ${
              camera
                ? 'bg-amber-400 text-zinc-950 font-bold'
                : 'border border-zinc-700 bg-zinc-900 text-zinc-100 font-semibold'
            } ${captureDisabled ? 'opacity-40 pointer-events-none' : ''}`}
            onClick={() => {
              if (!busy.current) setPhoto('');
            }}
          >
            {camera ? (
              <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <ImagePlus className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{camera ? 'Camera' : it ? 'Apri foto' : 'Open photo'}</span>
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              capture={camera ? 'environment' : undefined}
              disabled={captureDisabled}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void read(f);
                e.target.value = '';
              }}
            />
          </label>
        ))}
      </div>

      <p className="text-[11px] text-zinc-400">
        {it
          ? 'Inquadra lo schermo frontalmente (evita riflessi forti).'
          : 'Frame the screen straight-on (avoid strong glare).'}
      </p>

      {/* Honest OCR status / progress indicator */}
      {(messages[status] || status === 'loading' || status === 'reading') && (
        <div
          role="status"
          className={`rounded-xl border px-3 py-2 text-xs space-y-1.5 ${
            status === 'unavailable' || status === 'failed'
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
              : status === 'empty'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                : 'border-zinc-800 bg-zinc-900/70 text-zinc-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {(status === 'loading' || status === 'reading') && (
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-amber-400" aria-hidden="true" />
            )}
            <span>{messages[status] ?? ''}</span>
          </div>

          {status === 'loading' && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800" aria-hidden="true">
              <div className="h-full w-1/2 rounded-full bg-amber-400/70 animate-pulse" />
            </div>
          )}

          {status === 'reading' && (
            <div
              role="progressbar"
              aria-valuenow={clampedProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
            >
              <div
                className="h-full rounded-full bg-amber-400 transition-[width] duration-150"
                style={{ width: `${clampedProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {!sameProfile && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-200"
        >
          {it ? 'Profilo cambiato. Riapri lo scanner.' : 'Profile changed. Reopen the scanner.'}
        </p>
      )}

      {/* Detected fields */}
      {Object.entries(labels).map(([k, label]) => {
        const key = k as keyof OverlayFields;
        if (fields[key] === undefined && !(key.startsWith('egg') && hasEggFields)) {
          return null;
        }
        const isHex = key === 'seed' || key.startsWith('egg');
        const val = fields[key] ?? '';
        const eggKey = key.startsWith('egg') ? (key as 'egg3' | 'egg2' | 'egg1' | 'egg0') : null;
        const eggUncertain = eggKey ? (uncertain[eggKey] ?? []) : [];
        const quickSwaps =
          key.startsWith('egg') || (key === 'seed' && !pairVerified)
            ? [...val]
                .map((ch, pos) => ({ ch, pos, alt: HEX_CONFUSION[ch] }))
                .filter((item): item is { ch: string; pos: number; alt: string } => !!item.alt)
            : [];

        return (
          <div
            key={key}
            className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold text-zinc-300">{label}</span>

              {key === 'seed' &&
                (pairVerified ? (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/40">
                    {it ? 'Verificato SFMT ✓' : 'SFMT Verified ✓'}
                  </span>
                ) : hasSeedAndFrame && verifyLevel === 'probable' ? (
                  <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300 border border-sky-500/40">
                    {it
                      ? `Probabile SFMT (${matchedNibbles}/16)`
                      : `SFMT Probable (${matchedNibbles}/16)`}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 border border-amber-500/40">
                    {it ? 'Non verificato — controlla il ritaglio' : 'Unverified — check crop'}
                  </span>
                ))}

              {eggKey && eggUncertain.length > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 border border-amber-500/40">
                  {it
                    ? `Controlla #${eggUncertain.map((n) => n + 1).join(', #')}`
                    : `Check #${eggUncertain.map((n) => n + 1).join(', #')}`}
                </span>
              )}
            </div>

            {crops[key] && (
              <div className="inline-block rounded-lg border border-zinc-800 bg-zinc-950 p-1.5">
                <img
                  src={crops[key]}
                  alt={label}
                  className="max-h-12 w-auto rounded"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            )}

            <label className="block">
              <span className="sr-only">{label}</span>
              <input
                className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 font-mono text-base tracking-widest tabular-nums text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
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
              <div className="flex flex-wrap gap-0.5 -mx-1">
                {quickSwaps.map(({ ch, pos, alt }) => (
                  <button
                    key={pos}
                    type="button"
                    aria-label={`${label} #${pos + 1}: ${ch} → ${alt}`}
                    className="min-h-11 min-w-11 px-1 py-1.5 inline-flex items-center justify-center active:scale-95 transition"
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
                    <span
                      className={`rounded-lg border px-2 py-1 font-mono text-xs ${
                        eggUncertain.includes(pos)
                          ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-200'
                      }`}
                    >
                      #{pos + 1} · {ch}→{alt}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Explicit Apply Actions */}
      {(fields.seed !== undefined || fields.frame !== undefined || hasEggFields) && (
        <div className="space-y-2">
          {hasSeedAndFrame && (
            <button
              type="button"
              disabled={!sameProfile || !seedValid || !frameValid}
              onClick={() =>
                apply(() => {
                  setInitialSeedHex(fields.seed!);
                  setStartFrame(Number(fields.frame));
                })
              }
              className={`min-h-11 w-full rounded-xl px-3 text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition ${
                pairVerified
                  ? 'bg-emerald-500 font-bold text-zinc-950'
                  : 'border border-amber-500/60 bg-amber-500/15 font-semibold text-amber-200'
              }`}
            >
              {pairVerified ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>{it ? 'Applica Seed + Frame' : 'Apply Seed + Frame'}</span>
            </button>
          )}

          {(fields.seed !== undefined || fields.frame !== undefined) && (
            <div className={hasSeedAndFrame ? 'grid grid-cols-2 gap-2' : ''}>
              {fields.seed !== undefined && (
                <button
                  type="button"
                  disabled={!sameProfile || !seedValid}
                  onClick={() => apply(() => setInitialSeedHex(fields.seed!))}
                  className={`min-h-11 w-full rounded-xl px-3 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95 transition ${
                    hasSeedAndFrame
                      ? 'border border-zinc-700 bg-zinc-900 text-zinc-200'
                      : 'border border-amber-500/60 bg-amber-500/15 text-amber-200'
                  }`}
                >
                  {!hasSeedAndFrame && (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{it ? 'Applica Initial Seed' : 'Apply Initial Seed'}</span>
                </button>
              )}

              {fields.frame !== undefined && (
                <button
                  type="button"
                  disabled={!sameProfile || !frameValid}
                  onClick={() => apply(() => setStartFrame(Number(fields.frame)))}
                  className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-semibold text-zinc-200 flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
                >
                  {it ? 'Applica Frame' : 'Apply Frame'}
                </button>
              )}
            </div>
          )}

          {hasEggFields && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-zinc-400">
                {it
                  ? 'Verifica visivamente i ritagli prima di applicare.'
                  : 'Visually check crops before applying.'}
              </p>
              <button
                type="button"
                disabled={!sameProfile || !egg}
                onClick={() => apply(() => updateActiveEggSeed(egg!))}
                className={`min-h-11 w-full rounded-xl px-3 text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition ${
                  hasEggUncertain
                    ? 'border border-amber-500/60 bg-amber-500/15 font-semibold text-amber-200'
                    : 'bg-sky-400 font-bold text-zinc-950'
                }`}
              >
                {hasEggUncertain ? (
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                )}
                <span>{it ? 'Applica Egg Seed' : 'Apply Egg Seed'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {photo && (
        <details open={Object.keys(fields).length > 0 && !crops.seed && !crops.egg3}>
          <summary className="cursor-pointer text-xs text-zinc-400 py-1">
            {it ? 'Foto originale' : 'Original photo'}
          </summary>
          <img
            className="mt-2 max-h-[35vh] max-w-full rounded-xl border border-zinc-800 object-contain"
            src={photo}
            alt="Overlay"
          />
        </details>
      )}

      {(raw || status === 'empty') && (
        <details>
          <summary className="cursor-pointer text-xs text-zinc-400 py-1">
            {it ? 'Testo OCR' : 'OCR text'}
          </summary>
          <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-900/60 p-2 text-xs text-zinc-400">
            {raw}
          </pre>
        </details>
      )}
    </ScannerModalShell>
  );
}
