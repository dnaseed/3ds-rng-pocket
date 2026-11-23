import { BottomNav } from './components/layout/BottomNav';
import { TopHeader } from './components/layout/TopHeader';
import { EggPage } from './pages/EggPage';
import { EventPage } from './pages/EventPage';
import { HomeMenuPage } from './pages/HomeMenuPage';
import { IdPage } from './pages/IdPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { SeedPage } from './pages/SeedPage';
import { StationaryPage } from './pages/StationaryPage';
import { WildPage } from './pages/WildPage';
import { AppProvider, useApp, type MoreSection } from './store/AppContext';

function AppShell() {
  const { activeGen, activeTab, setActiveTab, moreSection, setMoreSection, i18n } = useApp();

  if (activeGen === 'home') {
    return <HomeMenuPage />;
  }

  return (
    <div className="app-shell min-h-dvh bg-zinc-950 text-zinc-100 flex flex-col">
      <TopHeader />

      <nav className="hidden lg:flex w-full max-w-[1440px] mx-auto px-6 gap-2 border-b border-zinc-800">
        {(['seed', 'stationary', 'wild', 'egg', 'event', 'id', 'profiles'] as const).map((tab) => {
          const secondary = tab === 'event' || tab === 'id' || tab === 'profiles';
          const active = secondary ? activeTab === 'more' && moreSection === tab : activeTab === tab;
          const label = tab === 'event' ? 'Event' : tab === 'id' ? 'ID RNG' : tab === 'profiles' ? i18n.t('profiles.title') : i18n.t(`nav.${tab}`);
          return (
            <button key={tab} aria-current={active ? 'page' : undefined}
              className="min-h-11 px-3 border-b-2 border-transparent text-sm text-zinc-300 aria-[current=page]:border-amber-400 aria-[current=page]:text-amber-200"
              onClick={() => {
                if (secondary) setMoreSection(tab);
                setActiveTab(secondary ? 'more' : tab);
              }}
            >{label}</button>
          );
        })}
      </nav>
      <main className="flex-1 max-w-xl w-full mx-auto px-3 pt-3">
        {activeTab === 'seed' && <SeedPage />}
        {activeTab === 'stationary' && <StationaryPage />}
        {activeTab === 'wild' && <WildPage />}
        {activeTab === 'egg' && <EggPage />}

        {activeTab === 'more' && (
          <div className="more-page space-y-3">
            <div className="lg:hidden grid grid-cols-3 gap-1 p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
              {(
                [
                  { id: 'event', label: 'Event' },
                  { id: 'id', label: 'ID RNG' },
                  { id: 'profiles', label: i18n.t('profiles.title') },
                ] as { id: MoreSection; label: string }[]
              ).map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setMoreSection(sec.id)}
                  aria-pressed={moreSection === sec.id}
                  className="choice-button min-h-10 rounded-xl text-xs font-semibold transition px-2 truncate"
                >
                  {sec.label}
                </button>
              ))}
            </div>

            {moreSection === 'event' && <EventPage />}
            {moreSection === 'id' && <IdPage />}
            {moreSection === 'profiles' && <ProfilesPage />}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
