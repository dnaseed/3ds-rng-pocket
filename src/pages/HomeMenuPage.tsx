import { ArrowRight, Lock, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { useApp } from '../store/AppContext';

export function HomeMenuPage() {
  const { i18n, lang, setLang, isOnline, setActiveGen } = useApp();

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100 flex flex-col safe-pt safe-pb">
      {/* Top Bar */}
      <div className="max-w-xl lg:max-w-6xl lg:px-8 w-full mx-auto px-4 pt-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-medium text-zinc-300">
          {isOnline ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>{isOnline ? i18n.t('app.online') : i18n.t('app.offline')}</span>
        </span>

        <button
          type="button"
          onClick={() => setLang(lang === 'it' ? 'en' : 'it')}
          className="h-9 min-w-10 px-3 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-bold uppercase text-zinc-200 active:scale-95 transition"
        >
          {lang}
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-xl lg:max-w-6xl lg:px-8 w-full mx-auto px-4 py-6 flex flex-col justify-center space-y-6 lg:grid lg:grid-cols-[2fr_3fr] lg:items-center lg:gap-16 lg:space-y-0">
        {/* Brand Hero */}
        <div className="text-center space-y-3 lg:text-left lg:space-y-5">
          <div className="mx-auto lg:mx-0 w-20 h-20 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl shadow-amber-500/10 bg-zinc-950">
            <img
              src="./icons/icon-192.png"
              alt={i18n.t('app.title')}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl lg:text-4xl font-extrabold tracking-tight text-zinc-100">
              {i18n.t('app.title')}
            </h1>
            <p className="text-xs lg:text-base lg:max-w-sm text-zinc-400">{i18n.t('home.tagline')}</p>
          </div>
        </div>

        {/* Generation Cards */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
            {i18n.t('home.chooseGen')}
          </div>

          {/* Gen 7 Card (Active) */}
          <button
            type="button"
            onClick={() => setActiveGen('gen7')}
            className="w-full text-left rounded-3xl bg-zinc-900 border border-amber-500/45 p-4 lg:p-6 space-y-3 shadow-lg shadow-amber-500/5 active:scale-[0.99] transition hover:border-amber-400/70"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-base font-extrabold text-zinc-100">
                    {i18n.t('home.gen7Title')}
                  </span>
                </div>
                <div className="text-xs font-semibold text-amber-300">
                  {i18n.t('home.gen7Games')}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold shrink-0">
                {i18n.t('home.active')}
              </span>
            </div>

            <p className="text-xs lg:text-sm text-zinc-300 leading-relaxed">{i18n.t('home.gen7Desc')}</p>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-300 font-mono text-[11px] font-bold">
                  US
                </span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-mono text-[11px] font-bold">
                  UM
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 font-mono text-[11px] font-bold">
                  S
                </span>
                <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 font-mono text-[11px] font-bold">
                  M
                </span>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold shrink-0">
                <span>{i18n.t('home.openGen')}</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </button>

          {/* Gen 6 Card (Locked / Coming Soon) */}
          <div
            aria-disabled="true"
            className="w-full rounded-3xl bg-zinc-900/50 border border-zinc-800/90 p-4 space-y-2.5 opacity-65 select-none"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="text-base font-bold text-zinc-200">
                    {i18n.t('home.gen6Title')}
                  </span>
                </div>
                <div className="text-xs font-medium text-sky-300/80">
                  {i18n.t('home.gen6Games')}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-semibold shrink-0">
                {i18n.t('home.comingSoon')}
              </span>
            </div>

            <p className="lg:hidden text-xs text-zinc-400 leading-relaxed">{i18n.t('home.gen6Desc')}</p>

            <div className="lg:hidden flex items-center gap-1.5 pt-0.5">
              {['X', 'Y', 'OR', 'AS'].map((v) => (
                <span
                  key={v}
                  className="px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 font-mono text-[11px] font-bold"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-xl lg:max-w-6xl lg:px-8 w-full mx-auto px-4 pb-4 text-center text-[11px] text-zinc-400">
        {i18n.t('home.credits')}
      </footer>
    </div>
  );
}
