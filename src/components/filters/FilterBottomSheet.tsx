import { useDialogFocus } from '../common/useDialogFocus';
import { RotateCcw, Sparkles, X } from 'lucide-react';
import { useEffect } from 'react';
import { createDefaultRngFilter } from '../../engine/core/filters';
import type { RngFilterOptions } from '../../engine/core/types';
import { useApp } from '../../store/AppContext';
import { NumberStepper } from '../common/NumberStepper';
import { NumericInput } from '../common/NumericInput';

export type FilterSheetMode = 'stationary' | 'wild' | 'egg' | 'event';

interface FilterBottomSheetProps {
  open: boolean;
  onClose: () => void;
  filter: RngFilterOptions;
  onChange: (next: RngFilterOptions) => void;
  mode: FilterSheetMode;
  syncNature?: number; // 0..24 or 255
  showSafeBlink?: boolean;
  npcCount?: number;
  allowExactStats?: boolean;
}

const STAT_LABELS = ['PS', 'Atk', 'Def', 'SpA', 'SpD', 'Vel'] as const;
const STAT_LABELS_EN = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'] as const;

const IV_PRESETS = [
  { label: 'filters.presetAny', low: [0, 0, 0, 0, 0, 0] },
  { label: 'filters.preset5Atk', low: [31, 0, 31, 31, 31, 31] },
  { label: 'filters.preset5SpA', low: [31, 31, 31, 0, 31, 31] },
  { label: 'filters.preset6IV', low: [31, 31, 31, 31, 31, 31] },
] as const;

export function countActiveFilters(f: RngFilterOptions): number {
  if (f.skip) return 0;
  let count = 0;
  if (f.shinyOnly) count++;
  if (f.safeOnly || f.blinkOnly) count++;
  if (f.byStats) count++;
  else {
    if (f.ivLow.some((v) => v > 0) || f.ivUp.some((v) => v < 31)) count++;
    if (f.perfectIvCount > 0) count++;
  }
  if (f.natures.some(Boolean)) count++;
  if (f.hpTypes.some(Boolean)) count++;
  if (f.ability !== 0) count++;
  if (f.gender !== 0) count++;
  if (f.level !== 0) count++;
  if (f.slots.some(Boolean)) count++;
  if (f.specialOnly) count++;
  if (f.ball !== 0) count++;
  if (f.natureInheritance !== 0) count++;
  return count;
}

export function FilterBottomSheet({
  open,
  onClose,
  filter,
  onChange,
  mode,
  syncNature = 255,
  showSafeBlink = false,
  npcCount = 0,
  allowExactStats = true,
}: FilterBottomSheetProps) {
  const { i18n, lang } = useApp();

  const dialogRef = useDialogFocus(open);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const statNames = lang === 'it' ? STAT_LABELS : STAT_LABELS_EN;

  const setIvBound = (which: 'ivLow' | 'ivUp', idx: number, val: number) => {
    const clamped = Math.max(0, Math.min(31, Number.isNaN(val) ? 0 : val));
    const next = [...filter[which]] as [number, number, number, number, number, number];
    next[idx] = clamped;
    onChange({ ...filter, [which]: next });
  };

  const applyPreset = (
    low: [number, number, number, number, number, number],
    up: [number, number, number, number, number, number],
  ) => {
    onChange({ ...filter, byStats: false, ivLow: low, ivUp: up });
  };

  const toggleNature = (idx: number) => {
    const next = [...filter.natures];
    next[idx] = !next[idx];
    onChange({ ...filter, natures: next });
  };

  const toggleHp = (idx: number) => {
    const next = [...filter.hpTypes];
    next[idx] = !next[idx];
    onChange({ ...filter, hpTypes: next });
  };

  const toggleSlot = (slotNum: number) => {
    const next = [...filter.slots];
    next[slotNum] = !next[slotNum];
    onChange({ ...filter, slots: next });
  };

  const resetAll = () => {
    const fresh = createDefaultRngFilter();
    fresh.baseStats = filter.baseStats;
    onChange(fresh);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end justify-center lg:items-center lg:p-6"
      onClick={onClose}
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={i18n.t('filters.title')}
    >
      <div
        className="w-full max-w-xl max-h-[88dvh] bg-zinc-950 border-t border-zinc-800 rounded-t-3xl lg:rounded-3xl lg:border lg:max-h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <h3 className="text-base font-bold text-zinc-100">{i18n.t('filters.title')}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetAll}
              className="h-9 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{i18n.t('app.reset')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300"
              aria-label={i18n.t('app.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Disable Filters */}
          <label className="flex items-center justify-between min-h-11 px-3 rounded-xl bg-zinc-900 border border-zinc-800">
            <span className="text-xs font-medium text-zinc-200">{i18n.t('filters.disable')}</span>
            <input
              type="checkbox"
              checked={filter.skip}
              onChange={(e) => onChange({ ...filter, skip: e.target.checked })}
              className="w-5 h-5 accent-amber-500"
            />
          </label>

          {/* Shiny Segmented */}
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-zinc-400">Shiny</span>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
              <button
                type="button"
                onClick={() => onChange({ ...filter, shinyOnly: false, squareShinyOnly: false })}
                aria-pressed={!filter.shinyOnly}
                className="choice-button h-9 rounded-lg text-xs font-semibold"
              >
                {i18n.t('filters.shinyAll')}
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...filter, shinyOnly: true, squareShinyOnly: false })}
                aria-pressed={filter.shinyOnly && !filter.squareShinyOnly}
                className="choice-button h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{i18n.t('filters.shinyStar')}</span>
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...filter, shinyOnly: true, squareShinyOnly: true })}
                aria-pressed={filter.shinyOnly && filter.squareShinyOnly}
                className="choice-button h-9 rounded-lg text-xs font-semibold"
              >
                {i18n.t('filters.shinySquare')}
              </button>
            </div>
          </div>

          {/* Safe / Blink Only */}
          {showSafeBlink && (
            <label className="flex items-center justify-between min-h-11 px-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-xs font-medium text-zinc-200">
                {npcCount === 0 ? i18n.t('search.blinkOnly') : i18n.t('search.safeOnly')}
              </span>
              <input
                type="checkbox"
                checked={npcCount === 0 ? Boolean(filter.blinkOnly) : Boolean(filter.safeOnly)}
                onChange={(e) =>
                  onChange({
                    ...filter,
                    safeOnly: npcCount > 0 ? e.target.checked : false,
                    blinkOnly: npcCount === 0 ? e.target.checked : false,
                  })
                }
                className="w-5 h-5 accent-emerald-500"
              />
            </label>
          )}

          {/* Quick IV Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">
                {i18n.t('filters.ivPresets')}
              </span>
              {allowExactStats && filter.baseStats && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...filter,
                      byStats: !filter.byStats,
                      targetStats: filter.targetStats ?? [0, 0, 0, 0, 0, 0],
                    })
                  }
                  className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border ${
                    filter.byStats
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                >
                  {i18n.t('filters.exactStats')}
                </button>
              )}
            </div>

            {!filter.byStats ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {IV_PRESETS.map(({ label, low }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => applyPreset([...low], [31, 31, 31, 31, 31, 31])}
                      aria-pressed={low.every((v, i) => v === filter.ivLow[i]) && filter.ivUp.every((v) => v === 31)}
                      className="choice-button h-8 px-2.5 rounded-lg text-xs"
                    >
                      {i18n.t(label)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const low = [...filter.ivLow] as [number, number, number, number, number, number];
                      const up = [...filter.ivUp] as [number, number, number, number, number, number];
                      low[5] = 0;
                      up[5] = 0;
                      applyPreset(low, up);
                    }}
                    aria-pressed={filter.ivLow[5] === 0 && filter.ivUp[5] === 0}
                    className="choice-button h-8 px-2.5 rounded-lg text-xs"
                  >
                    {i18n.t('filters.preset0Spe')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const low = [...filter.ivLow] as [number, number, number, number, number, number];
                      const up = [...filter.ivUp] as [number, number, number, number, number, number];
                      low[1] = 0;
                      up[1] = 0;
                      applyPreset(low, up);
                    }}
                    aria-pressed={filter.ivLow[1] === 0 && filter.ivUp[1] === 0}
                    className="choice-button h-8 px-2.5 rounded-lg text-xs"
                  >
                    {i18n.t('filters.preset0Atk')}
                  </button>
                </div>

                {/* 2x3 IV Min/Max Grid */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {statNames.map((lbl, idx) => (
                    <div
                      key={lbl}
                      className="rounded-xl bg-zinc-900 border border-zinc-800 p-2 space-y-1"
                    >
                      <span className="block text-[11px] font-bold text-zinc-400 text-center">
                        {lbl}
                      </span>
                      <div className="flex items-center gap-1">
                        <NumericInput
                          ariaLabel={`${lbl} Min`}
                          min={0}
                          max={31}
                          value={filter.ivLow[idx] ?? 0}
                          onChange={(val) => setIvBound('ivLow', idx, val)}
                          className="w-full h-8 rounded-lg bg-zinc-950 border border-zinc-800 text-center font-mono text-xs tabular-nums text-zinc-100"
                        />
                        <span className="text-zinc-400 text-xs">–</span>
                        <NumericInput
                          ariaLabel={`${lbl} Max`}
                          min={0}
                          max={31}
                          value={filter.ivUp[idx] ?? 31}
                          onChange={(val) => setIvBound('ivUp', idx, val)}
                          className="w-full h-8 rounded-lg bg-zinc-950 border border-zinc-800 text-center font-mono text-xs tabular-nums text-zinc-100"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <NumberStepper
                  label={i18n.t('filters.perfectIvs')}
                  value={filter.perfectIvCount}
                  min={0}
                  max={6}
                  onChange={(v) => onChange({ ...filter, perfectIvCount: v })}
                />
              </>
            ) : (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {statNames.map((lbl, idx) => (
                  <div
                    key={lbl}
                    className="rounded-xl bg-zinc-900 border border-zinc-800 p-2 space-y-1"
                  >
                    <span className="block text-[11px] font-bold text-zinc-400 text-center">
                      {lbl} (0=*)
                    </span>
                    <NumericInput
                      ariaLabel={`${lbl} Stat`}
                      min={0}
                      max={999}
                      value={filter.targetStats?.[idx] ?? 0}
                      onChange={(val) => {
                        const next = [
                          ...(filter.targetStats ?? [0, 0, 0, 0, 0, 0]),
                        ] as [number, number, number, number, number, number];
                        next[idx] = val;
                        onChange({ ...filter, targetStats: next });
                      }}
                      className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 text-center font-mono text-xs tabular-nums text-amber-300"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ability & Gender */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-zinc-400">
                {i18n.t('filters.ability')}
              </span>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                {[
                  { v: 0, l: '-' },
                  { v: 1, l: '1' },
                  { v: 2, l: '2' },
                  { v: 3, l: 'H' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => onChange({ ...filter, ability: opt.v })}
                    aria-pressed={filter.ability === opt.v}
                    className="choice-button h-8 rounded-lg text-xs font-bold"
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="block text-xs font-medium text-zinc-400">
                {i18n.t('filters.gender')}
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                {[
                  { v: 0, l: '-' },
                  { v: 1, l: '♂' },
                  { v: 2, l: '♀' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => onChange({ ...filter, gender: opt.v })}
                    aria-pressed={filter.gender === opt.v}
                    className="choice-button h-8 rounded-lg text-xs font-bold"
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Wild-specific Filters */}
          {mode === 'wild' && (
            <div className="space-y-2">
              <span className="block text-xs font-medium text-zinc-400">
                {i18n.t('filters.slot')}
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 10 }, (_, k) => k + 1).map((slotNum) => {
                  const active = Boolean(filter.slots[slotNum]);
                  return (
                    <button
                      key={slotNum}
                      type="button"
                      onClick={() => toggleSlot(slotNum)}
                      aria-pressed={active}
                      className="choice-button h-9 rounded-lg font-mono text-xs font-bold transition"
                    >
                      {slotNum}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <NumberStepper
                  label={i18n.t('filters.level')}
                  value={filter.level}
                  min={0}
                  max={100}
                  onChange={(level) => onChange({ ...filter, level })}
                />
                <label className="flex items-center justify-between px-3 rounded-xl bg-zinc-900 border border-zinc-800 mt-5 h-11">
                  <span className="text-[11px] font-medium text-zinc-200">
                    {i18n.t('filters.specialOnly')}
                  </span>
                  <input
                    type="checkbox"
                    checked={filter.specialOnly}
                    onChange={(e) => onChange({ ...filter, specialOnly: e.target.checked })}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Egg-specific Filters */}
          {mode === 'egg' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="block text-xs font-medium text-zinc-400">
                  {i18n.t('filters.ball')}
                </span>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                  {[
                    { v: 0, l: '-' },
                    { v: 1, l: '♂' },
                    { v: 2, l: '♀' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => onChange({ ...filter, ball: opt.v })}
                      aria-pressed={filter.ball === opt.v}
                      className="choice-button h-8 rounded-lg text-xs font-bold"
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-medium text-zinc-400">
                  {i18n.t('filters.natureInherit')}
                </span>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                  {[
                    { v: 0, l: '-' },
                    { v: 1, l: '♂' },
                    { v: 2, l: '♀' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => onChange({ ...filter, natureInheritance: opt.v })}
                      aria-pressed={filter.natureInheritance === opt.v}
                      className="choice-button h-8 rounded-lg text-xs font-bold"
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Natures Multi-select */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">
                {i18n.t('filters.natures')}
              </span>
              {syncNature < 25 && (
                <button
                  type="button"
                  onClick={() => {
                    const next = new Array<boolean>(25).fill(false);
                    next[syncNature] = true;
                    onChange({ ...filter, natures: next });
                  }}
                  className="h-7 px-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-[11px] font-semibold text-amber-300"
                >
                  {i18n.t('filters.matchSync')} ({i18n.getNatureName(syncNature)})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 25 }, (_, idx) => {
                const active = Boolean(filter.natures[idx]);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleNature(idx)}
                    aria-pressed={active}
                    className="choice-button h-8 px-2.5 rounded-lg text-xs font-medium transition"
                  >
                    {i18n.getNatureName(idx)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hidden Power Multi-select */}
          <div className="space-y-1.5 pb-2">
            <span className="block text-xs font-medium text-zinc-400">
              {i18n.t('filters.hiddenPower')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 16 }, (_, idx) => {
                const active = Boolean(filter.hpTypes[idx]);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleHp(idx)}
                    aria-pressed={active}
                    className="choice-button h-8 px-2.5 rounded-lg text-xs font-medium transition"
                  >
                    {i18n.getHpTypeName(idx)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950 safe-pb shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-2xl bg-amber-500 text-zinc-950 font-bold text-sm active:scale-[0.99] transition"
          >
            {i18n.t('filters.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
