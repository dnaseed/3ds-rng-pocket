import { Sparkles } from 'lucide-react';
import { getFormeEntry } from '../../data/personalTable';
import { convertToTimeStr, getStats } from '../../engine/core/pokemonMath';
import type { FrameRow } from '../../engine/core/types';
import { useApp } from '../../store/AppContext';

const ABILITY_LABELS = ['-', '1', '2', 'H'] as const;
const GENDER_LABELS = ['-', '♂', '♀'] as const;
const ITEM_LABELS = ['50%', '5%', '1%', '—'] as const;

interface FrameCardProps {
  row: FrameRow;
  showSpecies?: boolean;
  showStats?: boolean;
  fallbackSpecies?: number;
  fallbackForme?: number;
  checked?: boolean;
  onToggleCheck?: () => void;
  onSelect: () => void;
}

function getBlinkBadge(blink: number): { label: string; cls: string } {
  if (blink === 0) return { label: 'Safe', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
  if (blink === 1) return { label: '★ Blink', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  if (blink === 2) return { label: '? Unsafe', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
  if (blink === 3) return { label: '? ★', cls: 'bg-rose-500/20 text-rose-200 border-rose-500/40' };
  if (blink === 4) return { label: '<?>', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
  return { label: `${blink}`, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
}

export function FrameCard({
  row,
  showSpecies = false,
  showStats = false,
  fallbackSpecies = 0,
  fallbackForme = 0,
  checked = false,
  onToggleCheck,
  onSelect,
}: FrameCardProps) {
  const { i18n } = useApp();
  const r = row.result;
  const blinkInfo = getBlinkBadge(row.blink);

  const displayStats = (() => {
    if (!showStats) return null;
    if (r.stats) return r.stats;
    const sp = r.species > 0 ? r.species : fallbackSpecies;
    const fm = r.species > 0 ? r.forme : fallbackForme;
    if (sp <= 0 || r.level <= 0) return null;
    const entry = getFormeEntry(sp, fm);
    return getStats(r.ivs, r.nature, r.level, entry.stats);
  })();

  const natureText =
    r.kind === 'egg' && r.beInheritParents !== null
      ? r.beInheritParents
        ? '♂ Ever'
        : '♀ Ever'
      : i18n.getNatureName(r.nature);

  const hpText = i18n.getHpTypeName(r.hiddenPower);
  const abText = ABILITY_LABELS[r.ability] ?? '-';
  const genText = GENDER_LABELS[r.gender] ?? '-';

  return (
    <div
      className={`rounded-2xl border p-3 transition ${
        checked
          ? 'bg-zinc-900/40 border-zinc-800/50 opacity-55'
          : r.squareShiny
            ? 'bg-zinc-900 border-cyan-400/70'
            : r.shiny
              ? 'bg-zinc-900 border-amber-400/70'
              : 'bg-zinc-900/90 border-zinc-800'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {onToggleCheck && (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleCheck}
            className="mt-1 w-5 h-5 accent-emerald-500 shrink-0"
            aria-label="Mark step completed"
          />
        )}

        <button type="button" onClick={onSelect} className="flex-1 text-left min-w-0 space-y-1.5">
          {/* Row 1: Frame + Badges + Nature + Ability + Gender */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-sm font-bold text-zinc-100 tabular-nums">
                #{row.frame.toLocaleString()}
              </span>

              {row.eggNum !== undefined && (
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-[10px] font-bold text-zinc-300 tabular-nums">
                  E{row.eggNum}
                </span>
              )}

              {row.acceptReject && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide ${
                    row.acceptReject === 'accept'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  }`}
                >
                  {row.acceptReject === 'accept' ? i18n.t('egg.accept') : i18n.t('egg.reject')}
                </span>
              )}

              {r.kind !== 'egg' && (
                <span
                  className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${blinkInfo.cls}`}
                >
                  {blinkInfo.label}
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
                  {r.squareShiny ? '◇' : '★'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs flex-wrap justify-end">
              <span className="font-semibold text-zinc-100">{natureText}</span>
              {r.synchronize && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold">
                  Sync ✓
                </span>
              )}
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-[10px] text-zinc-300">
                Ab {abText}
              </span>
              <span
                className={`font-bold ${
                  r.gender === 1 ? 'text-sky-400' : r.gender === 2 ? 'text-pink-400' : 'text-zinc-400'
                }`}
              >
                {genText}
              </span>
            </div>
          </div>

          {/* Row 2: 6 IVs (or Computed Stats) + HP */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 font-mono text-xs tabular-nums">
              {displayStats
                ? displayStats.map((st, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center justify-center min-w-7 px-1 py-0.5 rounded bg-sky-500/15 text-sky-200 font-semibold"
                    >
                      {st}
                    </span>
                  ))
                : r.ivs.map((iv, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center justify-center min-w-6 px-1 py-0.5 rounded ${
                        iv === 31
                          ? 'bg-emerald-500/15 text-emerald-300 font-bold'
                          : iv === 0
                            ? 'bg-amber-500/15 text-amber-300 font-bold'
                            : 'bg-zinc-950 text-zinc-300'
                      }`}
                    >
                      {String(iv).padStart(2, '0')}
                    </span>
                  ))}
            </div>
            <span className="text-[11px] font-medium text-zinc-300 shrink-0">
              {i18n.t('search.hpShort')} {hpText}
            </span>
          </div>

          {/* Row 3: Timing / Wild / Egg metadata */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-300 font-mono tabular-nums">
            <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap min-w-0">
              {row.realtime >= 0 && (
                <span>
                  {convertToTimeStr(row.realtime / 60)}{' '}
                  <span className={row.shift === 0 ? 'text-amber-300' : 'text-zinc-300'}>
                    ({row.shift >= 0 ? `+${row.shift}` : row.shift}F)
                  </span>
                </span>
              )}

              {r.kind !== 'egg' && r.frameDelayUsed > 0 && (
                <span className="shrink-0">Delay +{r.frameDelayUsed}F</span>
              )}

              {(r.kind === 'egg' || r.kind === 'mainEgg') && 'ball' in r && (
                <span>
                  {r.kind === 'egg' ? `+${r.framesUsed}F · ` : ''}Ball:{r.ball === 1 ? '♂' : '♀'}
                </span>
              )}

              {r.kind === 'wild' && (
                <span className="text-zinc-300 font-sans truncate">
                  {showSpecies ? `${i18n.getSpeciesName(r.species)} ` : ''}
                  Lv.{r.level} ·{' '}
                  {r.isSpecial
                    ? r.specialVal !== null
                      ? `<${String(r.specialVal).padStart(2, '0')}>`
                      : r.slot > 7
                        ? `W${r.slot - 7}`
                        : (row.specialSlotStr || 'SP')
                    : `S${r.slot}`}
                  {r.item < 3 ? ` · ${ITEM_LABELS[r.item]}` : ''}
                </span>
              )}
            </div>

            {row.frame0 !== undefined && (
              <span className="text-amber-300/80 shrink-0">
                {r.kind === 'wild' ? `Cast #${row.frame0}` : `F1 #${row.frame0}`}
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
