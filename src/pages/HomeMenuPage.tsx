import { ArrowRight, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { getVersionBadgeClass, type HeaderVersion } from '../components/layout/TopHeader';
import { useApp } from '../store/AppContext';

export function HomeMenuPage() {
  const { i18n, lang, setLang, isOnline } = useApp();

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

          <GenerationCard generation="gen7" versions={['US', 'UM', 'S', 'M']} />
          <GenerationCard generation="gen6" versions={['X', 'Y', 'OR', 'AS']} />
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-xl lg:max-w-6xl lg:px-8 w-full mx-auto px-4 pb-4 text-center text-[11px] text-zinc-400">
        {i18n.t('home.credits')}
      </footer>
    </div>
  );
}

function GenerationCard({ generation, versions }: { generation: 'gen6' | 'gen7'; versions: HeaderVersion[] }) {
  const { i18n, setActiveGen } = useApp();
  const gen6 = generation === 'gen6';
  return (
    <button type="button" onClick={() => setActiveGen(generation)}
      className={`w-full rounded-3xl bg-zinc-900 border p-4 lg:p-6 space-y-3 text-left shadow-lg active:scale-[0.99] transition ${gen6
        ? 'border-sky-500/45 shadow-sky-500/5 hover:border-sky-400/70'
        : 'border-amber-500/45 shadow-amber-500/5 hover:border-amber-400/70'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className={`size-4 shrink-0 ${gen6 ? 'text-sky-400' : 'text-amber-400'}`} />
            <span className="text-base font-extrabold">{i18n.t(`home.${generation}Title`)}</span>
          </div>
          <div className={`text-xs font-semibold ${gen6 ? 'text-sky-300' : 'text-amber-300'}`}>
            {i18n.t(`home.${generation}Games`)}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
          {i18n.t('home.active')}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-zinc-300 lg:text-sm">{i18n.t(`home.${generation}Desc`)}</p>
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap gap-1.5">
          {versions.map(version => <span key={version} className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${getVersionBadgeClass(version)}`}>{version}</span>)}
        </div>
        <span className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 text-xs font-bold text-zinc-950">
          {i18n.t('home.openGen')} <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </div>
    </button>
  );
}
