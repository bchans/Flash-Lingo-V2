import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shuffle } from '@/lib/utils';
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useDeviceDetection } from '@/hooks/use-device-detection';
import { DrivingGameScene } from './DrivingGameScene';
import { RevolvingCar } from './RevolvingCar';
import { updateCard, getCachedAudio, saveCardAudio } from '@/lib/db';
import { useAchievement } from '@/lib/achievement-context';
import { checkForNewAchievements } from '@/lib/achievements';
import { firebaseAPI } from '@/lib/firebase-api';
import { base64ToAudio, audioToBase64 } from '@/lib/api';
import type { Card as CardType } from "@shared/schema";
// Import CSS for fullscreen mode
import './driving-game.css';

interface DrivingGameCardProps {
  cards: CardType[];
  onCorrectAnswer: (cardId: number) => void;
  onWrongAnswer: (cardId: number) => void;
  onSessionComplete?: () => void;
}

export function DrivingGameCard({ 
  cards,
  onCorrectAnswer,
  onWrongAnswer,
  onSessionComplete
}: DrivingGameCardProps) {
  const STREAK_SPEED_INCREMENT = 0.10; // 10% speed increase per correct answer in streak
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffledCards, setShuffledCards] = useState<CardType[]>([]);
  const [score, setScore] = useState(0);
  const { showAchievement } = useAchievement();
  const [progress, setProgress] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const { toast } = useToast();
  
  // Sound toggle state - persisted in localStorage
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    return localStorage.getItem('drivingGameSound') === 'true';
  });
  
  const toggleSound = () => {
    setIsSoundEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem('drivingGameSound', newValue.toString());
      return newValue;
    });
  };
  
  // Check for all achievements (including car unlocks)
  async function checkAllAchievements() {
    try {
      const newAchievements = await checkForNewAchievements();
      for (const achievement of newAchievements) {
        showAchievement({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description
        });
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  }
  
  // Language code conversion for TTS
  const convertToLanguageCode = (lang: string): string => {
    const langMap: { [key: string]: string } = {
      'en': 'en-US', 'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE', 'it': 'it-IT',
      'pt': 'pt-PT', 'ja': 'ja-JP', 'ko': 'ko-KR', 'zh': 'zh-CN', 'vi': 'vi-VN',
      'th': 'th-TH', 'ru': 'ru-RU', 'ar': 'ar-XA', 'hi': 'hi-IN', 'pl': 'pl-PL',
      'nl': 'nl-NL', 'sv': 'sv-SE', 'da': 'da-DK', 'fi': 'fi-FI', 'no': 'nb-NO',
      'tr': 'tr-TR', 'el': 'el-GR', 'he': 'he-IL', 'id': 'id-ID', 'ms': 'ms-MY',
    };
    return langMap[lang] || lang;
  };
  
  // Play audio for correct answer
  async function playCardAudio(card: CardType) {
    if (!isSoundEnabled) return;
    
    try {
      // Check for cached audio first
      const cachedAudio = await getCachedAudio(card.id);
      
      if (cachedAudio.target) {
        // Use cached audio
        const audioUrl = base64ToAudio(cachedAudio.target);
        const audio = new Audio(audioUrl);
        audio.play().catch(err => console.error('Audio playback failed:', err));
        audio.addEventListener('ended', () => URL.revokeObjectURL(audioUrl));
      } else {
        // Generate new audio using Google Cloud TTS
        const languageCode = convertToLanguageCode(card.targetLang || 'en');
        const audioBlob = await firebaseAPI.generateTTS(card.targetText, languageCode);
        
        if (audioBlob) {
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.play().catch(err => console.error('Audio playback failed:', err));
          audio.addEventListener('ended', () => URL.revokeObjectURL(audioUrl));
          
          // Cache for future use
          const base64Audio = await audioToBase64(audioBlob);
          await saveCardAudio(card.id, undefined, base64Audio);
        }
      }
    } catch (error) {
      console.error('Error playing card audio:', error);
    }
  }
  
  // Track game session variables
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [incorrectAnswers, setIncorrectAnswers] = useState(0);
  const [gameStatus, setGameStatus] = useState<'intro' | 'playing' | 'complete'>('intro');
  const [streakCount, setStreakCount] = useState(0);
  const streakSpeedMultiplier = useMemo(
    () => 1 + streakCount * STREAK_SPEED_INCREMENT,
    [streakCount]
  );
  
  // Game mode system - extensible for future modes
  type GameMode = {
    id: string;
    name: string;
    description: string;
    filterCards: (cards: CardType[]) => CardType[];
  };
  
  const GAME_MODES: GameMode[] = [
    {
      id: 'all',
      name: 'All Cards',
      description: 'Practice with all available cards',
      filterCards: (cards) => cards
    },
    {
      id: 'unlearned',
      name: 'Not Yet Learnt',
      description: 'Practice only cards you haven\'t mastered yet',
      filterCards: (cards) => cards.filter(card => !card.learned)
    }
  ];

  // Car speed multipliers - each car is progressively faster
  const CAR_SPEED_MULTIPLIERS = {
    0: 1.0,   // City Cab (default speed)
    1: 1.1,   // Delivery Car (10% faster)
    2: 1.2,   // Ambulance (20% faster)
    3: 1.3,   // Police Car (30% faster)
    4: 1.4,   // Racing Car (40% faster)
    5: 1.5    // Vintage Car (50% faster)
  };

  const CAR_NAMES = [
    "City Cab",
    "Delivery Car", 
    "Ambulance",
    "Police Car",
    "Racing Car",
    "Vintage Car"
  ];
  
  const [selectedMode, setSelectedMode] = useState<GameMode>(GAME_MODES[0]);
  const [selectedCarIndex, setSelectedCarIndex] = useState(0);
  const [showCategories, setShowCategories] = useState(false);
  
  // For the side that shows the options
  const [leftOption, setLeftOption] = useState('');
  const [rightOption, setRightOption] = useState('');
  
  // Reference for the game container
  const gameContainerRef = React.useRef<HTMLDivElement>(null);

  // State to track fullscreen status
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Device detection
  const { isMobile } = useDeviceDetection();
  
  // Show feedback state
  const [showFeedback, setShowFeedback] = useState<{ isCorrect: boolean } | null>(null);
  
  // Show loading screen immediately when starting game
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  
  // Add state to track if game has been initialized
  const [gameInitialized, setGameInitialized] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(() => {
    if (typeof window === 'undefined') return 800;
    return window.visualViewport?.height ?? window.innerHeight;
  });
  
  // Keep viewport-aware sizing for mobile overlay
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewport = () => {
      setViewportHeight(window.visualViewport?.height ?? window.innerHeight);
    };

    updateViewport();

    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    window.visualViewport?.addEventListener?.('resize', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.visualViewport?.removeEventListener?.('resize', updateViewport);
    };
  }, []);

  // On mobile, always use overlay when game is active to hide page content
  const shouldUseMobileOverlay = isMobile && gameStarted;

  useEffect(() => {
    if (!shouldUseMobileOverlay || typeof document === 'undefined') return;
    
    // Save original styles
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalHeight = document.body.style.height;
    
    // Lock body to prevent any scrolling or content visibility
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    
    // Also hide any scrollbars
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      document.body.style.height = originalHeight;
      document.documentElement.style.overflow = '';
    };
  }, [shouldUseMobileOverlay]);

  // Shuffle cards on component mount - only for initial setup, not for game mode filtering
  // Filter out sentence-type cards as they don't fit well on highway signs
  useEffect(() => {
    if (cards.length > 0 && shuffledCards.length === 0) {
      // Filter out sentence-type cards
      const wordCards = cards.filter(card => card.type !== 'sentence');
      // If no word cards available, fall back to all cards
      const cardsToUse = wordCards.length > 0 ? wordCards : cards;
      const shuffled = shuffle([...cardsToUse]);
      setShuffledCards(shuffled);
      setupNewQuestion(shuffled[0]);
    }
  }, [cards]);

  // Current card
  const currentCard = shuffledCards[currentIndex] || cards[0];

  function setupNewQuestion(card: CardType) {
    if (!card) return;
    
    // Get other cards for incorrect options
    const otherCards = shuffledCards.filter(c => c.id !== card.id);
    let randomCard = otherCards[Math.floor(Math.random() * otherCards.length)];
    
    // If no other cards in shuffled deck, use any card from the full deck
    if (!randomCard && cards.length > 1) {
      const allOtherCards = cards.filter(c => c.id !== card.id);
      randomCard = allOtherCards[Math.floor(Math.random() * allOtherCards.length)];
    }
    
    // Create options array with correct answer and one wrong answer
    const options = [card.targetText];
    if (randomCard) {
      options.push(randomCard.targetText);
    } else {
      // Fallback if truly no other cards available
      options.push("Alternative option");
    }
    
    // Shuffle the options
    const shuffledOptions = shuffle(options);
    
    console.log(`📝 CARD SETUP: New question: "${card.sourceText}" -> "${card.targetText}"`);
    console.log(`📝 CARD SETUP: Old options: [${currentOptions.join(', ')}]`);
    console.log(`📝 CARD SETUP: New options: [${shuffledOptions.join(', ')}]`);
    
    setCurrentOptions(shuffledOptions);
    
    // Set left and right options for the UI
    setLeftOption(shuffledOptions[0] || '');
    setRightOption(shuffledOptions[1] || '');
    
    console.log(`📝 CARD SETUP: Options set - Left="${shuffledOptions[0]}", Right="${shuffledOptions[1]}"`);
    console.log(`📝 CARD SETUP: State should now trigger DrivingGameScene options effect`);
  }

  async function handleAnswer(isCorrect: boolean) {
    console.log(`Answer: ${isCorrect ? 'Correct' : 'Incorrect'}`);
    
    // Show feedback
    setShowFeedback({ isCorrect });
    
    const currentCard = shuffledCards[currentIndex];
    
    // Update card status in database - like StudyCard component
    try {
      await updateCard(currentCard.id, { ...currentCard, learned: isCorrect });
      
      // Check for all achievements after updating card
      if (isCorrect) {
        await checkAllAchievements();
      }
    } catch (error) {
      console.error('Error updating card status:', error);
    }
    
    if (isCorrect) {
      const newScore = score + 1;
      setScore(newScore);
      setCorrectAnswers(correctAnswers + 1);
      setStreakCount(prev => {
        const next = prev + 1;
        console.log(`STREAK UPDATE: ${next} correct answers in a row`);
        return next;
      });
      onCorrectAnswer(currentCard.id);
      console.log(`SCORE UPDATE: Correct answer! Score: ${newScore}/${shuffledCards.length}`);
      
      // Play audio for the correct card if sound is enabled
      playCardAudio(currentCard);
      
      toast({
        title: "Correct!",
        description: `"${currentCard.sourceText}" = "${currentCard.targetText}"`,
      });
    } else {
      setIncorrectAnswers(incorrectAnswers + 1);
      if (streakCount !== 0) {
        console.log("STREAK RESET: Incorrect answer");
      }
      setStreakCount(0);
      onWrongAnswer(currentCard.id);
      console.log(`SCORE UPDATE: Incorrect answer. Score remains: ${score}/${shuffledCards.length}`);
      
      toast({
        title: "Incorrect",
        description: `"${currentCard.sourceText}" = "${currentCard.targetText}"`,
        variant: "destructive",
      });
    }

    // Immediately prepare next question options and advance to next card
    if (currentIndex < shuffledCards.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextCard = shuffledCards[nextIndex];
      console.log(`🚀 IMMEDIATE UPDATE: Advancing to card "${nextCard.sourceText}" (${nextIndex + 1}/${shuffledCards.length})`);
      
      // Advance to next card immediately to sync word container with highway signs
      setCurrentIndex(nextIndex);
      setupNewQuestion(nextCard);
    }

    // Hide feedback after delay and check if game should end
    setTimeout(() => {
      setShowFeedback(null);
      
      if (currentIndex < shuffledCards.length - 1) {
        const nextIndex = currentIndex + 1;
        console.log(`🎮 GAME FLOW: Advancing to card ${nextIndex + 1}/${shuffledCards.length}`);
        
        setCurrentIndex(nextIndex);
        setProgress((nextIndex / shuffledCards.length) * 100);
        console.log(`🎮 Progress updated to ${Math.round((nextIndex / shuffledCards.length) * 100)}%`);
      } else {
        // Game over - all cards completed
        console.log(`🎮 GAME FLOW: All cards completed, ending game`);
        setIsGameOver(true);
        setGameStatus('complete');
        // Call onSessionComplete to trigger the parent success screen and refresh cards
        onSessionComplete?.();
      }
    }, 1500);
  }

  function handleGameAction(action: 'left' | 'right') {
    if (showFeedback) return; // Prevent actions during feedback
    
    const choice = action;
    
    console.log(`Driving Game - Action: ${choice}, Current card index: ${currentIndex}, Card: "${currentCard.sourceText}" -> "${currentCard.targetText}"`);
    console.log(`Driving Game - Left option: "${leftOption}", Right option: "${rightOption}"`);
    
    let isCorrect = false;
    if (choice === 'left') {
      isCorrect = leftOption === currentCard.targetText;
      console.log(`Driving Game - Left choice ${isCorrect ? "CORRECT" : "WRONG"}`);
    } else {
      isCorrect = rightOption === currentCard.targetText;
      console.log(`Driving Game - Right choice ${isCorrect ? "CORRECT" : "WRONG"}`);
    }
    
    handleAnswer(isCorrect);
  }

  function makeChoice(choice: 'left' | 'right') {
    if (showFeedback) return; // Prevent actions during feedback
    
    const currentCard = shuffledCards[currentIndex];
    const correctAnswer = currentCard.targetText;
    
    console.log(`Driving Game - Action: ${choice}, Current card index: ${currentIndex}, Card: "${currentCard.sourceText}" -> "${currentCard.targetText}"`);
    console.log(`Driving Game - Left option: "${leftOption}", Right option: "${rightOption}"`);
    
    let isCorrect = false;
    if (choice === 'left') {
      isCorrect = leftOption === correctAnswer;
      console.log(`Driving Game - Left choice ${isCorrect ? "CORRECT" : "WRONG"}`);
    } else {
      isCorrect = rightOption === correctAnswer;
      console.log(`Driving Game - Right choice ${isCorrect ? "CORRECT" : "WRONG"}`);
    }
    
    handleAnswer(isCorrect);
  }
  
  function startGame() {
    console.log("Starting Driving Game...");
    
    // Filter cards based on selected mode, then exclude sentences (they don't fit on highway signs)
    const modeFilteredCards = selectedMode.filterCards(cards);
    const filteredCards = modeFilteredCards.filter(card => card.type !== 'sentence');
    
    // If no word cards available after filtering, fall back to mode-filtered cards
    const cardsToUse = filteredCards.length > 0 ? filteredCards : modeFilteredCards;
    
    if (cardsToUse.length === 0) {
      toast({
        title: "No cards available",
        description: selectedMode.id === 'unknown' 
          ? "All cards are already mastered! Try 'All Cards' mode." 
          : "Please create some cards first",
        variant: "destructive",
      });
      return;
    }
    
    // Shuffle filtered cards for game session
    const shuffled = shuffle([...cardsToUse]);
    setShuffledCards(shuffled);
    setCurrentIndex(0);
    setScore(0);
    setProgress(0);
    setCorrectAnswers(0);
    setIncorrectAnswers(0);
    setStreakCount(0);
    setIsGameOver(false);
    
    // Always show loading screen first, regardless of previous game state
    setShowLoadingScreen(true);
    setGameStarted(false); // Ensure game is not started yet
    setGameInitialized(false); // Reset initialization state
    
    // Immediately start the game but keep loading screen visible
    setGameStatus('playing');
    if (shuffled.length > 0) {
      setupNewQuestion(shuffled[0]);
    }
    
    // After a very short delay, start the game engine but keep loading screen
    setTimeout(() => {
      setGameStarted(true);
      setGameInitialized(true); // Mark as initialized
      
      // Request fullscreen on mobile devices
      if (isMobile) {
        setTimeout(() => {
          requestFullscreen();
        }, 100);
      }
    }, 100); // Very short delay to ensure state is properly set
  }
  
  function resetGame() {
    setCurrentIndex(0);
    setScore(0);
    setProgress(0);
    setIsGameOver(false);
    setCorrectAnswers(0);
    setIncorrectAnswers(0);
    setStreakCount(0);
    setGameStatus('intro');
    setGameStarted(false);
    setGameInitialized(false); // Reset initialization state
  }

  function handleExitGame() {
    console.log("Exiting Driving Game...");
    exitFullscreen();
    setGameStarted(false);
    setGameStatus('intro');
    setShowLoadingScreen(false);
    setGameInitialized(false); // Reset initialization
    
    // Reset game state
    resetGame();
    
    toast({
      title: "Game Exited",
      description: "You've returned to the menu.",
    });
  }

  function requestFullscreen() {
    const container = gameContainerRef.current;
    if (container) {
      setIsFullscreen(true);
      container.classList.add('fullscreen-game');
      
      // On mobile, always use document.documentElement and force landscape orientation
      const elementToFullscreen = isMobile ? document.documentElement : container;
      
      // Lock orientation to landscape on mobile
      if (isMobile && screen.orientation && 'lock' in screen.orientation) {
        try {
          (screen.orientation as any).lock('landscape').catch((err: any) => {
            console.log("Orientation lock failed:", err);
          });
        } catch (err) {
          console.log("Orientation lock not supported:", err);
        }
      }
      
      // Request actual fullscreen API for true fullscreen with proper typing
      if (elementToFullscreen.requestFullscreen) {
        elementToFullscreen.requestFullscreen().catch((err) => {
          console.log("Fullscreen request failed:", err);
        });
      } else if ((elementToFullscreen as any).webkitRequestFullscreen) {
        // Safari compatibility
        (elementToFullscreen as any).webkitRequestFullscreen();
      } else if ((elementToFullscreen as any).mozRequestFullScreen) {
        // Firefox compatibility
        (elementToFullscreen as any).mozRequestFullScreen();
      }
      
      // Focus the container to ensure keyboard events work
      container.focus();
    }
  }

  function exitFullscreen() {
    const container = gameContainerRef.current;
    if (container) {
      setIsFullscreen(false);
      container.classList.remove('fullscreen-game');
    }
  }

  // Handle intro screen
  if (gameStatus === 'intro') {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="text-center space-y-6">
            <div className="space-y-4">
              <div className="flex justify-center">
                <RevolvingCar onCarChange={(carIndex) => setSelectedCarIndex(carIndex)} />
              </div>
              
              {/* Speed Indicator */}
              <div className="max-w-48 mx-auto">
                <div className="text-center mb-2">
                  <span className="text-xs font-medium">{CAR_NAMES[selectedCarIndex]}</span>
                </div>
                <div className="w-full bg-accent/20 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(CAR_SPEED_MULTIPLIERS[selectedCarIndex as keyof typeof CAR_SPEED_MULTIPLIERS] / 1.5) * 100}%` }}
                  />
                </div>
                <div className="flex justify-center mt-1">
                  <span className="text-xs text-muted-foreground">
                    {CAR_SPEED_MULTIPLIERS[selectedCarIndex as keyof typeof CAR_SPEED_MULTIPLIERS]}x speed
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <p className="text-muted-foreground mb-6">
                Race through the correct lanes to unlock new cars and improve your vocabulary!
              </p>
            </div>
            
            {/* Game Mode Selection */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-center">Choose Your Challenge</h3>
              
              <div className="grid grid-cols-2 gap-6 max-w-sm mx-auto">
                {/* All Cards Option */}
                <div 
                  className={`training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform animate-in zoom-in-0 duration-150 ${
                    selectedMode.id === 'all' ? 'scale-105' : ''
                  }`}
                  style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
                  onClick={() => setSelectedMode(GAME_MODES.find(mode => mode.id === 'all')!)}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-colors ${
                    selectedMode.id === 'all' ? 'bg-primary/20 border-2 border-primary' : 'bg-primary/10 hover:bg-primary/20'
                  }`}>
                    <div className="text-3xl">📚</div>
                  </div>
                  <h3 className="font-medium">All Cards</h3>
                  <span className="text-xs text-muted-foreground">
                    {GAME_MODES.find(mode => mode.id === 'all')?.filterCards(cards).length} cards
                  </span>
                </div>

                {/* Not Yet Learnt Option */}
                <div 
                  className={`training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform animate-in zoom-in-0 duration-150 ${
                    selectedMode.id === 'unlearned' ? 'scale-105' : ''
                  } ${
                    cards.filter(card => !card.learned).length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  style={{ animationDelay: '0.4s', animationFillMode: 'both' }}
                  onClick={() => {
                    if (cards.filter(card => !card.learned).length > 0) {
                      setSelectedMode(GAME_MODES.find(mode => mode.id === 'unlearned')!);
                    }
                  }}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-colors ${
                    selectedMode.id === 'unlearned' ? 'bg-orange-200 border-2 border-orange-600' : 'bg-orange-100 hover:bg-orange-200'
                  }`}>
                    <div className="text-3xl">🎯</div>
                  </div>
                  <h3 className="font-medium">Not Yet Learnt</h3>
                  <span className="text-xs text-muted-foreground">
                    {GAME_MODES.find(mode => mode.id === 'unlearned')?.filterCards(cards).length} cards
                  </span>
                </div>
              </div>

              {/* Categories Section */}
              <div className="mt-6">
                <div 
                  className="training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform animate-in zoom-in-0 duration-150 mx-auto"
                  style={{ animationDelay: '0.5s', animationFillMode: 'both', maxWidth: '120px' }}
                  onClick={() => setShowCategories(!showCategories)}
                >
                  <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-3 hover:bg-purple-200 transition-colors">
                    <div className="text-3xl">🏷️</div>
                  </div>
                  <h3 className="font-medium">Categories</h3>
                </div>
                
                {/* Expandable Categories Section */}
                {showCategories && (
                  <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="max-h-40 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                        {Array.from(new Map(cards.filter(card => card.category).map(card => [card.category!, { category: card.category!, emoji: card.categoryEmoji }])).values()).map(({ category, emoji }, index) => (
                          <div 
                            key={category}
                            className={`flex items-center gap-2 p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors animate-in fade-in-0 duration-200 ${
                              selectedMode.name === category ? 'bg-primary/20 border border-primary' : ''
                            }`}
                            style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}
                            onClick={() => {
                              // Create a dynamic category mode
                              const categoryMode = {
                                id: `category-${category}`,
                                name: category,
                                description: `Practice ${category} vocabulary`,
                                filterCards: (cards: any[]) => cards.filter(card => card.category === category)
                              };
                              setSelectedMode(categoryMode);
                            }}
                          >
                            <span className="text-lg">{emoji}</span>
                            <span className="text-sm font-medium">{category}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {cards.filter(card => card.category === category).length}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <Button 
              onClick={startGame}
              size="lg"
              className="w-full"
              disabled={selectedMode.filterCards(cards).filter(c => c.type !== 'sentence').length === 0}
            >
              Start Driving ({selectedMode.filterCards(cards).filter(c => c.type !== 'sentence').length} cards)
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading screen - show as soon as showLoadingScreen is true (don't wait for gameStarted)
  if (showLoadingScreen) {
    console.log("RENDERING PATH: Loading screen with score containers", {
      showLoadingScreen,
      gameStarted,
      score,
      totalCards: shuffledCards.length,
      currentCardIndex: currentIndex + 1
    });
    
    // Mobile overlay class for full screen coverage
    const mobileOverlayClass = shouldUseMobileOverlay 
      ? 'fixed inset-0 z-[9999] rounded-none border-0 shadow-none' 
      : '';
    const mobileOverlayStyle = shouldUseMobileOverlay 
      ? { height: '100dvh', width: '100vw', backgroundColor: '#000' } 
      : undefined;
    
    return (
      <Card
        className={`w-full overflow-hidden ${mobileOverlayClass}`}
        ref={gameContainerRef}
        style={mobileOverlayStyle}
      >
        <CardContent
          className="p-0 relative"
          style={shouldUseMobileOverlay ? { height: '100%' } : { height: '600px' }}
        >
          {/* Use a simple black background while the DrivingGameScene handles the actual loading */}
          <div style={{ width: '100%', height: '100%', backgroundColor: '#000' }}>
            <DrivingGameScene
              word={currentCard.sourceText}
              correctTranslation={currentCard.targetText}
              options={currentOptions}
              onSelectLeft={() => makeChoice('left')}
              onSelectRight={() => makeChoice('right')}
              progress={progress}
              showFeedback={showFeedback}
              onExit={handleExitGame}
              score={score}
              totalCards={shuffledCards.length}
              selectedCarIndex={selectedCarIndex}
              streakSpeedMultiplier={streakSpeedMultiplier}
              currentStreak={streakCount}
              isSoundEnabled={isSoundEnabled}
              onToggleSound={toggleSound}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle game over screen
  if (isGameOver) {
    const accuracy = shuffledCards.length > 0 ? Math.round((correctAnswers / shuffledCards.length) * 100) : 0;
    
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center space-y-4">
          <h2 className="text-3xl font-bold">🏁 Race Complete!</h2>
          <div className="space-y-2">
            <p className="text-xl">Final Score: {score}/{shuffledCards.length}</p>
            <p className="text-lg text-muted-foreground">Accuracy: {accuracy}%</p>
          </div>
          <div className="flex gap-4 justify-center">
            <Button onClick={resetGame} variant="outline">
              Play Again
            </Button>
            <Button onClick={() => setGameStatus('intro')}>
              Main Menu
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Main game view
  if (gameStarted && shuffledCards.length > 0) {
    const currentCard = shuffledCards[currentIndex];
    console.log("RENDERING PATH: Main game view with score containers", {
      gameStarted,
      cardsLength: shuffledCards.length,
      currentIndex,
      showLoadingScreen,
      isGameOver
    });
    
    // Mobile overlay class for full screen coverage - hide everything else
    const mobileOverlayClass = shouldUseMobileOverlay 
      ? 'fixed inset-0 z-[9999] rounded-none border-0 shadow-none' 
      : '';
    const mobileOverlayStyle = shouldUseMobileOverlay 
      ? { height: '100dvh', width: '100vw', backgroundColor: '#000' } 
      : undefined;
    const containerHeight = shouldUseMobileOverlay ? '100%' : (isFullscreen ? '100vh' : '400px');

    return (
      <Card 
        className={`w-full overflow-hidden ${isFullscreen ? 'fullscreen-game' : ''} ${mobileOverlayClass}`} 
        ref={gameContainerRef}
        tabIndex={0}
        style={mobileOverlayStyle}
      >
        <CardContent className={`p-0 relative ${shouldUseMobileOverlay ? 'h-full' : ''}`}>
          <div className={`flex flex-col ${shouldUseMobileOverlay ? 'h-full' : ''}`} style={shouldUseMobileOverlay ? { backgroundColor: '#000' } : undefined}>
            {/* Hide header on mobile overlay for cleaner fullscreen */}
            {!shouldUseMobileOverlay && (
              <>
                <div className={`p-4 bg-accent/30 ${isFullscreen ? 'game-header' : ''}`}>
                  <div className="flex justify-end items-center mb-2">
                    <Badge variant="outline" className="text-sm py-1 px-3">
                      Score {score}/{shuffledCards.length || cards.length || 1}
                    </Badge>
                  </div>
                  <Progress value={progress} className="h-2 mb-1" />
                </div>
                
                <div className={`p-4 text-center ${isFullscreen ? 'game-info' : ''}`}>
                  <h3 className="text-2xl font-bold mb-4">{currentCard.sourceText}</h3>
                  <p className="text-muted-foreground mb-4">
                    Choose the correct translation by driving to the right lane
                  </p>
                </div>
              </>
            )}

            {/* 3D Driving Game Scene */}
            <div className="flex-1 min-h-[260px]" style={shouldUseMobileOverlay ? { height: '100%' } : undefined}>
              <div 
                className="driving-game-scene-container h-full" 
                style={{ 
                  height: containerHeight,
                  width: '100%',
                  position: 'relative'
                }}
                ref={(el) => {
                  if (el) {
                    console.log("PARENT CONTAINER: Scene container rendered", {
                      position: window.getComputedStyle(el).position,
                      overflow: window.getComputedStyle(el).overflow,
                      bounds: el.getBoundingClientRect()
                    });
                  }
                }}
              >
                <DrivingGameScene
                  word={currentCard.sourceText}
                  correctTranslation={currentCard.targetText}
                  options={currentOptions}
                  onSelectLeft={() => makeChoice('left')}
                  onSelectRight={() => makeChoice('right')}
                  progress={progress}
                  showFeedback={showFeedback}
                  onExit={handleExitGame}
                  score={score}
                  totalCards={shuffledCards.length}
                  selectedCarIndex={selectedCarIndex}
                  streakSpeedMultiplier={streakSpeedMultiplier}
                  currentStreak={streakCount}
                  isSoundEnabled={isSoundEnabled}
                  onToggleSound={toggleSound}
                />
                
                {/* Touch control areas for mobile */}
                {(isFullscreen || shouldUseMobileOverlay) && (
                  <>
                    <div 
                      className="touch-control-left" 
                      onClick={() => handleGameAction('left')}
                      aria-label="Drive left"
                    />
                    <div 
                      className="touch-control-right" 
                      onClick={() => handleGameAction('right')}
                      aria-label="Drive right"
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Fallback for empty card set - only show if cards have been loaded but are empty
  // If cards array is empty, it might still be loading from the parent
  if (cards.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Loading cards...</p>
        </CardContent>
      </Card>
    );
  }

  // Final fallback - shouldn't normally reach here
  return (
    <Card className="w-full">
      <CardContent className="p-6 text-center">
        <p>No cards available to play the driving game.</p>
      </CardContent>
    </Card>
  );
}