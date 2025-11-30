import { useEffect, useState } from "react";
import { StudyCard } from "@/components/ui/study-card";
import { getCards, deleteCard, updateCard, saveCard, getCardsWithScenarios, saveCachedScenario, updateHasScenarioFlags, getCachedAudio, saveCardAudio, getGrammarLessons, saveGrammarLesson } from "@/lib/db";
import { db } from "@/lib/db";
import { firebaseAPI } from "@/lib/firebase-api";
import { base64ToAudio } from "@/lib/api";
import type { Card, InsertCard, InsertGrammarLesson } from "@shared/schema";
import { getAssetUrl } from "@/lib/asset-utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lightbulb, Target, Zap, Calendar, ChevronLeft, ChevronRight, Trophy, Star, BookOpen, Clock, Car, Settings, Shuffle, Trash2, ChevronDown, ChevronUp, Volume2, VolumeX, Play, Menu } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Card as CardUI, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StreakFireIndicator } from "@/components/ui/streak-fire-indicator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MultipleChoiceCard } from "@/components/ui/multiple-choice-card";
import { StreakChallengeCard } from "@/components/ui/streak-challenge-card";
import { DailyPracticeCard } from "@/components/ui/daily-practice-card";
import { TimeAttackCard } from "@/components/ui/time-attack-card";
import { DrivingGameCard } from "@/components/ui/driving-game";
import SentenceBuilder from "@/components/ui/sentence-builder";
import { GrammarLesson } from "@/components/ui/grammar-lesson";
import { usePreferences } from "@/lib/preferences-simple";
import { useAchievement } from "@/lib/achievement-context";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import type { NewWordInfo, SourceLanguageSentencePart } from "@/components/ui/sentence-builder"; // Import NewWordInfo
import { generateScenarioWithGemini, GeminiScenarioRequest, GeminiGeneratedScenarioData, generateGrammarLessonWithGemini, GrammarLessonData, getLessonIcon } from "@/lib/gemini"; // Added for Gemini integration

type StudyMode = 'flashcard' | 'multiple-choice' | 'streak' | 'daily' | 'time-attack' | 'driving-game' | 'sentence-builder' | 'grammar-lessons';

// Vocabulary levels (approximations)
const VOCAB_LEVELS = {
  A1: 500,
  A2: 1000,
  B1: 2000,
  B2: 4000,
  C1: 8000,
  C2: 16000,
};

// --- Sentence Builder Scenario Generation Logic ---
interface GeneratedScenario {
  scenarioTheme: string;
  // scenarioContext: string; // No longer used by SentenceBuilder display, but Gemini might generate it internally
  sentenceToBuild: string; // The sentence with blanks "___" (target language) - derived from originalSentenceParts
  sourceLanguageTranslation: SourceLanguageSentencePart[]; // Updated to structured type
  correctWordsForBlanks: string[];
  distractorWords: string[];
  newWordsInScenario: NewWordInfo[]; // Words unknown to user, with explanations
  originalSentenceParts: { text: string, isKnown: boolean, isBlank?: boolean, originalText?: string }[];
}

// SCENARIO_TEMPLATES, getUserVocabLevel, and the old generateConversationalScenario are removed.
// They will be replaced by a new function that calls Gemini.

// --- Helper function to extract cached scenarios ---
function extractCachedScenarios(cardsWithScenarios: Card[]): GeneratedScenario[] {
  const cachedScenarios: GeneratedScenario[] = [];
  
  cardsWithScenarios.forEach(card => {
    if (card.cachedScenarios && card.cachedScenarios.length > 0) {
      card.cachedScenarios.forEach(scenarioJson => {
        try {
          const scenario = JSON.parse(scenarioJson) as GeneratedScenario;
          cachedScenarios.push(scenario);
        } catch (error) {
          console.error('Error parsing cached scenario:', error);
        }
      });
    }
  });
  
  // Shuffle scenarios to avoid showing the same scenario order every time
  for (let i = cachedScenarios.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cachedScenarios[i], cachedScenarios[j]] = [cachedScenarios[j], cachedScenarios[i]];
  }
  
  return cachedScenarios;
}

// --- Helper function to save scenarios to cache ---
async function saveScenariosToCache(scenarios: GeneratedScenario[], allUserCards: Card[]): Promise<void> {
  console.log(`🔄 Starting to save ${scenarios.length} scenarios to cache...`);

  const wordToCardMap = new Map<string, Card>();
  allUserCards.forEach(card => {
    if (card.targetText && typeof card.targetText === 'string') {
      const cleanedText = card.targetText.toLowerCase().trim();
      if (cleanedText) {
        wordToCardMap.set(cleanedText, card);
      } else {
        console.warn(`[saveScenariosToCache] Card ID ${card.id} has empty targetText after cleaning.`);
      }
    } else {
      console.warn(`[saveScenariosToCache] Card ID ${card.id} has invalid targetText.`);
    }
  });

  console.log(`📋 Created word map with ${wordToCardMap.size} words from ${allUserCards.length} cards. Example keys: ${Array.from(wordToCardMap.keys()).slice(0,5).join(', ')}`);

  let savedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const scenario of scenarios) {
    let scenarioAssociated = false;

    // Prioritize matching with originalText from blank parts
    const blankParts = scenario.originalSentenceParts.filter(part => part.isBlank && part.originalText);

    console.log(`🔍 Checking scenario "${scenario.scenarioTheme}". Blank parts with originalText: ${blankParts.map(p => p.originalText).join(', ')}. CorrectWordsForBlanks: ${scenario.correctWordsForBlanks.join(', ')}`);

    for (const part of blankParts) {
      if (part.originalText) {
        const cleanOriginalText = part.originalText.toLowerCase().trim();
        const card = wordToCardMap.get(cleanOriginalText);
        console.log(`  Attempting match with originalText: "${part.originalText}" (cleaned: "${cleanOriginalText}")`);
        if (card && card.id) {
          try {
            await saveCachedScenario(card.id, JSON.stringify(scenario));
            console.log(`✅ Saved scenario "${scenario.scenarioTheme}" for card ID ${card.id} (word: "${part.originalText}") using originalText.`);
            await updateCard(card.id, { hasScenario: true }); // Explicitly update hasScenario
            savedCount++;
            scenarioAssociated = true;
            break;
          } catch (error) {
            console.error(`❌ Error saving scenario "${scenario.scenarioTheme}" for word "${part.originalText}" (card ID ${card.id}):`, error);
            failedCount++;
          }
        } else {
          console.log(`  No card found for originalText: "${cleanOriginalText}"`);
        }
      }
    }

    // If not associated, try matching with correctWordsForBlanks
    if (!scenarioAssociated) {
      for (const word of scenario.correctWordsForBlanks) {
        const cleanWord = word.toLowerCase().trim();
        const card = wordToCardMap.get(cleanWord);
        console.log(`  Attempting match with correctWordsForBlanks: "${word}" (cleaned: "${cleanWord}")`);
        if (card && card.id) {
          try {
            await saveCachedScenario(card.id, JSON.stringify(scenario));
            console.log(`✅ Saved scenario "${scenario.scenarioTheme}" for card ID ${card.id} (word: "${word}") using correctWordsForBlanks.`);
            await updateCard(card.id, { hasScenario: true }); // Explicitly update hasScenario
            savedCount++;
            scenarioAssociated = true;
            break;
          } catch (error) {
            console.error(`❌ Error saving scenario "${scenario.scenarioTheme}" for word "${word}" (card ID ${card.id}):`, error);
            failedCount++;
          }
        } else {
          console.log(`  No card found for correctWord: "${cleanWord}"`);
        }
      }
    }

    if (!scenarioAssociated) {
      // If still not associated, log the words from non-blank parts for debugging, but don't use them for primary association.
      const knownTexts = scenario.originalSentenceParts
        .filter(part => !part.isBlank && part.text)
        .map(part => part.text.toLowerCase().trim());
      console.log(`⚠️ No primary matching card found for scenario "${scenario.scenarioTheme}". Original blank texts: [${blankParts.map(p=>p.originalText).join(', ')}]. Correct words: [${scenario.correctWordsForBlanks.join(', ')}]. Known texts in scenario: [${knownTexts.join(', ')}]`);
      skippedCount++;
    }
  }

  console.log(`📊 Scenario caching complete: ${savedCount} saved, ${failedCount} failed, ${skippedCount} skipped`);
}

// --- New function to call Gemini and adapt its response ---
async function generateScenariosForSentenceBuilder(
  allUserCards: Card[],
  currentSourceLang: string, // User's native/UI language
  currentTargetLang: string,  // Language being learned
  onNewScenariosAvailable?: (scenarios: GeneratedScenario[]) => void // Callback for background scenarios
): Promise<GeneratedScenario[]> {
  console.log(`Generating scenarios for: SourceLang=${currentSourceLang}, TargetLang=${currentTargetLang}`);

  // 1. Get cards with cached scenarios
  const cardsWithScenarios = await getCardsWithScenarios();
  const cachedScenarios = extractCachedScenarios(cardsWithScenarios)
    .filter(scenario => scenario.sourceLanguageTranslation && scenario.sourceLanguageTranslation.length > 0); // Validate scenarios
  
  console.log(`Found ${cachedScenarios.length} cached scenarios`);

  // 2. Select up to 20 user cards relevant to the target language.
  // We prefer cards where targetLang matches currentTargetLang.
  // We'll take 'word' type cards primarily for scenario generation.
  const relevantUserCards = allUserCards
    .filter(card => card.targetLang === currentTargetLang && card.sourceLang === currentSourceLang) // Match current language pair
    .map(card => ({
      id: card.id,
      sourceText: card.sourceText, // in currentSourceLang
      targetText: card.targetText, // in currentTargetLang
      type: card.type || 'word',
      cachedScenarios: card.cachedScenarios || [],
      hasScenario: card.hasScenario || false
    }));

  // 3. Identify words without cached scenarios for API call (using hasScenario flag)
  const cardsWithoutScenarios = relevantUserCards.filter(card => 
    !card.hasScenario
  );

  console.log(`📊 Card filtering stats:
    - Total relevant cards: ${relevantUserCards.length}
    - Cards with scenarios: ${relevantUserCards.length - cardsWithoutScenarios.length}
    - Cards without scenarios: ${cardsWithoutScenarios.length}
    - Cards to send to Gemini: ${Math.min(cardsWithoutScenarios.length, 20)}`);

  // Log some examples of cards with/without scenarios
  if (relevantUserCards.length > 0) {
    const cardsWithScenarios = relevantUserCards.filter(card => 
      card.hasScenario
    );
    console.log(`🔍 Example cards with scenarios: ${cardsWithScenarios.slice(0, 3).map(c => c.targetText).join(', ')}`);
    console.log(`🔍 Example cards without scenarios: ${cardsWithoutScenarios.slice(0, 3).map(c => c.targetText).join(', ')}`);
  }

  // Randomize card selection instead of always using the first 20
  const shuffledCards = [...cardsWithoutScenarios].sort(() => Math.random() - 0.5);
  const cardsForGemini = shuffledCards.slice(0, 20);

  // 4. If we have cached scenarios, return them first
  if (cachedScenarios.length > 0) {
    console.log(`Returning ${cachedScenarios.length} cached scenarios immediately`);
    
    // If we have cards without scenarios, fetch new ones in background
    if (cardsForGemini.length > 0 && onNewScenariosAvailable) {
      // Log initial decision based on potentially stale data
      console.log(`🚀 Background fetch: Initial check suggests sending ${cardsForGemini.length} cards to Gemini (cards without scenarios).`);
      console.log(`📝 Initial words list for Gemini: ${cardsForGemini.map(c => c.targetText).join(', ')}`);
      
      // Fetch new scenarios in background without blocking
      setTimeout(async () => {
        try {
          // Re-fetch fresh card data from DB for the most up-to-date hasScenario flags
          console.log('[BG Fetch] Re-fetching cards from DB for accurate background processing...');
          const freshDbCards = await getCards(); // Fetches all cards fresh from DB

          // Re-apply relevance and hasScenario filtering based on fresh data
          const freshRelevantUserCards = freshDbCards
            .filter(card => card.targetLang === currentTargetLang && card.sourceLang === currentSourceLang)
            .map(card => ({
              id: card.id,
              sourceText: card.sourceText,
              targetText: card.targetText,
              type: card.type || 'word',
              cachedScenarios: card.cachedScenarios || [],
              hasScenario: card.hasScenario || false
            }));

          const freshCardsWithoutScenarios = freshRelevantUserCards.filter(card => !card.hasScenario);
          const finalCardsForGemini = [...freshCardsWithoutScenarios].sort(() => Math.random() - 0.5).slice(0, 20);

          console.log(`[BG Fetch] Fresh check: ${freshCardsWithoutScenarios.length} cards truly need scenarios.`);
          console.log(`[BG Fetch] Sending ${finalCardsForGemini.length} cards to Gemini.`);
          console.log(`[BG Fetch] Final words list for Gemini: ${finalCardsForGemini.map(c => c.targetText).join(', ')}`);

          if (finalCardsForGemini.length > 0) {
            const newScenarios = await fetchNewScenarios(finalCardsForGemini, currentSourceLang, currentTargetLang);
            if (newScenarios.length > 0) {
              // Pass allUserCards (the original complete list from component state) for context in saveScenariosToCache,
              // as it's used to build the wordToCardMap. The actual card data for hasScenario updates
              // is handled by card ID within saveScenariosToCache and saveCachedScenario.
              await saveScenariosToCache(newScenarios, allUserCards);
              console.log(`✅ Background fetch completed: ${newScenarios.length} new scenarios cached`);

              // To update the UI, fetch all cards again to get the latest scenario list
              const updatedCardsWithAllScenarios = await getCardsWithScenarios();
              const combinedScenarios = extractCachedScenarios(updatedCardsWithAllScenarios);
              const shuffledCombinedScenarios = [...combinedScenarios].sort(() => Math.random() - 0.5); // Shuffle for variety
              onNewScenariosAvailable(shuffledCombinedScenarios);
            } else {
              console.log(`⚠️ Background fetch returned no new scenarios (after fresh check).`);
            }
          } else {
            console.log(`✅ No background fetch truly needed after fresh check - all relevant cards have scenarios.`);
          }
        } catch (error) {
          console.error('❌ Background scenario fetch failed:', error);
        }
      }, 100); // Small delay to allow DB operations from foreground to settle if any race conditions were an issue.
    } else if (cardsForGemini.length === 0) {
      console.log(`✅ No background fetch needed - all cards (from potentially stale list) already have scenarios.`);
    }
    
    return cachedScenarios;
  }

  // 5. If no cached scenarios, fetch new ones immediately (foreground fetch)
  console.log(`No cached scenarios found, fetching ${cardsForGemini.length} new scenarios (foreground)`);
  const newScenarios = await fetchNewScenarios(cardsForGemini, currentSourceLang, currentTargetLang);
  
  if (newScenarios.length > 0) {
    // Pass allUserCards for context in saveScenariosToCache
    await saveScenariosToCache(newScenarios, allUserCards);
  }
  
  return newScenarios;
}

// --- Helper function to fetch new scenarios from Gemini ---
async function fetchNewScenarios(
  cardsForGemini: { id?: number; sourceText: string; targetText: string; type: 'word' | 'sentence' }[], // Adjusted type
  currentSourceLang: string,
  currentTargetLang: string
): Promise<GeneratedScenario[]> {
  if (cardsForGemini.length === 0) {
    console.warn("⚠️ No cards available for Gemini scenario generation.");
    return [];
  }

  console.log(`🤖 Calling Gemini API with ${cardsForGemini.length} cards:`, cardsForGemini.map(c => c.targetText).join(', '));

  const requestData: GeminiScenarioRequest = {
    userCards: cardsForGemini.map(c => ({ sourceText: c.sourceText, targetText: c.targetText, type: c.type as 'word' | 'sentence' })),
    sourceLang: currentSourceLang, // This is for explanations (user's native language)
    targetLang: currentTargetLang, // This is for the scenario content
  };

  console.log(`📤 Sending request to Gemini:`, {
    sourceLang: currentSourceLang,
    targetLang: currentTargetLang,
    wordCount: requestData.userCards.length,
    words: requestData.userCards.map(w => w.targetText)
  });

  try {
    const geminiResponse = await generateScenarioWithGemini(requestData);

    if (!geminiResponse || geminiResponse.length === 0) {
      console.error("Failed to generate scenarios with Gemini, response was null or empty.");
      return [];
    }

    // Adapt Gemini's response to GeneratedScenario interface
    const scenarios: GeneratedScenario[] = geminiResponse.map(geminiScenario => {
      let sentenceToBuildString = "";
      geminiScenario.sentenceParts.forEach(part => {
        sentenceToBuildString += part.text + " ";
      });
      sentenceToBuildString = sentenceToBuildString.trim();

      return {
        scenarioTheme: geminiScenario.scenarioTheme,
        originalSentenceParts: geminiScenario.sentenceParts.map(p => ({
          text: p.text === "___" ? "___" : p.text, // Keep ___ as is for blanks
          isKnown: p.isKnown || false, // Default to false if not provided
          isBlank: p.isBlank || p.text === "___", // Fix: also treat "___" text as blank even if isBlank is false
          originalText: p.originalText,
        })),
        sentenceToBuild: sentenceToBuildString, // Constructed string
        sourceLanguageTranslation: geminiScenario.sourceLanguageSentenceParts.map(part => ({
          ...part,
          isGap: false // Remove all gaps from source language - user shouldn't see gaps there
        })), // Remove gaps from source language translation
        correctWordsForBlanks: geminiScenario.correctWordsForBlanks,
        distractorWords: geminiScenario.distractorWords,
        newWordsInScenario: geminiScenario.newWordsInScenario.map(nw => ({
          text: nw.text, // In targetLang
          explanation: nw.explanation, // In sourceLang (user's native)
          isAdded: false // Default client-side state
        })),
      };
    });

    console.log(`Successfully adapted Gemini response to ${scenarios.length} GeneratedScenarios`);
    return scenarios;

  } catch (error) {
    console.error("Error in fetchNewScenarios:", error);
    return [];
  }
}

// --- End of new Gemini scenario generation logic ---

// Old template-based scenario generation logic has been removed.
// The new `generateScenarioForSentenceBuilder` function above uses Gemini.


export default function Study() {
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedMode, setSelectedMode] = useState<StudyMode | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const { toast } = useToast();
  const [streakRecord, setStreakRecord] = useState(0);
  const [completedCardIds, setCompletedCardIds] = useState<number[]>([]); 
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: "", message: "", emoji: "🎉" });
  const [successProgress, setSuccessProgress] = useState(0);
  const [mistralAPICalls, setMistralAPICalls] = useState(0); 
  const dailyGoal = 5; 
  const { useEmojiMode, toggleEmojiMode } = usePreferences();
  const [location, setLocation] = useLocation();
  const [studyAllCards, setStudyAllCards] = useState(true); // New state for flashcard mode
  const [showTrainingModes, setShowTrainingModes] = useState(false); // New state for training modes dropdown
  const [shuffleAnimation, setShuffleAnimation] = useState(false); // New state for shuffle animation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // New state for delete confirmation
  const [cardToDelete, setCardToDelete] = useState<number | null>(null); // Card ID to delete
  const [cardSlideDirection, setCardSlideDirection] = useState<'left' | 'right' | null>(null); // Card slide animation
  const [correctStreak, setCorrectStreak] = useState(0); // Track correct answers in a row
  const [showSparkleEffect, setShowSparkleEffect] = useState(false); // Sparkle effect state
  const [selectedTrainingMode, setSelectedTrainingMode] = useState<'all' | 'unlearned' | 'categories' | string | null>(null); // Pre-selected training mode
  const [showCategories, setShowCategories] = useState(false); // Show category selection
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [areOptionsVisible, setAreOptionsVisible] = useState(true);
  const [audioLoading, setAudioLoading] = useState<boolean>(false);

  // Helper function to convert language codes to BCP-47 format
  const convertToLanguageCode = (lang: string): string => {
    const langMap: { [key: string]: string } = {
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-BR',
      'ru': 'ru-RU',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'zh': 'zh-CN',
      'ar': 'ar-XA',
      'hi': 'hi-IN',
      'th': 'th-TH',
      'vi': 'vi-VN',
      'tr': 'tr-TR',
      'pl': 'pl-PL',
      'nl': 'nl-NL',
      'sv': 'sv-SE',
      'da': 'da-DK',
      'no': 'nb-NO',
      'fi': 'fi-FI',
      'cs': 'cs-CZ',
      'hu': 'hu-HU',
      'ro': 'ro-RO',
      'sk': 'sk-SK',
      'bg': 'bg-BG',
      'hr': 'hr-HR',
      'et': 'et-EE',
      'lv': 'lv-LV',
      'lt': 'lt-LT',
      'sl': 'sl-SI',
      'mt': 'mt-MT',
      'cy': 'cy-GB',
      'ga': 'ga-IE',
      'is': 'is-IS',
      'mk': 'mk-MK',
      'sq': 'sq-AL',
      'ca': 'ca-ES',
      'eu': 'eu-ES',
      'gl': 'gl-ES',
      'ms': 'ms-MY',
      'id': 'id-ID',
      'tl': 'tl-PH',
      'sw': 'sw-TZ',
      'am': 'am-ET',
      'he': 'he-IL',
      'fa': 'fa-IR',
      'ur': 'ur-PK',
      'bn': 'bn-BD',
      'gu': 'gu-IN',
      'kn': 'kn-IN',
      'ml': 'ml-IN',
      'mr': 'mr-IN',
      'ne': 'ne-NP',
      'pa': 'pa-IN',
      'si': 'si-LK',
      'ta': 'ta-IN',
      'te': 'te-IN',
      'my': 'my-MM',
      'km': 'km-KH',
      'lo': 'lo-LA',
      'ka': 'ka-GE',
      'hy': 'hy-AM',
      'az': 'az-AZ',
      'kk': 'kk-KZ',
      'ky': 'ky-KG',
      'mn': 'mn-MN',
      'uz': 'uz-UZ',
      'tk': 'tk-TM',
      'tg': 'tg-TJ',
    };

    return langMap[lang] || lang;
  };

  const handleTTS = async (text: string, side: 'front' | 'back') => {
    if (audioLoading) return;

    try {
      setAudioLoading(true);
      const card = cards[currentCardIndex];

      // Check for cached audio first
      const cachedAudio = await getCachedAudio(card.id);
      const audioField = side === 'front' ? 'source' : 'target';

      if (cachedAudio[audioField]) {
        // Use cached audio
        const audioUrl = base64ToAudio(cachedAudio[audioField]);
        const audio = new Audio(audioUrl);

        audio.addEventListener('loadeddata', () => {
          audio.play().catch(error => {
            console.error('Audio playback failed:', error);
            toast({
              title: "Audio Playback Failed",
              description: "Could not play audio. Please try again.",
              variant: "destructive"
            });
          });
        });

        audio.addEventListener('error', () => {
          toast({
            title: "Audio Error",
            description: "Failed to load audio file.",
            variant: "destructive"
          });
        });

        audio.addEventListener('ended', () => {
          URL.revokeObjectURL(audioUrl);
        });
      } else {
        // Generate new audio using Google Cloud TTS
        const language = side === 'front' ? card.sourceLang : card.targetLang;
        const languageCode = convertToLanguageCode(language);

        try {
          console.log('TTS Debug - text:', text, 'languageCode:', languageCode);
          const ttsResponse = await firebaseAPI.getGeminiTTS(text, languageCode);

          // Play the audio directly
          firebaseAPI.playBase64Audio(ttsResponse.audioContent);

          // Cache the audio for future use
          const audioBase64 = ttsResponse.audioContent;
          if (side === 'front') {
            await saveCardAudio(card.id, audioBase64, undefined);
          } else {
            await saveCardAudio(card.id, undefined, audioBase64);
          }

          toast({
            title: "🔊 Audio Generated",
            description: `Playing pronunciation for "${text}"`,
            duration: 2000,
          });

        } catch (error) {
          console.error('TTS error:', error);

          // Show error message to user
          toast({
            title: "Audio Generation Failed",
            description: "Could not generate audio. Please try again later.",
            variant: "destructive"
          });
        }
      }

    } catch (error) {
      console.error('TTS Error:', error);
      toast({
        title: "Audio Error",
        description: "Failed to generate audio. Please try again.",
        variant: "destructive"
      });
    } finally {
      setAudioLoading(false);
    }
  };


  // State for SentenceBuilder data
  const [availableScenarios, setAvailableScenarios] = useState<GeneratedScenario[]>([]);
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [currentScenarioData, setCurrentScenarioData] = useState<GeneratedScenario | null | undefined>(undefined); // undefined initially, null if error/no data
  const [isLoadingScenario, setIsLoadingScenario] = useState(false);
  const [cachedScenariosLoaded, setCachedScenariosLoaded] = useState(false);

  // State for GrammarLesson data
  const [grammarLesson, setGrammarLesson] = useState<GrammarLessonData | null>(null);
  const [isLoadingGrammarLesson, setIsLoadingGrammarLesson] = useState(false);
  const [grammarLessonError, setGrammarLessonError] = useState<string | null>(null);
  const [savedGrammarLessons, setSavedGrammarLessons] = useState<any[]>([]);
  const [selectedGrammarLessonId, setSelectedGrammarLessonId] = useState<number | null>(null);
  const [lessonCompletedForFX, setLessonCompletedForFX] = useState<{ id: number, element: HTMLElement | null } | null>(null);
  const [progressBarAnimationTrigger, setProgressBarAnimationTrigger] = useState(0);
  const [progressBarHeight, setProgressBarHeight] = useState(0);
  const [savedProgressBarHeight, setSavedProgressBarHeight] = useState(0); // New: tracks the "initial" height

  // Handle progress bar animation
  useEffect(() => {
    console.log('🔍 USEEFFECT TRIGGERED:', {
      lessonsLength: savedGrammarLessons.length,
      animationTrigger: progressBarAnimationTrigger,
      currentProgressBarHeight: progressBarHeight,
      savedProgressBarHeight: savedProgressBarHeight
    });

    if (savedGrammarLessons.length > 0) {
      const LESSON_V_SPACE = 160;
      const orderedLessons = [...savedGrammarLessons];
      let completedFromBottom = 0;
      
      console.log('🔍 LESSON ANALYSIS:');
      for (let i = 0; i < orderedLessons.length; i++) {
        console.log(`🔍 Lesson ${i}: ${orderedLessons[i].title}, completed: ${orderedLessons[i].completed}`);
        if (orderedLessons[i].completed) {
          completedFromBottom = i + 1;
        } else {
          break;
        }
      }
      
      const targetHeight = completedFromBottom * LESSON_V_SPACE;
      console.log('🔍 CALCULATED:', { completedFromBottom, targetHeight, savedProgressBarHeight });
      
      if (progressBarAnimationTrigger > 0) {
        // Animation mode: animate from saved height to new target height
        console.log('🎯 ANIMATION PATH: Starting animation from saved height:', savedProgressBarHeight, 'to target height:', targetHeight);
        
        // Start from saved height
        setProgressBarHeight(savedProgressBarHeight);
        
        // Then animate to target height after a small delay
        setTimeout(() => {
          console.log('🎯 ANIMATION PATH: Now animating to target height');
          setProgressBarHeight(targetHeight);
          
          // After animation completes (2000ms transition), update saved height
          setTimeout(() => {
            console.log('🎯 ANIMATION COMPLETE: Updating saved height to:', targetHeight);
            setSavedProgressBarHeight(targetHeight);
          }, 2000);
        }, 100);
      } else {
        // Initial load: use saved height, but if saved height doesn't match current state, update it
        if (savedProgressBarHeight !== targetHeight && savedProgressBarHeight === 0) {
          // First time loading - set both saved and current height
          console.log('🎯 FIRST LOAD: Setting both heights to:', targetHeight);
          setSavedProgressBarHeight(targetHeight);
          setProgressBarHeight(targetHeight);
        } else {
          // Normal load: use saved height
          console.log('🎯 NORMAL LOAD: Using saved height:', savedProgressBarHeight);
          setProgressBarHeight(savedProgressBarHeight);
        }
      }
    }
  }, [progressBarAnimationTrigger, savedGrammarLessons]);

  async function loadSavedGrammarLessons() {
    try {
      const lessons = await getGrammarLessons();
      console.log('📚 LESSON LOADING DEBUG - Raw lessons from database:', lessons);
      
      // Migration: Fix undefined completion status for existing lessons
      const lessonsNeedingMigration = lessons.filter(lesson => lesson.completed === undefined);
      if (lessonsNeedingMigration.length > 0) {
        console.log(`📚 MIGRATION: Fixing ${lessonsNeedingMigration.length} lessons with undefined completion status`);
        
        for (const lesson of lessonsNeedingMigration) {
          try {
            await db.grammarLessons.update(lesson.id, { completed: false });
            console.log(`📚 MIGRATION: Updated lesson ${lesson.id} completed status to false`);
          } catch (error) {
            console.error(`📚 MIGRATION ERROR: Failed to update lesson ${lesson.id}:`, error);
          }
        }
        
        // Reload lessons after migration
        const updatedLessons = await getGrammarLessons();
        console.log('📚 MIGRATION: Reloaded lessons after completion status fix');
        
        const parsedLessons = updatedLessons.map((lesson, index) => {
          const lessonNumber = lesson.lessonNumber || (index + 1);
          const isExam = lesson.isExam ?? false;
          return {
            ...lesson,
            completed: lesson.completed ?? false, // Ensure completed is always boolean
            isExam: isExam, // Ensure isExam is always boolean
            lessonNumber: lessonNumber, // Default lesson number based on position
            icon: lesson.icon || getLessonIcon(lessonNumber, isExam), // Generate icon if missing
            exercises: typeof lesson.exercises === 'string' ? JSON.parse(lesson.exercises) : lesson.exercises,
            newWords: lesson.newWords ? lesson.newWords.map(word => typeof word === 'string' ? JSON.parse(word) : word) : []
          };
        });
        
        setSavedGrammarLessons(parsedLessons);
      } else {
        const parsedLessons = lessons.map((lesson, index) => {
          const lessonNumber = lesson.lessonNumber || (index + 1);
          const isExam = lesson.isExam ?? false;
          return {
            ...lesson,
            completed: lesson.completed ?? false, // Ensure completed is always boolean
            isExam: isExam, // Ensure isExam is always boolean
            lessonNumber: lessonNumber, // Default lesson number based on position
            icon: lesson.icon || getLessonIcon(lessonNumber, isExam), // Generate icon if missing
            exercises: typeof lesson.exercises === 'string' ? JSON.parse(lesson.exercises) : lesson.exercises,
            newWords: lesson.newWords ? lesson.newWords.map(word => typeof word === 'string' ? JSON.parse(word) : word) : []
          };
        });
        
        console.log('📚 LESSON LOADING DEBUG - Parsed lessons with completion status:');
        parsedLessons.forEach((lesson, index) => {
          console.log(`📚 Lesson ${index}: ID=${lesson.id}, Title="${lesson.title}", Completed=${lesson.completed}, IsExam=${lesson.isExam}, LessonNumber=${lesson.lessonNumber}`);
        });
        
        setSavedGrammarLessons(parsedLessons);
      }
    } catch (error) {
      console.error("Error loading grammar lessons:", error);
    }
  }

  async function generateNewGrammarLesson() {
    setIsLoadingGrammarLesson(true);
    setGrammarLessonError(null); // Clear any previous errors
    try {
      // Enhanced duplicate prevention for unlimited lessons
      const allCachedLessons = await getGrammarLessons();
      
      // Sort by creation date (newest first) for recency context
      const sortedLessons = allCachedLessons.sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      
      // Calculate lesson number (total lessons + 1)
      const lessonNumber = allCachedLessons.length + 1;
      
      // Determine if this should be an exam (every 5 lessons: 5, 10, 15, etc.)
      const isExam = lessonNumber % 5 === 0 && lessonNumber > 0;
      
      // Multi-layer approach for duplicate prevention:
      // 1. Recent lessons (10 most recent for immediate context)
      const recentLessons = sortedLessons.slice(0, 10);
      
      // 2. For exams, get the last 4 lessons since last exam (or all if less)
      const lessonsSinceLastExam = isExam 
        ? sortedLessons.slice(0, 4).map(lesson => ({ 
            title: lesson.title, 
            explanation: lesson.explanation || '' 
          }))
        : recentLessons.map(lesson => ({ 
            title: lesson.title, 
            explanation: lesson.explanation || '' 
          }));
      
      // 3. All lesson titles for comprehensive duplicate checking (token-efficient)
      const allLessonTitles = allCachedLessons.map(lesson => lesson.title);
      
      // 4. Grammar concepts covered (extract key concepts from titles)
      const coveredConcepts = new Set();
      allLessonTitles.forEach(title => {
        // Extract key grammar terms to track concept coverage
        const concepts = title.toLowerCase().match(/\b(present|past|future|tense|conditional|subjunctive|imperative|participle|article|pronoun|adjective|adverb|preposition|conjunction|infinitive|gerund|perfect|continuous|passive|active|plural|singular|gender|agreement|negation|question|inversion|reflexive|modal|comparative|superlative)\b/g);
        if (concepts) concepts.forEach(concept => coveredConcepts.add(concept as string));
      });

      const lesson = await generateGrammarLessonWithGemini({
        userCards: cards.slice(0, 20),
        sourceLang: preferences.languages.nativeLang,
        targetLang: preferences.languages.learningLang,
        previousLessons: lessonsSinceLastExam,
        isExam,
        lessonNumber
      });

      if (lesson) {
        // Convert our format to database format - store all exercises as JSON
        const grammarLessonToSave: InsertGrammarLesson = {
          title: lesson.title,
          explanation: lesson.explanation,
          exercises: JSON.stringify(lesson.exercises),
          newWords: lesson.newWords.map(word => JSON.stringify(word)),
          isExam: lesson.isExam || false,
          lessonNumber: lesson.lessonNumber || lessonNumber
        };
        const savedLessonId = await saveGrammarLesson(grammarLessonToSave);
        console.log(`📚 New ${isExam ? 'exam' : 'lesson'} saved with ID: ${savedLessonId}`);
        
        // Reload saved lessons to show the new one
        await loadSavedGrammarLessons();
        
        // Include the ID in the lesson object for completion tracking
        const lessonWithId = {
          ...lesson,
          id: savedLessonId
        };
        console.log(`📚 Setting grammar lesson with ID: ${savedLessonId}`, lessonWithId);
        setGrammarLesson(lessonWithId);
      } else {
        throw new Error('Failed to generate lesson');
      }
    } catch (error) {
      console.error("Error generating grammar lesson:", error);
      
      // Set a more specific error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
        setGrammarLessonError('The AI response was incomplete. This often happens due to high demand.');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        setGrammarLessonError('Network connection issue. Please check your internet.');
      } else {
        setGrammarLessonError('Failed to generate lesson. The AI service might be overloaded.');
      }
      
      toast({
        variant: "destructive",
        title: "❌ Grammar Lesson Generation Failed",
        description: "Click the retry button to try again.",
      });
    } finally {
      setIsLoadingGrammarLesson(false);
    }
  }

  async function loadSavedGrammarLesson(lessonId: number) {
    try {
      const lessons = await getGrammarLessons();
      const dbLesson = lessons.find(l => l.id === lessonId);
      
      if (dbLesson) {
        // Find the lesson's position to determine lessonNumber if not set
        const lessonIndex = lessons.findIndex(l => l.id === lessonId);
        const lessonNumber = dbLesson.lessonNumber || (lessonIndex + 1);
        const isExam = dbLesson.isExam ?? false;
        
        // Convert database format to our component format - parse exercises from JSON
        const componentLesson: GrammarLessonData & { id: number } = {
          id: dbLesson.id, // Include the ID so it can be marked as completed
          title: dbLesson.title,
          explanation: dbLesson.explanation,
          exercises: JSON.parse(dbLesson.exercises),
          newWords: dbLesson.newWords ? dbLesson.newWords.map(word => {
            try {
              return JSON.parse(word);
            } catch {
              return { text: word, explanation: '' };
            }
          }) : [],
          isExam: isExam,
          lessonNumber: lessonNumber,
          icon: dbLesson.icon || getLessonIcon(lessonNumber, isExam)
        };
        console.log(`📚 Loading lesson with ID: ${dbLesson.id}, completed: ${dbLesson.completed}, isExam: ${isExam}, icon: ${componentLesson.icon}`);
        setGrammarLesson(componentLesson);
        setSelectedGrammarLessonId(lessonId);
      }
    } catch (error) {
      console.error("Error loading saved grammar lesson:", error);
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Failed to load saved lesson",
      });
    }
  }

  async function handleGrammarLessonComplete(lessonTitle: string, exerciseCount: number, lessonId?: number) {
    console.log('🔥 COMPLETION HANDLER CALLED:', { lessonTitle, exerciseCount, lessonId });
    
    // Check if this is an exam
    const isExam = grammarLesson?.isExam || false;
    
    // Mark lesson as completed in database first, but don't update local state yet
    if (lessonId) {
      console.log(`🔄 Marking lesson ${lessonId} as completed in handleGrammarLessonComplete`);
      try {
        await db.grammarLessons.update(lessonId, { completed: true });
        console.log(`✅ Successfully marked lesson ${lessonId} as completed`);
        
        // Verify the update worked
        const updatedLesson = await db.grammarLessons.get(lessonId);
        console.log('🔍 VERIFICATION - Updated lesson from DB:', updatedLesson);
      } catch (error) {
        console.error(`❌ Error marking lesson as completed:`, error);
      }
    } else {
      console.warn('⚠️ No lesson ID provided to handleGrammarLessonComplete');
    }

    // Show success screen with shorter, generic messages
    console.log('🎬 SUCCESS SCREEN: Starting to show success screen');
    setSuccessMessage({
      title: isExam ? "Exam Passed! 🎓" : "Lesson Complete!",
      message: isExam 
        ? "Excellent work! You're making great progress!"
        : "Great job! Keep up the good work!",
      emoji: isExam ? "🎓" : "📚"
    });
    setShowSuccessScreen(true);
    console.log('🎬 SUCCESS SCREEN: Success screen is now visible');
    
    // Wait for progress bar animation (700ms) + buffer = 1200ms, then check achievements and go back
    setTimeout(async () => {
      console.log('🎬 SUCCESS SCREEN: Success screen timeout completed, checking achievements');
      await checkAchievements();
      
      console.log('🎬 SUCCESS SCREEN: Hiding success screen and navigating back');
      setShowSuccessScreen(false);
      setGrammarLesson(null);
      setSelectedTrainingMode(null);
      setSelectedGrammarLessonId(null);
      console.log('🔄 Navigating back to Grammar Lessons after success screen');
      
      // NOW update local state to trigger animation after success screen is completely done
      if (lessonId) {
        console.log('🔄 Now updating local state after success screen - setSavedGrammarLessons called');
        setSavedGrammarLessons(prevLessons => 
          prevLessons.map(lesson => 
            lesson.id === lessonId ? { ...lesson, completed: true } : lesson
          )
        );
        
        // TRIGGER ANIMATION after state update
        console.log('🎯 Triggering progress bar animation');
        setProgressBarAnimationTrigger(prev => prev + 1);
      }
    }, 1200); // 1.2s total (0.7s animation + 0.5s delay)
  }

  // Handle drag end for study mode items (placeholder for now)
  const handleDragEnd = (result: DropResult) => {
    // We don't need to reorder these items currently, but the drag functionality is available
    console.log('Study mode drag ended:', result);
  };

  const toggleStyle = () => {
    toggleEmojiMode();
  };

  const preferences = usePreferences(); // Get preferences for language defaults

  const minimalFlashcardStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <BookOpen size={28} />
      </div>
      <CardTitle>Classic Flashcards</CardTitle>
    </div>
  );

  const decoratedFlashcardStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <div className="text-2xl">📝</div>
      </div>
      <CardTitle>Classic Flashcards</CardTitle>
    </div>
  );

  const minimalMultipleChoiceStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <Target size={28} />
      </div>
      <CardTitle>Multiple Choice</CardTitle>
    </div>
  );

  const decoratedMultipleChoiceStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <div className="text-2xl">🎯</div>
      </div>
      <CardTitle>Multiple Choice</CardTitle>
    </div>
  );

  const minimalStreakStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <Zap size={28} />
      </div>
      <CardTitle>Streak Challenge</CardTitle>
    </div>
  );

  const decoratedStreakStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <div className="text-2xl">⚡</div>
      </div>
      <CardTitle>Streak Challenge</CardTitle>
    </div>
  );

  const minimalDailyStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <Calendar size={28} />
      </div>
      <CardTitle>Daily Practice</CardTitle>
    </div>
  );

  const decoratedDailyStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <div className="text-2xl">📅</div>
      </div>
      <CardTitle>Daily Practice</CardTitle>
    </div>
  );
  
  const minimalTimeAttackStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <Clock size={28} />
      </div>
      <CardTitle>Time Attack</CardTitle>
    </div>
  );
  
  const decoratedTimeAttackStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <div className="text-2xl">⏱️</div>
      </div>
      <CardTitle>Time Attack</CardTitle>
    </div>
  );
  
  const minimalDrivingGameStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <Car size={28} />
      </div>
      <CardTitle>Flash Hour</CardTitle>
    </div>
  );
  
  const decoratedDrivingGameStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <div className="text-2xl">🚗</div>
      </div>
      <CardTitle>Flash Hour</CardTitle>
    </div>
  );

  const minimalSentenceBuilderStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <Settings size={28} />
      </div>
      <CardTitle>Sentence Builder</CardTitle>
    </div>
  );

  const decoratedSentenceBuilderStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <div className="text-2xl">🔧</div>
      </div>
      <CardTitle>Sentence Builder</CardTitle>
    </div>
  );

  const minimalGrammarLessonsStyle = (
    <div className="flex items-center gap-3">
      <div
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center"
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <BookOpen size={28} />
      </div>
      <CardTitle>Grammar Lessons</CardTitle>
    </div>
  );

  const decoratedGrammarLessonsStyle = (
    <div className="flex items-center gap-3">
      <div
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center"
        onClick={(e) => { e.stopPropagation(); toggleStyle(); }}
        style={{ width: "44px", height: "44px" }}
      >
        <div className="text-2xl">🎓</div>
      </div>
      <CardTitle>Grammar Lessons</CardTitle>
    </div>
  );


  useEffect(() => {
    loadCards();
    const storedAPICalls = localStorage.getItem('mistralAPICalls');
    if (storedAPICalls) {
      setMistralAPICalls(parseInt(storedAPICalls, 10));
    }
  }, []);

  useEffect(() => {
    async function fetchScenarios() {
      if (selectedMode === 'sentence-builder' && cards.length > 0) {
        // Always fetch/reshuffle scenarios when entering sentence builder mode
        setIsLoadingScenario(true);
        setCurrentScenarioData(undefined); // Clear previous scenario while loading
        setCachedScenariosLoaded(false);
        
        // Determine source and target languages for the scenario
        const currentCardForLang = cards[currentCardIndex] || cards[0];
        const sourceLang = currentCardForLang?.sourceLang || preferences.languages.nativeLang || "en";
        const targetLang = currentCardForLang?.targetLang || preferences.languages.learningLang || "fr";

        console.log(`Fetching scenarios (cached first). Source: ${sourceLang}, Target: ${targetLang}`);

        try {
          // Define callback for new scenarios from background fetch
          const handleNewScenarios = async (newScenarios: GeneratedScenario[]) => {
            console.log(`Received ${newScenarios.length} updated scenarios from background fetch`);
            
            // Apply category filtering to new scenarios as well
            const cardMap = new Map(cards.map(card => [card.targetText.toLowerCase(), card]));
            let filteredNewScenarios = newScenarios;
            
            if (selectedTrainingMode === 'unlearned') {
              filteredNewScenarios = newScenarios.filter(scenario => {
                const card = cardMap.get(scenario.correctWordsForBlanks[0]?.toLowerCase());
                return card && !card.learned;
              });
            } else if (selectedTrainingMode && selectedTrainingMode !== 'all') {
              filteredNewScenarios = newScenarios.filter(scenario => {
                const card = cardMap.get(scenario.correctWordsForBlanks[0]?.toLowerCase());
                return card && card.category === selectedTrainingMode;
              });
            }
            
            console.log(`Filtered to ${filteredNewScenarios.length} scenarios for training mode: ${selectedTrainingMode}`);
            
            // Shuffle the filtered scenarios to ensure variety
            const shuffledScenarios = [...filteredNewScenarios];
            for (let i = shuffledScenarios.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffledScenarios[i], shuffledScenarios[j]] = [shuffledScenarios[j], shuffledScenarios[i]];
            }
            setAvailableScenarios(shuffledScenarios);
            // Don't change current scenario if user is already interacting
            if (currentScenarioIndex < shuffledScenarios.length) {
              setCurrentScenarioData(shuffledScenarios[currentScenarioIndex]);
            }
          };

          const scenarios = await generateScenariosForSentenceBuilder(
            cards,
            sourceLang,
            targetLang,
            handleNewScenarios
          );

          // Create a map of targetText to card for efficient lookup
          const cardMap = new Map(cards.map(card => [card.targetText.toLowerCase(), card]));

          // Filter scenarios based on the selected training mode
          let filteredScenarios = scenarios;
          if (selectedTrainingMode === 'unlearned') {
            filteredScenarios = scenarios.filter(scenario => {
              const card = cardMap.get(scenario.correctWordsForBlanks[0]?.toLowerCase());
              return card && !card.learned;
            });
          } else if (selectedTrainingMode && selectedTrainingMode !== 'all') {
            filteredScenarios = scenarios.filter(scenario => {
              const card = cardMap.get(scenario.correctWordsForBlanks[0]?.toLowerCase());
              return card && card.category === selectedTrainingMode;
            });
          }

          // Shuffle scenarios every time we enter sentence builder
          const shuffledScenarios = [...filteredScenarios];
          for (let i = shuffledScenarios.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledScenarios[i], shuffledScenarios[j]] = [shuffledScenarios[j], shuffledScenarios[i]];
          }

          setAvailableScenarios(shuffledScenarios);
          setCurrentScenarioIndex(0);
          setCachedScenariosLoaded(true);

          if (shuffledScenarios.length > 0) {
            setCurrentScenarioData(shuffledScenarios[0]);
            console.log(`Loaded ${shuffledScenarios.length} scenarios for sentence builder (cached: ${shuffledScenarios.length})`);
          } else {
            setCurrentScenarioData(null);
            console.log('No scenarios available for current cards');
          }
        } catch (error) {
          console.error('Error loading scenarios:', error);
          setCurrentScenarioData(null);
        } finally {
          setIsLoadingScenario(false);
        }
      }
    }

    // Load cards for all modes when selectedMode or selectedTrainingMode changes
    if (selectedMode) {
      loadCards();
    }
    // Only fetch scenarios if the mode is sentence-builder and a training mode has been selected.
    if (selectedMode === 'sentence-builder' && selectedTrainingMode) {
      fetchScenarios();
    }

    if (selectedMode === 'grammar-lessons' && selectedTrainingMode === null) {
      loadSavedGrammarLessons();
    }
  }, [selectedMode, selectedTrainingMode, preferences.languages.nativeLang, preferences.languages.learningLang]); // Always run when mode changes

  async function loadCards() {
    const savedCards = await getCards();
    
    // Run migration to update hasScenario flags for existing cards
    await updateHasScenarioFlags();
    
    // Filter out sentences for specific modes that work better with words only
    const wordOnlyModes = ['multiple-choice', 'driving-game', 'daily', 'time-attack'];
    let filteredCards = savedCards;
    
    if (wordOnlyModes.includes(selectedMode || '')) {
      filteredCards = savedCards.filter(card => card.type === 'word');
    }
    
    // Apply training mode filtering for all modes when selectedTrainingMode is set
    let finalCards = filteredCards;
    if (selectedTrainingMode === 'unlearned') {
      // Show only unlearned cards
      finalCards = filteredCards.filter(card => !card.learned);
    } else if (selectedTrainingMode && selectedTrainingMode !== 'all') {
      // Show cards from specific category
      finalCards = filteredCards.filter(card => card.category === selectedTrainingMode);
    }
    
    // Auto-shuffle for flashcard mode to ensure different order each time
    if (selectedMode === 'flashcard' && finalCards.length > 1) {
      finalCards = [...finalCards].sort(() => Math.random() - 0.5);
      console.log('🔀 Auto-shuffled flashcards for study session');
    }
    
    setCards(finalCards);
  }

  async function handleDelete(id: number) {
    setCardToDelete(id);
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (!cardToDelete) return;
    
    try {
      await deleteCard(cardToDelete);
      await loadCards();
      toast({
        title: "🗑️ Card deleted",
        description: "Translation card has been removed"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Failed to delete card"
      });
    } finally {
      setShowDeleteConfirm(false);
      setCardToDelete(null);
    }
  }

  function handleStatusChange(cardId: number, learned: boolean) {
    console.log('CARD TRANSITION - handleStatusChange called:', { cardId, learned, currentCardIndex, totalCards: cards.length, currentCardText: cards[currentCardIndex]?.sourceText, nextCardText: cards[currentCardIndex + 1]?.sourceText });
    
    // Start slide animation based on answer
    setCardSlideDirection(learned ? 'right' : 'left');
    console.log('CARD TRANSITION - Slide direction set:', learned ? 'right' : 'left', 'for card:', cards[currentCardIndex]?.sourceText);
    
    // Update streak for correct/incorrect answers
    if (learned) {
      const newStreak = correctStreak + 1;
      setCorrectStreak(newStreak);
      // Check if this is a new streak record
      const currentRecord = parseInt(localStorage.getItem('streakRecord') || '0');
      if (newStreak > currentRecord) {
        localStorage.setItem('streakRecord', newStreak.toString());
        setStreakRecord(newStreak);
        toast({
          title: "🔥 New Streak Record!",
          description: `Amazing! You've reached a streak of ${newStreak}!`
        });
      }
    } else {
      // Reset streak on wrong answer
      setCorrectStreak(0);
    }
    
    // Wait for slide animation to complete, then teleport the card
    setTimeout(() => {
      const card = cards.find(c => c.id === cardId);
      if (card && learned) {
        updateCard(cardId, { 
          learned,
          proficiency: (card.proficiency || 0) + 1,
          lastStudied: new Date().toISOString() as unknown as Date
        });
        const todayProgress = parseInt(localStorage.getItem('todayProgress') || '0');
        localStorage.setItem('todayProgress', Math.min(todayProgress + 1, dailyGoal).toString());
        setCompletedCardIds([...completedCardIds, cardId]); // Add completed card ID

        //Check for first success achievement
        const checkFirstSuccess = async () => {
          const allCards = await getCards();
          const learnedCards = allCards.filter(card => card.learned);
          if (learnedCards.length === 1) {
            const achievement = {
              id: "first-learned",
              name: "First Success",
              description: "Master your first card"
            };
            showAchievement(achievement);
          }
        };
        checkFirstSuccess();
      }
      
      // Move to next card
      if (currentCardIndex >= cards.length - 1) {
        // Show success screen when reaching the last card (regardless of whether it was marked as learned)
        if (!showSuccessScreen && selectedMode === 'flashcard') {
          console.log('SUCCESS SCREEN: Displaying "You did it!" animation from handleStatusChange');
          // For the last card, show success screen immediately without particle animation
          setSuccessMessage({
            title: "You did it!",
            message: "You've completed all the flashcards in this set. Keep up the good work!",
            emoji: "🎉"
          });
          setShowSuccessScreen(true);
          // Wait for progress bar animation (700ms) + buffer = 1200ms, then check achievements and go back
          setTimeout(async () => {
            await checkAchievements();
            handleBackToModes();
          }, 1200);
        }
      } else {
        console.log('CARD TRANSITION - Moving to next card:', currentCardIndex + 1, 'card text:', cards[currentCardIndex + 1]?.sourceText);
        setCurrentCardIndex(prev => {
          const newIndex = prev + 1;
          console.log('CARD TRANSITION - Index changed from', prev, 'to', newIndex);
          return newIndex;
        });
        
        // Immediately reset slide direction without animation to teleport the card back
        console.log('CARD TRANSITION - Clearing slide direction to make new card interactive');
        setCardSlideDirection(null);
      }
    }, 300); // Wait for slide animation to complete (300ms)
  }


  function nextCard() {
    if (currentCardIndex >= cards.length - 1) {
      // Don't show success screen from nextCard - only from handleStatusChange
      // This prevents double triggering when the last card is marked as learned
      return;
    }
    setCurrentCardIndex((prev) => prev + 1);
  }

  function previousCard() {
    setCurrentCardIndex((prev) => (prev - 1 + cards.length) % cards.length);
  }

  function shuffleCards() {
    if (cards.length <= 1) return;
    
    setShuffleAnimation(true);
    
    // Create a shuffled copy of the cards array
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    setTimeout(() => {
      setCards(shuffled);
      setCurrentCardIndex(0);
      setShuffleAnimation(false);
      toast({
        title: "Cards shuffled!",
        description: "The card order has been randomized"
      });
    }, 300);
  }

  const { showAchievement } = useAchievement();

  function handleNewStreakRecord(streak: number) {
    setStreakRecord(streak);
    localStorage.setItem('streakRecord', streak.toString());

    // Check if this is a significant streak milestone (5, 10, or complete set)
    if (streak >= cards.length) {
      // Complete set achievement
      showAchievement({
        id: "streak-master",
        name: "Streak Master",
        description: "Get 10 correct answers in a row in Streak Challenge"
      });

      // Perfect streak achievement
      localStorage.setItem('perfectStreakAchieved', 'true');

      setSuccessMessage({
        title: "New Streak Record!",
        message: `Amazing! You've reached a streak of ${streak}! You've mastered all cards in this set.`,
        emoji: "🏆"
      });
      setShowSuccessScreen(true);
      // Wait for progress bar animation (700ms) + buffer = 1200ms, then check achievements and go back
      setTimeout(async () => {
        await checkAchievements();
        handleBackToModes();
      }, 1200);
    } else if (streak >= 10 && streak < cards.length) {
      // Show achievement notification for 10+ streak
      showAchievement({
        id: "streak-master",
        name: "Streak Master",
        description: "Get 10 correct answers in a row in Streak Challenge"
      });

      toast({
        title: "🎉 New Streak Record!",
        description: `Amazing! You've reached a streak of ${streak}!`
      });
    } else {
      toast({
        title: "🎉 New Streak Record!",
        description: `Amazing! You've reached a streak of ${streak}!`
      });
    }
  }

  function handleDailySessionComplete() {
    const sessionsCompleted = parseInt(localStorage.getItem('dailySessionsCompleted') || '0') + 1;
    localStorage.setItem('dailySessionsCompleted', sessionsCompleted.toString());

    // Show achievement notification if this is the 5th daily session
    if (sessionsCompleted === 5) {
      showAchievement({
        id: "daily-dedication",
        name: "Daily Dedication",
        description: "Complete 5 daily practice sessions"
      });
    }

    // Track today's progress
    const todayProgress = parseInt(localStorage.getItem('todayProgress') || '0');
    const dailyGoal = 5; // Same as defined above

    // If daily goal reached, show achievement
    if (todayProgress >= dailyGoal) {
      showAchievement({
        id: "daily-goal-1",
        name: "Daily Target",
        description: "Reach your daily study goal"
      });
    }

    setSuccessMessage({
      title: "Daily Practice Complete!",
      message: "Great job completing your daily practice session! Come back tomorrow for new cards.",
      emoji: "⭐"
    });
    setShowSuccessScreen(true);
    setTimeout(() => {
      handleBackToModes();
    }, 3000);
  }

  function handleMultipleChoiceComplete() {
    setSuccessMessage({
      title: "Multiple Choice Complete!",
      message: "Great job completing the multiple choice challenge! Your language skills are improving!",
      emoji: "🎯"
    });
    setShowSuccessScreen(true);
    setTimeout(() => {
      handleBackToModes();
    }, 3000);
  }
  
  function handleTimeAttackComplete() {
    setSuccessMessage({
      title: "Time Attack Complete!",
      message: "Great job on the time attack challenge! Your speed is improving!",
      emoji: "⏱️"
    });
    setShowSuccessScreen(true);
    setTimeout(() => {
      handleBackToModes();
    }, 3000);
  }

  function handleSentenceBuilderComplete() {
    setSuccessMessage({
      title: "Sentence Builder Complete!",
      message: "Excellent work building sentences! Your grammar skills are improving!",
      emoji: "🔧"
    });
    setShowSuccessScreen(true);
    setTimeout(() => {
      handleBackToModes();
    }, 3000);
  }
  
  async function handleDrivingGameComplete() {
    // Refresh cards from database to show updated learned status
    try {
      const updatedCards = await getCards();
      setCards(updatedCards);
    } catch (error) {
      console.error('Error refreshing cards after driving game completion:', error);
    }
    
    setSuccessMessage({
      title: "Flash Hour Complete!",
      message: "Great job navigating the city streets! Your language skills are on the road to success!",
      emoji: "🚗"
    });
    setShowSuccessScreen(true);
    setTimeout(() => {
      handleBackToModes();
    }, 3000);
  }

    async function checkAchievements() {
    const allCards = await getCards();
    const learnedCards = allCards.filter(card => card.learned);
    const todayProgress = parseInt(localStorage.getItem('todayProgress') || '0');
    const dailyGoal = 5;
    const streakRecord = parseInt(localStorage.getItem('streakRecord') || '0');
    const dailySessionsCompleted = parseInt(localStorage.getItem('dailySessionsCompleted') || '0');

    // First card learned
    if (learnedCards.length === 1) {
      showAchievement({ 
        id: "first-learned", 
        name: "First Success", 
        description: "Master your first card" 
      });
    }

    // Five cards learned
    if (learnedCards.length >= 5) {
      showAchievement({ 
        id: "five-learned", 
        name: "Five Learned", 
        description: "Master five cards" 
      });
    }

    // Daily goal achievement
    if (todayProgress >= dailyGoal) {
      showAchievement({
        id: "daily-goal-1",
        name: "Daily Target",
        description: "Reach your daily study goal"
      });
    }

    // Streak achievements
    if (streakRecord >= 10) {
      showAchievement({
        id: "streak-master",
        name: "Streak Master",
        description: "Get 10 correct answers in a row in Streak Challenge"
      });
    }

    // Daily dedication
    if (dailySessionsCompleted >= 5) {
      showAchievement({
        id: "daily-dedication",
        name: "Daily Dedication",
        description: "Complete 5 daily practice sessions"
      });
    }

    // Perfect set achievement
    if (allCards.length > 0 && learnedCards.length === allCards.length) {
      showAchievement({
        id: "complete-deck",
        name: "Complete Collection",
        description: "Master all your cards"
      });
    }
  }


  // Check URL params for study mode on initial load
  useEffect(() => {
    const path = location.split('/');
    const modeParam = path[path.length - 1];

    // If URL contains a valid study mode, set it
    if (['flashcard', 'multiple-choice', 'streak', 'daily', 'time-attack', 'driving-game'].includes(modeParam as StudyMode)) {
      handleSelectMode(modeParam as StudyMode, false);
    }
  }, [location]);

  // Handle going back to study mode selection and reset all states
  const handleBackToModes = () => {
    setSelectedMode(null);
    setCurrentCardIndex(0);
    setCompletedCardIds([]);
    setShowSuccessScreen(false);
    setSuccessMessage({ title: "", message: "", emoji: "🎉" });
    setStudyAllCards(true); // Reset to default
    setCorrectStreak(0); // Reset streak when starting new round
    setCardSlideDirection(null); // Reset card animation state
    setSelectedTrainingMode(null); // Reset training mode
    setShowCategories(false); // Reset category display
    setLocation('/study');
  };

  const handleSelectMode = (mode: StudyMode, updateURL = true) => {
    // For flashcard mode, show training mode selection first
    if (mode === 'flashcard' || mode === 'sentence-builder' || mode === 'grammar-lessons') {
      setSelectedMode(mode);
      setSelectedTrainingMode(null); // Reset training mode selection
      if (updateURL) {
        setLocation(`/study/${mode}`);
      }
      return;
    }

    setSelectedMode(mode);
    setCurrentCardIndex(0);
    setCompletedCardIds([]);

    // Update URL to include the mode for proper back button behavior
    if (updateURL) {
      setLocation(`/study/${mode}`);
    }
  };

  const SuccessScreen = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-background/90 z-50 animate-in fade-in-0 zoom-in-95 duration-300">
      <div className="bg-card border rounded-lg p-8 max-w-md text-center">
        <img src={getAssetUrl("success-clippy.png")} alt="Success" className="h-36 w-36 mx-auto mb-4" />
        <h2 className="text-3xl font-bold mb-4">{successMessage.title}</h2>
        <p className="text-lg text-muted-foreground mb-6">{successMessage.message}</p>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-6">
          <div className="h-full bg-primary rounded-full animate-progress-bar" />
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Saving progress...
        </p>
        <Button 
          onClick={handleBackToModes}
          className="w-full"
        >
          Return to Menu
        </Button>
      </div>
    </div>
  );

  if (showSuccessScreen) {
    return <SuccessScreen />;
  }

  if (!selectedMode) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" className="mr-4">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">{useEmojiMode ? '📚 ' : ''}Study Cards</h1>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="study-mode-items" direction="vertical">
            {(provided) => (
              <div 
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto"
              >
                <Draggable key="flashcard" draggableId="flashcard" index={0}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`${snapshot.isDragging ? 'opacity-75' : ''}`}
                    >
                      <CardUI 
                        className={`cursor-pointer hover:bg-accent/50 transition-colors ${snapshot.isDragging ? 'border-primary' : ''} cursor-grab active:cursor-grabbing`}
                        onClick={() => handleSelectMode('flashcard')} 
                      >
                        <CardHeader className="pb-0">
                          {!useEmojiMode ? minimalFlashcardStyle : decoratedFlashcardStyle}
                        </CardHeader>
                        <CardContent className="text-muted-foreground pt-2">
                          Review cards one by one with traditional flashcard method
                        </CardContent>
                      </CardUI>
                    </div>
                  )}
                </Draggable>

                <Draggable key="driving-game" draggableId="driving-game" index={1}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`${snapshot.isDragging ? 'opacity-75' : ''}`}
                    >
                      <CardUI 
                        className={`cursor-pointer hover:bg-accent/50 transition-colors ${snapshot.isDragging ? 'border-primary' : ''} cursor-grab active:cursor-grabbing`}
                        onClick={() => handleSelectMode('driving-game')}
                      >
                        <CardHeader className="pb-0">
                          {!useEmojiMode ? minimalDrivingGameStyle : decoratedDrivingGameStyle}
                        </CardHeader>
                        <CardContent className="text-muted-foreground pt-2">
                          Drive to the correct translations on the city roads!
                        </CardContent>
                      </CardUI>
                    </div>
                  )}
                </Draggable>

                <Draggable key="multiple-choice" draggableId="multiple-choice" index={2}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`${snapshot.isDragging ? 'opacity-75' : ''}`}
                    >
                      <CardUI 
                        className={`cursor-pointer hover:bg-accent/50 transition-colors ${snapshot.isDragging ? 'border-primary' : ''} cursor-grab active:cursor-grabbing`}
                        onClick={() => handleSelectMode('multiple-choice')}
                      >
                        <CardHeader className="pb-0">
                          {!useEmojiMode ? minimalMultipleChoiceStyle : decoratedMultipleChoiceStyle}
                        </CardHeader>
                        <CardContent className="text-muted-foreground pt-2">
                          Test your knowledge with multiple choice questions
                        </CardContent>
                      </CardUI>
                    </div>
                  )}
                </Draggable>



                <Draggable key="daily" draggableId="daily" index={4}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`${snapshot.isDragging ? 'opacity-75' : ''}`}
                    >
                      <CardUI 
                        className={`cursor-pointer hover:bg-accent/50 transition-colors ${snapshot.isDragging ? 'border-primary' : ''} cursor-grab active:cursor-grabbing`}
                        onClick={() => handleSelectMode('daily')}
                      >
                        <CardHeader className="pb-0">
                          {!useEmojiMode ? minimalDailyStyle : decoratedDailyStyle}
                        </CardHeader>
                        <CardContent className="text-muted-foreground pt-2">
                          A curated set of cards for your daily learning routine
                        </CardContent>
                      </CardUI>
                    </div>
                  )}
                </Draggable>
                
                <Draggable key="time-attack" draggableId="time-attack" index={5}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`${snapshot.isDragging ? 'opacity-75' : ''}`}
                    >
                      <CardUI 
                        className={`cursor-pointer hover:bg-accent/50 transition-colors ${snapshot.isDragging ? 'border-primary' : ''} cursor-grab active:cursor-grabbing`}
                        onClick={() => handleSelectMode('time-attack')}
                      >
                        <CardHeader className="pb-0">
                          {!useEmojiMode ? minimalTimeAttackStyle : decoratedTimeAttackStyle}
                        </CardHeader>
                        <CardContent className="text-muted-foreground pt-2">
                          Answer as many cards as you can in 60 seconds!
                        </CardContent>
                      </CardUI>
                    </div>
                  )}
                </Draggable>

                <Draggable key="sentence-builder" draggableId="sentence-builder" index={6}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`${snapshot.isDragging ? 'opacity-75' : ''}`}
                    >
                      <CardUI 
                        className={`cursor-pointer hover:bg-accent/50 transition-colors ${snapshot.isDragging ? 'border-primary' : ''} cursor-grab active:cursor-grabbing`}
                        onClick={() => handleSelectMode('sentence-builder')}
                      >
                        <CardHeader className="pb-0">
                          {!useEmojiMode ? minimalSentenceBuilderStyle : decoratedSentenceBuilderStyle}
                        </CardHeader>
                        <CardContent className="text-muted-foreground pt-2">
                          Build sentences by arranging words in the correct order
                        </CardContent>
                      </CardUI>
                    </div>
                  )}
                </Draggable>

                <Draggable key="grammar-lessons" draggableId="grammar-lessons" index={7}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`${snapshot.isDragging ? 'opacity-75' : ''}`}
                    >
                      <CardUI
                        className={`cursor-pointer hover:bg-accent/50 transition-colors ${snapshot.isDragging ? 'border-primary' : ''} cursor-grab active:cursor-grabbing`}
                        onClick={() => handleSelectMode('grammar-lessons')}
                      >
                        <CardHeader className="pb-0">
                          {!useEmojiMode ? minimalGrammarLessonsStyle : decoratedGrammarLessonsStyle}
                        </CardHeader>
                        <CardContent className="text-muted-foreground pt-2">
                          Learn grammar with AI-generated lessons and stories
                        </CardContent>
                      </CardUI>
                    </div>
                  )}
                </Draggable>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            className="mr-4"
            onClick={handleBackToModes}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">
            {selectedMode === 'flashcard' && `${useEmojiMode ? '🎴 ' : ''}Classic Flashcards`}
            {selectedMode === 'multiple-choice' && `${useEmojiMode ? '🎯 ' : ''}Multiple Choice`}
            {selectedMode === 'streak' && `${useEmojiMode ? '⚡ ' : ''}Streak Challenge`}
            {selectedMode === 'daily' && `${useEmojiMode ? '📅 ' : ''}Daily Practice`}
            {selectedMode === 'time-attack' && `${useEmojiMode ? '⏱️ ' : ''}Time Attack`}
            {selectedMode === 'driving-game' && `${useEmojiMode ? '🚗 ' : ''}Flash Hour`}
            {selectedMode === 'sentence-builder' && `${useEmojiMode ? '🔧 ' : ''}Sentence Builder`}
            {selectedMode === 'grammar-lessons' && `${useEmojiMode ? '🎓 ' : ''}Grammar Lessons`}
          </h1>
        </div>
        

      </div>

      {/* Reserved streak space for flashcard mode - always present to prevent layout shift */}
      {selectedMode === 'flashcard' && (
        <div className="flex justify-center mb-4">
          <div className="h-8 flex items-center justify-center min-w-[140px]">
            <StreakFireIndicator
              streak={correctStreak}
              disabled={
                selectedMode !== "flashcard" ||
                currentCardIndex >= cards.length - 1 ||
                showSuccessScreen
              }
            />
          </div>
        </div>
      )}

      <div className="space-y-6 max-w-2xl mx-auto">
        {cards.length === 0 && selectedMode !== 'grammar-lessons' ? (
          <div className="text-center text-muted-foreground p-8">
            <p className="text-4xl mb-4">📝</p>
            <p>No cards yet. Create some cards to start studying!</p>
          </div>
        ) : (
          <>

            {selectedMode === 'flashcard' && cards.length > 0 && selectedTrainingMode === null && (
              <div className="training-mode-container relative max-w-md mx-auto animate-in slide-in-from-right duration-250 overflow-hidden w-full">
                <h2 className="text-2xl font-bold text-center mb-8">Choose Training Mode</h2>
                <div className="grid grid-cols-3 gap-6 max-w-md mx-auto">
                  <div 
                    className="training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform animate-in zoom-in-0 duration-150"
                    style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
                    onClick={() => {
                      const container = document.querySelector('.training-mode-container');
                      if (container) {
                        container.classList.add('animate-out', 'slide-out-to-left', 'duration-150');
                        setTimeout(() => {
                          setSelectedTrainingMode('all');
                          setStudyAllCards(true);
                          setCorrectStreak(0);
                          setCurrentCardIndex(0);
                          setCardSlideDirection(null);
                        }, 150);
                      }
                    }}
                  >
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 hover:bg-primary/20 transition-colors">
                      {useEmojiMode ? (
                        <div className="text-3xl">📚</div>
                      ) : (
                        <BookOpen className="h-8 w-8 text-primary" />
                      )}
                    </div>
                    <h3 className="font-medium">All Cards</h3>
                  </div>
                  
                  <div 
                    className={`training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform animate-in zoom-in-0 duration-150 ${
                      cards.filter(card => !card.learned).length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    style={{ animationDelay: '0.4s', animationFillMode: 'both' }}
                    onClick={() => {
                      if (cards.filter(card => !card.learned).length > 0) {
                        const container = document.querySelector('.training-mode-container');
                        if (container) {
                          container.classList.add('animate-out', 'slide-out-to-left', 'duration-150');
                          setTimeout(() => {
                            setSelectedTrainingMode('unlearned');
                            setStudyAllCards(false);
                            setCorrectStreak(0);
                            setCurrentCardIndex(0);
                            setCardSlideDirection(null);
                          }, 150);
                        }
                      }
                    }}
                  >
                    <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-3 hover:bg-orange-200 transition-colors">
                      {useEmojiMode ? (
                        <div className="text-3xl">🎯</div>
                      ) : (
                        <Target className="h-8 w-8 text-orange-600" />
                      )}
                    </div>
                    <h3 className="font-medium">Not Yet Learnt</h3>
                  </div>
                  
                  <div 
                    className="training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform animate-in zoom-in-0 duration-150"
                    style={{ animationDelay: '0.5s', animationFillMode: 'both' }}
                    onClick={() => {
                      setShowCategories(!showCategories);
                    }}
                  >
                    <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-3 hover:bg-purple-200 transition-colors">
                      {useEmojiMode ? (
                        <div className="text-3xl">🏷️</div>
                      ) : (
                        <ChevronDown className={`h-8 w-8 text-purple-600 transition-transform ${showCategories ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                    <h3 className="font-medium">Categories</h3>
                  </div>
                </div>
                
                {/* Expandable Categories Section */}
                {showCategories && (
                  <div className="mt-6 animate-in slide-in-from-top-2 duration-150">
                    <div className="max-h-40 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                        {Array.from(new Map(cards.filter(card => card.category).map(card => [card.category, { category: card.category, emoji: card.categoryEmoji }])).values()).map(({ category, emoji }, index) => (
                          <div 
                            key={category}
                            className="flex items-center gap-2 p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors animate-in fade-in-0 duration-100"
                            style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'both' }}
                            onClick={() => {
                              const container = document.querySelector('.training-mode-container');
                              if (container) {
                                container.classList.add('animate-out', 'slide-out-to-left', 'duration-150');
                                setTimeout(() => {
                                  setSelectedTrainingMode(category);
                                  setCorrectStreak(0);
                                  setCurrentCardIndex(0);
                                  setCardSlideDirection(null);
                                }, 150);
                              }
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
            )}

            {selectedMode === 'flashcard' && cards.length > 0 && selectedTrainingMode && (
              <div className="relative">


                {/* Card stack container with fixed dimensions to prevent layout shifts */}
                <div className="relative overflow-hidden">
                  {/* Container with fixed height to contain cards properly */}
                  <div className="relative h-[280px]">
                    {/* Next card behind current card - always visible when available */}
                    {currentCardIndex + 1 < cards.length && (
                      <div className={`absolute inset-0 z-0 pointer-events-none transition-all duration-300 ${
                        cardSlideDirection ? 'transform translate-y-0 scale-100 opacity-100' : 'transform translate-y-2 scale-95 opacity-50'
                      }`}>
                        <StudyCard 
                          key={`stack-${cards[currentCardIndex + 1].id}`}
                          card={cards[currentCardIndex + 1]}
                          onDelete={() => {}}
                          onStatusChange={() => {}}
                        />
                      </div>
                    )}

                    {/* Current card - teleports back instantly after slide */}
                    <div className={`absolute inset-0 z-10 transition-all ${
                      cardSlideDirection ? 'duration-300' : 'duration-0'
                    } ${shuffleAnimation ? 'scale-95 opacity-75' : 'scale-100 opacity-100'} ${
                      cardSlideDirection === 'left' ? 'transform -translate-x-full opacity-0' : 
                      cardSlideDirection === 'right' ? 'transform translate-x-full opacity-0' : 
                      'transform translate-x-0 opacity-100'
                    }`}>
                      <StudyCard
                        key={`current-${currentCardIndex}`}
                        card={cards[currentCardIndex]}
                        onDelete={handleDelete}
                        onStatusChange={handleStatusChange}
                        isSoundEnabled={isSoundEnabled}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-2 space-y-3">
                  <div className="flex items-center">
                    {/* Toggle Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAreOptionsVisible(!areOptionsVisible)}
                      className="text-sm"
                    >
                      {areOptionsVisible ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>

                    <div className="flex-grow"></div>

                    <div 
                      className={`flex items-center space-x-2 transition-all duration-300 ease-in-out overflow-hidden ${
                        areOptionsVisible 
                          ? 'max-h-12 opacity-100' 
                          : 'max-h-0 opacity-0'
                      }`}
                    >
                      {/* Shuffle Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={shuffleCards}
                        disabled={shuffleAnimation || cards.length <= 1}
                        className="text-sm"
                      >
                        <Shuffle className="h-4 w-4 mr-2" />
                        Shuffle
                      </Button>

                      {/* Play Sound Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTTS(cards[currentCardIndex].targetText, 'back')}
                        disabled={audioLoading}
                        className="text-sm"
                      >
                        <Play className="h-4 w-4" />
                      </Button>

                      {/* Sound Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                        className="text-sm"
                      >
                        {isSoundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      </Button>

                      {/* Delete Button - aligned to the right */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(cards[currentCardIndex].id)}
                        className="text-sm text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-center">
                    <span className="text-muted-foreground">
                      {currentCardIndex + 1} / {cards.length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedMode === 'multiple-choice' && !selectedTrainingMode && (
              <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col justify-start items-center p-4 pt-16 animate-in fade-in-0 duration-350">
                <div className="text-center w-full max-w-md">
                  <div className="text-6xl mb-4 animate-bounce">🎯</div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Multiple Choice
                  </h2>
                  <p className="text-gray-600 mb-8">
                    Choose Training Mode
                  </p>

                  <div className="training-mode-container grid grid-cols-2 gap-6 max-w-sm mx-auto">
                    <div 
                      className="training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform animate-in slide-in-from-bottom-4 fade-in-0 duration-300"
                      style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
                      onClick={() => {
                        const container = document.querySelector('.training-mode-container');
                        const categoriesSection = document.querySelector('.categories-section');
                        if (container) {
                          container.classList.add('animate-out', 'slide-out-to-left', 'fade-out-0', 'duration-150');
                          if (categoriesSection) {
                            categoriesSection.classList.add('animate-out', 'slide-out-to-left', 'fade-out-0', 'duration-150');
                          }
                          setTimeout(() => {
                            setSelectedTrainingMode('all');
                            setStudyAllCards(true);
                            setCorrectStreak(0);
                            setCurrentCardIndex(0);
                            setCardSlideDirection(null);
                          }, 150);
                        }
                      }}
                    >
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 hover:bg-primary/20 transition-colors">
                        {useEmojiMode ? (
                          <div className="text-3xl">📚</div>
                        ) : (
                          <BookOpen className="h-8 w-8 text-primary" />
                        )}
                      </div>
                      <h3 className="font-medium">All Cards</h3>
                    </div>
                    
                    <div 
                      className={`training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform animate-in slide-in-from-bottom-4 fade-in-0 duration-300 ${
                        cards.filter(card => !card.learned).length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
                      onClick={() => {
                        if (cards.filter(card => !card.learned).length > 0) {
                          const container = document.querySelector('.training-mode-container');
                          const categoriesSection = document.querySelector('.categories-section');
                          if (container) {
                            container.classList.add('animate-out', 'slide-out-to-left', 'fade-out-0', 'duration-150');
                            if (categoriesSection) {
                              categoriesSection.classList.add('animate-out', 'slide-out-to-left', 'fade-out-0', 'duration-150');
                            }
                            setTimeout(() => {
                              setSelectedTrainingMode('unlearned');
                              setStudyAllCards(false);
                              setCorrectStreak(0);
                              setCurrentCardIndex(0);
                              setCardSlideDirection(null);
                            }, 150);
                          }
                        }
                      }}
                    >
                      <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-3 hover:bg-orange-200 transition-colors">
                        {useEmojiMode ? (
                          <div className="text-3xl">🎯</div>
                        ) : (
                          <Target className="h-8 w-8 text-orange-600" />
                        )}
                      </div>
                      <h3 className="font-medium">Not Yet Learnt</h3>
                    </div>
                  </div>

                  {/* Categories Section for Multiple Choice */}
                  <div className="categories-section mt-6 animate-in slide-in-from-bottom-4 fade-in-0 duration-300" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
                    <div 
                      className="training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform mx-auto"
                      style={{ maxWidth: '120px' }}
                      onClick={() => {
                        setShowCategories(!showCategories);
                      }}
                    >
                      <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-3 hover:bg-purple-200 transition-colors">
                        {useEmojiMode ? (
                          <div className="text-3xl">🏷️</div>
                        ) : (
                          <ChevronDown className={`h-8 w-8 text-purple-600 transition-transform ${showCategories ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                      <h3 className="font-medium">Categories</h3>
                    </div>
                    
                    {/* Expandable Categories Section */}
                    {showCategories && (
                      <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
                        <div className="max-h-40 overflow-y-auto">
                          <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                            {Array.from(new Map(cards.filter(card => card.category).map(card => [card.category, { category: card.category, emoji: card.categoryEmoji }])).values()).map(({ category, emoji }, index) => (
                              <div 
                                key={category}
                                className="flex items-center gap-2 p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors animate-in fade-in-0 duration-200"
                                style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}
                                onClick={() => {
                                  const container = document.querySelector('.training-mode-container');
                                  if (container) {
                                    container.classList.add('animate-out', 'slide-out-to-left', 'duration-150');
                                    setTimeout(() => {
                                      setSelectedTrainingMode(category);
                                      setCorrectStreak(0);
                                      setCurrentCardIndex(0);
                                      setCardSlideDirection(null);
                                    }, 150);
                                  }
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
              </div>
            )}

            {selectedMode === 'multiple-choice' && selectedTrainingMode && (
              <MultipleChoiceCard
                cards={cards}
                onCorrectAnswer={(cardId) => {
                  // Don't call handleStatusChange for multiple choice - it triggers flashcard logic
                  const card = cards.find(c => c.id === cardId);
                  if (card) {
                    // Update card status directly without triggering flashcard completion logic
                    updateCard(cardId, { 
                      learned: true,
                      proficiency: (card.proficiency || 0) + 1,
                      lastStudied: new Date().toISOString() as unknown as Date
                    });
                  }
                }}
                onWrongAnswer={(cardId) => {
                  // No action needed for wrong answers in multiple choice
                }}
                onSessionComplete={handleMultipleChoiceComplete}
              />
            )}



            {selectedMode === 'daily' && (
              <DailyPracticeCard
                cards={cards}
                onCorrectAnswer={(cardId) => {
                  const card = cards.find(c => c.id === cardId);
                  if (card) {
                    handleStatusChange(cardId, true);
                  }
                }}
                onWrongAnswer={(cardId) => {
                  const card = cards.find(c => c.id === cardId);
                  if (card) {
                    handleStatusChange(cardId, false);
                  }
                }}
                onSessionComplete={handleDailySessionComplete}
              />
            )}
            {selectedMode === 'time-attack' && !selectedTrainingMode && (
              <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex flex-col justify-start items-center p-4 pt-16 animate-in fade-in-0 duration-350">
                <div className="text-center w-full max-w-md">
                  <div className="text-6xl mb-4 animate-bounce">⚡</div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Time Attack
                  </h2>
                  <p className="text-gray-600 mb-8">
                    Choose Training Mode
                  </p>

                  <div className="training-mode-container grid grid-cols-2 gap-6 max-w-sm mx-auto">
                    <div 
                      className="training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform animate-in slide-in-from-bottom-4 fade-in-0 duration-300"
                      style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
                      onClick={() => {
                        const container = document.querySelector('.training-mode-container');
                        const categoriesSection = document.querySelector('.categories-section');
                        if (container) {
                          container.classList.add('animate-out', 'slide-out-to-left', 'fade-out-0', 'duration-150');
                          if (categoriesSection) {
                            categoriesSection.classList.add('animate-out', 'slide-out-to-left', 'fade-out-0', 'duration-150');
                          }
                          setTimeout(() => {
                            setSelectedTrainingMode('all');
                            setStudyAllCards(true);
                            setCorrectStreak(0);
                            setCurrentCardIndex(0);
                            setCardSlideDirection(null);
                          }, 150);
                        }
                      }}
                    >
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 hover:bg-primary/20 transition-colors">
                        {useEmojiMode ? (
                          <div className="text-3xl">📚</div>
                        ) : (
                          <BookOpen className="h-8 w-8 text-primary" />
                        )}
                      </div>
                      <h3 className="font-medium">All Cards</h3>
                    </div>
                    
                    <div 
                      className={`training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform animate-in slide-in-from-bottom-4 fade-in-0 duration-300 ${
                        cards.filter(card => !card.learned).length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
                      onClick={() => {
                        if (cards.filter(card => !card.learned).length > 0) {
                          const container = document.querySelector('.training-mode-container');
                          const categoriesSection = document.querySelector('.categories-section');
                          if (container) {
                            container.classList.add('animate-out', 'slide-out-to-left', 'fade-out-0', 'duration-150');
                            if (categoriesSection) {
                              categoriesSection.classList.add('animate-out', 'slide-out-to-left', 'fade-out-0', 'duration-150');
                            }
                            setTimeout(() => {
                              setSelectedTrainingMode('unlearned');
                              setStudyAllCards(false);
                              setCorrectStreak(0);
                              setCurrentCardIndex(0);
                              setCardSlideDirection(null);
                            }, 150);
                          }
                        }
                      }}
                    >
                      <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-3 hover:bg-orange-200 transition-colors">
                        {useEmojiMode ? (
                          <div className="text-3xl">🎯</div>
                        ) : (
                          <Target className="h-8 w-8 text-orange-600" />
                        )}
                      </div>
                      <h3 className="font-medium">Not Yet Learnt</h3>
                    </div>
                  </div>

                  {/* Categories Section for Time Attack */}
                  <div className="categories-section mt-6 animate-in slide-in-from-bottom-4 fade-in-0 duration-300" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
                    <div 
                      className="training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform mx-auto"
                      style={{ maxWidth: '120px' }}
                      onClick={() => {
                        setShowCategories(!showCategories);
                      }}
                    >
                      <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-3 hover:bg-purple-200 transition-colors">
                        {useEmojiMode ? (
                          <div className="text-3xl">🏷️</div>
                        ) : (
                          <ChevronDown className={`h-8 w-8 text-purple-600 transition-transform ${showCategories ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                      <h3 className="font-medium">Categories</h3>
                    </div>
                    
                    {/* Expandable Categories Section */}
                    {showCategories && (
                      <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
                        <div className="max-h-40 overflow-y-auto">
                          <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                            {Array.from(new Map(cards.filter(card => card.category).map(card => [card.category, { category: card.category, emoji: card.categoryEmoji }])).values()).map(({ category, emoji }, index) => (
                              <div 
                                key={category}
                                className="flex items-center gap-2 p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors animate-in fade-in-0 duration-200"
                                style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}
                                onClick={() => {
                                  const container = document.querySelector('.training-mode-container');
                                  if (container) {
                                    container.classList.add('animate-out', 'slide-out-to-left', 'duration-150');
                                    setTimeout(() => {
                                      setSelectedTrainingMode(category);
                                      setCorrectStreak(0);
                                      setCurrentCardIndex(0);
                                      setCardSlideDirection(null);
                                    }, 150);
                                  }
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
              </div>
            )}

            {selectedMode === 'time-attack' && selectedTrainingMode && (
              <TimeAttackCard
                cards={cards}
                onCorrectAnswer={(cardId) => {
                  const card = cards.find(c => c.id === cardId);
                  if (card) {
                    handleStatusChange(cardId, true);
                  }
                }}
                onWrongAnswer={(cardId) => {
                  const card = cards.find(c => c.id === cardId);
                  if (card) {
                    handleStatusChange(cardId, false);
                  }
                }}
                onSessionComplete={handleTimeAttackComplete}
              />
            )}
            {selectedMode === 'driving-game' && (
              <DrivingGameCard
                cards={cards}
                onCorrectAnswer={(cardId) => {
                  const card = cards.find(c => c.id === cardId);
                  if (card) {
                    handleStatusChange(cardId, true);
                  }
                }}
                onWrongAnswer={(cardId) => {
                  const card = cards.find(c => c.id === cardId);
                  if (card) {
                    handleStatusChange(cardId, false);
                  }
                }}
                onSessionComplete={handleDrivingGameComplete}
              />
            )}
            
            {selectedMode === 'sentence-builder' && !selectedTrainingMode && (
              <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-start items-center p-4 pt-16 animate-in fade-in-0 duration-350">
                <div className="text-center w-full max-w-md">
                  <div className="text-6xl mb-4 animate-bounce">🔧</div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Sentence Builder
                  </h2>
                  <p className="text-gray-600 mb-8">
                    Choose Training Mode
                  </p>

                  <div className="training-mode-container grid grid-cols-2 gap-6 max-w-sm mx-auto">
                    <div
                      className="training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform animate-in slide-in-from-bottom-4 fade-in-0 duration-300"
                      style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
                      onClick={() => {
                        const container = document.querySelector('.training-mode-container');
                        const categoriesSection = document.querySelector('.categories-section');
                        if (container) {
                          container.classList.add('animate-out', 'slide-out-to-left', 'fade-out-0', 'duration-150');
                          if (categoriesSection) {
                            categoriesSection.classList.add('animate-out', 'slide-out-to-left', 'fade-out-0', 'duration-150');
                          }
                          setTimeout(() => {
                            setSelectedTrainingMode('all');
                            setStudyAllCards(true);
                            setCorrectStreak(0);
                            setCurrentCardIndex(0);
                            setCardSlideDirection(null);
                          }, 150);
                        }
                      }}
                    >
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 hover:bg-primary/20 transition-colors">
                        {useEmojiMode ? (
                          <div className="text-3xl">📚</div>
                        ) : (
                          <BookOpen className="h-8 w-8 text-primary" />
                        )}
                      </div>
                      <h3 className="font-medium">All Scenarios</h3>
                    </div>

                    <div
                      className={`training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform animate-in slide-in-from-bottom-4 fade-in-0 duration-300 ${
                        cards.filter(card => !card.learned).length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
                      onClick={() => {
                        if (cards.filter(card => !card.learned).length > 0) {
                          const container = document.querySelector('.training-mode-container');
                          const categoriesSection = document.querySelector('.categories-section');
                          if (container) {
                            container.classList.add('animate-out', 'slide-out-to-left', 'fade-out-0', 'duration-150');
                            if (categoriesSection) {
                              categoriesSection.classList.add('animate-out', 'slide-out-to-left', 'fade-out-0', 'duration-150');
                            }
                            setTimeout(() => {
                              setSelectedTrainingMode('unlearned');
                              setStudyAllCards(false);
                              setCorrectStreak(0);
                              setCurrentCardIndex(0);
                              setCardSlideDirection(null);
                            }, 150);
                          }
                        }
                      }}
                    >
                      <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-3 hover:bg-orange-200 transition-colors">
                        {useEmojiMode ? (
                          <div className="text-3xl">🎯</div>
                        ) : (
                          <Target className="h-8 w-8 text-orange-600" />
                        )}
                      </div>
                      <h3 className="font-medium">Still Learning</h3>
                    </div>
                  </div>

                  {/* Categories Section for Sentence Builder */}
                  <div className="categories-section mt-6 animate-in slide-in-from-bottom-4 fade-in-0 duration-300" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
                    <div
                      className="training-option flex flex-col items-center text-center cursor-pointer hover:scale-105 transition-all transform mx-auto"
                      style={{ maxWidth: '120px' }}
                      onClick={() => {
                        setShowCategories(!showCategories);
                      }}
                    >
                      <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-3 hover:bg-purple-200 transition-colors">
                        {useEmojiMode ? (
                          <div className="text-3xl">🏷️</div>
                        ) : (
                          <ChevronDown className={`h-8 w-8 text-purple-600 transition-transform ${showCategories ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                      <h3 className="font-medium">Categories</h3>
                    </div>

                    {/* Expandable Categories Section */}
                    {showCategories && (
                      <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
                        <div className="max-h-40 overflow-y-auto">
                          <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                            {Array.from(new Map(cards.filter(card => card.category).map(card => [card.category, { category: card.category, emoji: card.categoryEmoji }])).values()).map(({ category, emoji }, index) => (
                              <div
                                key={category}
                                className="flex items-center gap-2 p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors animate-in fade-in-0 duration-200"
                                style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}
                                onClick={() => {
                                  const container = document.querySelector('.training-mode-container');
                                  if (container) {
                                    container.classList.add('animate-out', 'slide-out-to-left', 'duration-150');
                                    setTimeout(() => {
                                      setSelectedTrainingMode(category);
                                      setCorrectStreak(0);
                                      setCurrentCardIndex(0);
                                      setCardSlideDirection(null);
                                    }, 150);
                                  }
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
              </div>
            )}

            {selectedMode === 'grammar-lessons' && (() => {
              // Show lesson selection if no training mode selected
              if (selectedTrainingMode === null) {
                return (
                  <div className="space-y-6">
                    <div className="text-6xl mb-4 animate-bounce text-center">🎓</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">
                      Grammar Lessons
                    </h2>
                    <p className="text-gray-600 mb-8 text-center">
                      Choose Lesson
                    </p>

                    {/* Tech Tree Layout */}
                    <div className="training-mode-container max-w-4xl mx-auto">
                      <div className="tech-tree-layout relative">
                        {/* New Lesson at top */}
                        <div className="flex justify-center mb-8">
                          <div 
                            className={`training-option flex flex-col items-center text-center transition-all transform animate-in slide-in-from-bottom-4 fade-in-0 duration-300 z-20 ${
                              isLoadingGrammarLesson ? 'cursor-wait opacity-75' : 'cursor-pointer hover:scale-105'
                            }`}
                            style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
                            onClick={() => {
                              if (isLoadingGrammarLesson) return;
                              generateNewGrammarLesson();
                            }}
                          >
                            <div className={`bg-blue-100 hover:bg-blue-200 transition-colors p-6 rounded-xl border-2 border-blue-300 shadow-lg relative ${
                              isLoadingGrammarLesson ? 'animate-pulse' : ''
                            }`}>
                              {isLoadingGrammarLesson ? (
                                <>
                                  <div className="text-4xl mb-3 animate-spin">⏳</div>
                                  <h3 className="font-semibold text-gray-800">Creating...</h3>
                                  <p className="text-xs text-gray-600 mt-1">Please wait</p>
                                </>
                              ) : (
                                <>
                                  <div className="text-4xl mb-3">❓</div>
                                  <h3 className="font-semibold text-gray-800">New Lesson</h3>
                                  <p className="text-xs text-gray-600 mt-1">Generate fresh lesson</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>


                        {/* Saved Lessons in tech tree format - newest on top */}
                        {savedGrammarLessons.length > 0 && (() => {
                          const totalLessons = savedGrammarLessons.length;
                          const LESSON_V_SPACE = 160; // Vertical space for each lesson (h-32 + margin)
                          const TIMELINE_HEIGHT = (totalLessons * LESSON_V_SPACE) + LESSON_V_SPACE;

                          return (
                            <div className="relative" style={{ height: `${TIMELINE_HEIGHT}px` }}>
                              {/* --- Progress Bar --- */}
                              {/* Background */}
                              <div className="absolute left-1/2 -translate-x-1/2 w-3 bg-gray-300 rounded-full z-[1]" style={{ top: 0, height: `${TIMELINE_HEIGHT}px` }} />
                              {/* Fill */}
                              <div 
                                key={`progress-fill-${progressBarAnimationTrigger}`}
                                className="absolute left-1/2 -translate-x-1/2 w-3 bg-green-500 rounded-full z-[2]" 
                                style={{ bottom: 0, height: `${progressBarHeight}px`, transition: 'height 2s ease-out' }} 
                              />

                              {/* --- Lessons & Dots (Single Loop) --- */}
                              {[...savedGrammarLessons].reverse().map((lesson, displayIndex) => {
                                const originalIndex = totalLessons - 1 - displayIndex; // oldest is 0
                                const verticalCenterFromBottom = (originalIndex + 1) * LESSON_V_SPACE;
                                const isLeft = displayIndex % 2 === 0;
                                
                                // Check if this lesson is unlocked (sequential progression)
                                const isUnlocked = (() => {
                                  // First lesson (oldest, originalIndex 0) is always unlocked
                                  if (originalIndex === 0) return true;
                                  
                                  // For other lessons, check if previous lesson is completed
                                  // Since lessons are sorted by id, find the lesson with originalIndex - 1
                                  const sortedLessons = [...savedGrammarLessons].sort((a, b) => a.id - b.id);
                                  const currentLessonInSorted = sortedLessons[originalIndex];
                                  const previousLessonInSorted = sortedLessons[originalIndex - 1];
                                  
                                  console.log(`🔐 UNLOCK CHECK for lesson ${currentLessonInSorted?.id} (originalIndex ${originalIndex}):`, {
                                    currentLesson: currentLessonInSorted?.title,
                                    previousLesson: previousLessonInSorted?.title,
                                    previousCompleted: previousLessonInSorted?.completed
                                  });
                                  
                                  return previousLessonInSorted?.completed || false;
                                })();
                              
                              return (
                                  <div
                                    key={lesson.id}
                                    className="absolute w-full h-32"
                                    style={{ bottom: `${verticalCenterFromBottom - 64}px` }}
                                  >
                                    {/* Dot (Aligned with card center) */}
                                    <div className={`absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md z-[3] ${
                                      lesson.completed ? 'bg-green-400' : isUnlocked ? 'bg-blue-400' : 'bg-gray-400'
                                    }`} />
                                  
                                    {/* Line (Aligned with card center) */}
                                    <div className={`absolute top-1/2 -translate-y-1/2 h-0.5 bg-gray-300 z-[-1] ${isLeft ? 'left-0 right-1/2 mr-2' : 'left-1/2 right-0 ml-2'}`} />
                                  
                                    {/* Card (Container) */}
                                  <div 
                                      id={`lesson-card-${lesson.id}`}
                                      className={`training-option flex flex-col items-center text-center transition-transform z-20 ${isLeft ? 'absolute left-0' : 'absolute right-0'} ${
                                        isUnlocked ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-60'
                                      }`}
                                    onClick={() => {
                                      if (!isUnlocked) {
                                        toast({
                                          title: "🔒 Lesson Locked",
                                          description: "Complete the previous lesson first to unlock this one.",
                                          variant: "destructive"
                                        });
                                        return;
                                      }
                                      
                                        const container = document.querySelector('.training-mode-container');
                                        if (container) {
                                          container.classList.add('animate-out', 'slide-out-to-left', 'duration-150');
                                          setTimeout(() => {
                                            loadSavedGrammarLesson(lesson.id);
                                            setSelectedTrainingMode('saved');
                                          }, 150);
                                      }
                                    }}
                                  >
                                      {/* Card (Content) */}
                                    <div className={`relative transition-colors p-6 rounded-xl border-2 shadow-lg ${
                                          lesson.completed 
                                            ? 'bg-green-100 hover:bg-green-200 border-green-400' 
                                            : isUnlocked 
                                              ? (lesson.isExam ? 'bg-yellow-50 hover:bg-yellow-100 border-yellow-400' : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-gray-400')
                                              : 'bg-gray-100 border-gray-300'
                                    }`}>
                                        <div className="text-4xl mb-3">{isUnlocked ? (lesson.icon || (lesson.isExam ? '🎓' : '📖')) : '🔒'}</div>
                                        <h3 className={`font-semibold text-sm leading-tight ${isUnlocked ? 'text-gray-800' : 'text-gray-500'}`}>
                                          {lesson.title.includes(':') 
                                            ? lesson.title.split(':')[1].trim().substring(0, 20) + (lesson.title.split(':')[1].trim().length > 20 ? '...' : '')
                                            : lesson.title.substring(0, 20) + (lesson.title.length > 20 ? '...' : '')}
                                      </h3>
                                        <p className={`text-xs mt-1 ${isUnlocked ? (lesson.isExam ? 'text-yellow-700 font-semibold' : 'text-gray-600') : 'text-gray-500'}`}>
                                          {isUnlocked 
                                            ? (lesson.isExam ? 'EXAM' : (displayIndex === 0 ? 'Latest lesson' : `Lesson ${totalLessons - displayIndex}`))
                                            : 'Complete previous lesson'
                                          }
                                      </p>
                                        {displayIndex === 0 && !lesson.completed && (
                                          <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium z-30">New</div>
                                      )}
                                      {lesson.completed && (
                                        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium z-30 flex items-center gap-1">
                                            <span className="text-xs">✓</span>Done
                                        </div>
                                      )}
                                      {!isUnlocked && !lesson.completed && (
                                        <div className="absolute -top-2 -right-2 bg-gray-500 text-white text-xs px-2 py-1 rounded-full font-medium z-30 flex items-center gap-1">
                                            <span className="text-xs">🔒</span>Locked
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              }

              // Don't show loading screen - loading is shown in button now
              // Just show lesson selection while loading
              if (isLoadingGrammarLesson && !grammarLesson) {
                // Stay on lesson selection screen while loading
                return null;
              }

              if (!grammarLesson) {
                return (
                  <div className="text-center p-8">
                    <div className="mb-6">
                      <div className="text-6xl mb-4">⚠️</div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">Lesson Generation Failed</h3>
                      <p className="text-gray-600 mb-4">
                        {grammarLessonError || 'Unable to create a new lesson right now'}
                      </p>
                      <div className="space-y-3">
                        <Button 
                          onClick={() => {
                            generateNewGrammarLesson();
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          🔄 Try Again
                        </Button>
                        <div className="text-sm text-gray-500">
                          If this keeps happening, try again in a few minutes
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <GrammarLesson
                  lesson={grammarLesson}
                  onSuccess={handleGrammarLessonComplete}
                  onComplete={() => {
                    console.log(`📚 Grammar lesson completed - handled by success screen`);
                  }}
                />
              );
            })()}

            {selectedMode === 'sentence-builder' && selectedTrainingMode && (() => {
              if (isLoadingScenario || currentScenarioData === undefined) {
                return (
                  <div className="text-center p-8">
                    <div className="mb-6">
                      <img 
                        src={getAssetUrl("clippy_working.png")} 
                        alt="Clippy working" 
                        className="w-24 h-24 mx-auto animate-bounce"
                      />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">
                      Loading scenario from Gemini...
                    </h3>
                    <p className="text-gray-600">
                      Clippy is building interactive sentences for you
                    </p>
                    <div className="mt-4 w-32 h-1 bg-gray-200 rounded-full mx-auto overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                );
              }

              if (!currentScenarioData) {
                return (
                  <div className="text-center text-muted-foreground p-8">
                    <p>Could not generate a sentence scenario. Try adding more relevant vocabulary words or check your connection.</p>
                    <Button onClick={() => { // Button to try fetching again
                        // Clear scenarios and trigger refetch
                        setAvailableScenarios([]);
                        setCurrentScenarioIndex(0);
                        setCurrentScenarioData(undefined);
                    }} className="mt-4">Try Again</Button>
                  </div>
                );
              }

              // Determine source and target languages from the current card or fallback to preferences
              const currentCard = cards[currentCardIndex] || cards[0];
              const scenarioSourceLang = currentCard?.sourceLang || preferences.languages.nativeLang || "en";
              const scenarioTargetLang = currentCard?.targetLang || preferences.languages.learningLang || "fr";

              // Simple translation mapping for common scenario themes
              const themeTranslations: Record<string, Record<string, string>> = {
                'en': {
                  'At a Cafe': 'At a Cafe',
                  'At the Market': 'At the Market',
                  'At Home': 'At Home',
                  'At Work': 'At Work',
                  'At the Restaurant': 'At the Restaurant',
                  'At School': 'At School',
                  'At the Store': 'At the Store',
                  'At the Hospital': 'At the Hospital',
                  'At the Airport': 'At the Airport',
                  'Tại nhà': 'At Home',
                  'Tại quán cà phê': 'At a Cafe',
                  'Tại chợ': 'At the Market',
                  'Tại nơi làm việc': 'At Work',
                  'Tại nhà hàng': 'At the Restaurant',
                  'Tại trường học': 'At School',
                  'Tại cửa hàng': 'At the Store',
                  'Tại bệnh viện': 'At the Hospital',
                  'Tại sân bay': 'At the Airport'
                }
              };

              const translatedTheme = themeTranslations[scenarioSourceLang]?.[currentScenarioData.scenarioTheme] || currentScenarioData.scenarioTheme;

              return (
                <div className="max-w-2xl mx-auto space-y-4">
                  <SentenceBuilder
                    scenarioTheme={currentScenarioData.scenarioTheme}
                    scenarioThemeTranslated={translatedTheme}
                    scenarioContext={""} // No longer used for display
                    sentenceToBuild={currentScenarioData.sentenceToBuild}
                    sourceLanguageTranslation={currentScenarioData.sourceLanguageTranslation}
                    correctWordsForBlanks={currentScenarioData.correctWordsForBlanks}
                    distractorWords={currentScenarioData.distractorWords}
                    originalSentenceParts={currentScenarioData.originalSentenceParts}
                    newWordsInScenario={currentScenarioData.newWordsInScenario}
                    onWordAddToVocab={async (newWordData) => {
                      try {
                        // Construct NewCard payload for saving
                        // Note: We need to reverse the language mapping because:
                        // - newWordData.text is the word in target language (the language being learned)
                        // - newWordData.explanation is the explanation in source language (user's native language)
                        const cardToSave: any = {
                          sourceText: newWordData.text,        // New word (in targetLang) becomes sourceText in card
                          targetText: newWordData.explanation, // Explanation (in sourceLang) becomes targetText in card
                          explanation: newWordData.explanation, // Required explanation field
                          sourceLang: scenarioTargetLang,     // NEW WORD is in target language, so sourceLang should be targetLanguage
                          targetLang: scenarioSourceLang,     // EXPLANATION is in source language, so targetLang should be sourceLanguage
                          type: 'word',
                          learned: false,
                          // category, categoryEmoji are optional or could be set to a default
                        };
                        const savedCard = await saveCard(cardToSave);
                        
                        // Auto-categorize the newly added word
                        try {
                          const categorizeResponse = await fetch('/api/categorize', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ 
                              cards: [{ 
                                id: savedCard.id, 
                                sourceText: savedCard.sourceText, 
                                targetText: savedCard.targetText, 
                                type: savedCard.type 
                              }] 
                            }),
                          });
                          
                          if (categorizeResponse.ok) {
                            const categorizedData = await categorizeResponse.json();
                            if (categorizedData.cards && categorizedData.cards.length > 0) {
                              // Update the card with the categorization
                              await updateCard(savedCard.id, {
                                category: categorizedData.cards[0].category,
                                categoryEmoji: categorizedData.cards[0].categoryEmoji
                              });
                            }
                          }
                        } catch (categoryError) {
                          console.log("Auto-categorization failed, but word was saved:", categoryError);
                        }
                        
                        toast({
                          title: "✨ Word Added",
                          description: `"${newWordData.text}" has been added to your vocabulary.`,
                        });
                        // Don't reload cards or generate new scenarios when adding vocabulary
                        // This prevents the annoying scenario regeneration on vocabulary addition
                      } catch (error) {
                        console.error("Failed to save new word as card:", error);
                        toast({
                          variant: "destructive",
                          title: "❌ Error Adding Word",
                          description: "Could not save the new word to your vocabulary.",
                        });
                      }
                    }}
                    onNextSentence={() => {
                      // Cycle through available scenarios first
                      if (availableScenarios.length > 1) {
                        const nextIndex = (currentScenarioIndex + 1) % availableScenarios.length;
                        setCurrentScenarioIndex(nextIndex);
                        setCurrentScenarioData(availableScenarios[nextIndex]);
                      } else {
                        // If only one scenario or no scenarios, generate new ones
                        setAvailableScenarios([]);
                        setCurrentScenarioIndex(0);
                        setCurrentScenarioData(undefined);
                      }
                    }}
                    onPlayAudio={async (text: string) => {
                      // Custom TTS implementation for sentence builder scenarios
                      console.log('🔊 STUDY PAGE: SentenceBuilder onPlayAudio callback called with:', text);
                      
                      if (audioLoading) return;
                      
                      try {
                        setAudioLoading(true);
                        const languageCode = convertToLanguageCode(scenarioTargetLang);
                        console.log('🔊 SENTENCE BUILDER TTS: Using language code:', languageCode, 'for text:', text);
                        
                        const ttsResponse = await firebaseAPI.getGeminiTTS(text, languageCode);
                        firebaseAPI.playBase64Audio(ttsResponse.audioContent);
                        
                        console.log('🔊 SENTENCE BUILDER TTS: Successfully played audio for:', text);
                        
                        toast({
                          title: "🔊 Audio Generated",
                          description: `Playing pronunciation for sentence`,
                          duration: 2000,
                        });
                        
                      } catch (error) {
                        console.error('🔊 SENTENCE BUILDER TTS Error:', error);
                        toast({
                          title: "Audio Generation Failed",
                          description: "Could not generate audio. Please try again later.",
                          variant: "destructive"
                        });
                      } finally {
                        setAudioLoading(false);
                      }
                    }}
                    isSoundEnabled={isSoundEnabled}
                    targetLang={scenarioTargetLang}
                    currentScenarioIndex={currentScenarioIndex}
                    totalScenarios={availableScenarios.length}
                  />
                  
                  {/* Control Icons Row - moved outside the card */}
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    {/* Shuffle Button */}
                    {availableScenarios.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Shuffle available scenarios
                          const shuffled = [...availableScenarios];
                          for (let i = shuffled.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                          }
                          setAvailableScenarios(shuffled);
                          setCurrentScenarioIndex(0);
                          setCurrentScenarioData(shuffled[0]);
                          toast({
                            title: "Scenarios shuffled!",
                            description: "The scenario order has been randomized"
                          });
                        }}
                        className="text-sm"
                        title="Shuffle scenarios"
                      >
                        <Shuffle className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Play Sound Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        // Play the sentence with filled words or the original sentence
                        const filledSentence = currentScenarioData.originalSentenceParts
                          .map((part, index) => {
                            if (part.isBlank || part.text === "___") {
                              const blankIndex = currentScenarioData.originalSentenceParts.filter(p => p.isBlank || p.text === "___").indexOf(part);
                              return currentScenarioData.correctWordsForBlanks[blankIndex];
                            }
                            return part.text;
                          })
                          .join(' ')
                          .replace(/\s+/g, ' ')
                          .trim();
                        console.log('🔊 STUDY PAGE: Manual play button clicked (OUTSIDE card):', filledSentence);
                        
                        // Custom TTS for sentence builder with proper language
                        if (audioLoading) return;
                        
                        try {
                          setAudioLoading(true);
                          const languageCode = convertToLanguageCode(scenarioTargetLang);
                          console.log('🔊 MANUAL PLAY TTS: Using language code:', languageCode, 'for text:', filledSentence);
                          
                          const ttsResponse = await firebaseAPI.getGeminiTTS(filledSentence, languageCode);
                          firebaseAPI.playBase64Audio(ttsResponse.audioContent);
                          
                          console.log('🔊 MANUAL PLAY TTS: Successfully played audio for:', filledSentence);
                          
                        } catch (error) {
                          console.error('🔊 MANUAL PLAY TTS Error:', error);
                          toast({
                            title: "Audio Generation Failed",
                            description: "Could not generate audio. Please try again later.",
                            variant: "destructive"
                          });
                        } finally {
                          setAudioLoading(false);
                        }
                      }}
                      className="text-sm"
                      title="Play audio"
                    >
                      <Play className="h-4 w-4" />
                    </Button>

                    {/* Sound Toggle Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                      className="text-sm"
                      title={isSoundEnabled ? "Turn sound off" : "Turn sound on"}
                    >
                      {isSoundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </Button>

                    {/* Delete Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Clear current scenarios to force regeneration
                        setAvailableScenarios([]);
                        setCurrentScenarioIndex(0);
                        setCurrentScenarioData(undefined);
                        toast({
                          title: "Scenario cleared",
                          description: "Generating new scenarios..."
                        });
                      }}
                      className="text-sm text-destructive hover:text-destructive"
                      title="Delete scenario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Progress Bar - moved outside the SentenceBuilder card */}
                  <div className="w-full max-w-md mx-auto">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-700 ease-out shadow-sm"
                        style={{ 
                          width: `${Math.min(100, ((currentScenarioIndex + 1) / Math.max(1, availableScenarios.length)) * 100)}%`
                        }}
                      />
                    </div>
                    <div className="text-xs text-center text-muted-foreground mt-1">
                      {currentScenarioIndex + 1} of {availableScenarios.length}
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this flashcard? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}