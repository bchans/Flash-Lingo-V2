import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { getCards, deleteCard, exportCards, importCards, updateCard } from "@/lib/db";
import type { Card as CardType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, Download, Upload, Save, Sparkles, Info } from "lucide-react";
import { Link } from "wouter";
import { usePreferences } from "@/lib/preferences-simple";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Scenarios from "./scenarios";
import Lessons from "./lessons";

type Tab = "flashcards" | "scenarios" | "lessons";

export default function MyCards() {
  const [activeTab, setActiveTab] = useState<Tab>("flashcards");
  const [cards, setCards] = useState<CardType[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { useEmojiMode } = usePreferences();

  useEffect(() => {
    if (activeTab === "flashcards") {
      loadCards();
    }
  }, [activeTab]);

  async function loadCards() {
    const savedCards = await getCards();
    setCards(savedCards);
  }

  async function handleDelete(id: number) {
    try {
      await deleteCard(id);
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
    }
  }

  async function handleExport() {
    try {
      setIsExporting(true);
      const jsonData = await exportCards();

      // Create a downloadable file
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flashlingo-cards-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();

      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
            title: "💾 Export complete",
            description: "Your cards, lessons, audio, and API keys have been exported successfully"
          });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Export failed",
        description: "Failed to export your cards"
      });
    } finally {
      setIsExporting(false);
    }
  }

  function triggerImportDialog() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const inputElement = event.target;
    const file = inputElement.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const jsonData = e.target?.result as string | null;
          if (!jsonData) {
            throw new Error("No file contents were read.");
          }

          let parsedData: any;
          try {
            parsedData = JSON.parse(jsonData);
          } catch (parseError) {
            throw new SyntaxError("Invalid JSON structure");
          }

          const importedCount = await importCards(jsonData);
          
          // Reload cards and force re-render
          const updatedCards = await getCards();
          setCards(updatedCards);

          // Check if the import included additional data
          const hasAPIKeys = parsedData.apiKeys || parsedData.geminiApiKey || parsedData.firebaseApiKey || parsedData.mistralApiKey;
          const hasLessons = parsedData.grammarLessons && parsedData.grammarLessons.length > 0;
          
          let description = `Successfully imported ${importedCount} cards`;
          if (hasLessons) {
            description += `, ${parsedData.grammarLessons.length} lessons`;
          }
          if (hasAPIKeys) {
            description += `, and API keys`;
          }
          
          toast({
            title: "📥 Import complete",
            description: description
          });
        } catch (error) {
          console.error("Import failed:", error);
          const isFormatError = error instanceof SyntaxError || (error instanceof Error && error.message?.includes("Invalid JSON"));
          
          toast({
            variant: "destructive",
            title: "❌ Import failed",
            description: isFormatError
              ? "The file format is invalid. Please export from Flash Lingo and try again."
              : (error instanceof Error ? error.message : "Something went wrong while importing.")
          });
        } finally {
          setIsImporting(false);
          // Reset file input
          if (inputElement) {
            inputElement.value = '';
          }
        }
      };

      reader.readAsText(file);
    } catch (error) {
      setIsImporting(false);
      toast({
        variant: "destructive",
        title: "❌ Import failed",
        description: "Failed to read the file"
      });
    }
  }

  async function handleCategorize() {

    try {
      setIsCategorizing(true);

      // Filter cards that don't have categories
      const uncategorizedCards = cards.filter(card => !card.category);

      // If all cards have categories, re-evaluate and merge similar ones
      if (uncategorizedCards.length === 0) {
        // Use all cards for re-evaluation and merging
        const allCards = cards.map(card => ({
          id: card.id,
          sourceText: card.sourceText,
          targetText: card.targetText,
          type: card.type,
          currentCategory: card.category,
          currentEmoji: card.categoryEmoji
        }));

        const response = await fetch('/api/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: allCards, mode: 'merge' })
        });

        if (!response.ok) {
          throw new Error('Failed to re-categorize cards');
        }

        const result = await response.json();

        // Update cards with new categories
        for (const updatedCard of result.cards) {
          await updateCard(updatedCard.id, {
            category: updatedCard.category,
            categoryEmoji: updatedCard.categoryEmoji
          });
        }

        // Refresh cards
        await loadCards();

        toast({
          title: "🎯 Categories optimized",
          description: `Re-evaluated all categories and merged similar ones`
        });

        return;
      }

      // Prepare card data for AI categorization
      const cardTexts = uncategorizedCards.map(card => ({
        id: card.id,
        sourceText: card.sourceText,
        targetText: card.targetText,
        type: card.type
      }));

      // Call Gemini API for categorization
      const response = await fetch('/api/categorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cards: cardTexts }),
      });

      if (!response.ok) {
        throw new Error('Failed to categorize cards');
      }

      const categorizedData = await response.json();

      // Update cards with categories
      for (const cardData of categorizedData.cards) {
        await updateCard(cardData.id, {
          category: cardData.category,
          categoryEmoji: cardData.categoryEmoji
        });
      }

      await loadCards();

      toast({
        title: "🎯 Categorization complete",
        description: `Successfully categorized ${uncategorizedCards.length} cards`
      });
    } catch (error) {
      console.error('Categorization error:', error);
      toast({
        variant: "destructive",
        title: "❌ Categorization failed",
        description: "Failed to categorize cards. Please try again."
      });
    } finally {
      setIsCategorizing(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6 max-w-4xl mx-auto">
        <Link href="/">
          <Button variant="ghost" size="icon" className="mr-4">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{useEmojiMode ? '📚 ' : ''}My Cards</h1>
      </div>

      <div className="flex border-b mb-6 max-w-4xl mx-auto">
        <Button
          variant={activeTab === "flashcards" ? "secondary" : "ghost"}
          onClick={() => setActiveTab("flashcards")}
          className="rounded-b-none"
        >
          Flashcards
        </Button>
        <Button
          variant={activeTab === "scenarios" ? "secondary" : "ghost"}
          onClick={() => setActiveTab("scenarios")}
          className="rounded-b-none"
        >
          Scenarios
        </Button>
        <Button
          variant={activeTab === "lessons" ? "secondary" : "ghost"}
          onClick={() => setActiveTab("lessons")}
          className="rounded-b-none"
        >
          Lessons
        </Button>
      </div>

      {activeTab === 'flashcards' && (
        <>
          <div className="flex flex-wrap gap-2 mb-6 p-4 bg-muted/50 rounded-lg max-w-4xl mx-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCategorize}
              disabled={isCategorizing || cards.length === 0}
              className="flex items-center"
            >
              {isCategorizing ? (
                <span className="animate-spin mr-2">⏳</span>
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Categorize
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={triggerImportDialog}
              disabled={isImporting}
              className="flex items-center"
            >
              {isImporting ? (
                <span className="animate-spin mr-2">⏳</span>
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Import
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || cards.length === 0}
              className="flex items-center"
>
              {isExporting ? (
                <span className="animate-spin mr-2">⏳</span>
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Export
            </Button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              accept=".json"
              className="hidden"
            />
          </div>

          <Alert className="max-w-4xl mx-auto mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>💡 Tip:</strong> Export includes your cards, grammar lessons, audio pronunciations, and <strong>API keys</strong>. 
              Import on a new device to restore everything instantly!
            </AlertDescription>
          </Alert>

          <div className="space-y-4 max-w-4xl mx-auto">
            {cards.length === 0 ? (
              <div className="text-center text-muted-foreground p-8">
                <p className="text-4xl mb-4">📝</p>
                <p>No cards yet. Create some cards to get started!</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-4">Languages</th>
                      <th className="text-left p-4">Source Text</th>
                      <th className="text-left p-4">Translation</th>
                      <th className="text-left p-4">Status</th>
                      <th className="text-left p-4">Type</th>
                      <th className="text-left p-4">Category</th>
                      <th className="text-right p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((card) => (
                      <tr key={card.id} className="border-t">
                        <td className="p-4">
                          {card.sourceLang} → {card.targetLang}
                        </td>
                        <td className="p-4">{card.sourceText}</td>
                        <td className="p-4">{card.targetText}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            card.learned
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {card.learned ? '✨ Learned' : '📚 Still Learning'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            card.type === 'sentence'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {card.type === 'sentence' ? '💬 Sentence' : '📝 Word'}
                          </span>
                        </td>
                        <td className="p-4">
                          {card.category ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                              {card.categoryEmoji} {card.category}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">No category</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(card.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'scenarios' && <Scenarios />}

      {activeTab === 'lessons' && <Lessons />}
    </div>
  );
}