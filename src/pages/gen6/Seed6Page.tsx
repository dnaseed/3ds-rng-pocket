import { useState } from 'react';
import { ArrowRight, Timer } from 'lucide-react';
import { parseHex32, toHex32 } from '../../engine/math/uint';
import type { Session6 } from '../../services/gen6Storage';
import { useApp } from '../../store/AppContext';
import { buttonClass, cardClass, fieldClass, labelClass, NumberField, primaryClass } from './fields';

export function Seed6Page({ session, updateSession, onStationary }: {
  session: Session6;
  updateSession: (next: Partial<Session6>) => void;
  onStationary: () => void;
}) {
  const { i18n, lang } = useApp();
  const [draft, setDraft] = useState(session.initialSeedHex);
  const [status, setStatus] = useState('');
  const seed = parseHex32(draft);
  const seconds = ((session.targetFrame - session.startFrame) / 60).toLocaleString(lang, { maximumFractionDigits: 3 });

  return <div className="tool-workspace">
    <section className={cardClass}>
      <h1 className="text-base font-bold">{i18n.t('nav.seed')}</h1>
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault();
        if (seed === null) return;
        const canonical = toHex32(seed);
        updateSession({ initialSeedHex: canonical });
        setDraft(canonical);
        setStatus(i18n.t('gen6.seedApplied'));
      }}>
        <label className={labelClass}>
          <span>{i18n.t('gen6.mtSeed')}</span>
          <input className={`${fieldClass} font-mono tracking-widest text-amber-300`}
            autoCapitalize="characters" spellCheck={false} autoComplete="off" maxLength={10}
            value={draft} aria-describedby="gen6-seed-status"
            onChange={event => { setDraft(event.target.value.toUpperCase()); setStatus(''); }} />
        </label>
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
        <NumberField label={i18n.t('search.startingFrame')} value={session.startFrame} onChange={startFrame => updateSession({ startFrame })} />
        <NumberField label={i18n.t('search.targetFrame')} value={session.targetFrame} onChange={targetFrame => updateSession({ targetFrame })} />
      </div>
      <p aria-live="polite" className="font-mono text-lg text-amber-300">{seconds} s</p>
      <p className="text-xs text-zinc-400">{i18n.t('gen6.frameTimeHelp')}</p>
    </section>
  </div>;
}
