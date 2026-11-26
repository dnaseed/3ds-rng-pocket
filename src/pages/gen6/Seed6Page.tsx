import { useState } from 'react';
import { HexSeedInput } from '../../components/common/HexSeedInput';
import { NumberStepper } from '../../components/common/NumberStepper';
import { ArrowRight, ScanText, Timer } from 'lucide-react';
import { parseHex32, toHex32 } from '../../engine/math/uint';
import type { Session6 } from '../../services/gen6Storage';
import { useApp } from '../../store/AppContext';
import { buttonClass, cardClass, primaryClass } from './fields';

export function Seed6Page({ session, updateSession, onStationary, onOpenScan }: {
  session: Session6;
  updateSession: (next: Partial<Session6>) => void;
  onStationary: () => void;
  onOpenScan?: () => void;
}) {
  const { i18n, lang } = useApp();
  const it = lang === 'it';
  const [edit, setEdit] = useState({ applied: session.initialSeedHex, value: session.initialSeedHex });
  const draft = edit.applied === session.initialSeedHex ? edit.value : session.initialSeedHex;
  const setDraft = (value: string) => setEdit({ applied: session.initialSeedHex, value });
  const [status, setStatus] = useState('');
  const seed = parseHex32(draft);
  const seconds = ((session.targetFrame - session.startFrame) / 60).toLocaleString(lang, { maximumFractionDigits: 3 });

  return <div className="tool-workspace">
    <section className={cardClass}>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-bold">{i18n.t('nav.seed')}</h1>
        {onOpenScan && (
          <button
            type="button"
            onClick={onOpenScan}
            aria-label={it ? 'Scansiona overlay' : 'Scan overlay'}
            className="min-h-11 px-2.5 -my-1.5 shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 border border-amber-500/35 text-xs font-semibold text-amber-200 hover:border-amber-400/60 active:scale-95 transition"
          >
            <ScanText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden min-[400px]:inline">
              {it ? 'Scansiona overlay' : 'Scan overlay'}
            </span>
            <span className="min-[400px]:hidden">Overlay</span>
          </button>
        )}
      </div>
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault();
        if (seed === null) return;
        const canonical = toHex32(seed);
        updateSession({ initialSeedHex: canonical });
        setDraft(canonical);
        setStatus(i18n.t('gen6.seedApplied'));
      }}>
        <HexSeedInput label={i18n.t('gen6.mtSeed')} value={draft}
          onDraftChange={value => { setDraft(value); setStatus(''); }} />
        <div className="flex flex-wrap gap-2">
          <button className={primaryClass} type="submit" disabled={seed === null}>{i18n.t('app.apply')}</button>
          <button className={buttonClass} type="button" onClick={onStationary}>
            {i18n.t('gen6.openStationary')} <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
        <p id="gen6-seed-status" role="status" className="text-xs text-zinc-400">
          {seed === null && draft !== '' ? i18n.t('gen6.seedInvalid') : status}
        </p>
      </form>
    </section>
    <section className={cardClass}>
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Timer size={16} className="text-amber-400" aria-hidden="true" />{i18n.t('gen6.frameTime')}</h2>
      <div className="grid grid-cols-2 gap-2">
        <NumberStepper label={i18n.t('search.startingFrame')} value={session.startFrame} onChange={startFrame => updateSession({ startFrame })} />
        <NumberStepper label={i18n.t('search.targetFrame')} value={session.targetFrame} onChange={targetFrame => updateSession({ targetFrame })} />
      </div>
      <p aria-live="polite" className="font-mono text-lg text-amber-300">{seconds} s</p>
      <p className="text-xs text-zinc-400">{i18n.t('gen6.frameTimeHelp')}</p>
    </section>
  </div>;
}
