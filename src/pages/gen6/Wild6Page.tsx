import { aroundTargetRange6, isWildCalibrationCompatible6, wildCalibrationMethod6 } from './searchOptions6';
import { Clock, Crosshair, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { wildAreas6, wildGroup6, wildLocation6, wildSlots6, type WildMethod6 } from '../../data/wild6Catalog';
import { getPersonalEntry6 } from '../../data/personalTable6';
import { parseHex32, toHex32 } from '../../engine/math/uint';
import { createDefaultRngFilter } from '../../engine/core/filters';
import type { Wild6Request, WildRow6 } from '../../engine/gen6/wild6';
import type { Session6, TrainerProfile6 } from '../../services/gen6Storage';
import { computeTsvTrv } from '../../services/profileStorage';
import { useSearchWorker } from '../../workers/useSearchWorker';
import { useApp } from '../../store/AppContext';
import { FrameField, FrameIvValues, FrameShinyBadge, FrameSyncBadge } from '../../components/results/FrameValues';
import { SearchWorkspace } from '../../components/layout/SearchWorkspace';
import { SearchActionBar } from '../../components/results/SearchActionBar';
import { FilterBottomSheet, countActiveFilters } from '../../components/filters/FilterBottomSheet';
import { NumberField } from './fields';
import { Check6, Select6 } from './ToolFields6';
import { CopyResultValue, Details6, MtFrameTiming, PokemonDetailCard6, Results6, rowButtonClass, StatValues6, type Results6Data } from './Results6';

const rngCardClass = 'rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2.5';
type SearchMode6 = 'normal' | 'timeline' | 'aroundTarget';

export function Wild6Page({ profile, session, updateSession, onOpenTimeline }: {
  profile: TrainerProfile6;
  session: Session6;
  updateSession: (patch: Partial<Session6>) => void;
  onOpenTimeline?: () => void;
}) {
  const { i18n, lang } = useApp();
  const it = lang === 'it';
  const t = i18n.t;
  const game = profile.gameVersion;
  const oras = game === 'OR' || game === 'AS';
  const methods = wildGroup6(game).methods;
  const names: Record<WildMethod6, string> = {
    Normal: it ? 'Incontro normale' : 'Normal Wild',
    Horde: it ? 'Orda' : 'Horde',
    Fishing: it ? 'Pesca' : 'Fishing',
    RockSmash: it ? 'Spaccaroccia' : 'Rock Smash',
    FriendSafari: it ? 'Safari Amici' : 'Friend Safari',
    CaveShadow: it ? 'Ombre in grotta' : 'Cave Shadows',
    Trap: it ? 'Trappola' : 'Trap',
    DexNav: 'DexNav',
    PokeRadar: 'PokéRadar',
  };
  const [q, setQ] = useState({
    method: 'Normal' as WildMethod6, area: 0, rod: 0, slot: 0, delay: 6, chain: 0, ha: false, haSlot: 0, potential: 0,
    forceShiny: false, level: 50, genderRatio: 127, safariSlots: 2, syncNature: -1, assumeSync: false,
    lead: 'none' as Wild6Request['lead'], unown: false,
  });
  const [dex, setDex] = useState({ active: true, terrain: 0, specialSlots: false, searchLevel: 0 });
  const [mode, setMode] = useState<SearchMode6>('normal');
  const [filter, setFilter] = useState(createDefaultRngFilter);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<(Results6Data<WildRow6> & { startFrame: number; targetFrame: number }) | null>(null);
  const [row, setRow] = useState<WildRow6 | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [error, setError] = useState('');
  const worker = useSearchWorker();
  const update = (patch: Partial<typeof q>) => setQ(prev => ({ ...prev, ...patch }));
  const areas = wildAreas6(game, q.method);
  const area = areas[q.area];
  const slots = area ? wildSlots6(game, q.method, area, q.rod) : [];
  const savedCalibration = session.timeline;
  const calibration = savedCalibration && isWildCalibrationCompatible6(savedCalibration, q.method, oras)
    ? savedCalibration : undefined;
  const calibrationLabel = savedCalibration ? t('gen6.timelineMethods.' + savedCalibration.method) : '';
  const calibrationMessage = savedCalibration
    ? t('gen6.wildCalibrationMismatch', {
      saved: calibrationLabel,
      family: savedCalibration.oras ? 'ORAS' : 'XY',
      expected: t('gen6.timelineMethods.' + wildCalibrationMethod6(q.method)),
      game: oras ? 'ORAS' : 'XY',
    })
    : t('gen6.timelineNeedsSetup');

  async function search(overrideMode?: SearchMode6, overrideTarget?: number) {
    setError('');
    const activeMode = overrideMode ?? mode;
    const targetFrame = overrideTarget ?? session.targetFrame;
    const { minFrame, maxFrame } = activeMode === 'aroundTarget'
      ? aroundTargetRange6(targetFrame)
      : { minFrame: session.startFrame, maxFrame: session.endFrame };

    if (activeMode === 'timeline' && !calibration) {
      setError(calibrationMessage);
      return;
    }
    if (minFrame > maxFrame) {
      setError(t('gen6.invalidRange'));
      return;
    }
    const { tsv, trv } = computeTsvTrv(profile.tid, profile.sid);
    try {
      const output = await worker.searchWild6({
        ...q, tsv, trv, game, seed: parseHex32(session.initialSeedHex) ?? 0,
        minFrame, maxFrame, charm: profile.shinyCharm,
        assumeSync: activeMode !== 'timeline' && q.assumeSync,
        timeline: activeMode === 'timeline' ? calibration : undefined,
        filter, dex: { ...dex, chain: q.chain, charm: profile.shinyCharm, compoundEyes: q.lead === 'compound' },
      });
      const modeText = activeMode === 'timeline' ? t('search.modeTimeline') : activeMode === 'aroundTarget' ? t('search.modeAround') : '';
      setResult({
        ...output, startFrame: minFrame, targetFrame,
        summary: [
          game, names[q.method], area && wildLocation6(area), modeText,
          activeMode === 'timeline' && t('gen6.activeCalibration', { method: calibrationLabel }),
          session.initialSeedHex, `#${minFrame}–#${maxFrame}`,
          countActiveFilters(filter) ? `${t('search.filters')} ${countActiveFilters(filter)}` : '',
        ].filter(Boolean).join(' · '),
      });
    } catch { /* The worker reports errors. */ }
  }

  return <>
    <SearchWorkspace collapsible={!!result}
      actions={<SearchActionBar activeFilters={countActiveFilters(filter)} onOpenFilters={() => setOpen(true)} isRunning={worker.isRunning} progress={worker.progress} onSearch={() => void search()} onAbort={worker.abort} />}
      results={<Results6 result={result} error={error || (worker.error ? t(worker.error === 'Invalid MT range' ? 'gen6.invalidRange' : 'misc.searchError') : null)}
        headerExtra={<button type="button" aria-pressed={showStats} onClick={() => setShowStats(value => !value)}
          className={`min-h-10 rounded-xl border px-2.5 text-xs font-semibold transition ${showStats
            ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
            : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'}`}>
          {t('search.showStats')}
        </button>}
        renderRow={r => {
          const member = r.members[r.matches[0]! - 1]!;
          const horde = r.members.length === 5;
          const abLabel = member.ability === 3 ? 'HA' : member.ability > 0 ? String(member.ability) : '-';
          const genderLabel = ['-', '♂', '♀'][member.gender] ?? '-';
          const genderTone = member.gender === 1 ? 'text-sky-400' : member.gender === 2 ? 'text-pink-400' : 'text-zinc-400';
          return <button type="button" className={rowButtonClass} onClick={() => setRow(r)}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <b className="font-mono text-amber-300">#{r.frame}</b>
                {horde && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-300">{names.Horde} · {r.matches.length}/5</span>}
                <span className="font-semibold text-zinc-100">{member.species ? i18n.getSpeciesName(member.species) : 'Slot ' + r.slot}</span>
                {member.level > 0 && <span className="text-xs text-zinc-400">Lv. {member.level}</span>}
                <span className="text-xs text-zinc-200">{i18n.getNatureName(member.nature)}</span>
                {member.synchronize && <FrameSyncBadge synced />}
                {member.shiny && <FrameShinyBadge square={member.squareShiny} />}
              </span>
              <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-zinc-300">
                <span>Ab {abLabel}</span>
                <span className={`font-bold ${genderTone}`}>{genderLabel}</span>
              </span>
            </div>
            {horde && <span className="block text-xs text-zinc-400">{`${t('gen6.member')} ${r.matches[0]}`}</span>}
            <div className="flex items-center justify-between gap-2">
              {showStats && member.species > 0 && member.level > 0
                ? <StatValues6 ivs={member.ivs} nature={member.nature} level={member.level} species={member.species} forme={member.forme} />
                : <FrameIvValues ivs={member.ivs} />}
              <span className="shrink-0 text-[11px] font-medium text-zinc-400">
                {t('search.hpShort')} {i18n.getHpTypeName(member.hiddenPower)}
              </span>
            </div>
          </button>;
        }} />}>

      {/* Card 1: Wild Encounter Settings (Always open, matching Gen 7) */}
      <section className={rngCardClass}>
        <h1 className="text-base font-bold">{t('nav.wild')} · {game}</h1>
        <div className="grid grid-cols-2 gap-2">
          <Select6 label={it ? 'Metodo' : 'Method'} value={q.method}
            options={Array.from(new Set(methods.map(m => m.method as WildMethod6))).map(m => [m, names[m]])}
            change={v => update({ method: v as WildMethod6, area: 0, slot: 0, rod: 0, delay: methods.find(m => m.method === v)!.delay, chain: 0, ha: false, forceShiny: false })} />
          {q.method === 'Fishing' ? (
            <Select6 label={it ? 'Canna' : 'Rod'} value={q.rod}
              options={(it ? ['Amo Vecchio', 'Amo Buono', 'Super Amo'] : ['Old Rod', 'Good Rod', 'Super Rod']).map((n, i) => [i, n])}
              change={v => update({ rod: +v, slot: 0 })} />
          ) : (
            <Select6 label={t('gen6.genderRatio')} value={q.genderRatio}
              options={[[127, '1:1'], [31, '7:1'], [63, '3:1'], [191, '1:3'], [225, '1:7'], [0, '♂'], [254, '♀'], [255, '—']]}
              change={v => update({ genderRatio: +v })} />
          )}
        </div>

        {areas.length > 0 && (
          <Select6 label={it ? 'Località' : 'Location'} value={q.area}
            options={areas.map((a, i) => [i, wildLocation6(a)])} change={v => update({ area: +v, slot: 0 })} />
        )}
        {slots.length > 0 && (
          <Select6 label="Slot" value={q.slot}
            options={[[0, '—'], ...slots.map((s, i) => [i + 1, `${i + 1} · ${i18n.getSpeciesName(s.species & 2047)}`] as const)]}
            change={v => update({ slot: +v })} />
        )}

        <div className="grid grid-cols-2 gap-2">
          <Select6 label="Lead" value={q.lead}
            options={Object.entries({ none: '—', static: 'Static', magnet: 'Magnet Pull', cuteM: 'Cute Charm ♂', cuteF: 'Cute Charm ♀', pressure: 'Pressure', black: 'Black Flute', white: 'White Flute', compound: 'Compound Eyes' })}
            change={v => update({ lead: v as Wild6Request['lead'] })} />
          <Select6 label={t('stationary.syncNature')} value={q.syncNature}
            options={[[-1, '—'], ...Array.from({ length: 25 }, (_, i) => [i, i18n.getNatureName(i)] as const)]}
            change={v => update({ syncNature: +v })} />
        </div>

        {q.method === 'Fishing' && (
          <Select6 label={t('gen6.genderRatio')} value={q.genderRatio}
            options={[[127, '1:1'], [31, '7:1'], [63, '3:1'], [191, '1:3'], [225, '1:7'], [0, '♂'], [254, '♀'], [255, '—']]}
            change={v => update({ genderRatio: +v })} />
        )}

        {['Fishing', 'PokeRadar', 'DexNav'].includes(q.method) && (
          <NumberField label={it ? 'Catena' : 'Chain length'} value={q.chain} max={999} onChange={chain => update({ chain })} />
        )}
        {q.method === 'DexNav' && <>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label={t('gen6.searchLevel')} value={dex.searchLevel} max={999} onChange={searchLevel => setDex({ ...dex, searchLevel })} />
            <NumberField label={it ? 'Potenziale' : 'Potential'} value={q.potential} max={3} onChange={potential => update({ potential })} />
          </div>
          <Select6 label={it ? 'Terreno' : 'Terrain'} value={dex.terrain}
            options={[[0, it ? 'Erba' : 'Grass'], [1, it ? 'Erba alta' : 'Tall grass'], [2, 'Surf']]}
            change={v => setDex({ ...dex, terrain: +v })} />
          <div className="flex flex-wrap gap-2">
            <Check6 label={it ? 'Ricerca attiva' : 'Active search'} value={dex.active} change={active => setDex({ ...dex, active })} />
            <Check6 label={t('gen6.dexSlots')} value={dex.specialSlots} change={specialSlots => setDex({ ...dex, specialSlots })} />
            <Check6 label="Unown" value={q.unown} change={unown => update({ unown })} />
          </div>
        </>}
        {q.method === 'FriendSafari' && (
          <NumberField label={t('gen6.safariSlots')} value={q.safariSlots} min={2} max={3} onChange={safariSlots => update({ safariSlots })} />
        )}
        {q.method === 'Horde' && (
          <NumberField label={t('gen6.haSlot')} max={5} value={q.haSlot} onChange={haSlot => update({ haSlot })} />
        )}
        {q.method === 'PokeRadar' && q.chain > 0 && (
          <NumberField label={t('filters.level')} value={q.level} min={1} max={100} onChange={level => update({ level })} />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {mode !== 'timeline' && (
            <Check6 label={t('gen6.assumeSynced')} value={q.assumeSync} change={assumeSync => update({ assumeSync })} />
          )}
          {['DexNav', 'FriendSafari'].includes(q.method) && (
            <Check6 label={it ? 'Abilità nascosta' : 'Hidden ability'} value={q.ha} change={ha => update({ ha })} />
          )}
          {['DexNav', 'PokeRadar'].includes(q.method) && (
            <Check6 label={t('gen6.forceShiny')} value={q.forceShiny} change={forceShiny => update({ forceShiny })} />
          )}
          {onOpenTimeline && (
            <button type="button" onClick={onOpenTimeline}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs font-semibold text-zinc-200 hover:border-amber-500/60 active:scale-95 transition">
              <Clock size={14} className={calibration ? 'text-emerald-400' : 'text-amber-400'} aria-hidden="true" />
              <span>{t('gen6.tinyTimelineTool')}</span>
              {calibration && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">✓</span>}
            </button>
          )}
        </div>
      </section>

      {/* Card 2: RNG INFO (Always open, matching Gen 7) */}
      <section className={rngCardClass}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">{t('search.rngInfo')}</span>
          <button type="button" onClick={() => {
            updateSession({ startFrame: 0, endFrame: 50000, targetFrame: 5000 });
            update({ delay: methods.find(m => m.method === q.method)?.delay ?? 6 });
          }} className="flex h-8 items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 text-[11px] font-medium text-amber-300 active:scale-95 transition">
            <Settings2 className="size-3.5" aria-hidden="true" />
            <span>{t('search.resetRng')}</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
          {([
            { id: 'normal', label: t('search.modeNormal') },
            { id: 'timeline', label: t('search.modeTimeline') },
            { id: 'aroundTarget', label: t('search.modeAround') },
          ] as const).map(item => (
            <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => setMode(item.id)}
              className="choice-button min-h-10 rounded-lg px-1.5 text-[11px] font-semibold transition">
              {item.label}
            </button>
          ))}
        </div>

        {mode === 'timeline' && calibration && (
          <p className="text-xs text-zinc-300">{t('gen6.activeCalibration', { method: calibrationLabel })}</p>
        )}
        {mode === 'timeline' && !calibration && (
          <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200">
            <p>{calibrationMessage}</p>
          </div>
        )}

        {mode === 'aroundTarget' ? (
          <div className="space-y-1.5">
            <NumberField label={t('search.targetFrame')} value={session.targetFrame} min={0}
              onChange={targetFrame => updateSession({ targetFrame })} />
            <p className="text-[11px] font-mono text-zinc-400">
              #{aroundTargetRange6(session.targetFrame).minFrame} – #{aroundTargetRange6(session.targetFrame).maxFrame}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <NumberField label={t('search.startFrame')} value={session.startFrame} onChange={startFrame => updateSession({ startFrame })} />
            <NumberField label={t('search.endFrame')} value={session.endFrame} onChange={endFrame => updateSession({ endFrame })} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {mode !== 'aroundTarget' && (
            <NumberField label={t('search.targetFrame')} value={session.targetFrame} onChange={targetFrame => updateSession({ targetFrame })} />
          )}
          <NumberField label={t('gen6.delay')} max={4000} value={q.delay} onChange={delay => update({ delay })} />
        </div>
      </section>
    </SearchWorkspace>

    <FilterBottomSheet open={open} onClose={() => setOpen(false)} mode="wild" showSpecialOnly={false}
      filter={filter} onChange={setFilter} allowExactStats={false} personalData={{ speciesCount: 721, getEntry: getPersonalEntry6 }} />

    <Details6 open={!!row} title={`Frame #${row?.frame ?? ''}`} onClose={() => setRow(null)}>
      {row && result && <>
        <MtFrameTiming frame={row.frame} startFrame={result.startFrame} targetFrame={result.targetFrame} />
        <dl className="grid grid-cols-2 gap-2">
          <FrameField label={t('misc.randomNumber')}>{toHex32(row.rand)}</FrameField>
          <FrameField label={t('gen6.mtState')}>{toHex32(row.state)}</FrameField>
        </dl>
        {row.dex && (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200">
            DexNav ({row.dex.x}, {row.dex.y}) · Slot {row.dex.slot + 1} · +{row.dex.levelBoost} Lv
            {' · '}{it ? 'Potenziale' : 'Potential'} {row.dex.potential} · HA {row.dex.ha ? '✓' : '×'}
            {' · '}{it ? 'Mossa uovo' : 'Egg move'} {row.dex.eggMove ? '✓' : '×'}{row.dex.boost ? ' · Boost' : ''}
          </p>
        )}
        <ol className="space-y-3">
          {row.members.map((p, i) => (
            <li key={i} className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {row.matches.includes(i + 1) && (
                  <span className="text-emerald-300" title={t('gen6.filterMatch')}>
                    ✓<span className="sr-only">{t('gen6.filterMatch')}</span>
                  </span>
                )}
                <span>{i + 1} · {p.species ? i18n.getSpeciesName(p.species) : `Slot ${p.slot}`}{p.level > 0 && ` · Lv. ${p.level}`}</span>
                {p.shiny && <FrameShinyBadge square={p.squareShiny} />}
              </div>
              <PokemonDetailCard6
                species={p.species} forme={p.forme} level={p.level}
                nature={p.nature} synchronized={p.synchronize} ability={p.ability} gender={p.gender}
                hiddenPower={p.hiddenPower} ivs={p.ivs} pid={p.pid} ec={p.ec} psv={p.psv} prv={p.prv}
                extra={[
                  { label: 'Slot', value: p.slot },
                  ...(p.item !== null ? [{ label: it ? 'Strumento' : 'Held Item', value: ['50%', '5%', '1%', '—'][p.item] }] : []),
                  ...(p.species === 201 ? [{ label: t('event.forme'), value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!?'[p.forme] ?? p.forme }] : []),
                ]}
              />
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button"
            className="h-10 rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 text-xs font-semibold text-sky-200 active:scale-95 transition"
            onClick={() => { updateSession({ targetFrame: row.frame }); setRow(null); }}>
            {t('search.setAsTarget')}
          </button>
          <button type="button"
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 text-xs font-bold text-zinc-950 active:scale-95 transition"
            onClick={() => {
              const target = row.frame;
              updateSession({ targetFrame: target });
              setMode('aroundTarget');
              setRow(null);
              void search('aroundTarget', target);
            }}>
            <Crosshair size={14} aria-hidden="true" />
            <span>{t('search.aroundAction')}</span>
          </button>
        </div>
        <CopyResultValue value={toHex32(row.state)} label={t('gen6.copyState')} />
      </>}
    </Details6>
  </>;
}
