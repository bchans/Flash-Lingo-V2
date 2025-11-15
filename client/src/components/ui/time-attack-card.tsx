import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress"; 
import { Badge } from "@/components/ui/badge";
import type { Card as CardType } from "@shared/schema";
import { Clock, Zap, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { shuffle } from "@/lib/utils";
import { usePreferences } from "@/lib/preferences-simple";

interface TimeAttackCardProps {
  cards: CardType[];
  onCorrectAnswer: (cardId: number) => void;
  onWrongAnswer: (cardId: number) => void;
  onSessionComplete?: () => void;
  timeLimit?: number; // Time limit in seconds, default is 60
}

export function TimeAttackCard({ 
  cards, 
  onCorrectAnswer,
  onWrongAnswer,
  onSessionComplete,
  timeLimit = 60 // 60 second default time limit
}: TimeAttackCardProps) {
  const [currentCard, setCurrentCard] = useState<CardType | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('timeAttackHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [shuffledCards, setShuffledCards] = useState<CardType[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const { toast } = useToast();
  const { useEmojiMode } = usePreferences();

  // Shuffle cards at start
  useEffect(() => {
    if (cards.length >= 4) {
      resetGame();
    }
  }, [cards]);

  // Timer countdown
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    
    if (gameActive && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timer);
            endGame();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gameActive, timeRemaining]);

  const resetGame = useCallback(() => {
    const shuffled = shuffle([...cards]);
    setShuffledCards(shuffled);
    setCurrentCard(shuffled[0]);
    setScore(0);
    setTimeRemaining(timeLimit);
    setGameActive(false);
    setGameOver(false);
    setFlipped(false);
    setShowMnemonic(false);
  }, [cards, timeLimit]);

  const startGame = () => {
    setGameActive(true);
    setGameOver(false);
  };

  const endGame = () => {
    setGameActive(false);
    setGameOver(true);
    
    // Update high score if needed
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('timeAttackHighScore', score.toString());
      
      toast({
        title: "🏆 New High Score!",
        description: `You set a new personal record of ${score} words!`,
        duration: 3000
      });
    }
    
    setTimeout(() => {
      if (onSessionComplete) {
        onSessionComplete();
      }
    }, 3000);
  };

  const handleAnswer = (knew: boolean) => {
    if (!currentCard || !gameActive) return;

    if (knew) {
      setScore(prev => prev + 1);
      onCorrectAnswer(currentCard.id);
    } else {
      onWrongAnswer(currentCard.id);
    }

    // Reset card state
    setFlipped(false);
    setShowMnemonic(false);

    // Get next card
    const nextCardIndex = Math.floor(Math.random() * shuffledCards.length);
    setCurrentCard(shuffledCards[nextCardIndex]);
  };

  const handleCardClick = () => {
    setFlipped(!flipped);
  };

  if (!currentCard || cards.length < 4) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <p>Need at least 4 cards for this mode! Create more cards to unlock it. 🎯</p>
      </div>
    );
  }

  if (gameOver) {
    return (
      <Card className="w-full max-w-2xl mx-auto p-6 space-y-6 text-center">
        <h2 className="text-2xl font-bold">Time's Up!</h2>
        <div className="py-6">
          <div className="text-5xl font-bold mb-4">{score}</div>
          <p className="text-muted-foreground">words completed</p>
          
          {score === highScore && score > 0 && (
            <Badge variant="secondary" className="mt-4 text-yellow-500">
              <Zap className="h-4 w-4 mr-1" /> New Record!
            </Badge>
          )}
          
          {score < highScore && (
            <p className="mt-4 text-sm text-muted-foreground">
              Your best: {highScore} words
            </p>
          )}
        </div>
        
        <Button onClick={resetGame} className="w-full">
          Play Again
        </Button>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-red-500" />
          <span className="font-medium">{timeRemaining} seconds</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          <span className="font-medium">Score: {score}</span>
          {highScore > 0 && (
            <span className="text-sm text-muted-foreground">Best: {highScore}</span>
          )}
        </div>
      </div>

      <Progress value={(timeRemaining / timeLimit) * 100} className="h-2" />

      {!gameActive ? (
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <h2 className="text-xl font-semibold">Time Attack Mode</h2>
          <p className="text-center text-muted-foreground">
            Answer as many cards as you can in {timeLimit} seconds!
          </p>
          <Button onClick={startGame} size="lg" className="mt-4">
            Start Game
          </Button>
        </div>
      ) : (
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
      )}
    </Card>
  );
}