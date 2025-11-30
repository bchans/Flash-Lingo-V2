import Dexie, { type Table } from 'dexie';
import type { Card, GrammarLesson, InsertGrammarLesson } from '@shared/schema';

export class CardDatabase extends Dexie {
  cards!: Table<Card>;
  grammarLessons!: Table<GrammarLesson>;

  constructor() {
    super('language_cards');
    this.version(1).stores({
      cards: '++id, sourceLang, targetLang, learned, proficiency, lastStudied'
    });
    this.version(2).stores({
      cards: '++id, sourceLang, targetLang, learned, proficiency, lastStudied, category, categoryEmoji'
    });
    this.version(3).stores({
      cards: '++id, sourceLang, targetLang, learned, proficiency, lastStudied, category, categoryEmoji, cachedScenarios'
    });
    this.version(4).stores({
      cards: '++id, sourceLang, targetLang, learned, proficiency, lastStudied, category, categoryEmoji, cachedScenarios, hasScenario'
    });
    this.version(5).stores({
      cards: '++id, sourceLang, targetLang, learned, proficiency, lastStudied, category, categoryEmoji, cachedScenarios, hasScenario, audioFileSource, audioFileTarget'
    });
    this.version(6).stores({
      cards: '++id, sourceLang, targetLang, learned, proficiency, lastStudied, category, categoryEmoji, cachedScenarios, hasScenario, audioFileSource, audioFileTarget',
      grammarLessons: '++id, createdAt'
    });
    this.version(7).stores({
      cards: '++id, sourceLang, targetLang, learned, proficiency, lastStudied, category, categoryEmoji, cachedScenarios, hasScenario, audioFileSource, audioFileTarget',
      grammarLessons: '++id, createdAt, title, explanation, exercises, newWords'
    });
    this.version(8).stores({
      cards: '++id, sourceLang, targetLang, learned, proficiency, lastStudied, category, categoryEmoji, cachedScenarios, hasScenario, audioFileSource, audioFileTarget',
      grammarLessons: '++id, createdAt, title, explanation, exercises, newWords, completed'
    });
    // Add compound index to speed up imports that match on source+target text
    this.version(9).stores({
      cards: '++id,[sourceText+targetText], sourceLang, targetLang, learned, proficiency, lastStudied, category, categoryEmoji, cachedScenarios, hasScenario, audioFileSource, audioFileTarget',
      grammarLessons: '++id, createdAt, title, explanation, exercises, newWords, completed'
    });
  }
}

export const db = new CardDatabase();

// Migration function to update hasScenario flag for existing cards
export async function updateHasScenarioFlags(): Promise<void> {
  try {
    const allCards = await db.cards.toArray();
    console.log(`🔄 Updating hasScenario flags for ${allCards.length} cards...`);

    let updatedCount = 0;
    for (const card of allCards) {
      const hasScenarios = card.cachedScenarios && card.cachedScenarios.length > 0;
      const needsUpdate = hasScenarios && !card.hasScenario;

      if (needsUpdate) {
        await db.cards.update(card.id!, { hasScenario: true });
        console.log(`🔄 Updated hasScenario flag for card: ${card.targetText} (ID: ${card.id})`);
        updatedCount++;
      }
    }

    console.log(`✅ Updated hasScenario flag for ${updatedCount} cards`);

    // Show current state after migration
    const cardsWithScenarios = allCards.filter(card => card.hasScenario);
    const cardsWithoutScenarios = allCards.filter(card => !card.hasScenario);
    console.log(`📊 After migration: ${cardsWithScenarios.length} cards have scenarios, ${cardsWithoutScenarios.length} need scenarios`);
  } catch (error) {
    console.error('❌ Error updating hasScenario flags:', error);
  }
}

export async function saveCard(card: Omit<Card, 'id'>) {
  return await db.cards.add(card as Card);
}

export async function getCards() {
  return await db.cards.toArray();
}

export async function deleteCard(id: number) {
  return await db.cards.delete(id);
}

export async function updateCard(id: number, card: Partial<Card>) {
  return await db.cards.update(id, card);
}

// Export all cards to a JSON string
export async function exportCards(): Promise<string> {
  const cards = await getCards();
  const grammarLessons = await getGrammarLessons();
  
  // Extract scenarios from cards
  const scenarios: any[] = [];
  cards.forEach(card => {
    if (card.cachedScenarios && card.cachedScenarios.length > 0) {
      card.cachedScenarios.forEach(scenarioJson => {
        try {
          const scenario = JSON.parse(scenarioJson);
          scenarios.push({
            ...scenario,
            associatedCardId: card.id
          });
        } catch (error) {
          console.error('Error parsing cached scenario for export:', error);
        }
      });
    }
  });

  // Collect all audio files (MP3s stored as base64)
  const audioFiles: { [key: string]: string } = {};
  cards.forEach(card => {
    if (card.audioFileSource) {
      audioFiles[`card_${card.id}_source`] = card.audioFileSource;
    }
    if (card.audioFileTarget) {
      audioFiles[`card_${card.id}_target`] = card.audioFileTarget;
    }
  });

  // Import API keys functions
  const { getAPIKeys } = await import('./api-keys');
  const apiKeys = getAPIKeys();

  return JSON.stringify({ 
    cards, 
    grammarLessons,
    scenarios,
    audioFiles,
    apiKeys, // Include API keys in export
    exportVersion: "4.0", // Increment version to indicate API keys support
    exportDate: new Date().toISOString(),
    contentTypes: {
      flashcards: cards.length,
      grammarLessons: grammarLessons.length,
      scenarios: scenarios.length,
      audioFiles: Object.keys(audioFiles).length,
      apiKeysIncluded: !!(apiKeys.geminiApiKey || apiKeys.firebaseApiKey || apiKeys.mistralApiKey)
    }
  }, null, 2);
}

// Import cards from a JSON string
export async function importCards(jsonData: string): Promise<number> {
  const data = JSON.parse(jsonData);

  // Handle both old format (just cards) and new format (cards + scenarios + lessons)
  let cards = [];
  let grammarLessons = [];

  if (data.cards && Array.isArray(data.cards)) {
    cards = data.cards;
  } else if (Array.isArray(data)) {
    // Old format - just an array of cards
    cards = data;
  } else {
    throw new Error('Invalid JSON format: no cards found');
  }

  if (data.grammarLessons && Array.isArray(data.grammarLessons)) {
    grammarLessons = data.grammarLessons;
  }

  let importedCount = 0;

  // Import cards (including their scenarios)
  for (const cardData of cards) {
    // Validate required fields
    if (!cardData.sourceText || !cardData.targetText) {
      continue; // Skip invalid cards
    }

    const card: Omit<Card, 'id'> = {
      sourceText: cardData.sourceText,
      targetText: cardData.targetText,
      explanation: cardData.explanation || '',
      type: (cardData.type as 'word' | 'sentence') || 'word',
      sourceLang: cardData.sourceLang || 'en',
      targetLang: cardData.targetLang || 'en',
      learned: cardData.learned || false,
      proficiency: cardData.proficiency || 0,
      lastStudied: cardData.lastStudied || new Date(),
      category: cardData.category || null,
      categoryEmoji: cardData.categoryEmoji || null,
      cachedScenarios: cardData.cachedScenarios || [],
      hasScenario: cardData.hasScenario || false,
      audioFileSource: cardData.audioFileSource || null,
      audioFileTarget: cardData.audioFileTarget || null,
      createdAt: cardData.createdAt || new Date(),
    };

    const savedCardId = await saveCard(card) as number;

    // Import scenarios for this card if they exist
    if (cardData.cachedScenarios && Array.isArray(cardData.cachedScenarios)) {
      for (const scenario of cardData.cachedScenarios) {
        await saveCachedScenario(savedCardId, scenario);
      }
      // Update hasScenario flag
      await updateCard(savedCardId, { hasScenario: true });
    }

    importedCount++;
  }

  // Import audio files if present (restore from audioFiles section)
  if (data.audioFiles && typeof data.audioFiles === 'object') {
    for (const [key, audioData] of Object.entries(data.audioFiles)) {
      const match = key.match(/^card_(\d+)_(source|target)$/);
      if (match) {
        const originalCardId = parseInt(match[1]);
        const audioType = match[2] as 'source' | 'target';
        
        // Find the imported card by matching source and target text
        // (since IDs change on import)
        const originalCard = cards.find(c => c.id === originalCardId);
        if (originalCard) {
          const importedCard = await db.cards.where({
            sourceText: originalCard.sourceText,
            targetText: originalCard.targetText
          }).first();
          
          if (importedCard) {
            if (audioType === 'source') {
              await updateCard(importedCard.id, { audioFileSource: audioData as string });
            } else {
              await updateCard(importedCard.id, { audioFileTarget: audioData as string });
            }
          }
        }
      }
    }
  }

  // Import grammar lessons with conflict handling
  const existingLessons = await getGrammarLessons();
  for (const lessonData of grammarLessons) {
    // Validate required fields
    if (!lessonData.title || !lessonData.explanation || !lessonData.exercises) {
      continue; // Skip invalid lessons
    }

    // Check for conflicts (lessons with same title)
    const existingLesson = existingLessons.find(l => l.title === lessonData.title);
    
    if (existingLesson) {
      // Skip if existing lesson is more progressed (completed vs not completed)
      if (existingLesson.completed && !lessonData.completed) {
        console.log(`Skipping lesson "${lessonData.title}" - existing lesson is more progressed`);
        continue;
      }
      
      // Update existing lesson if imported one is more progressed
      if (!existingLesson.completed && lessonData.completed) {
        console.log(`Updating lesson "${lessonData.title}" with progress from import`);
        await db.grammarLessons.update(existingLesson.id, { 
          completed: true,
          isExam: lessonData.isExam ?? existingLesson.isExam,
          lessonNumber: lessonData.lessonNumber ?? existingLesson.lessonNumber
        });
        continue;
      }
      
      // If both have same progress, skip to avoid duplicates
      console.log(`Skipping duplicate lesson "${lessonData.title}"`);
      continue;
    }

    // No conflict, import the lesson
    const lesson: InsertGrammarLesson = {
      title: lessonData.title,
      explanation: lessonData.explanation,
      exercises: typeof lessonData.exercises === 'string' ? lessonData.exercises : JSON.stringify(lessonData.exercises),
      newWords: lessonData.newWords || [],
      isExam: lessonData.isExam || false,
      lessonNumber: lessonData.lessonNumber || 0,
      completed: lessonData.completed || false
    };

    await saveGrammarLesson(lesson);
    console.log(`Imported lesson "${lessonData.title}"`);
  }

  // Import API keys if present
  // Handle both formats: nested under 'apiKeys' property or at root level
  const apiKeysToImport = data.apiKeys || (data.geminiApiKey || data.firebaseApiKey || data.mistralApiKey ? data : null);
  
  if (apiKeysToImport) {
    const { saveAPIKeys } = await import('./api-keys');
    try {
      saveAPIKeys(apiKeysToImport);
      console.log('✅ API keys imported successfully');
    } catch (error) {
      console.error('Failed to import API keys:', error);
    }
  }

  return importedCount;
}

// Save a scenario to a word's cached scenarios
export async function saveCachedScenario(cardId: number, scenario: string): Promise<void> {
  try {
    const card = await db.cards.get(cardId);
    if (!card) {
      throw new Error('Card not found');
    }

    const existingScenarios = card.cachedScenarios || [];
    const updatedScenarios = [...existingScenarios, scenario];

    await db.cards.update(cardId, { 
      cachedScenarios: updatedScenarios,
      hasScenario: true // Mark this card as having a scenario
    });
  } catch (error) {
    console.error('Error saving cached scenario:', error);
    throw error;
  }
}

// Get cached scenarios for a word
export async function getCachedScenarios(cardId: number): Promise<string[]> {
  try {
    const card = await db.cards.get(cardId);
    return card?.cachedScenarios || [];
  } catch (error) {
    console.error('Error getting cached scenarios:', error);
    return [];
  }
}

// Get all cards with their cached scenarios
export async function getCardsWithScenarios(): Promise<Card[]> {
  try {
    const cards = await db.cards.toArray();
    return cards.map(card => ({
      ...card,
      cachedScenarios: card.cachedScenarios || []
    }));
  } catch (error) {
    console.error('Error getting cards with scenarios:', error);
    return [];
  }
}

// Remove a cached scenario from a card
export async function removeCachedScenario(cardId: number, scenarioIndex: number): Promise<void> {
  try {
    const card = await db.cards.get(cardId);
    if (!card || !card.cachedScenarios) {
      throw new Error('Card or scenarios not found');
    }

    const updatedScenarios = card.cachedScenarios.filter((_, index) => index !== scenarioIndex);
    await db.cards.update(cardId, { cachedScenarios: updatedScenarios });
  } catch (error) {
    console.error('Error removing cached scenario:', error);
    throw error;
  }
}

// Save audio for a card (both source and target)
export async function saveCardAudio(cardId: number, audioFileSource?: string, audioFileTarget?: string): Promise<void> {
  try {
    const updateData: any = {};
    if (audioFileSource) {
      updateData.audioFileSource = audioFileSource;
    }
    if (audioFileTarget) {
      updateData.audioFileTarget = audioFileTarget;
    }

    await db.cards.update(cardId, updateData);
  } catch (error) {
    console.error('Error saving card audio:', error);
    throw error;
  }
}

// Get cached audio for a card
export async function getCachedAudio(cardId: number): Promise<{ source?: string, target?: string }> {
  try {
    const card = await db.cards.get(cardId);
    return {
      source: card?.audioFileSource || undefined,
      target: card?.audioFileTarget || undefined
    };
  } catch (error) {
    console.error('Error getting cached audio:', error);
    return {};
  }
}

export async function saveGrammarLesson(lesson: InsertGrammarLesson) {
  return await db.grammarLessons.add(lesson as GrammarLesson);
}

export async function getGrammarLessons() {
  return await db.grammarLessons.toArray();
}