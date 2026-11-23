import { Clock, Compass, Egg, MoreHorizontal, Sparkles } from 'lucide-react';
import { useApp, type AppTab } from '../../store/AppContext';

export function BottomNav() {
  const { activeTab, setActiveTab, i18n } = useApp();

  const items: { id: AppTab; label: string; icon: typeof Clock }[] = [
    { id: 'seed', label: i18n.t('nav.seed'), icon: Clock },
    { id: 'stationary', label: i18n.t('nav.stationary'), icon: Sparkles },
    { id: 'wild', label: i18n.t('nav.wild'), icon: Compass },
    { id: 'egg', label: i18n.t('nav.egg'), icon: Egg },
    { id: 'more', label: i18n.t('nav.more'), icon: MoreHorizontal },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80 safe-pb">
      <div className="max-w-xl mx-auto grid grid-cols-5 h-15">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
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
