import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartBar, Trophy, Flame, CheckCircle, Target, Calendar, Star, Book, Zap, Award, Settings, Volume2 } from "lucide-react";
import { getCards } from "@/lib/db";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Card as CardType } from "@shared/schema";
import { useAchievement } from "@/lib/achievement-context";
import { usePreferences } from "@/lib/preferences-simple";
import { TTSConfig } from "@/components/ui/tts-config";

type AchievementStats = {
  cards: CardType[];
  streak: number;
  todayCards: number;
  totalLearned: number;
  dailyGoal: number;
  streakRecord: number;
  dailySessionsCompleted: number;
  perfectStreakAchieved: boolean;
};

type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  condition: (stats: AchievementStats) => boolean;
};

export default function Stats() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [streak, setStreak] = useState(0);
  const [todayCards, setTodayCards] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(5); 
  const [totalLearned, setTotalLearned] = useState(0);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [showDailyGoalSettings, setShowDailyGoalSettings] = useState(false);
  const { showAchievementNotifications, toggleAchievementNotifications, useEmojiMode } = usePreferences();

  const achievements: Achievement[] = [
    {
      id: "first-card",
      name: "First Steps",
      description: "Create your first flashcard",
      icon: <Book className="h-4 w-4" />,
      condition: ({ cards }) => cards.length >= 1
    },
    {
      id: "ten-cards",
      name: "Card Collector",
      description: "Create 10 flashcards",
      icon: <Book className="h-4 w-4" />,
      condition: ({ cards }) => cards.length >= 10
    },
    {
      id: "fifty-cards",
      name: "Knowledge Builder",
      description: "Create 50 flashcards",
      icon: <Book className="h-4 w-4" />,
      condition: ({ cards }) => cards.length >= 50
    },
    {
      id: "first-learned",
      name: "First Success",
      description: "Master your first card",
      icon: <Star className="h-4 w-4" />,
      condition: ({ totalLearned }) => totalLearned >= 1
    },
    {
      id: "five-learned",
      name: "Getting Fluent",
      description: "Master 5 cards",
      icon: <Star className="h-4 w-4" />,
      condition: ({ totalLearned }) => totalLearned >= 5
    },
    {
      id: "twenty-learned",
      name: "Vocabulary Expert",
      description: "Master 20 cards",
      icon: <Award className="h-4 w-4" />,
      condition: ({ totalLearned }) => totalLearned >= 20
    },
    {
      id: "daily-goal-1",
      name: "Daily Target",
      description: "Reach your daily study goal",
      icon: <Target className="h-4 w-4" />,
      condition: ({ todayCards, dailyGoal }) => todayCards >= dailyGoal
    },
    {
      id: "streak-3",
      name: "Consistent Learner",
      description: "Maintain a 3-day study streak",
      icon: <Flame className="h-4 w-4" />,
      condition: ({ streak }) => streak >= 3
    },
    {
      id: "streak-7",
      name: "Weekly Warrior",
      description: "Maintain a 7-day study streak",
      icon: <Flame className="h-4 w-4" />,
      condition: ({ streak }) => streak >= 7
    },
    {
      id: "streak-30",
      name: "Monthly Master",
      description: "Maintain a 30-day study streak",
      icon: <Calendar className="h-4 w-4" />,
      condition: ({ streak }) => streak >= 30
    },
    {
      id: "overachiever",
      name: "Overachiever",
      description: "Study twice your daily goal",
      icon: <Zap className="h-4 w-4" />,
      condition: ({ todayCards, dailyGoal }) => todayCards >= dailyGoal * 2
    },
    {
      id: "complete-deck",
      name: "Complete Collection",
      description: "Master all your cards",
      icon: <CheckCircle className="h-4 w-4" />,
      condition: ({ cards, totalLearned }) => cards.length >= 5 && cards.length === totalLearned
    },
    {
      id: "streak-master",
      name: "Streak Master",
      description: "Get 10 correct answers in a row in Streak Challenge",
      icon: <Zap className="h-4 w-4" />,
      condition: ({ streakRecord }) => streakRecord >= 10
    },
    {
      id: "daily-dedication",
      name: "Daily Dedication",
      description: "Complete 5 daily practice sessions",
      icon: <Calendar className="h-4 w-4" />,
      condition: ({ dailySessionsCompleted }) => dailySessionsCompleted >= 5
    },
    {
      id: "unlock-delivery-car",
      name: "Delivery Driver",
      description: "Master 10 cards to unlock the Delivery Car",
      icon: <ChartBar className="h-4 w-4" />,
      condition: ({ totalLearned }) => totalLearned >= 10
    },
    {
      id: "unlock-ambulance",
      name: "Emergency Responder",
      description: "Master 20 cards to unlock the Ambulance",
      icon: <Target className="h-4 w-4" />,
      condition: ({ totalLearned }) => totalLearned >= 20
    },
    {
      id: "unlock-police-car",
      name: "Law Enforcer",
      description: "Master 40 cards to unlock the Police Car",
      icon: <Star className="h-4 w-4" />,
      condition: ({ totalLearned }) => totalLearned >= 40
    },
    {
      id: "unlock-racing-car",
      name: "Speed Racer",
      description: "Master 80 cards to unlock the Racing Car",
      icon: <Zap className="h-4 w-4" />,
      condition: ({ totalLearned }) => totalLearned >= 80
    },
    {
      id: "unlock-vintage-car",
      name: "Classic Collector",
      description: "Master 160 cards to unlock the Vintage Car",
      icon: <Award className="h-4 w-4" />,
      condition: ({ totalLearned }) => totalLearned >= 160
    },
    {
      id: "perfect-streak",
      name: "Perfect Streak",
      description: "Complete a streak challenge with no mistakes",
      icon: <Award className="h-4 w-4" />,
      condition: ({ perfectStreakAchieved }) => perfectStreakAchieved
    }
  ];

  const { showAchievement } = useAchievement();
  
  useEffect(() => {
    // Load daily goal from localStorage
    const savedDailyGoal = localStorage.getItem('dailyGoal');
    if (savedDailyGoal) {
      setDailyGoal(Math.max(5, parseInt(savedDailyGoal)));
    }
    
    // Load stats immediately and every 5 seconds
    loadStats();
    const interval = setInterval(loadStats, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Check for newly unlocked achievements
  useEffect(() => {
    // Get previously unlocked achievements from localStorage
    const previouslyUnlocked = JSON.parse(localStorage.getItem('unlockedAchievements') || '[]');
    
    // Find newly unlocked achievements
    const newlyUnlocked = unlockedAchievements.filter(id => !previouslyUnlocked.includes(id));
    
    // If there are new achievements, show notifications and update localStorage
    if (newlyUnlocked.length > 0) {
      // Save all currently unlocked achievements to localStorage
      localStorage.setItem('unlockedAchievements', JSON.stringify(unlockedAchievements));
      
      // Show notification for each newly unlocked achievement
      newlyUnlocked.forEach(id => {
        const achievement = achievements.find(a => a.id === id);
        if (achievement) {
          showAchievement({
            id: achievement.id,
            name: achievement.name,
            description: achievement.description
          });
        }
      });
    }
  }, [unlockedAchievements, achievements, showAchievement]);

  async function loadStats() {
    try {
      const allCards = await getCards();
      setCards(allCards);

      // Count cards marked as learned
      const learnedCards = allCards.filter(card => card.learned);
      setTotalLearned(learnedCards.length);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayStudied = allCards.filter(card => {
        if (!card.lastStudied) return false;
        const studiedDate = new Date(card.lastStudied);
        studiedDate.setHours(0, 0, 0, 0);
        return studiedDate.getTime() === today.getTime();
      });

      setTodayCards(todayStudied.length);

      const lastActivity = localStorage.getItem('lastActivity');
      const currentStreak = localStorage.getItem('currentStreak') || '0';

      if (lastActivity) {
        const lastDate = new Date(lastActivity);
        lastDate.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (todayStudied.length > 0) {
          if (lastDate.getTime() === yesterday.getTime()) {
            setStreak(parseInt(currentStreak) + 1);
            localStorage.setItem('currentStreak', (parseInt(currentStreak) + 1).toString());
          } else if (lastDate.getTime() !== today.getTime()) {
            setStreak(1);
            localStorage.setItem('currentStreak', '1');
          } else {
            setStreak(parseInt(currentStreak));
          }
          localStorage.setItem('lastActivity', today.toISOString());
        } else {
          setStreak(parseInt(currentStreak));
        }
      } else if (todayStudied.length > 0) {
        setStreak(1);
        localStorage.setItem('currentStreak', '1');
        localStorage.setItem('lastActivity', today.toISOString());
      }

      // Get values from localStorage if they exist
      const streakRecord = parseInt(localStorage.getItem('streakRecord') || '0');
      const dailySessionsCompleted = parseInt(localStorage.getItem('dailySessionsCompleted') || '0');
      const perfectStreakAchieved = localStorage.getItem('perfectStreakAchieved') === 'true';
      
      const stats = {
        cards: allCards,
        streak: parseInt(currentStreak),
        todayCards: todayStudied.length,
        totalLearned: learnedCards.length,
        dailyGoal,
        streakRecord,
        dailySessionsCompleted,
        perfectStreakAchieved
      };

      const unlocked = achievements
        .filter(achievement => achievement.condition(stats))
        .map(achievement => achievement.id);

      setUnlockedAchievements(unlocked);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  const progressPercentage = Math.min((todayCards / dailyGoal) * 100, 100);
  const achievementsPercentage = (unlockedAchievements.length / achievements.length) * 100;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6 max-w-4xl mx-auto">
        <Link href="/">
          <Button variant="ghost" size="icon" className="mr-4">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{useEmojiMode ? '📊 ' : ''}Your Stats</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        {/* API Usage Statistics */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              API Usage Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {localStorage.getItem('mistralAPICalls') || '0'}
                </div>
                <p className="text-sm text-muted-foreground">AI Translations</p>
                <p className="text-xs text-muted-foreground">Mistral AI</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {localStorage.getItem('ttsAPICalls') || '0'}
                </div>
                <p className="text-sm text-muted-foreground">Text-to-Speech</p>
                <p className="text-xs text-muted-foreground">Gemini TTS</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {localStorage.getItem('geminiAPICalls') || '0'}
                </div>
                <p className="text-sm text-muted-foreground">Image Processing</p>
                <p className="text-xs text-muted-foreground">Gemini Vision</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">
                  {localStorage.getItem('scenarioAPICalls') || '0'}
                </div>
                <p className="text-sm text-muted-foreground">Scenario Generation</p>
                <p className="text-xs text-muted-foreground">Gemini Scenarios</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-4xl font-bold text-slate-600">
                  {
                    parseInt(localStorage.getItem('mistralAPICalls') || '0') +
                    parseInt(localStorage.getItem('ttsAPICalls') || '0') +
                    parseInt(localStorage.getItem('geminiAPICalls') || '0') +
                    parseInt(localStorage.getItem('scenarioAPICalls') || '0')
                  }
                </div>
                <p className="text-lg text-muted-foreground">Total API Calls</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Current Streak
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-5xl font-bold mb-2">{streak}</div>
            <p className="text-muted-foreground">days in a row</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Streak Record
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-5xl font-bold mb-2">
              {localStorage.getItem('streakRecord') || '0'}
            </div>
            <p className="text-muted-foreground">best streak challenge score</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              Today's Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <div className="flex justify-between mb-1">
                <span>{todayCards} / {dailyGoal} cards</span>
                <span>{progressPercentage.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-700">
                <div
                  className="bg-primary h-2.5 rounded-full"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
            
            <p className="text-center text-sm text-muted-foreground mb-4">
              {progressPercentage >= 100
                ? "Daily goal completed! 🎉"
                : `${Math.max(0, dailyGoal - todayCards)} more to reach your daily goal`}
            </p>

            <div className="mb-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowDailyGoalSettings(!showDailyGoalSettings)}
                className="text-muted-foreground"
              >
                <Settings className="h-4 w-4 mr-2" /> 
                {showDailyGoalSettings ? 'Hide Settings' : 'Edit Daily Goal'}
              </Button>
            </div>

            {/* Collapsible Daily Goal Settings */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
              showDailyGoalSettings ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="space-y-3 mb-4 animate-in slide-in-from-top duration-300">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Daily Goal</label>
                  <span className="text-sm font-semibold text-primary">{dailyGoal} cards</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={dailyGoal}
                  onChange={(e) => {
                    const newGoal = parseInt(e.target.value);
                    setDailyGoal(newGoal);
                    localStorage.setItem('dailyGoal', newGoal.toString());
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
                  style={{
                    background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((dailyGoal - 5) / 95) * 100}%, #e5e7eb ${((dailyGoal - 5) / 95) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5</span>
                  <span>100</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartBar className="h-5 w-5 text-blue-500" />
              Card Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold">{cards.length}</div>
                <p className="text-muted-foreground">total cards</p>
              </div>
              <div>
                <div className="text-3xl font-bold">{totalLearned}</div>
                <p className="text-muted-foreground">mastered</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span>{unlockedAchievements.length} / {achievements.length} achievements</span>
                <span>{achievementsPercentage.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-700">
                <div
                  className="bg-yellow-500 h-2.5 rounded-full"
                  style={{ width: `${achievementsPercentage}%` }}
                ></div>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                {achievementsPercentage < 100
                  ? `${achievements.length - unlockedAchievements.length} more achievements to unlock`
                  : "All achievements unlocked! 🏆"}
              </p>
              
              <div className="flex items-center">
                <span className="text-sm mr-2">Notifications</span>
                <button 
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${showAchievementNotifications ? 'bg-primary' : 'bg-input'}`}
                  onClick={toggleAchievementNotifications}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${showAchievementNotifications ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {achievements.map((achievement) => {
                const isUnlocked = unlockedAchievements.includes(achievement.id);
                return (
                  <Card 
                    key={achievement.id}
                    className={`${!isUnlocked ? "opacity-60" : ""}`}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        {achievement.icon}
                        {achievement.name}
                        {isUnlocked && <span className="text-green-500">✓</span>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {achievement.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}