import { useDialogFocus } from '../common/useDialogFocus';
import { ChevronDown, Clock, Layers, SlidersHorizontal, Sparkles, Target, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { GameVersionId } from '../../engine/core/types';
import { useApp } from '../../store/AppContext';
import { HexSeedInput } from '../common/HexSeedInput';
import { NumberStepper } from '../common/NumberStepper';

function getVersionBadgeClass(ver: GameVersionId): string {
  switch (ver) {
    case 'US':
      return 'bg-orange-500/20 text-orange-300';
    case 'UM':
      return 'bg-indigo-500/20 text-indigo-300';
    case 'S':
      return 'bg-amber-500/20 text-amber-300';
    case 'M':
      return 'bg-sky-500/20 text-sky-300';
  }
}

export function TopHeader() {
  const {
    lang,
    setLang,
    i18n,
    activeProfile,
    profileStore,
    selectProfile,
    initialSeedHex,
    setInitialSeedHex,
    targetFrame,
    setTargetFrame,
    setActiveGen,
    setActiveTab,
    setMoreSection,
    isOnline,
  } = useApp();

  const [showPicker, setShowPicker] = useState(false);
  const [showSeedPopover, setShowSeedPopover] = useState(false);
  const [showTargetPopover, setShowTargetPopover] = useState(false);

  const anyPopoverOpen = showPicker || showSeedPopover || showTargetPopover;
  const dialogRef = useDialogFocus(anyPopoverOpen);
  useEffect(() => {
    if (!anyPopoverOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPicker(false);
        setShowSeedPopover(false);
        setShowTargetPopover(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [anyPopoverOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 safe-pt">
        <div className="max-w-xl lg:max-w-[1440px] lg:px-6 mx-auto px-2.5 h-13 flex items-center justify-between gap-2">
          {/* Active Profile Pill + Online Dot */}
          <button
            type="button"
            onClick={() => {
              setShowSeedPopover(false);
              setShowTargetPopover(false);
              setShowPicker((v) => !v);
            }}
            className="flex items-center gap-1.5 min-h-10 px-2.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-100 active:scale-95 transition truncate min-w-0 shrink max-w-[43%]"
            title={isOnline ? 'Online' : 'Offline'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isOnline ? 'bg-emerald-400' : 'bg-zinc-500'
              }`}
            />
            <span
              className={`px-1 py-0.5 rounded text-[11px] font-bold tracking-wide shrink-0 ${getVersionBadgeClass(
                activeProfile.gameVersion,
              )}`}
            >
              {activeProfile.gameVersion}
            </span>
            <span className="truncate">{activeProfile.name}</span>
            {activeProfile.shinyCharm && <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          </button>

          {/* Right: Seed Pill + Target Frame Pill + Lang */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowPicker(false);
                setShowTargetPopover(false);
                setShowSeedPopover((v) => !v);
              }}
              className={`flex items-center gap-1 h-10 px-2.5 rounded-full bg-zinc-900 border font-mono text-[11px] tabular-nums text-amber-300 active:scale-95 transition ${
                showSeedPopover ? 'border-amber-500' : 'border-zinc-800'
              }`}
              title={i18n.t('seed.manualHex')}
            >
              <span>{initialSeedHex}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowPicker(false);
                setShowSeedPopover(false);
                setShowTargetPopover((v) => !v);
              }}
              className={`flex items-center gap-1 h-10 px-2.5 rounded-full bg-zinc-900 border font-mono text-[11px] tabular-nums text-sky-300 active:scale-95 transition ${
                showTargetPopover ? 'border-sky-400' : 'border-zinc-800'
              }`}
              title={i18n.t('search.targetFrame')}
            >
              <Target className="w-3 h-3 text-sky-400 shrink-0" />
              <span>{targetFrame.toLocaleString()}</span>
            </button>

            <button
              type="button"
              onClick={() => setLang(lang === 'it' ? 'en' : 'it')}
              aria-label={i18n.t('profiles.language')}
              className="h-10 min-w-10 px-2.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-bold uppercase text-zinc-200 active:scale-95 transition"
            >
              {lang}
            </button>
          </div>
        </div>
      </header>

      {/* Quick Profile Switcher Dropdown */}
      {showPicker && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
          onClick={() => setShowPicker(false)}
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={i18n.t('profiles.title')}
        >
          <div
            className="header-popover max-w-xl mx-auto mt-14 px-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-2 shadow-2xl space-y-1">
              {profileStore.profiles.map((p) => {
                const active = p.id === activeProfile.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      selectProfile(p.id);
                      setShowPicker(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition ${
                      active
                        ? 'bg-amber-500/15 border border-amber-500/40 text-amber-200'
                        : 'hover:bg-zinc-800 text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getVersionBadgeClass(
                          p.gameVersion,
                        )}`}
                      >
                        {p.gameVersion}
                      </span>
                      <span className="font-medium truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs tabular-nums text-zinc-400">
                      <span>TSV {String(p.tsv).padStart(4, '0')}</span>
                      {p.shinyCharm && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                  </button>
                );
              })}

              <div className="pt-1 border-t border-zinc-800 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowPicker(false);
                    setMoreSection('profiles');
                    setActiveTab('more');
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
                  <span>{i18n.t('profiles.manage')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPicker(false);
                    setActiveGen('home');
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>{i18n.t('home.backToMenu')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Seed Editor Popover */}
      {showSeedPopover && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
          onClick={() => setShowSeedPopover(false)}
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={i18n.t('seed.manualHex')}
        >
          <div
            className="header-popover header-popover-end max-w-xl mx-auto mt-14 px-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3.5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200">
                  {i18n.t('seed.manualHex')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSeedPopover(false)}
                  aria-label={i18n.t('app.close')}
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <HexSeedInput value={initialSeedHex} onChange={setInitialSeedHex} />

              <button
                type="button"
                onClick={() => {
                  setShowSeedPopover(false);
                  setActiveTab('seed');
                }}
                className="w-full h-10 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                <span>
                  {i18n.t('nav.seed')} / {i18n.t('seed.modeQr')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Target Frame Editor Popover */}
      {showTargetPopover && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
          onClick={() => setShowTargetPopover(false)}
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={i18n.t('search.targetFrame')}
        >
          <div
            className="header-popover header-popover-end max-w-xl mx-auto mt-14 px-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3.5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  <span>{i18n.t('search.targetFrame')}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowTargetPopover(false)}
                  aria-label={i18n.t('app.close')}
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <NumberStepper
                value={targetFrame}
                min={0}
                onChange={setTargetFrame}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
