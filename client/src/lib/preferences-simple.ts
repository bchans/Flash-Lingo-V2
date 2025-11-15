import { create } from 'zustand';

interface LanguagePreferences {
  nativeLang: string;
  learningLang: string;
}

export type HintName = 'styleToggle' | 'offlineMode' | 'memoryAid' | 'studyModes' | 'editText' | 'dragAndDrop';

interface HintCounter {
  [key: string]: number;
}

export interface MenuItem {
  id: string;
  title: string;
  path: string;
  description: string;
  emojiIcon: string;
  iconComponent: string;
}

export const DEFAULT_MENU_ITEMS: MenuItem[] = [
  {
    id: 'create',
    title: 'Create Card',
    path: '/create',
    description: 'Create new translation cards with AI assistance',
    emojiIcon: '✍️',
    iconComponent: 'Plus'
  },
  {
    id: 'study',
    title: 'Study Cards',
    path: '/study',
    description: 'Review your flashcards with various study modes',
    emojiIcon: '📚',
    iconComponent: 'BookOpen'
  },
  {
    id: 'scan',
    title: 'Scan Text',
    path: '/scan',
    description: 'Extract flashcards from images or text',
    emojiIcon: '📸',
    iconComponent: 'Camera'
  },
  {
    id: 'my-cards',
    title: 'My Cards',
    path: '/my-cards',
    description: 'Manage and organize your flashcard collection',
    emojiIcon: '🗂️',
    iconComponent: 'FolderOpen'
  },
  {
    id: 'stats',
    title: 'Statistics',
    path: '/stats',
    description: 'Track your learning progress and achievements',
    emojiIcon: '📊',
    iconComponent: 'BarChart3'
  }
];

interface PreferencesState {
  hasCompletedOnboarding: boolean;
  useEmojiMode: boolean;
  languages: LanguagePreferences;
  hintCounters: HintCounter;
  currentHintIndex: number;
  menuItems: MenuItem[];
  showAchievementNotifications: boolean;
  setLanguages: (languages: LanguagePreferences) => void;
  completeOnboarding: () => void;
  toggleEmojiMode: () => void;
  incrementHintCounter: (hintName: HintName) => void;
  rotateHintIndex: () => void;
  shouldShowHint: (hintName: HintName) => boolean;
  updateMenuOrder: (newOrder: MenuItem[]) => void;
  toggleAchievementNotifications: () => void;
}

export const HINTS: Record<HintName, string> = {
  'styleToggle': 'Try clicking the emoji icons to switch between styles!',
  'offlineMode': 'This app works offline! Your data stays in your browser.',
  'memoryAid': 'Click "New Idea" to get different types of memory aids.',
  'studyModes': 'Drag and drop to reorder your favorite study modes!',
  'editText': 'Click any text to edit it directly.',
  'dragAndDrop': 'You can drag and drop items to reorder them!'
};

const MAX_HINT_COUNT = 3;

// Initialize with persisted values
const getInitialState = () => {
  const savedOnboarding = localStorage.getItem('hasCompletedOnboarding');
  const savedEmojiMode = localStorage.getItem('useEmojiMode');
  const savedSourceLang = localStorage.getItem('defaultSourceLang');
  const savedTargetLang = localStorage.getItem('defaultTargetLang');
  const savedAchievementNotifications = localStorage.getItem('showAchievementNotifications');
  const savedHintCounters = localStorage.getItem('hintCounters');
  const savedMenuItems = localStorage.getItem('menuItems');
  
  return {
    hasCompletedOnboarding: savedOnboarding === 'true',
    useEmojiMode: savedEmojiMode !== 'false',
    languages: {
      nativeLang: savedSourceLang || 'en',
      learningLang: savedTargetLang || 'vi'
    },
    hintCounters: savedHintCounters ? JSON.parse(savedHintCounters) : {
      styleToggle: 0,
      offlineMode: 0,
      memoryAid: 0,
      studyModes: 0,
      editText: 0,
      dragAndDrop: 0
    },
    currentHintIndex: 0,
    menuItems: savedMenuItems ? JSON.parse(savedMenuItems) : DEFAULT_MENU_ITEMS,
    showAchievementNotifications: savedAchievementNotifications !== 'false'
  };
};

export const usePreferences = create<PreferencesState>((set, get) => ({
  ...getInitialState(),

  setLanguages: (languages) => {
    set({ languages });
    localStorage.setItem('defaultSourceLang', languages.nativeLang);
    localStorage.setItem('defaultTargetLang', languages.learningLang);
  },

  completeOnboarding: () => {
    set({ hasCompletedOnboarding: true });
    localStorage.setItem('hasCompletedOnboarding', 'true');
  },

  toggleEmojiMode: () => set((state) => {
    const newEmojiMode = !state.useEmojiMode;
    localStorage.setItem('useEmojiMode', newEmojiMode.toString());
    return { useEmojiMode: newEmojiMode };
  }),

  incrementHintCounter: (hintName) => set((state) => {
    const newCounters = {
      ...state.hintCounters,
      [hintName]: (state.hintCounters[hintName] || 0) + 1
    };
    localStorage.setItem('hintCounters', JSON.stringify(newCounters));
    return { hintCounters: newCounters };
  }),

  rotateHintIndex: () => set((state) => {
    const availableHints = Object.entries(state.hintCounters)
      .filter(([_, count]) => count < MAX_HINT_COUNT)
      .map(([name, _]) => name);
    
    if (availableHints.length === 0) {
      return state;
    }
    
    return {
      currentHintIndex: (state.currentHintIndex + 1) % availableHints.length
    };
  }),

  shouldShowHint: (hintName) => {
    const state = get();
    return (state.hintCounters[hintName] || 0) < MAX_HINT_COUNT;
  },

  updateMenuOrder: (newOrder) => {
    set({ menuItems: newOrder });
    localStorage.setItem('menuItems', JSON.stringify(newOrder));
  },

  toggleAchievementNotifications: () => set((state) => {
    const newNotifications = !state.showAchievementNotifications;
    localStorage.setItem('showAchievementNotifications', newNotifications.toString());
    return { showAchievementNotifications: newNotifications };
  })
}));