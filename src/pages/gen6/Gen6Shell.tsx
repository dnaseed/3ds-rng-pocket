import { ArrowLeft, Clock, Fingerprint, Sparkles, Users, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  loadProfileStore6, loadSession6, saveProfileStore6, saveSession6, type ProfileStore6, type Session6,
} from '../../services/gen6Storage';
import { useApp } from '../../store/AppContext';
import { Seed6Page } from './Seed6Page';
import { Timeline6Page } from './Timeline6Page';
import { Stationary6Page } from './Stationary6Page';
import { Id6Page } from './Id6Page';
import { Wild6Page } from './Wild6Page';
import { Egg6Page } from './Egg6Page';
import { Event6Page } from './Event6Page';
import { Pokerus6Page } from './Pokerus6Page';
import { Finder6Page } from './Finder6Page';
import { Profiles6Page } from './Profiles6Page';

const tabs = [
  { id: 'seed', label: 'nav.seed', icon: Clock },
  { id: 'stationary', label: 'nav.stationary', icon: Sparkles },
  { id: 'wild', label: 'nav.wild', icon: Sparkles },
  { id: 'egg', label: 'nav.egg', icon: Sparkles },
  { id: 'event', label: 'nav.event', icon: Sparkles },
  { id: 'id', label: null, icon: Fingerprint },
  { id: 'tools', label: 'misc.tools', icon: Clock },
  { id: 'profiles', label: 'profiles.shortTitle', icon: Users },
] as const;

type Tab = (typeof tabs)[number]['id'];

export default function Gen6Shell() {
  const { i18n, lang, setLang, isOnline, setActiveGen } = useApp();
  const [tab, setTab] = useState<Tab>('seed');
  const [seedMode, setSeedMode] = useState<'mt' | 'timeline' | 'finder'>('mt');
  const [more,setMore] = useState(false);
  const [store, setStore] = useState(loadProfileStore6);
  const [session, setSession] = useState(loadSession6);
  const [profileSaveFailed, setProfileSaveFailed] = useState(false);
  const [sessionSaveFailed, setSessionSaveFailed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const profile = store.profiles.find(entry => entry.id === store.activeProfileId) ?? store.profiles[0]!;

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, [tab]);

  useEffect(() => {
    try {
      saveProfileStore6(store);
      setProfileSaveFailed(false);
    } catch {
      setProfileSaveFailed(true);
    }
  }, [store]);

  useEffect(() => {
    try {
      saveSession6(session);
      setSessionSaveFailed(false);
    } catch {
      setSessionSaveFailed(true);
    }
  }, [session]);

  const updateSession = (next: Partial<Session6>) => setSession(current => ({ ...current, ...next }));
  const updateStore = (next: ProfileStore6) => setStore(next);
  const profileScope = JSON.stringify(profile);
  const primaryTabs = tabs.slice(0,4);
  const nav = (mobile: boolean, secondary = false) => (secondary ? tabs.slice(4) : mobile ? primaryTabs : tabs).map(({ id, label, icon: Icon }) => (
    <button key={id} type="button" aria-current={tab === id ? 'page' : undefined}
      onClick={() => {setTab(id);setMore(false);}}
      className={mobile
        ? 'flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium text-zinc-400 aria-[current=page]:text-amber-300'
        : 'min-h-11 px-3 border-b-2 border-transparent text-sm text-zinc-300 aria-[current=page]:border-amber-400 aria-[current=page]:text-amber-200'}>
      {mobile && <Icon size={19} aria-hidden="true" />}
      {label ? i18n.t(label) : 'ID RNG'}
    </button>
  ));

  return <div className="app-shell min-h-dvh bg-zinc-950 text-zinc-100 flex flex-col">
    <header className="border-b border-zinc-800 bg-zinc-950 safe-pt">
      <div className="mx-auto flex w-full max-w-xl lg:max-w-[1440px] items-center gap-2 px-3 lg:px-6 py-2">
        <button type="button" aria-label={i18n.t('home.backToMenu')} title={i18n.t('home.backToMenu')}
          onClick={() => setActiveGen('home')} className="grid size-10 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-900">
          <ArrowLeft size={17} aria-hidden="true" />
        </button>
        <div className="shrink-0 leading-tight">
          <div className="text-xs font-bold">Gen 6</div>
          <div className="text-[11px] text-amber-300 font-mono tabular-nums">{session.initialSeedHex}</div>
        </div>
        <select aria-label={i18n.t('gen6.currentProfile')} value={profile.id}
          className="min-h-10 min-w-0 max-w-72 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 pl-2 text-xs"
          onChange={event => setStore(current => ({ ...current, activeProfileId: event.target.value }))}>
          {store.profiles.map(entry => <option key={entry.id} value={entry.id}>{entry.gameVersion} · {entry.name}</option>)}
        </select>
        {!isOnline && <span title={i18n.t('app.offline')} aria-label={i18n.t('app.offline')} className="text-amber-400 shrink-0"><WifiOff size={15} /></span>}
        <button type="button" aria-label={i18n.t('profiles.language')} onClick={() => setLang(lang === 'it' ? 'en' : 'it')}
          className="h-10 px-2 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-bold uppercase">
          {lang}
        </button>
      </div>
      <nav aria-label={i18n.t('gen6.navigation')} className="hidden lg:flex mx-auto max-w-[1440px] px-6 gap-2">{nav(false)}</nav>
      {(profileSaveFailed || sessionSaveFailed) &&
        <p role="alert" className="px-3 py-1 text-xs text-rose-300">{i18n.t('gen6.storageError')}</p>}
    </header>
    <main ref={mainRef} className="flex-1 w-full max-w-xl mx-auto px-3 pt-3">
      {more && <div className="lg:hidden grid grid-cols-2 gap-2 p-2">{nav(false,true)}</div>}
      {tab === 'seed' && <><div className="flex flex-wrap gap-2 py-2">{(['mt','timeline','finder'] as const).map(mode => <button key={mode} className="px-3 py-2 rounded-lg bg-zinc-900 aria-pressed:text-amber-300" aria-pressed={mode === seedMode} onClick={() => setSeedMode(mode)}>{mode === 'mt' ? 'Seed MT' : mode === 'finder' ? 'MT Seed Finder' : 'TinyMT Timeline'}</button>)}</div>
        {seedMode === 'mt' ? <Seed6Page session={session} updateSession={updateSession} onStationary={() => setTab('stationary')} /> : seedMode === 'finder' ? <Finder6Page seed={session.initialSeedHex} apply={initialSeedHex=>{updateSession({initialSeedHex});setSeedMode('mt');}}/> : <Timeline6Page key={profileScope} game={profile.gameVersion} saved={session.timeline} onSave={timeline=>updateSession({timeline})}/>}</>}
      {tab === 'egg' && <Egg6Page key={profileScope} profile={profile} session={session} updateSession={updateSession}/>}
      {tab === 'event' && <Event6Page key={profileScope} profile={profile} session={session} updateSession={updateSession}/>}
      {tab === 'tools' && <Pokerus6Page key={profileScope} profile={profile} session={session} updateSession={updateSession}/>}
      {tab === 'stationary' && <Stationary6Page key={profileScope} profile={profile} session={session} updateSession={updateSession} />}
      {tab === 'wild' && <Wild6Page key={profileScope} profile={profile} session={session} updateSession={updateSession} />}
      {tab === 'id' && <Id6Page key={profileScope} scope={profileScope} session={session} updateSession={updateSession} />}
      {tab === 'profiles' && <Profiles6Page store={store} updateStore={updateStore} />}
    </main>
    <nav aria-label={i18n.t('gen6.navigation')}
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-950/95 border-t border-zinc-800 safe-pb">
      <div className="max-w-xl mx-auto grid grid-cols-5 h-15">{nav(true)}<button aria-expanded={more} className="text-xs" onClick={()=>{setMore(!more);mainRef.current?.scrollTo(0,0);window.scrollTo(0,0);}}>{i18n.t('nav.more')}</button></div>
    </nav>
  </div>;
}
