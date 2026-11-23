import { Check, Clock, Copy, Crosshair, Play, Sparkles, Target, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getFormeEntry } from '../../data/personalTable';
import { convertToTimeStr, getStats } from '../../engine/core/pokemonMath';
import type { FrameRow } from '../../engine/core/types';
import { formatEggSeedStr, toHex32, toHex64 } from '../../engine/math/uint';
import { useApp } from '../../store/AppContext';

const ABILITY_LABELS = ['-', '1', '2', 'H'] as const;
const GENDER_LABELS = ['-', '♂', '♀'] as const;

interface FrameDetailModalProps {
  row: FrameRow | null;
  onClose: () => void;
  fallbackSpecies?: number;
  fallbackForme?: number;
  aroundTab?: 'stationary' | 'wild' | 'event';
}

export function FrameDetailModal({
  row,
  onClose,
  fallbackSpecies = 0,
  fallbackForme = 0,
  aroundTab,
}: FrameDetailModalProps) {
  const { i18n, setStartFrame, setTargetFrame, triggerAroundTarget, triggerTimelineFrom } = useApp();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [row]);

  useEffect(() => {
    if (!row) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [row, onClose]);

  if (!row) return null;

  const r = row.result;
  const sp = r.species > 0 ? r.species : fallbackSpecies;
  const fm = r.species > 0 ? r.forme : fallbackForme;
  const entry = sp > 0 ? getFormeEntry(sp, fm) : null;
  const computedStats =
    r.stats ?? (entry && r.level > 0 ? getStats(r.ivs, r.nature, r.level, entry.stats) : null);

  const isEggLike = r.kind === 'egg' || r.kind === 'mainEgg';
  const hideEggPid = r.kind === 'egg' && r.pid === 0;
  const eggBall = isEggLike && 'ball' in r ? (r.ball === 1 ? '♂' : '♀') : null;
  const wurmpleEvo =
    isEggLike && r.gender !== 0 ? (((r.ec >>> 16) % 10) < 5 ? 'Beautifly' : 'Dustox') : null;
  const pidHex = toHex32(r.pid);
  const ecHex = toHex32(r.ec);
  const randHex =
    r.kind === 'egg' ? toHex32(r.randNum) : toHex64(r.randLo, r.randHi);
  const tinyHex = r.kind === 'egg' ? formatEggSeedStr(r.status) : null;
  const abLabel = ABILITY_LABELS[r.ability] ?? '-';
  const genLabel = GENDER_LABELS[r.gender] ?? '-';
  const natureLabel =
    r.kind === 'egg' && r.beInheritParents !== null
      ? r.beInheritParents
        ? '♂ Ever'
        : '♀ Ever'
      : i18n.getNatureName(r.nature);
  const hpLabel = i18n.getHpTypeName(r.hiddenPower);

  const copySummary = async () => {
    const extraEgg = `${eggBall ? ` | Ball: ${eggBall}` : ''}${wurmpleEvo ? ` | Wurmple: ${wurmpleEvo}` : ''}`;
    const lines = [
      `Frame: ${row.frame}`,
      sp > 0 ? `Pokemon: ${i18n.getSpeciesName(sp)} (Lv.${r.level})` : `Lv.${r.level}`,
      `Nature: ${natureLabel} | Ability: ${abLabel} | Gender: ${r.gender === 1 ? 'M' : r.gender === 2 ? 'F' : '-'}`,
      `IVs: ${r.ivs.join('/')} | HP: ${hpLabel}`,
      hideEggPid
        ? `EC: ${ecHex}${extraEgg}`
        : `PID: ${pidHex} | EC: ${ecHex} | PSV: ${r.psv}${extraEgg}`,
      `Rand: ${randHex}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Frame #${row.frame}`}
    >
      <div
        className="w-full max-w-xl bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-4 space-y-3 safe-pb max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-lg font-bold text-amber-300 tabular-nums">
              #{row.frame.toLocaleString()}
            </span>
            {sp > 0 && (
              <span className="text-sm font-semibold text-zinc-200">
                {i18n.getSpeciesName(sp)} · Lv.{r.level}
              </span>
            )}
            {r.shiny && (
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  r.squareShiny
                    ? 'bg-cyan-400 text-zinc-950'
                    : 'bg-amber-400 text-zinc-950'
                }`}
              >
                <Sparkles className="w-2.5 h-2.5" />
                {r.squareShiny ? '◇ Square' : '★ Shiny'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={i18n.t('app.close')}
            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary: Nature, Ability, Gender, Hidden Power */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <span className="block text-[11px] text-zinc-400">{i18n.t('filters.natures')}</span>
            <span className="font-semibold text-zinc-100 inline-flex items-center justify-center gap-1 flex-wrap">
              <span>{natureLabel}</span>
              {r.synchronize && (
                <span className="text-[11px] font-semibold text-emerald-400">· Sync ✓</span>
              )}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-zinc-400">{i18n.t('filters.ability')}</span>
            <span className="font-mono font-bold text-zinc-100">{abLabel}</span>
          </div>
          <div>
            <span className="block text-[11px] text-zinc-400">{i18n.t('filters.gender')}</span>
            <span
              className={`font-bold ${
                r.gender === 1 ? 'text-sky-400' : r.gender === 2 ? 'text-pink-400' : 'text-zinc-300'
              }`}
            >
              {genLabel}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-zinc-400">{i18n.t('filters.hiddenPower')}</span>
            <span className="font-semibold text-zinc-100">{hpLabel}</span>
          </div>
        </div>

        {/* IVs + Stats */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3 space-y-2">
          <div className="grid grid-cols-6 gap-1 text-center font-mono text-xs tabular-nums">
            {['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'].map((s, idx) => (
              <div key={s} className="space-y-0.5">
                <div className="text-[11px] text-zinc-400">{s}</div>
                <div
                  className={`font-bold py-1 rounded bg-zinc-950 ${
                    r.ivs[idx] === 31
                      ? 'text-emerald-300'
                      : r.ivs[idx] === 0
                        ? 'text-amber-300'
                        : 'text-zinc-200'
                  }`}
                >
                  {r.ivs[idx]}
                </div>
                {computedStats && (
                  <div className="text-[11px] text-zinc-400">{computedStats[idx]}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Hex & Technical Metadata */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3 grid grid-cols-2 gap-y-2 gap-x-3 font-mono text-xs tabular-nums">
          <div>
            <span className="text-zinc-400 block text-[11px]">PID</span>
            <span className="text-zinc-100">{hideEggPid ? '—' : pidHex}</span>
          </div>
          <div>
            <span className="text-zinc-400 block text-[11px]">EC</span>
            <span className="text-zinc-100">{ecHex}</span>
          </div>
          <div>
            <span className="text-zinc-400 block text-[11px]">PSV / PRV</span>
            <span className="text-zinc-100">
              {hideEggPid ? '—' : `${String(r.psv).padStart(4, '0')} / ${r.prv}`}
            </span>
          </div>
          <div>
            <span className="text-zinc-400 block text-[11px]">
              {r.kind === 'egg' ? 'Frames Used' : i18n.t('search.delayUsed')}
            </span>
            <span className="text-zinc-100">
              {r.kind === 'egg' ? `+${r.framesUsed}F` : `${r.frameDelayUsed}F`}
            </span>
          </div>
          {eggBall && (
            <div>
              <span className="text-zinc-400 block text-[11px]">{i18n.t('filters.ball')}</span>
              <span className="text-zinc-100 font-sans font-semibold">{eggBall}</span>
            </div>
          )}
          {wurmpleEvo && (
            <div>
              <span className="text-zinc-400 block text-[11px]">Wurmple</span>
              <span className="text-zinc-100 font-sans font-semibold">{wurmpleEvo}</span>
            </div>
          )}
          <div className="col-span-2">
            <span className="text-zinc-400 block text-[11px]">Rand</span>
            <span className="text-amber-200 break-all">{randHex}</span>
          </div>
          {tinyHex && (
            <div className="col-span-2">
              <span className="text-zinc-400 block text-[11px]">TinyMT State</span>
              <span className="text-emerald-300 break-all">{tinyHex}</span>
            </div>
          )}
          {row.realtime >= 0 && (
            <div className="col-span-2">
              <span className="text-zinc-400 block text-[11px]">
                {i18n.t('search.estimatedTime')}
              </span>
              <span className="text-zinc-200">
                {convertToTimeStr(row.realtime / 60)} ({row.realtime}F / shift{' '}
                {row.shift >= 0 ? `+${row.shift}` : row.shift}F)
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          {aroundTab && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStartFrame(row.frame);
                    onClose();
                  }}
                  className="h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{i18n.t('search.setAsStart')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetFrame(row.frame);
                    onClose();
                  }}
                  className="h-10 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-200 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>{i18n.t('search.setAsTarget')}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerTimelineFrom(aroundTab, row.frame);
                    onClose();
                  }}
                  className="min-h-11 py-1.5 px-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 text-center active:scale-95 transition"
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{i18n.t('search.timelineFrom').replace('{f}', row.frame.toLocaleString())}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerAroundTarget(aroundTab, row.frame);
                    onClose();
                  }}
                  className="min-h-11 py-1.5 px-2.5 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold flex items-center justify-center gap-1.5 text-center active:scale-95 transition"
                >
                  <Crosshair className="w-3.5 h-3.5 shrink-0" />
                  <span>{i18n.t('search.aroundAction')}</span>
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={copySummary}
            className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-zinc-100 flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? i18n.t('app.copied') : i18n.t('app.copy')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
