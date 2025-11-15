import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveCard, db } from "@/lib/db";
import type { InsertCard } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { usePreferences } from "@/lib/preferences-simple";

interface GrammarLessonExercise {
  story: string;
  correctWordsForBlanks: string[];
  distractorWords: string[];
  explanation?: string;
}

interface GrammarLessonProps {
  lesson: {
    id?: number;
    title: string;
    explanation: string;
    exercises: GrammarLessonExercise[];
    newWords: { text: string; explanation: string }[];
    isExam?: boolean;
    lessonNumber?: number;
    icon?: string;
  };
  onComplete: () => void;
  onSuccess?: (lessonTitle: string, exerciseCount: number, lessonId?: number) => void;
}

export function GrammarLesson({ lesson, onComplete, onSuccess }: GrammarLessonProps) {
  const [step, setStep] = useState<'explanation' | 'vocabulary' | 'exercises' | 'results'>('explanation');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentBlankIndex, setCurrentBlankIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [addingWordIds, setAddingWordIds] = useState<Set<number>>(new Set());
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [lastShuffleKey, setLastShuffleKey] = useState('');
  const { toast } = useToast();
  const { languages } = usePreferences();

  // Handle option shuffling at the top level to avoid hooks rule violations
  useEffect(() => {
    if (step === 'exercises') {
      const currentExercise = lesson.exercises[currentExerciseIndex];
      const correctAnswer = currentExercise.correctWordsForBlanks[currentBlankIndex];
      const shuffleKey = `${currentExerciseIndex}-${currentBlankIndex}`;
      
      if (shuffleKey !== lastShuffleKey) {
        const allOptions = [...currentExercise.distractorWords, correctAnswer];
        setShuffledOptions([...allOptions].sort(() => Math.random() - 0.5));
        setLastShuffleKey(shuffleKey);
      }
    }
  }, [step, currentExerciseIndex, currentBlankIndex, lastShuffleKey, lesson.exercises]);

  // Remove this function as we now use steps

  const handleAnswer = (answer: string) => {
    const currentExercise = lesson.exercises[currentExerciseIndex];
    const correctAnswer = currentExercise.correctWordsForBlanks[currentBlankIndex];
    const correct = answer === correctAnswer;
    
    setIsCorrect(correct);
    setSelectedAnswer(answer);
    setUserAnswers([...userAnswers, answer]);
    
    // Move to next blank or exercise after a short delay to show feedback
    setTimeout(() => {
      setIsCorrect(null);
      setSelectedAnswer(null);
      setShowHint(false); // Reset hint for next question
      
      if (currentBlankIndex < currentExercise.correctWordsForBlanks.length - 1) {
        // Move to next blank in current exercise
        setCurrentBlankIndex(currentBlankIndex + 1);
      } else if (currentExerciseIndex < lesson.exercises.length - 1) {
        // Move to next exercise
        setCurrentExerciseIndex(currentExerciseIndex + 1);
        setCurrentBlankIndex(0);
        setUserAnswers([]);
      } else {
        // Completed all exercises - call success directly without results step
        setTimeout(async () => {
          if (onSuccess) {
            await onSuccess(lesson.title, lesson.exercises.length, (lesson as any).id);
          } else {
            if ((lesson as any).id) {
              await db.grammarLessons.update((lesson as any).id, { completed: true });
            }
            onComplete();
          }
        }, 1000); // Short delay to show the final correct answer
      }
    }, 1000);
  };

  // Step 1: Explanation
  if (step === 'explanation') {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="border-2">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-bold text-gray-800">
              {lesson.icon && <span className="mr-2">{lesson.icon}</span>}
              {lesson.title}
            </CardTitle>
            {lesson.isExam && (
              <p className="text-sm text-yellow-700 font-semibold mt-1">📝 EXAM</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold mb-4 text-blue-800 flex items-center gap-2">
                📚 Lesson Explanation
              </h4>
              <div className="text-gray-700 leading-relaxed">
                {lesson.explanation.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="mb-3 last:mb-0">{paragraph.trim()}</p>
                ))}
              </div>
            </div>
            
            <div className="pt-4 text-center">
              <Button 
                onClick={() => {
                  if (lesson.newWords.length > 0) {
                    setStep('vocabulary');
                  } else {
                    setStep('exercises');
                  }
                }} 
                className="px-8 py-3 text-lg font-semibold"
              >
                {lesson.newWords.length > 0 ? 'View New Vocabulary' : 'Start Exercises'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Vocabulary (only if there are new words)
  if (step === 'vocabulary' && lesson.newWords.length > 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="border-2">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-bold text-gray-800">
              {lesson.icon && <span className="mr-2">{lesson.icon}</span>}
              {lesson.title}
            </CardTitle>
            {lesson.isExam && (
              <p className="text-sm text-yellow-700 font-semibold mt-1">📝 EXAM</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold mb-4 text-yellow-800 flex items-center gap-2">
                ✨ New Vocabulary
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                These words will appear in your exercises. Add them to your vocabulary to practice later!
              </p>
              <div className="space-y-2">
                {lesson.newWords.map((word, index) => {
                  const isAdding = addingWordIds.has(index);
                  const isAdded = addingWordIds.has(-index - 1);
                  
                  return (
                    <div key={index} className="bg-white rounded-md p-3 border border-yellow-100 flex justify-between items-center">
                      <div>
                        <span className="font-medium text-gray-900">{word.text}</span>
                        <span className="text-gray-600 ml-2">- {word.explanation}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isAdding || isAdded}
                        className={`ml-4 h-8 w-8 p-0 ${
                          isAdded 
                            ? 'bg-green-100 border-green-300 text-green-700' 
                            : 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300'
                        }`}
                        onClick={async () => {
                          if (isAdding || isAdded) return;
                          
                          setAddingWordIds(prev => new Set(prev).add(index));
                          
                          try {
                            // Swap source and target: the foreign word is the target (what you're learning)
                            // and the explanation is the source (your native language)
                            await saveCard({
                              sourceText: word.explanation,  // Your native language explanation
                              targetText: word.text,         // Foreign language word you're learning
                              explanation: `Added from grammar lesson: ${lesson.title}`,
                              sourceLang: languages.nativeLang,   // Your native language
                              targetLang: languages.learningLang, // Language you're learning
                              type: 'word',
                              category: 'Grammar Lesson',
                              categoryEmoji: '📚',
                              learned: false,
                              proficiency: 0,
                              createdAt: new Date(),
                              lastStudied: null,
                              cachedScenarios: [],
                              hasScenario: false,
                              audioFileSource: null,
                              audioFileTarget: null
                            });
                            
                            toast({
                              title: "✨ Word Added",
                              description: `"${word.text}" has been added to your vocabulary.`,
                            });
                            
                            setAddingWordIds(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(index);
                              newSet.add(-index - 1);
                              return newSet;
                            });
                            
                          } catch (error) {
                            console.error('Failed to add vocabulary word:', error);
                            toast({
                              title: "Error",
                              description: "Failed to add word to vocabulary. Please try again.",
                              variant: "destructive"
                            });
                            
                            setAddingWordIds(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(index);
                              return newSet;
                            });
                          }
                        }}
                      >
                        {isAdding ? '...' : isAdded ? '✓' : '+'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="pt-4 text-center">
              <Button 
                onClick={() => setStep('exercises')} 
                className="px-8 py-3 text-lg font-semibold"
              >
                Start Exercises
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }


  // Step 3: Exercises
  if (step === 'exercises') {
    const currentExercise = lesson.exercises[currentExerciseIndex];
    
    // Clean the story text - remove any translation in parentheses for main display
    const cleanStory = currentExercise.story.replace(/\s*\([^)]*\)\s*/g, '').trim();
    const storyParts = cleanStory.split("___");
    const correctAnswer = currentExercise.correctWordsForBlanks[currentBlankIndex];
    
    // shuffledOptions are now managed at the top level

    // Fill in previous blanks in current exercise
    const filledAnswers = userAnswers.slice(0, currentBlankIndex);

    return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card className="border-2">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl font-bold text-gray-800">
            {lesson.icon && <span className="mr-2">{lesson.icon}</span>}
            {lesson.title} - Exercise {currentExerciseIndex + 1}/{lesson.exercises.length}
          </CardTitle>
          {lesson.isExam && (
            <p className="text-sm text-yellow-700 font-semibold mt-1">📝 EXAM</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Story with blank to fill */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="mb-4 text-lg">
              {storyParts.map((part, index) => (
                <span key={index}>
                  {part}
                  {index < filledAnswers.length && (
                    <span className="font-bold bg-green-200 px-2 py-1 rounded">{filledAnswers[index]}</span>
                  )}
                  {index === currentBlankIndex && index < storyParts.length - 1 && (
                    <span className="font-bold bg-yellow-200 px-2 py-1 rounded">___</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Translation below the sentence */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-700">
              <span className="font-medium">Translation:</span>
              <span className="ml-2 italic">
                {(() => {
                  // Try to extract translation from parentheses first
                  const parenthesesMatch = currentExercise.story.match(/\((.*?)\)/);
                  if (parenthesesMatch && parenthesesMatch[1]) {
                    // Return the source language translation without gaps
                    let translation = parenthesesMatch[1];
                    // Remove any gaps from translation - translations should never have blanks
                    translation = translation.replace(/___\s*/g, '');
                    return translation;
                  }
                  
                  // Try to extract from "English: ..." pattern
                  const englishMatch = currentExercise.story.match(/English:\s*(.+?)(?:\n|$)/i);
                  if (englishMatch && englishMatch[1]) {
                    let translation = englishMatch[1].trim();
                    // Remove any gaps from translation - translations should never have blanks
                    translation = translation.replace(/___\s*/g, '');
                    return translation;
                  }
                  
                  // Try to extract from translation field if available
                  if ((currentExercise as any).translation) {
                    return (currentExercise as any).translation;
                  }
                  
                  // Generate basic translation from the Vietnamese sentence  
                  const cleanStory = currentExercise.story.replace(/\([^)]*\)/g, '').trim();
                  // Create basic English translation structure - REMOVE gaps from translations
                  if (cleanStory.includes('Tôi')) return cleanStory.replace('Tôi', 'I').replace(/___\s*/g, '');
                  if (cleanStory.includes('Bố')) return cleanStory.replace('Bố', 'Father').replace(/___\s*/g, '');
                  if (cleanStory.includes('Bạn')) return cleanStory.replace('Bạn', 'You').replace(/___\s*/g, '');
                  
                  return cleanStory.replace(/___\s*/g, ''); // Remove all gaps from translation
                })()}
              </span>
            </div>
          </div>
          
          {/* Exercise explanation - expandable hint */}
          {currentExercise.explanation && (
            <div className="bg-green-50 border border-green-200 rounded-lg">
              <button 
                onClick={() => setShowHint(!showHint)}
                className="w-full p-4 text-left hover:bg-green-100 transition-colors"
              >
                <h4 className="font-semibold text-green-800 flex items-center gap-2">
                  💡 {showHint ? 'Hide Hint' : 'Show Hint'}
                  <span className="ml-auto text-sm">{showHint ? '▲' : '▼'}</span>
                </h4>
              </button>
              {showHint && (
                <div className="px-4 pb-4 border-t border-green-200">
                  <p className="text-green-700 mt-2">{currentExercise.explanation}</p>
                </div>
              )}
            </div>
          )}

          {/* Progress bar - shows completed questions (0% at start, fills to 100% on last answer) */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${selectedAnswer && currentExerciseIndex === lesson.exercises.length - 1 && currentBlankIndex === currentExercise.correctWordsForBlanks.length - 1 ? 100 : (currentExerciseIndex / lesson.exercises.length) * 100}%` }}
            ></div>
          </div>

          {/* Answer options */}
          <div className="grid grid-cols-2 gap-4">
            {shuffledOptions.map((option, index) => {
              const isCorrectOption = option === correctAnswer;
              const isSelectedOption = option === selectedAnswer;
              
              return (
                <Button
                  key={index}
                  variant={selectedAnswer ? (
                    isCorrectOption ? "default" : 
                    isSelectedOption ? "destructive" : "outline"
                  ) : "outline"}
                  className={`py-3 text-lg font-medium transition-all duration-300 ${
                    selectedAnswer && isCorrectOption
                      ? 'animate-pulse bg-green-500 hover:bg-green-600 scale-105 shadow-lg text-white' 
                      : selectedAnswer && isSelectedOption && !isCorrectOption
                      ? 'animate-bounce bg-red-500 hover:bg-red-600 scale-95 shadow-md text-white'
                      : !selectedAnswer 
                      ? 'hover:scale-105 hover:shadow-md transform transition-transform'
                      : 'opacity-60'
                  }`}
                  onClick={() => handleAnswer(option)}
                  disabled={!!selectedAnswer}
                >
                  {option}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
    );
  }

  // Default fallback (should not reach here)
  return null;
}
