import { lazy, Suspense } from 'react';
import { BottomNav, SectionNavigation } from './components/layout/BottomNav';
import { TopHeader } from './components/layout/TopHeader';
import { EggPage } from './pages/EggPage';
import { EventPage } from './pages/EventPage';
import { HomeMenuPage } from './pages/HomeMenuPage';
import { IdPage } from './pages/IdPage';
import { MiscPage } from './pages/MiscPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { SeedPage } from './pages/SeedPage';
import { StationaryPage } from './pages/StationaryPage';
import { WildPage } from './pages/WildPage';
import { AppProvider, useApp } from './store/AppContext';

const Gen6Shell = lazy(() => import('./pages/gen6/Gen6Shell'));

function AppShell() {
  const { activeGen, activeTab, moreSection, selectSection7, i18n } = useApp();

  if (activeGen === 'home') {
    return <HomeMenuPage />;
  }
  if (activeGen === 'gen6') {
    return <Suspense fallback={<p className="p-4 text-zinc-300">{i18n.t('gen6.loading')}</p>}><Gen6Shell /></Suspense>;
  }

  const activeSection = activeTab === 'more' ? moreSection : activeTab;
  return (
    <div className="app-shell min-h-dvh bg-zinc-950 text-zinc-100 flex flex-col">
      <TopHeader />

      <SectionNavigation active={activeSection} select={selectSection7} />
      <main className="flex-1 max-w-xl w-full mx-auto px-3 pt-3">
        {activeTab === 'seed' && <SeedPage />}
        {activeTab === 'stationary' && <StationaryPage />}
        {activeTab === 'wild' && <WildPage />}
        {activeTab === 'egg' && <EggPage />}

        {activeTab === 'more' && (
          <div className="more-page space-y-3">
            <SectionNavigation active={moreSection} select={selectSection7} secondary />

            {moreSection === 'event' && <EventPage />}
            {moreSection === 'id' && <IdPage />}
            {moreSection === 'tools' && <MiscPage />}
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
