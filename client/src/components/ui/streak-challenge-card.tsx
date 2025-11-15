import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Card as CardType } from "@shared/schema";
import { Flame, Brain, BrainCircuit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle } from "lucide-react";
import { shuffle } from "@/lib/utils";
import { Zap } from "lucide-react"; 
import { usePreferences } from "@/lib/preferences-simple";


interface StreakChallengeCardProps {
  cards: CardType[];
  onStreakUpdated?: (streak: number) => void;
  onCorrectAnswer: (cardId: number) => void;
  onWrongAnswer: (cardId: number) => void;
  onNewRecord?: (streak: number) => void;
  onSessionComplete?: () => void; // Added onSessionComplete prop
}

export function StreakChallengeCard({ 
  cards, 
  onStreakUpdated,
  onCorrectAnswer,
  onWrongAnswer,
  onSessionComplete
}: StreakChallengeCardProps) {
  // Get saved best streak from localStorage
  const savedBestStreak = localStorage.getItem('streakRecord') || '0';
  
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(parseInt(savedBestStreak)); 
  const [currentCard, setCurrentCard] = useState<CardType | null>(null);
  const [completedCardIds, setCompletedCardIds] = useState<number[]>([]);
  const { toast } = useToast();
  const [shuffledCards, setShuffledCards] = useState<CardType[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const { useEmojiMode } = usePreferences();

  useEffect(() => {
    console.log(`STREAK: useEffect [cards] triggered. cards.length=${cards.length}, Cards IDs: ${cards.map(c => c.id).join(', ')}`);
    
    if (cards.length >= 4) {
      console.log(`STREAK: RESETTING completed card IDs. Previous value: ${JSON.stringify(completedCardIds)}`);
      // Reset everything when cards change
      setCompletedCardIds([]);
      const shuffled = shuffle([...cards]);
      setShuffledCards(shuffled);
      setCardIndex(0);
      // Select first card (none are completed yet)
      const randomIndex = Math.floor(Math.random() * shuffled.length);
      const firstCard = shuffled[randomIndex];
      console.log(`STREAK: Initial card selected: ${firstCard.id}`);
      setCurrentCard(firstCard);
      console.log(`STREAK: All available cards: ${cards.map(card => card.id).join(', ')}`);
    }
  }, [cards]);

  // This function is no longer used for card selection
  function getRandomCard(): CardType | null {
    const availableCards = cards.filter(card => !completedCardIds.includes(card.id));
    console.log(`STREAK: Available cards: ${availableCards.length} out of ${cards.length}`);
    console.log(`STREAK: Completed card IDs: ${JSON.stringify(completedCardIds)}`);

    if (availableCards.length === 0) {
      console.log("STREAK: No more available cards, ending session");
      toast({
        title: "🎉 All Cards Completed!",
        description: "You've gone through all available cards. Great job!"
      });
      setTimeout(() => {
        onSessionComplete?.();
      }, 2500);
      return null;
    }

    const randomIndex = Math.floor(Math.random() * availableCards.length);
    console.log(`STREAK: Selected card ${availableCards[randomIndex].id} at index ${randomIndex}`);
    return availableCards[randomIndex];
  }

  function handleAnswer(knew: boolean) {
    if (!currentCard) return;

    console.log(`STREAK: handleAnswer called. knew=${knew}, currentCard.id=${currentCard.id}`);
    console.log(`STREAK: completedCardIds before update: ${JSON.stringify(completedCardIds)}`);
    
    // Create a new array with all existing completed IDs plus the current card
    const updatedCompletedIds = [...completedCardIds];

    // Add the current card ID if it's not already in the list
    if (!updatedCompletedIds.includes(currentCard.id)) {
      updatedCompletedIds.push(currentCard.id);
      // Important: Update the state with the new array
      setCompletedCardIds(updatedCompletedIds);
      console.log(`STREAK: Added card ${currentCard.id} to completed IDs, now: ${JSON.stringify(updatedCompletedIds)}`);
      console.log(`STREAK: Total completed cards: ${updatedCompletedIds.length} of ${cards.length}`);

      if (knew) {
        const newStreak = currentStreak + 1;
        setCurrentStreak(newStreak);
        if (newStreak > bestStreak) {
          setBestStreak(newStreak);
          // Save the new record to localStorage
          localStorage.setItem('streakRecord', newStreak.toString());
        }
        onStreakUpdated?.(newStreak);
        onCorrectAnswer(currentCard.id);
      } else {
        setCurrentStreak(0);
        onWrongAnswer(currentCard.id);
      }
    }

    setFlipped(false); // Reset flipped state after answer
    setShowMnemonic(false); // Reset mnemonic state

    // Convert to array using Array.from to handle TypeScript iterations
    const uniqueCompletedIds = Array.from(new Set(updatedCompletedIds));

    if (uniqueCompletedIds.length >= cards.length) {
      console.log(`STREAK: All ${cards.length} cards completed!`);
      toast({
        title: "🔥 Well Done!",
        description: `You completed the streak challenge with a streak of ${currentStreak}!`,
        duration: 3000
      });
      setTimeout(() => {
        setCurrentCard(null);
        onSessionComplete?.();
      }, 2000);
      return;
    }

    // Make sure we're using the updated completedCardIds for filtering
    const availableCards = shuffledCards.filter(card => !updatedCompletedIds.includes(card.id));
    console.log(`STREAK: ${availableCards.length} cards still available after filtering`);
    console.log(`STREAK: Completed cards so far: ${JSON.stringify(updatedCompletedIds)}`);

    if (availableCards.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableCards.length);
      const nextCard = availableCards[randomIndex];
      console.log(`STREAK: Selected next card ${nextCard.id} from ${availableCards.length} available cards`);
      setCurrentCard(nextCard);
    } else {
      console.log(`STREAK: No more available cards!`);
      toast({
        title: "🎉 All Cards Completed!",
        description: "You've gone through all available cards. Great job!"
      });
      setTimeout(() => {
        setCurrentCard(null);
        onSessionComplete?.();
      }, 2000);
    }
  }

  const handleCardClick = () => {
    // Simply toggle the flipped state
    setFlipped(!flipped);
  };

  if (!currentCard || cards.length < 4) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <p>Need at least 4 cards for this mode! Create more cards to unlock it. 🎯</p>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          <span className="font-medium">Streak: {currentStreak}</span>
          {bestStreak > 0 && (
            <span className="text-sm text-muted-foreground">Best: {bestStreak}</span>
          )}
        </div>
      </div>

      <div 
        className={`relative cursor-pointer rounded-lg transition-all duration-500`}
        style={{ 
          height: "280px",
          perspective: "1000px"
        }}
      >
        <div 
          className="absolute w-full h-full"
          style={{ 
            transformStyle: "preserve-3d",
            transition: "transform 0.6s",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)"
          }}
          onClick={handleCardClick}
        >
          {/* Front of card */}
          <div 
            className="absolute w-full h-full flex flex-col justify-between p-6 border rounded-lg bg-card"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="flex flex-col items-center justify-center flex-1">
              <p className="text-2xl font-medium">{currentCard.sourceText}</p>
              <p className="text-muted-foreground text-sm mt-4">Click to flip</p>
            </div>
            
            {currentCard.explanation && (
              <div 
                className="w-full relative mt-2 min-h-[2rem]"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMnemonic(!showMnemonic);
                }}
              >
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-7 mx-auto block overflow-hidden transition-all duration-300 ease-in-out"
                  style={{
                    width: showMnemonic ? 'auto' : '120px',
                    minWidth: '120px',
                    maxWidth: showMnemonic ? '100%' : '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--btn-background)'
                  }}
                >
                  <span 
                    className={`transition-all duration-300 ease-in-out transform ${
                      showMnemonic ? 'translate-y-[-100%] opacity-0' : 'translate-y-0 opacity-100'
                    }`}
                  >
                    Show mnemonic
                  </span>
                  <span 
                    className={`transition-all duration-300 ease-in-out transform absolute ${
                      showMnemonic ? 'translate-y-0 opacity-100' : 'translate-y-[100%] opacity-0'
                    }`}
                  >
                    {currentCard.explanation}
                  </span>
                </Button>
              </div>
            )}
          </div>

          {/* Back of card */}
          <div 
            className="absolute w-full h-full flex flex-col justify-center items-center p-6 border rounded-lg bg-card"
            style={{ 
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)"
            }}
          >
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <p className="text-2xl font-medium">{currentCard.targetText}</p>
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => handleAnswer(false)}
                >
                  <XCircle className="h-4 w-4 mr-2"/> Didn't know
                </Button>
                <Button 
                  variant="default"
                  className="w-full"
                  onClick={() => handleAnswer(true)}
                >
                  <CheckCircle className="h-4 w-4 mr-2"/> Knew it
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* All controls are now directly within the card itself */}
    </Card>
  );
}