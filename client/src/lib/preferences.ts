import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface LanguagePreferences {
  nativeLang: string;
  learningLang: string;
}

// Track hints for UI tips and how many times they've been shown
export type HintName = 'styleToggle' | 'offlineMode' | 'memoryAid' | 'studyModes' | 'editText' | 'dragAndDrop';

interface HintCounter {
  [key: string]: number; // How many times each hint has been shown
}

// Menu item definitions
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
  // Menu ordering
  menuItems: MenuItem[];
  showAchievementNotifications: boolean;
  // Actions
  setLanguages: (languages: LanguagePreferences) => void;
  completeOnboarding: () => void;
  toggleEmojiMode: () => void;
  incrementHintCounter: (hintName: HintName) => void;
  rotateHintIndex: () => void;
  shouldShowHint: (hintName: HintName) => boolean;
  // Menu ordering
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

// Maximum times to show each hint before hiding it permanently
const MAX_HINT_COUNT = 3;

export const usePreferences = create<PreferencesState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      useEmojiMode: true, // Set to true initially so emoji is the default style
      languages: {
        nativeLang: 'en',
        learningLang: 'vi'
      },
      hintCounters: {
        styleToggle: 0,
        offlineMode: 0,
        memoryAid: 0,
        studyModes: 0,
        editText: 0,
        dragAndDrop: 0
      },
      currentHintIndex: 0,
      menuItems: DEFAULT_MENU_ITEMS,
      showAchievementNotifications: true,

      setLanguages: (languages) => {
        console.log('Preferences - Setting Languages:', languages);
        set({ languages });
        console.log('Preferences - After Set:', get().languages);

        // Update default form values for create card page
        localStorage.setItem('defaultSourceLang', languages.nativeLang);
        localStorage.setItem('defaultTargetLang', languages.learningLang);
      },

      completeOnboarding: () => {
        console.log('Preferences - Before Complete:', get().languages);
        set({ hasCompletedOnboarding: true });
        console.log('Preferences - After Complete:', get().languages);
      },

      toggleEmojiMode: () => set((state) => ({ useEmojiMode: !state.useEmojiMode })),

      incrementHintCounter: (hintName) => set((state) => ({
        hintCounters: {
          ...state.hintCounters,
          [hintName]: (state.hintCounters[hintName] || 0) + 1
        }
      })),

      rotateHintIndex: () => set((state) => {
        const availableHints = Object.entries(state.hintCounters)
          .filter(([_, count]) => count < MAX_HINT_COUNT)
          .map(([name, _]) => name);
        
        if (availableHints.length === 0) {
          return state; // No more hints to show
        }
        
        return {
          currentHintIndex: (state.currentHintIndex + 1) % availableHints.length
        };
      }),

      shouldShowHint: (hintName) => {
        const state = get();
        return (state.hintCounters[hintName] || 0) < MAX_HINT_COUNT;
      },

      // Menu ordering functions
      updateMenuOrder: (newOrder) => set({ menuItems: newOrder }),

      // Achievement notification toggle
      toggleAchievementNotifications: () => set((state) => ({ 
        showAchievementNotifications: !state.showAchievementNotifications 
      }))
    }),
    {
      name: 'language-preferences',
      storage: createJSONStorage(() => localStorage),
      // Add explicit partialize to ensure all state is persisted
      partialize: (state) => state,
    }
  )
);