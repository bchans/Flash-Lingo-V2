import { getCards } from "@/lib/db";

export interface AchievementConditionParams {
  cards: { id?: number; learned?: boolean }[];
  totalLearned: number;
  todayCards: number;
  dailyGoal: number;
  streak: number;
  streakRecord: number;
  dailySessionsCompleted: number;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  condition: (params: AchievementConditionParams) => boolean;
}

// Achievement definitions (without icons - those are only needed for display)
export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "first-card",
    name: "First Steps",
    description: "Create your first flashcard",
    condition: ({ cards }) => cards.length >= 1
  },
  {
    id: "ten-cards",
    name: "Card Collector",
    description: "Create 10 flashcards",
    condition: ({ cards }) => cards.length >= 10
  },
  {
    id: "fifty-cards",
    name: "Knowledge Builder",
    description: "Create 50 flashcards",
    condition: ({ cards }) => cards.length >= 50
  },
  {
    id: "first-learned",
    name: "First Success",
    description: "Master your first card",
    condition: ({ totalLearned }) => totalLearned >= 1
  },
  {
    id: "five-learned",
    name: "Getting Fluent",
    description: "Master 5 cards",
    condition: ({ totalLearned }) => totalLearned >= 5
  },
  {
    id: "twenty-learned",
    name: "Vocabulary Expert",
    description: "Master 20 cards",
    condition: ({ totalLearned }) => totalLearned >= 20
  },
  {
    id: "daily-goal-1",
    name: "Daily Target",
    description: "Reach your daily study goal",
    condition: ({ todayCards, dailyGoal }) => todayCards >= dailyGoal
  },
  {
    id: "streak-3",
    name: "Consistent Learner",
    description: "Maintain a 3-day study streak",
    condition: ({ streak }) => streak >= 3
  },
  {
    id: "streak-7",
    name: "Weekly Warrior",
    description: "Maintain a 7-day study streak",
    condition: ({ streak }) => streak >= 7
  },
  {
    id: "streak-30",
    name: "Monthly Master",
    description: "Maintain a 30-day study streak",
    condition: ({ streak }) => streak >= 30
  },
  {
    id: "overachiever",
    name: "Overachiever",
    description: "Study twice your daily goal",
    condition: ({ todayCards, dailyGoal }) => todayCards >= dailyGoal * 2
  },
  {
    id: "complete-deck",
    name: "Complete Collection",
    description: "Master all your cards",
    condition: ({ cards, totalLearned }) => cards.length >= 5 && cards.length === totalLearned
  },
  {
    id: "streak-master",
    name: "Streak Master",
    description: "Get 10 correct answers in a row in Streak Challenge",
    condition: ({ streakRecord }) => streakRecord >= 10
  },
  {
    id: "daily-dedication",
    name: "Daily Dedication",
    description: "Complete 5 daily practice sessions",
    condition: ({ dailySessionsCompleted }) => dailySessionsCompleted >= 5
  },
  {
    id: "unlock-delivery-car",
    name: "Delivery Driver",
    description: "Master 10 cards to unlock the Delivery Car",
    condition: ({ totalLearned }) => totalLearned >= 10
  },
  {
    id: "unlock-ambulance",
    name: "Emergency Responder",
    description: "Master 20 cards to unlock the Ambulance",
    condition: ({ totalLearned }) => totalLearned >= 20
  },
  {
    id: "unlock-police-car",
    name: "Law Enforcer",
    description: "Master 40 cards to unlock the Police Car",
    condition: ({ totalLearned }) => totalLearned >= 40
  },
  {
    id: "unlock-racing-car",
    name: "Speed Demon",
    description: "Master 80 cards to unlock the Racing Car",
    condition: ({ totalLearned }) => totalLearned >= 80
  },
  {
    id: "unlock-vintage-car",
    name: "Classic Collector",
    description: "Master 160 cards to unlock the Vintage Car",
    condition: ({ totalLearned }) => totalLearned >= 160
  }
];

/**
 * Get current stats needed for achievement checking
 */
export async function getAchievementStats(): Promise<AchievementConditionParams> {
  const allCards = await getCards();
  const learnedCards = allCards.filter(card => card.learned);
  
  // Get today's progress
  const todayCards = parseInt(localStorage.getItem('todayProgress') || '0');
  const dailyGoal = parseInt(localStorage.getItem('dailyGoal') || '5');
  
  // Get streak
  const streak = parseInt(localStorage.getItem('studyStreak') || '0');
  
  // Get streak record (highest streak in streak challenge mode)
  const streakRecord = parseInt(localStorage.getItem('streakRecord') || '0');
  
  // Get daily sessions completed
  const dailySessionsCompleted = parseInt(localStorage.getItem('dailySessionsCompleted') || '0');
  
  return {
    cards: allCards,
    totalLearned: learnedCards.length,
    todayCards,
    dailyGoal,
    streak,
    streakRecord,
    dailySessionsCompleted
  };
}

/**
 * Check all achievements and return newly unlocked ones
 */
export async function checkForNewAchievements(): Promise<AchievementDefinition[]> {
  const stats = await getAchievementStats();
  
  // Get previously unlocked achievements from localStorage
  const previouslyUnlocked: string[] = JSON.parse(localStorage.getItem('unlockedAchievements') || '[]');
  
  // Check which achievements are now unlocked
  const currentlyUnlocked = ACHIEVEMENTS
    .filter(achievement => achievement.condition(stats))
    .map(achievement => achievement.id);
  
  // Find newly unlocked achievements
  const newlyUnlockedIds = currentlyUnlocked.filter(id => !previouslyUnlocked.includes(id));
  
  // If there are new achievements, update localStorage
  if (newlyUnlockedIds.length > 0) {
    localStorage.setItem('unlockedAchievements', JSON.stringify(currentlyUnlocked));
  }
  
  // Return the full achievement objects for newly unlocked ones
  return ACHIEVEMENTS.filter(a => newlyUnlockedIds.includes(a.id));
}

