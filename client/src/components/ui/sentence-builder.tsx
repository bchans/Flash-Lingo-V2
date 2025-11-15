import React, { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { PlusCircle, CheckCircle, AlertTriangle, Shuffle, Play, Volume2, VolumeX, Trash2 } from 'lucide-react';

// Data structures based on Step 1: Define Data Structures
export interface NewWordInfo {
  text: string;
  explanation: string;
  isAdded?: boolean; // Client-side state to track if user clicked "Add to Vocab"
}

// Represents each part of the sentence to be displayed, including non-blank text
export interface OriginalSentencePart {
  text: string;        // The word/punctuation itself, or "___" for a blank
  isKnown: boolean;    // If the original word (before becoming "___") is known by user
  isBlank?: boolean;   // True if this part is a blank to be filled
  originalText?: string; // The actual word that "___" replaces
}

// New interface for structured source language translation
export interface SourceLanguageSentencePart {
  text: string;      // Text in source language
  isGap?: boolean;   // True if this part corresponds to a gap in the target language sentence
}

interface SentenceBuilderProps {
  scenarioTheme: string;
  scenarioThemeTranslated?: string; // Theme translated to source language
  scenarioContext: string; // This is kept for potential future use or other context, though not displayed directly
  sentenceToBuild: string; // The sentence string with "___" for blanks (used for keying effect hook)
  sourceLanguageTranslation?: SourceLanguageSentencePart[]; // Updated: translation of the sentence to build
  correctWordsForBlanks: string[]; // The actual words that should fill the blanks, in order
  distractorWords: string[]; // Words to mix with correct words in the word bank
  originalSentenceParts: OriginalSentencePart[]; // Detailed structure for rendering sentence
  newWordsInScenario: NewWordInfo[];
  onWordAddToVocab: (word: NewWordInfo) => Promise<void>;
  onNextSentence?: () => void;
  // New control props
  onPlayAudio?: (text: string) => void;
  isSoundEnabled?: boolean;
  targetLang?: string;

  // Progress props
  currentScenarioIndex?: number;
  totalScenarios?: number;
}

// Internal state for the word bank items
interface WordBankObject {
  id: number; // Unique ID for this instance in the bank (index from split sentence)
  text: string;
  selected: boolean; // Tracks if it's selected from the bank for the current sentence
}

// Internal state for words placed in sentence slots
interface SelectedSlotWord {
  id: number; // Original ID from word bank to trace back
  text: string;
}

const SentenceBuilder: React.FC<SentenceBuilderProps> = ({
  scenarioTheme,
  scenarioThemeTranslated,
  scenarioContext,
  sentenceToBuild, // Key for useEffects
  sourceLanguageTranslation, // New prop
  correctWordsForBlanks,
  distractorWords,
  originalSentenceParts,
  newWordsInScenario,
  onWordAddToVocab,
  onNextSentence,
  // New control props
  onPlayAudio,
  isSoundEnabled,
  targetLang,
  // Progress props
  currentScenarioIndex = 0,
  totalScenarios = 1,
}) => {
  // These are the actual words the user needs to fill into the blanks, in the correct order.
  const [targetWordsForBlanks, setTargetWordsForBlanks] = useState<string[]>([]);
  const [wordBankWords, setWordBankWords] = useState<WordBankObject[]>([]);
  // These are the words the user has currently placed into the blanks.
  const [selectedWordsInBlanks, setSelectedWordsInBlanks] = useState<SelectedSlotWord[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const [currentNewWords, setCurrentNewWords] = useState<NewWordInfo[]>([]);
  const [isAddingToVocab, setIsAddingToVocab] = useState<Record<string, boolean>>({}); // Tracks loading state for each add button

  useEffect(() => {
    setCurrentNewWords(newWordsInScenario.map(nw => ({ ...nw, isAdded: false })));
  }, [newWordsInScenario]);

  const shuffleArray = (array: WordBankObject[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  useEffect(() => {
    // Set the target words for the blanks
    setTargetWordsForBlanks(correctWordsForBlanks);

    // Create the word bank from correct words and distractors
    const bank = [
      ...correctWordsForBlanks.map((word, index) => ({ id: index, text: word, selected: false })),
      ...distractorWords.map((word, index) => ({ id: correctWordsForBlanks.length + index, text: word, selected: false }))
    ];
    setWordBankWords(shuffleArray(bank));

    // Reset state for the new sentence
    setSelectedWordsInBlanks([]);
    setIsCorrect(null);
    setShowConfetti(false); // Ensure confetti is hidden for a new sentence
    // currentNewWords is updated by its own useEffect based on newWordsInScenario prop
  }, [sentenceToBuild, correctWordsForBlanks, distractorWords]); // sentenceToBuild acts as a key for new scenarios

  const handleWordBankSelect = (wordObj: WordBankObject) => {
    // Only allow selection if not already correct and if there's space in blanks
    if (wordObj.selected || isCorrect !== null || selectedWordsInBlanks.length >= targetWordsForBlanks.length) {
      return;
    }
    setSelectedWordsInBlanks(prev => [...prev, { id: wordObj.id, text: wordObj.text }]);
    setWordBankWords(prevBank =>
      prevBank.map(w => w.id === wordObj.id ? { ...w, selected: true } : w)
    );
  };

  const handleWordSlotClick = (clickedWordInSlot: SelectedSlotWord, indexInSentence: number) => {
    if (isCorrect !== null) return; // Don't allow changes after checking if correct/incorrect
    setSelectedWordsInBlanks(prev => {
      const newSelectedWords = [...prev];
      newSelectedWords.splice(indexInSentence, 1); // Remove word from its slot
      return newSelectedWords;
    });
    // Make the word available again in the word bank
    setWordBankWords(prevBank =>
      prevBank.map(wbWord =>
        wbWord.id === clickedWordInSlot.id ? { ...wbWord, selected: false } : wbWord
      )
    );
  };

  const handleCheckAnswer = () => {
    if (selectedWordsInBlanks.length !== targetWordsForBlanks.length) return; // Ensure all blanks are filled

    const userFilledWords = selectedWordsInBlanks.map(sw => sw.text);
    const isSentenceCorrect = JSON.stringify(userFilledWords) === JSON.stringify(targetWordsForBlanks);
    setIsCorrect(isSentenceCorrect);

    if (isSentenceCorrect) {
      setShowConfetti(true);
      
      // Auto-play audio of the complete correct sentence if sound is enabled
      if (isSoundEnabled && onPlayAudio) {
        const completeSentence = originalSentenceParts
          .map((part, index) => {
            if (part.isBlank || part.text === "___") {
              const blankIndex = originalSentenceParts.filter(p => p.isBlank || p.text === "___").indexOf(part);
              return targetWordsForBlanks[blankIndex];
            }
            return part.text;
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        console.log('🔊 SENTENCE BUILDER: Auto-playing after correct answer:', completeSentence);
        setTimeout(() => {
          onPlayAudio(completeSentence);
        }, 500); // Small delay before playing audio
      }
      
      setTimeout(() => {
        setShowConfetti(false);
        // Call onNextSentence after a short delay to allow confetti to be seen
        if (onNextSentence) {
          onNextSentence();
        }
      }, 3000); // Confetti duration
    } else {
      // For wrong answers, keep correct words and empty incorrect gaps
      const newSelectedWords = selectedWordsInBlanks.filter((selectedWord, index) => {
        return selectedWord.text === targetWordsForBlanks[index];
      });
      
      // Update word bank to make incorrect words available again
      const incorrectWords = selectedWordsInBlanks.filter((selectedWord, index) => {
        return selectedWord.text !== targetWordsForBlanks[index];
      });
      
      setWordBankWords(prev => 
        prev.map(word => {
          const wasIncorrect = incorrectWords.some(iw => iw.id === word.id);
          return wasIncorrect ? { ...word, selected: false } : word;
        })
      );
      
      setSelectedWordsInBlanks(newSelectedWords);
      
      // Reset isCorrect after a short delay to allow retry
      setTimeout(() => {
        setIsCorrect(null);
      }, 1500);
    }
  };

  const handleLocalWordAddToVocab = async (wordToAdd: NewWordInfo) => {
    setIsAddingToVocab(prev => ({...prev, [wordToAdd.text]: true}));
    try {
      await onWordAddToVocab(wordToAdd); // Call the prop
      setCurrentNewWords(prev =>
        prev.map(nw => nw.text === wordToAdd.text ? {...nw, isAdded: true} : nw)
      );
      // Auto-close the dialog after 2 seconds
      setTimeout(() => {
        // Close popover by triggering a click outside
        document.dispatchEvent(new Event('click'));
      }, 2000);
    } catch (error) {
      // Handle error (e.g., show a toast)
      console.error("Failed to add word to vocab:", error);
    } finally {
      setIsAddingToVocab(prev => ({...prev, [wordToAdd.text]: false}));
    }
  };

  const renderTextWithNewWordHighlighting = (text: string, textType: 'context' | 'sentenceSlot') => {
    if (!text) return '';
    // Simple approach: split text into words and check each one.
    // This won't handle punctuation attached to words well without more complex regex.
    const words = text.split(/(\s+)/); // Split by space, keeping spaces for rejoining

    return words.map((word, index) => {
      const cleanWord = word.replace(/[.,!?;:]$/, '').toLowerCase(); // Basic cleaning for matching
      const matchedNewWord = currentNewWords.find(nw => nw.text.toLowerCase() === cleanWord);

      if (matchedNewWord) {
        return (
          <Popover key={`${textType}-word-${index}-${matchedNewWord.text}`}>
            <PopoverTrigger asChild>
              <span className={cn(
                "px-1 py-0.5 rounded-md cursor-pointer underline decoration-dotted",
                matchedNewWord.isAdded 
                  ? "bg-green-200 text-green-800 decoration-green-500" 
                  : "bg-yellow-200 text-yellow-800 decoration-yellow-500"
              )}>
                {word}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-auto max-w-xs p-4 text-sm shadow-xl rounded-lg">
              <p className="font-bold text-base mb-1">{matchedNewWord.text}</p>
              <p className="text-muted-foreground mb-3">{matchedNewWord.explanation}</p>
              {!matchedNewWord.isAdded && (
                 <Button
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => handleLocalWordAddToVocab(matchedNewWord)}
                    disabled={isAddingToVocab[matchedNewWord.text]}
                  >
                   {isAddingToVocab[matchedNewWord.text] ? <PlusCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Add to Vocabulary
                 </Button>
              )}
              {matchedNewWord.isAdded && (
                  <Button size="sm" variant="ghost" className="w-full text-xs text-green-600" disabled>
                      <CheckCircle className="mr-2 h-4 w-4" /> Added to Vocabulary
                  </Button>
              )}
            </PopoverContent>
          </Popover>
        );
      }
      return word; // Return the original word (or space) if not new
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl border rounded-xl">
      {showConfetti && <Confetti />}
      <CardHeader>
        {scenarioTheme && <h2 className="text-2xl font-bold text-center text-primary">{scenarioThemeTranslated || scenarioTheme}</h2>}
        {/* scenarioContext display removed as per user request */}
      </CardHeader>
      <CardContent className="space-y-8 pt-6 pb-8">
        <div
          aria-label="Sentence construction area"
          className={cn(
            "flex flex-wrap gap-2 p-4 border-2 border-dashed rounded-lg min-h-[120px] items-center justify-center bg-muted/20", // Changed back to min-h for flexibility
            isCorrect === true && 'border-green-500 bg-green-50/50',
            isCorrect === false && 'border-red-500 bg-red-50/50',
            isCorrect === null && 'border-muted'
          )}
        >
          {originalSentenceParts.map((part, index) => {
            if (part.isBlank) {
              // Find which word from selectedWordsInBlanks corresponds to this blank slot
              // This requires knowing the order of blanks.
              // Let's find the index of this blank among all blanks.
              const blankIndex = originalSentenceParts.filter(p => p.isBlank).indexOf(part);
              const wordInSlot = selectedWordsInBlanks[blankIndex];

              return (
                <Button
                  key={`slot-${index}`} // Use overall index for key
                  variant="outline"
                  className={cn(
                    "h-14 text-lg flex-grow basis-24 rounded-md flex items-center justify-center font-medium shadow-sm",
                    wordInSlot ? "text-foreground bg-background cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800" : "text-muted-foreground bg-background opacity-70",
                    isCorrect !== null && wordInSlot && "cursor-default hover:bg-background"
                  )}
                  onClick={() => wordInSlot && isCorrect === null && handleWordSlotClick(wordInSlot, blankIndex)}
                  onKeyDown={(e) => {
                    if (wordInSlot && isCorrect === null && (e.key === 'Backspace' || e.key === 'Delete')) {
                      handleWordSlotClick(wordInSlot, blankIndex);
                    }
                  }}
                  disabled={!wordInSlot || isCorrect !== null}
                  aria-label={wordInSlot ? `Selected word: ${wordInSlot.text}, click or press Backspace/Delete to remove` : `Empty slot ${blankIndex + 1}`}
                >
                  {wordInSlot ? renderTextWithNewWordHighlighting(wordInSlot.text, 'sentenceSlot') : <span className="italic text-muted-foreground/80">empty</span>}
                </Button>
              );
            } else {
              // This is a text part, not a blank
              return (
                <span
                  key={`text-${index}`}
                  className={cn(
                    "text-lg font-medium p-2",
                    part.isKnown ? "text-foreground" : "text-muted-foreground opacity-80" // Style unknown words differently if needed
                  )}
                >
                  {renderTextWithNewWordHighlighting(part.text, 'context')}
                </span>
              );
            }
          })}
        </div>

        {/* Source Language Translation Display */}
        {sourceLanguageTranslation && sourceLanguageTranslation.length > 0 && (
          <div className="text-sm text-muted-foreground text-center mt-2 mb-4 px-4 py-2 bg-accent/50 rounded-md min-h-fit">
            {sourceLanguageTranslation.map((part, index) => (
              <span key={`src-trans-${index}`} className={cn(part.isGap && "font-bold text-primary")}>
                {part.text}{' '} {/* Add space for readability between parts */}
              </span>
            ))}
          </div>
        )}

        <div
          aria-label="Word bank"
          className="flex flex-wrap gap-3 justify-center p-4 bg-muted/10 rounded-lg min-h-[100px]" // Changed back to min-h for flexibility
        >
          {wordBankWords.map((wordObj) => (
            <Button
              key={`wordbank-${wordObj.id}`}
              variant="outline"
              size="lg" // Larger buttons for easier interaction
              className={cn(
                "text-lg font-semibold transition-all duration-150 ease-in-out shadow hover:shadow-md", // Enhanced styling
                wordObj.selected && "opacity-30 cursor-not-allowed ring-2 ring-primary/50",
                !wordObj.selected && "hover:scale-[1.03] active:scale-[0.97] hover:bg-primary/5 dark:hover:bg-primary/10",
                isCorrect !== null && !wordObj.selected && "opacity-60 cursor-not-allowed" // Dim unselected words after check
              )}
              onClick={() => handleWordBankSelect(wordObj)}
              disabled={wordObj.selected || isCorrect !== null || selectedWordsInBlanks.length >= targetWordsForBlanks.length}
              aria-disabled={wordObj.selected || isCorrect !== null || selectedWordsInBlanks.length >= targetWordsForBlanks.length}
            >
              {wordObj.text}
            </Button>
          ))}
        </div>

        {/* The "New Vocabulary" box below is now removed as per user feedback.
            Highlighting in context is handled by renderTextWithNewWordHighlighting. */}

      </CardContent>
      <CardFooter className="flex flex-col items-center space-y-4 pt-6 border-t">
        <Button
          onClick={handleCheckAnswer}
          disabled={selectedWordsInBlanks.length !== targetWordsForBlanks.length || isCorrect !== null}
          className="w-full sm:w-auto py-6 text-lg font-bold" // Larger check button
          size="lg"
          aria-label="Check your answer"
        >
          Check Answer
        </Button>
        {isCorrect === true && !showConfetti && <p className="text-green-600 font-semibold text-lg mt-2">Correct! 🎉 Moving to next...</p>}
        {isCorrect === false && <p className="text-red-600 font-semibold text-lg mt-2">Not quite. Adjust your sentence or review new vocabulary.</p>}
      </CardFooter>
    </Card>
  );
};

export default SentenceBuilder;
