import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type Card as CardType } from "@shared/schema";
import { Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MultipleChoiceCardProps {
  cards: CardType[];
  onCorrectAnswer: (cardId: number) => void;
  onWrongAnswer: (cardId: number) => void;
  onSessionComplete: () => void;
}

export function MultipleChoiceCard({ 
  cards, 
  onCorrectAnswer, 
  onWrongAnswer,
  onSessionComplete 
}: MultipleChoiceCardProps) {
  const [currentCard, setCurrentCard] = useState<CardType | null>(null);
  const [currentCardId, setCurrentCardId] = useState<number | null>(null); // Added to track current card ID
  const [options, setOptions] = useState<string[]>([]);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [completedCardIds, setCompletedCardIds] = useState<number[]>([]);
  const [feedbackExiting, setFeedbackExiting] = useState(false);
  const { toast } = useToast();

  // Only run setupNewQuestion on initial mount, not on cards changes
  useEffect(() => {
    console.log("Initial mount useEffect", new Date().toISOString());
    if (cards.length >= 4) {
      setupNewQuestion("initial mount");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means this only runs once on mount

  function setupNewQuestion(caller = "unknown", updatedCompletedIds: number[] = completedCardIds) {
    console.log(`MCQ: setupNewQuestion called from ${caller} ${new Date().toISOString()}`);
    console.log(`MCQ: CompletedCardIds: ${JSON.stringify(updatedCompletedIds)}`);

    // Get available cards (not yet completed)
    const availableCards = cards.filter(card => !updatedCompletedIds.includes(card.id));
    console.log(`MCQ: Available cards: ${availableCards.length} out of ${cards.length}`);

    // If all cards have been completed correctly, return to study screen
    if (availableCards.length === 0 || updatedCompletedIds.length >= cards.length) {
      console.log(`MCQ: COMPLETION DETECTED! Completed ${updatedCompletedIds.length} of ${cards.length} cards`);
      
      // Call the session complete callback to return to study screen (without toast - will be handled in study.tsx)
      if (typeof onSessionComplete === 'function') {
        console.log("MCQ: Calling onSessionComplete from setupNewQuestion");
        onSessionComplete();
      } else {
        console.log("MCQ: onSessionComplete is not a function in setupNewQuestion");
      }

      return;
    }

    // Check if we're nearing completion of all cards
    if (updatedCompletedIds.length > 0) {
      console.log(`MCQ: Checking completion: ${updatedCompletedIds.length} vs ${cards.length}`);
      if (updatedCompletedIds.length >= cards.length - 1) {
        toast({
          title: "🎯 Almost Done!",
          description: "Just one more card to go!"
        });
      }
    }

    // Reset states for new question
    setIsAnswered(false);
    setSelectedAnswer(null);
    setFeedback(null);

    // Select a random card from available cards, avoiding the current card if possible
    let newCard;
    if (availableCards.length > 1 && currentCardId) {
      // If we have more than one card available, make sure we don't select the same card again
      const filteredCards = availableCards.filter(card => card.id !== currentCardId);
      const randomIndex = Math.floor(Math.random() * filteredCards.length);
      newCard = filteredCards[randomIndex];
    } else {
      // If only one card available or no current card, just pick randomly
      const randomIndex = Math.floor(Math.random() * availableCards.length);
      newCard = availableCards[randomIndex];
    }

    setCurrentCard(newCard);
    setCurrentCardId(newCard.id); // Update currentCardId

    // Generate options for the selected card
    generateOptionsForCard(newCard);
  }

  // Helper function to generate options for a card
  function generateOptionsForCard(card: CardType) {
    // Generate wrong options
    const correctAnswer = card.targetText;
    // Get 3 random wrong answers from cards (excluding the correct answer)
    const wrongOptions = cards
      .filter(otherCard => otherCard.targetText !== correctAnswer)
      .map(otherCard => otherCard.targetText)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    // Combine and shuffle all options
    const allOptions = [correctAnswer, ...wrongOptions].sort(() => Math.random() - 0.5);

    setOptions(allOptions);
  }

  function handleAnswer(answer: string) {
    setSelectedAnswer(answer);
    setIsAnswered(true);

    if (answer === currentCard?.targetText) {
      setFeedback('correct');
      setIsCorrect(true);
      onCorrectAnswer(currentCard.id);

      // Update completedCardIds to mark this card as correctly answered
      // Create a stable reference to the updated IDs array
      const updatedCompletedIds = [...completedCardIds, currentCard.id];
      setCompletedCardIds(updatedCompletedIds);
      console.log(`MCQ: Updated completedCardIds: ${JSON.stringify(updatedCompletedIds)}`);

      // Check for completion immediately after updating state
      if (updatedCompletedIds.length >= cards.length) {
        console.log(`MCQ: COMPLETION DETECTED in answer handler! Completed ${updatedCompletedIds.length} of ${cards.length} cards`);
        
        // Call the session complete callback right away (no toast - will be handled in study.tsx)
        if (typeof onSessionComplete === 'function') {
          console.log("MCQ: Calling onSessionComplete");
          onSessionComplete();
        } else {
          console.log("MCQ: onSessionComplete is not a function");
        }
        return;
      }

      // Set a timeout to move to the next question or end the round
      setTimeout(() => {
        // Start exit animation
        setFeedbackExiting(true);
        setTimeout(() => {
          setFeedback(null);
          setFeedbackExiting(false);
          setupNewQuestion("correct answer timeout", updatedCompletedIds);
        }, 300);
      }, 1200);
    } else {
      setFeedback('incorrect');
      setIsCorrect(false);
      onWrongAnswer(currentCard!.id);

      // For incorrect answers, also show the next question after a delay
      setTimeout(() => {
        // Start exit animation
        setFeedbackExiting(true);
        setTimeout(() => {
          setFeedback(null);
          setFeedbackExiting(false);
          setupNewQuestion("incorrect answer timeout", completedCardIds);
        }, 300);
      }, 1200);
    }
  }

  if (!currentCard || cards.length < 4) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <p>Need at least 4 cards for multiple choice mode! Create more cards to unlock this mode. 🎯</p>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-lg font-medium text-center">
        {currentCard.sourceText}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {options.map((option, index) => (
          <Button
            key={index}
            variant={selectedAnswer ? (
              option === currentCard.targetText ? "default" : 
              option === selectedAnswer ? "destructive" : "outline"
            ) : "outline"}
            className={`p-4 h-auto text-left transition-all duration-300 ${
              selectedAnswer && option === currentCard.targetText 
                ? 'animate-pulse bg-green-500 hover:bg-green-600 scale-105 shadow-lg' 
                : selectedAnswer && option === selectedAnswer && option !== currentCard.targetText
                ? 'animate-bounce bg-red-500 hover:bg-red-600 scale-95 shadow-md'
                : !selectedAnswer 
                ? 'hover:scale-105 hover:shadow-md transform transition-transform'
                : 'opacity-60'
            }`}
            onClick={() => handleAnswer(option)}
            disabled={!!selectedAnswer}
          >
            {option}
            {selectedAnswer && option === currentCard.targetText && (
              <Check className="h-5 w-5 ml-2 text-white animate-in zoom-in-50 duration-300" />
            )}
            {selectedAnswer && option === selectedAnswer && option !== currentCard.targetText && (
              <X className="h-5 w-5 ml-2 text-white animate-in zoom-in-50 duration-300" />
            )}
          </Button>
        ))}
      </div>

      {/* Pre-allocated space for feedback message with enter/exit animations */}
      <div className="h-12 flex items-center justify-center">
        {selectedAnswer && feedback && (
          <div className={`text-center font-medium transition-all duration-300 ${
            feedbackExiting 
              ? 'animate-out fade-out-0 slide-out-to-top-2 zoom-out-95'
              : feedback === 'correct' 
                ? 'text-green-500 animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95' 
                : 'text-red-500 animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95'
          }`}>
            {feedback === 'correct' ? (
              <span className="inline-flex items-center gap-2">
                <span>✨</span> 
                Correct! Great job!
                <span>🎉</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span>😅</span> 
                Keep practicing!
                <span>💪</span>
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}


// Dummy shuffle function - replace with your actual implementation
function shuffle(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}