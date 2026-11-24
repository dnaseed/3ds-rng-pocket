import { useEffect, useRef, useState } from 'react';
import {
  loadProfileStore6, loadSession6, saveProfileStore6, saveSession6, type ProfileStore6, type Session6,
} from '../../services/gen6Storage';
import { GenerationHeader } from '../../components/layout/TopHeader';
import { MobileNavigation, SectionNavigation, secondaryTabs, type NavigationSection } from '../../components/layout/BottomNav';
import { computeTsvTrv } from '../../services/profileStorage';
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

export default function Gen6Shell() {
  const { i18n } = useApp();
  const [tab, setTab] = useState<NavigationSection>('seed');
  const [seedMode, setSeedMode] = useState<'mt' | 'timeline' | 'finder'>('mt');
  const [moreSection, setMoreSection] = useState<(typeof secondaryTabs)[number]>('event');
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
  const profiles = store.profiles.map(entry => ({ ...entry, ...computeTsvTrv(entry.tid, entry.sid) }));
  const secondary = secondaryTabs.some(section => section === tab);
  const selectSection = (section: NavigationSection) => {
    if (section === 'event' || section === 'id' || section === 'tools' || section === 'profiles') setMoreSection(section);
    setTab(section);
  };

  return <div className="app-shell min-h-dvh bg-zinc-950 text-zinc-100 flex flex-col">
    <GenerationHeader mt activeProfile={{ ...profile, ...computeTsvTrv(profile.tid, profile.sid) }}
      profiles={profiles} selectProfile={id => setStore(current => ({ ...current, activeProfileId: id }))}
      initialSeedHex={session.initialSeedHex} setInitialSeedHex={initialSeedHex => updateSession({ initialSeedHex })}
      targetFrame={session.targetFrame} setTargetFrame={targetFrame => updateSession({ targetFrame })}
      openProfiles={() => selectSection('profiles')} openSeed={() => { setTab('seed'); setSeedMode('mt'); }} />
    <SectionNavigation active={tab} select={selectSection} />
    {(profileSaveFailed || sessionSaveFailed) &&
      <p role="alert" className="px-3 py-1 text-xs text-rose-300">{i18n.t('gen6.storageError')}</p>}
    <main ref={mainRef} className="flex-1 w-full max-w-xl mx-auto px-3 pt-3">
      {secondary && <SectionNavigation active={tab} select={selectSection} secondary />}
      {tab === 'seed' && <div className="gen6-seed-view"><div className="grid grid-cols-3 gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 p-1 mb-2">{(['mt','timeline','finder'] as const).map(mode => <button key={mode} className="choice-button min-h-10 rounded-xl px-1 text-xs font-semibold" aria-pressed={mode === seedMode} onClick={() => setSeedMode(mode)}>{mode === 'mt' ? 'Seed MT' : mode === 'finder' ? 'MT Seed Finder' : 'TinyMT Timeline'}</button>)}</div>
        {seedMode === 'mt' ? <Seed6Page session={session} updateSession={updateSession} onStationary={() => setTab('stationary')} /> : seedMode === 'finder' ? <Finder6Page seed={session.initialSeedHex} apply={initialSeedHex=>{updateSession({initialSeedHex});setSeedMode('mt');}}/> : <Timeline6Page key={profileScope} game={profile.gameVersion} saved={session.timeline} onSave={timeline=>updateSession({timeline})}/>}</div>}
      {tab === 'egg' && <Egg6Page key={profileScope} profile={profile} session={session} updateSession={updateSession}/>}
      {tab === 'event' && <Event6Page key={profileScope} profile={profile} session={session} updateSession={updateSession}/>}
      {tab === 'tools' && <Pokerus6Page key={profileScope} profile={profile} session={session} updateSession={updateSession}/>}
      {tab === 'stationary' && <Stationary6Page key={profileScope} profile={profile} session={session} updateSession={updateSession} />}
      {tab === 'wild' && <Wild6Page key={profileScope} profile={profile} session={session} updateSession={updateSession} />}
      {tab === 'id' && <Id6Page key={profileScope} scope={profileScope} session={session} updateSession={updateSession} />}
      {tab === 'profiles' && <Profiles6Page store={store} updateStore={updateStore} />}
    </main>
    <MobileNavigation activeTab={secondary ? 'more' : tab as 'seed' | 'stationary' | 'wild' | 'egg'}
      selectTab={item => selectSection(item === 'more' ? moreSection : item)} />
  </div>;
}
