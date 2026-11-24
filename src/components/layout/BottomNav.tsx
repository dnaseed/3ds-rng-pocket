import { Clock, Compass, Egg, MoreHorizontal, Sparkles } from 'lucide-react';
import { useApp, type AppTab } from '../../store/AppContext';

export function BottomNav() {
  const { activeTab, setActiveTab } = useApp();
  return <MobileNavigation activeTab={activeTab} selectTab={setActiveTab} />;
}

export function MobileNavigation({ activeTab, selectTab }: { activeTab: AppTab; selectTab: (tab: AppTab) => void }) {
  const { i18n } = useApp();

  const items: { id: AppTab; label: string; icon: typeof Clock }[] = [
    { id: 'seed', label: i18n.t('nav.seed'), icon: Clock },
    { id: 'stationary', label: i18n.t('nav.stationary'), icon: Sparkles },
    { id: 'wild', label: i18n.t('nav.wild'), icon: Compass },
    { id: 'egg', label: i18n.t('nav.egg'), icon: Egg },
    { id: 'more', label: i18n.t('nav.more'), icon: MoreHorizontal },
  ];

  return (
    <nav aria-label={i18n.t('nav.navigation')} className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80 safe-pb">
      <div className="max-w-xl mx-auto grid grid-cols-5 h-15">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => selectTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 transition active:scale-95 ${
                active ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.3]' : 'stroke-[1.8]'}`} />
              <span className="text-[11px] font-medium tracking-tight leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export const secondaryTabs = ['event', 'id', 'tools', 'profiles'] as const;
export type NavigationSection = Exclude<AppTab, 'more'> | (typeof secondaryTabs)[number];

export function SectionNavigation({ active, select, secondary = false }: {
  active: NavigationSection;
  select: (section: NavigationSection) => void;
  secondary?: boolean;
}) {
  const { i18n } = useApp();
  const sections = secondary ? secondaryTabs : ['seed', 'stationary', 'wild', 'egg', ...secondaryTabs] as const;
  return <nav aria-label={i18n.t(secondary ? 'nav.more' : 'nav.navigation')}
    className={secondary
      ? 'lg:hidden grid grid-cols-4 gap-1 p-1 rounded-2xl bg-zinc-900 border border-zinc-800'
      : 'hidden lg:flex w-full max-w-[1440px] mx-auto px-6 gap-2 border-b border-zinc-800'}>
    {sections.map(section => <button key={section} type="button" aria-current={active === section ? 'page' : undefined}
      aria-pressed={secondary ? active === section : undefined}
      onClick={() => select(section)}
      className={secondary ? 'choice-button min-h-10 rounded-xl px-1.5 text-xs font-semibold truncate'
        : 'min-h-11 px-3 border-b-2 border-transparent text-sm text-zinc-300 aria-[current=page]:border-amber-400 aria-[current=page]:text-amber-200'}>
      {section === 'id' ? 'ID RNG' : i18n.t(section === 'tools' ? 'misc.tools' : section === 'profiles' ? (secondary ? 'profiles.shortTitle' : 'profiles.title') : `nav.${section}`)}
    </button>)}
  </nav>;
}
