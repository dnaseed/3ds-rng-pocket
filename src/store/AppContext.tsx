import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createI18n, type Language } from '../data/i18n';
import { getStartingFrame } from '../engine/core/pokemonMath';
import { isMoonVersion, isUltraVersion } from '../engine/core/types';
import { parseHex32, toHex32 } from '../engine/math/uint';
import type { TinyState } from '../engine/rng/types';
import {
  loadProfileStore,
  saveProfileStore,
  type ProfileStoreData,
  type TrainerProfile,
} from '../services/profileStorage';
import { DEFAULT_SEED_API_BASE } from '../services/sfmtSeedApi';

export type ActiveGen = 'home' | 'gen7';
export type AppTab = 'seed' | 'stationary' | 'wild' | 'egg' | 'more';
export type MoreSection = 'event' | 'id' | 'profiles' | 'tools';
export type ClockVisualStyle = 'svg' | 'sprite';

export interface AroundTargetJump {
  tab: 'stationary' | 'wild' | 'event';
  targetFrame: number;
  nonce: number;
}

export interface TimelineJump {
  tab: 'stationary' | 'wild' | 'event';
  startFrame: number;
  nonce: number;
}

interface PersistedSettings {
  lang: Language;
  clockStyle: ClockVisualStyle;
  apiBaseUrl: string;
  initialSeedHex: string;
  startFrame: number;
  targetFrame: number;
}

const SETTINGS_KEY = 'usum_rng_settings_v1';

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PersistedSettings>;
      return {
        lang: p.lang === 'en' ? 'en' : 'it',
        clockStyle: p.clockStyle === 'sprite' ? 'sprite' : 'svg',
        apiBaseUrl: typeof p.apiBaseUrl === 'string' && p.apiBaseUrl ? p.apiBaseUrl : DEFAULT_SEED_API_BASE,
        initialSeedHex:
          typeof p.initialSeedHex === 'string' && parseHex32(p.initialSeedHex) !== null
            ? toHex32(parseHex32(p.initialSeedHex)!)
            : '00000000',
        startFrame: typeof p.startFrame === 'number' && p.startFrame >= 0 ? p.startFrame : 478,
        targetFrame: typeof p.targetFrame === 'number' && p.targetFrame >= 0 ? p.targetFrame : 5000,
      };
    }
  } catch {
    // ignore
  }
  return {
    lang: 'it',
    clockStyle: 'svg',
    apiBaseUrl: DEFAULT_SEED_API_BASE,
    initialSeedHex: '00000000',
    startFrame: 478,
    targetFrame: 5000,
  };
}

interface AppContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  i18n: ReturnType<typeof createI18n>;
  clockStyle: ClockVisualStyle;
  setClockStyle: (s: ClockVisualStyle) => void;
  apiBaseUrl: string;
  setApiBaseUrl: (url: string) => void;
  isOnline: boolean;

  activeGen: ActiveGen;
  setActiveGen: (gen: ActiveGen) => void;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  moreSection: MoreSection;
  setMoreSection: (sec: MoreSection) => void;

  profileStore: ProfileStoreData;
  activeProfile: TrainerProfile;
  isUltra: boolean;
  isMoon: boolean;
  selectProfile: (id: string) => void;
  upsertProfile: (profile: TrainerProfile) => void;
  deleteProfile: (id: string) => void;
  replaceProfileStore: (store: ProfileStoreData) => void;
  updateActiveEggSeed: (seed: TinyState) => void;

  initialSeedHex: string;
  initialSeedNum: number;
  setInitialSeedHex: (hex: string) => void;
  startFrame: number;
  setStartFrame: (f: number) => void;
  targetFrame: number;
  setTargetFrame: (f: number) => void;
  idStartFrame: number;
  setIdStartFrame: (f: number) => void;
  idClockCorrection: number;
  setIdClockCorrection: (c: number) => void;

  aroundJump: AroundTargetJump | null;
  triggerAroundTarget: (tab: 'stationary' | 'wild' | 'event', targetFrame: number) => void;
  clearAroundJump: () => void;

  timelineJump: TimelineJump | null;
  triggerTimelineFrom: (tab: 'stationary' | 'wild' | 'event', startFrame: number) => void;
  clearTimelineJump: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PersistedSettings>(() => loadSettings());
  const [profileStore, setProfileStore] = useState<ProfileStoreData>(() => loadProfileStore());
  const [activeGen, setActiveGen] = useState<ActiveGen>('home');
  const [activeTab, setActiveTab] = useState<AppTab>('seed');
  const [moreSection, setMoreSection] = useState<MoreSection>('event');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const initialIsUltra = isUltraVersion(
    (profileStore.profiles.find((p) => p.id === profileStore.activeProfileId) ??
      profileStore.profiles[0]!).gameVersion,
  );
  const [idStartFrame, setIdStartFrame] = useState<number>(getStartingFrame(initialIsUltra, 4));
  const [idClockCorrection, setIdClockCorrection] = useState<number>(0);
  const [aroundJump, setAroundJump] = useState<AroundTargetJump | null>(null);
  const [timelineJump, setTimelineJump] = useState<TimelineJump | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = settings.lang;
    }
  }, [settings]);

  useEffect(() => {
    saveProfileStore(profileStore);
  }, [profileStore]);

  useEffect(() => {
    const onUp = () => setIsOnline(true);
    const onDown = () => setIsOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  const activeProfile = useMemo(() => {
    return (
      profileStore.profiles.find((p) => p.id === profileStore.activeProfileId) ??
      profileStore.profiles[0]!
    );
  }, [profileStore]);

  const isUltra = isUltraVersion(activeProfile.gameVersion);
  const isMoon = isMoonVersion(activeProfile.gameVersion);

  const prevIsUltraRef = useRef(isUltra);
  useEffect(() => {
    if (prevIsUltraRef.current !== isUltra) {
      const oldDefaultMain = getStartingFrame(prevIsUltraRef.current, 0);
      const newDefaultMain = getStartingFrame(isUltra, 0);
      const oldDefaultId = getStartingFrame(prevIsUltraRef.current, 4);
      const newDefaultId = getStartingFrame(isUltra, 4);
      setSettings((s) =>
        s.startFrame === oldDefaultMain ? { ...s, startFrame: newDefaultMain } : s,
      );
      setIdStartFrame((f) => (f === oldDefaultId ? newDefaultId : f));
      prevIsUltraRef.current = isUltra;
    }
  }, [isUltra]);

  const setLang = useCallback((lang: Language) => setSettings((s) => ({ ...s, lang })), []);
  const setClockStyle = useCallback(
    (clockStyle: ClockVisualStyle) => setSettings((s) => ({ ...s, clockStyle })),
    [],
  );
  const setApiBaseUrl = useCallback(
    (apiBaseUrl: string) => setSettings((s) => ({ ...s, apiBaseUrl })),
    [],
  );
  const setInitialSeedHex = useCallback((hex: string) => {
    const parsed = parseHex32(hex);
    setSettings((s) => ({
      ...s,
      initialSeedHex: parsed !== null ? toHex32(parsed) : hex.toUpperCase(),
    }));
  }, []);
  const setStartFrame = useCallback(
    (startFrame: number) => setSettings((s) => ({ ...s, startFrame })),
    [],
  );
  const setTargetFrame = useCallback(
    (targetFrame: number) => setSettings((s) => ({ ...s, targetFrame })),
    [],
  );

  const selectProfile = useCallback((id: string) => {
    setProfileStore((prev) => ({ ...prev, activeProfileId: id }));
  }, []);

  const upsertProfile = useCallback((profile: TrainerProfile) => {
    setProfileStore((prev) => {
      const exists = prev.profiles.some((p) => p.id === profile.id);
      const profiles = exists
        ? prev.profiles.map((p) => (p.id === profile.id ? profile : p))
        : [...prev.profiles, profile];
      return { ...prev, activeProfileId: profile.id, profiles };
    });
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setProfileStore((prev) => {
      if (prev.profiles.length <= 1) return prev;
      const profiles = prev.profiles.filter((p) => p.id !== id);
      const activeProfileId =
        prev.activeProfileId === id ? profiles[0]!.id : prev.activeProfileId;
      return { ...prev, activeProfileId, profiles };
    });
  }, []);

  const replaceProfileStore = useCallback((store: ProfileStoreData) => {
    setProfileStore(store);
  }, []);

  const updateActiveEggSeed = useCallback((seed: TinyState) => {
    setProfileStore((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === prev.activeProfileId ? { ...p, eggSeed: [...seed] as TinyState } : p,
      ),
    }));
  }, []);

  const triggerAroundTarget = useCallback(
    (tab: 'stationary' | 'wild' | 'event', targetFrameVal: number) => {
      setTargetFrame(targetFrameVal);
      if (tab === 'event') {
        setMoreSection('event');
        setActiveTab('more');
      } else {
        setActiveTab(tab);
      }
      setAroundJump({ tab, targetFrame: targetFrameVal, nonce: Date.now() });
    },
    [setTargetFrame],
  );

  const clearAroundJump = useCallback(() => setAroundJump(null), []);

  const triggerTimelineFrom = useCallback(
    (tab: 'stationary' | 'wild' | 'event', startFrameVal: number) => {
      setStartFrame(startFrameVal);
      if (tab === 'event') {
        setMoreSection('event');
        setActiveTab('more');
      } else {
        setActiveTab(tab);
      }
      setTimelineJump({ tab, startFrame: startFrameVal, nonce: Date.now() });
    },
    [setStartFrame],
  );

  const clearTimelineJump = useCallback(() => setTimelineJump(null), []);

  const i18n = useMemo(() => createI18n(settings.lang), [settings.lang]);
  const initialSeedNum = useMemo(
    () => parseHex32(settings.initialSeedHex) ?? 0,
    [settings.initialSeedHex],
  );

  const value: AppContextValue = {
    lang: settings.lang,
    setLang,
    i18n,
    clockStyle: settings.clockStyle,
    setClockStyle,
    apiBaseUrl: settings.apiBaseUrl,
    setApiBaseUrl,
    isOnline,
    activeGen,
    setActiveGen,
    activeTab,
    setActiveTab,
    moreSection,
    setMoreSection,
    profileStore,
    activeProfile,
    isUltra,
    isMoon,
    selectProfile,
    upsertProfile,
    deleteProfile,
    replaceProfileStore,
    updateActiveEggSeed,
    initialSeedHex: settings.initialSeedHex,
    initialSeedNum,
    setInitialSeedHex,
    startFrame: settings.startFrame,
    setStartFrame,
    targetFrame: settings.targetFrame,
    setTargetFrame,
    idStartFrame,
    setIdStartFrame,
    idClockCorrection,
    setIdClockCorrection,
    aroundJump,
    triggerAroundTarget,
    clearAroundJump,
    timelineJump,
    triggerTimelineFrom,
    clearTimelineJump,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
