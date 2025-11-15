import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Card as CardType } from "@shared/schema";
import { shuffle } from "@/lib/utils";
import { Calendar, CheckCircle, XCircle, Trophy } from "lucide-react";

interface DailyPracticeCardProps {
  cards: CardType[];
  onCorrectAnswer: (cardId: number) => void;
  onWrongAnswer: (cardId: number) => void;
  onSessionComplete?: () => void;
}

export function DailyPracticeCard({ 
  cards, 
  onCorrectAnswer, 
  onWrongAnswer,
  onSessionComplete 
}: DailyPracticeCardProps) {
  const [dailyCards, setDailyCards] = useState<CardType[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [progress, setProgress] = useState({ correct: 0, total: 0 });
  const DAILY_CARD_COUNT = 5;

  useEffect(() => {
    const today = new Date().toDateString();
    const lastPracticeDay = localStorage.getItem('lastPracticeDay');
    const shouldRefreshCards = lastPracticeDay !== today;

    if (shouldRefreshCards && cards.length >= 4) {
      // Prioritize cards that haven't been learned yet
      const unlearned = cards.filter(card => !card.learned);
      const learned = cards.filter(card => card.learned);
      const shuffledUnlearned = shuffle(unlearned);
      const shuffledLearned = shuffle(learned);
      
      // Take up to DAILY_CARD_COUNT cards, prioritizing unlearned ones
      const selectedCards = [
        ...shuffledUnlearned.slice(0, DAILY_CARD_COUNT),
        ...shuffledLearned.slice(0, Math.max(0, DAILY_CARD_COUNT - shuffledUnlearned.length))
      ].slice(0, DAILY_CARD_COUNT);

      setDailyCards(selectedCards);
      setCurrentCardIndex(0);
      setProgress({ correct: 0, total: 0 });
      localStorage.setItem('lastPracticeDay', today);
    }
  }, [cards]);

  function handleAnswer(knew: boolean) {
    if (currentCardIndex >= dailyCards.length) return;

    const currentCard = dailyCards[currentCardIndex];
    if (knew) {
      onCorrectAnswer(currentCard.id);
      setProgress(prev => ({ ...prev, correct: prev.correct + 1 }));
    } else {
      onWrongAnswer(currentCard.id);
    }
    setProgress(prev => ({ ...prev, total: prev.total + 1 }));

    setShowTranslation(false);
    if (currentCardIndex + 1 >= dailyCards.length) {
      onSessionComplete?.();
    } else {
      setCurrentCardIndex(prev => prev + 1);
    }
  }

  if (cards.length < 4) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <p>Need at least 4 cards for daily practice! Create more cards to unlock this mode. 🎯</p>
      </div>
    );
  }

  if (dailyCards.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <Trophy className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
        <p>You've completed today's practice! Come back tomorrow for new cards. 🌟</p>
        <p className="mt-2">Today's score: {progress.correct}/{progress.total}</p>
      </div>
    );
  }

  const currentCard = dailyCards[currentCardIndex];

  return (
    <Card className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-500" />
          <span className="font-medium">Daily Practice</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Card {currentCardIndex + 1}/{dailyCards.length}
        </div>
      </div>

      <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-700">
        <div
          className="bg-primary h-2.5 rounded-full transition-all"
          style={{ width: `${(currentCardIndex / dailyCards.length) * 100}%` }}
        ></div>
      </div>

      <div className="text-lg font-medium text-center">
        {currentCard.sourceText}
      </div>

      <Button 
        variant="outline" 
        className="w-full"
        onClick={() => setShowTranslation(!showTranslation)}
      >
        {showTranslation ? "Hide Translation" : "Show Translation"}
      </Button>

      {showTranslation && (
        <div className="space-y-4">
          <div className="text-lg font-medium text-primary text-center">
            {currentCard.targetText}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleAnswer(false)}
            >
              <XCircle className="h-4 w-4 mr-2 text-red-500" />
              Didn't Know
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleAnswer(true)}
            >
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              Knew It!
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
