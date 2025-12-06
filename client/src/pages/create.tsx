import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { translationRequestSchema, type TranslationRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Settings, Save, RefreshCw, Check, Upload } from "lucide-react";

import { getTranslation, getMemoryAid, getCategoryForCard } from "@/lib/mistral";
import { saveCard, getCards } from "@/lib/db";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { TranslationPreviewCard } from "@/components/ui/translation-preview-card";
import { usePreferences } from "@/lib/preferences-simple";
import { LANGUAGES } from "@/lib/constants";
import { useAchievement } from "@/lib/achievement-context";
import { useAPIKeys } from "@/lib/api-keys-context";
import { ImportAPIKeysPrompt } from "@/components/ui/import-api-keys-prompt";

export default function Create() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [isMemoryAidLoading, setIsMemoryAidLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentTranslation, setCurrentTranslation] = useState<{
    translation: string;
    explanation: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedState, setShowSavedState] = useState(false);
  const { toast } = useToast();
  const { languages, useEmojiMode, setLanguages } = usePreferences();
  const { hasMistralKey, importKeysFromFile, refreshKeys } = useAPIKeys();

  const form = useForm<TranslationRequest>({
    resolver: zodResolver(translationRequestSchema),
    defaultValues: {
      text: "",
      sourceLang: languages.nativeLang,
      targetLang: languages.learningLang
    }
  });

  // Update form values when languages change
  useEffect(() => {
    form.setValue('sourceLang', languages.nativeLang);
    form.setValue('targetLang', languages.learningLang);
    // Reset current translation when languages change to ensure consistency
    setCurrentTranslation(null);
  }, [languages.nativeLang, languages.learningLang, form]);

  async function onSubmit(data: TranslationRequest) {
    // Double-check API key availability
    if (!hasMistralKey) {
      toast({
        variant: "destructive",
        title: "🔑 API Key Required",
        description: "Please import your API keys to create cards. Click the 'Import API Keys' button below.",
      });
      return;
    }
    
    try {
      setIsTranslating(true);
      const result = await getTranslation(data);
      setCurrentTranslation(result);
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Check if it's an API key issue
      if (errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('401')) {
        toast({
          variant: "destructive",
          title: "🔑 API Key Issue",
          description: "Your API key may be invalid or expired. Please check your API keys in Settings.",
        });
        refreshKeys(); // Refresh to update button state
      } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) {
        toast({
          variant: "destructive",
          title: "🌐 Network Error",
          description: "Could not connect to the translation service. Please check your internet connection.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "❌ Translation Failed",
          description: errorMessage || "An unexpected error occurred. Please try again.",
        });
      }
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleRequestNewTranslation(feedback: string) {
    try {
      setIsTranslating(true);
      const data = form.getValues();
      const result = await getTranslation(data, feedback);
      setCurrentTranslation(result);
      return result;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: (error as Error).message
      });
      return null;
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleRequestNewMemoryAid(memoryAidType?: string) {
    if (!currentTranslation) return "";
    
    try {
      setIsMemoryAidLoading(true);
      const data = form.getValues();
      const newMemoryAid = await getMemoryAid({
        text: data.text,
        translation: currentTranslation.translation,
        sourceLang: data.sourceLang,
        targetLang: data.targetLang,
        memoryAidType: memoryAidType || 'mnemonic'
      });
      
      // Update the current translation with the new memory aid
      setCurrentTranslation({
        ...currentTranslation,
        explanation: newMemoryAid
      });
      
      return newMemoryAid;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Failed to generate new memory aid: " + (error as Error).message
      });
      return currentTranslation.explanation;
    } finally {
      setIsMemoryAidLoading(false);
    }
  }
  
  function handleTranslationChange(translation: string) {
    if (currentTranslation) {
      setCurrentTranslation({
        ...currentTranslation,
        translation
      });
    }
  }
  
  function handleExplanationChange(explanation: string) {
    if (currentTranslation) {
      setCurrentTranslation({
        ...currentTranslation,
        explanation
      });
    }
  }

  const { showAchievement } = useAchievement();
  const [cardCount, setCardCount] = useState(0);
  
  // Check for card count on mount
  useEffect(() => {
    async function checkCardCount() {
      const cards = await getCards();
      setCardCount(cards.length);
    }
    checkCardCount();
  }, []);
  
  async function handleSaveCard() {
    if (!currentTranslation || isSaving) return;

    try {
      setIsSaving(true);
      const data = form.getValues();
      
      // Detect if the input is a word or sentence
      const sourceText = data.text.trim();
      const wordCount = sourceText.split(/\s+/).length;
      const hasComplexPunctuation = /[.!?;:]/.test(sourceText);
      const type = (wordCount > 3 || hasComplexPunctuation) ? 'sentence' : 'word';
      
      // Get category for the card automatically
      const categoryData = await getCategoryForCard(
        data.text,
        currentTranslation.translation,
        type
      );
      
      await saveCard({
        sourceText: data.text,
        targetText: currentTranslation.translation,
        explanation: currentTranslation.explanation,
        sourceLang: data.sourceLang,
        targetLang: data.targetLang,
        type: type,
        category: categoryData.category,
        categoryEmoji: categoryData.categoryEmoji,
        createdAt: new Date(),
        learned: false,
        proficiency: 0,
        lastStudied: null
      });

      // Show saved state animation
      setShowSavedState(true);
      
      // After animation, reset and show toast
      setTimeout(() => {
        setShowSavedState(false);
        setIsSaving(false);
        toast({
          title: "✨ Card created!",
          description: "Your new translation card is ready for studying"
        });
        
        // Check for achievements
        const newCardCount = cardCount + 1;
        setCardCount(newCardCount);
        
        // First card achievement
        if (newCardCount === 1) {
          showAchievement({
            id: "first-card",
            name: "First Steps",
            description: "Created your first flashcard! Ready to start learning!"
          });
        }
        
        // 5 cards achievement
        if (newCardCount === 5) {
          showAchievement({
            id: "five-cards",
            name: "Card Collector",
            description: "Created 5 flashcards! Your vocabulary is growing!"
          });
        }
        
        // 10 cards achievement
        if (newCardCount === 10) {
          showAchievement({
            id: "ten-cards",
            name: "Vocabulary Builder",
            description: "Created 10 flashcards! You're building a solid foundation!"
          });
        }
        
        // 25 cards achievement
        if (newCardCount === 25) {
          showAchievement({
            id: "twenty-five-cards",
            name: "Word Master",
            description: "Created 25 flashcards! Your dedication is impressive!"
          });
        }

        // Reset form and translation for next card
        form.reset({
          text: "",
          sourceLang: form.getValues("sourceLang"),
          targetLang: form.getValues("targetLang")
        });
        setCurrentTranslation(null);
      }, 1125);
    } catch (error) {
      setIsSaving(false);
      setShowSavedState(false);
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: (error as Error).message
      });
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center mb-6">
        {currentTranslation ? (
          <Button 
            variant="ghost" 
            size="icon" 
            className="mr-4"
            onClick={() => setCurrentTranslation(null)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : (
          <Link href="/">
            <Button variant="ghost" size="icon" className="mr-4">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        )}
        <h1 className="text-3xl font-bold">✍️ Create Card</h1>
      </div>

      <div className="space-y-6">
        <div 
          className="relative w-full"
          style={{ 
            height: "520px",
            perspective: "1000px"
          }}
        >
          <div 
            className="absolute w-full h-full transition-transform duration-500 rounded-lg border bg-card text-card-foreground shadow-sm"
            style={{ 
              transformStyle: "preserve-3d",
              transform: currentTranslation ? "rotateY(180deg)" : "rotateY(0deg)"
            }}
          >
            {/* Front of card - Translation form */}
            <div 
              className="absolute w-full h-full rounded-lg overflow-hidden"
              style={{ backfaceVisibility: "hidden" }}
            >
              <Card className="w-full h-full border-0 shadow-none">
                <CardHeader className="text-center">
                  <CardTitle></CardTitle>
                </CardHeader>
                <CardContent className="pb-24">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="text"
                        render={({ field }) => (
                          <FormItem>
                            {/* Removed redundant label as it's clear from the placeholder */}
                            <FormControl>
                              <Input 
                                placeholder="Enter text to translate..." 
                                className="text-xl p-6 min-h-[100px]" 
                                {...field} 
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {!hasMistralKey ? (
                        <Button 
                          type="button"
                          className="w-full h-14 text-lg mt-6 border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                          variant="outline"
                          onClick={async (e) => {
                            e.preventDefault();
                            const success = await importKeysFromFile();
                            if (success) {
                              toast({
                                title: "✅ API Keys Imported",
                                description: "Your API keys have been imported. You can now create cards!",
                              });
                              refreshKeys();
                            }
                          }}
                        >
                          <Upload className="mr-2 h-5 w-5" />
                          Import API Keys
                        </Button>
                      ) : (
                        <Button 
                          type="submit" 
                          className="w-full h-14 text-lg mt-6"
                          disabled={isTranslating}
                        >
                          {isTranslating ? (
                            <div className="flex items-center">
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Translating...
                            </div>
                          ) : (
                            "Create Card"
                          )}
                        </Button>
                      )}

                      {showSettings && (
                        <div className="flex gap-4 mt-8 animate-in slide-in-from-bottom duration-300">
                          <FormField
                            control={form.control}
                            name="sourceLang"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Source Language</FormLabel>
                                <Select 
                                  onValueChange={(value) => {
                                    field.onChange(value);
                                    // Permanently update preferences
                                    setLanguages({
                                      nativeLang: value,
                                      learningLang: languages.learningLang
                                    });
                                  }} 
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a language" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {LANGUAGES.map((lang) => (
                                      <SelectItem key={lang.value} value={lang.value}>
                                        {lang.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="targetLang"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Target Language</FormLabel>
                                <Select 
                                  onValueChange={(value) => {
                                    field.onChange(value);
                                    // Permanently update preferences
                                    setLanguages({
                                      nativeLang: languages.nativeLang,
                                      learningLang: value
                                    });
                                  }} 
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a language" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {LANGUAGES.map((lang) => (
                                      <SelectItem key={lang.value} value={lang.value}>
                                        {lang.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </form>
                  </Form>
                </CardContent>
                <CardFooter className="absolute bottom-0 w-full justify-start pb-6">
                  {!showSettings && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowSettings(true)}
                      className="text-muted-foreground"
                    >
                      <Settings className="h-4 w-4 mr-2" /> Language Settings
                    </Button>
                  )}
                  {showSettings && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowSettings(false)}
                      className="text-muted-foreground"
                    >
                      <Settings className="h-4 w-4 mr-2" /> Hide Settings
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>

            {/* Back of card - Translation preview */}
            <div 
              className="absolute w-full h-full rounded-lg overflow-hidden"
              style={{ 
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)"
              }}
            >
              {currentTranslation && (
                <TranslationPreviewCard
                  sourceText={form.getValues("text")}
                  translation={currentTranslation.translation}
                  explanation={currentTranslation.explanation}
                  sourceLang={form.getValues("sourceLang")}
                  targetLang={form.getValues("targetLang")}
                  onSave={handleSaveCard}
                  onRequestNewTranslation={handleRequestNewTranslation}
                  onRequestNewMemoryAid={handleRequestNewMemoryAid}
                  onTranslationChange={handleTranslationChange}
                  onExplanationChange={handleExplanationChange}
                  isLoading={isTranslating}
                  isMemoryAidLoading={isMemoryAidLoading}
                />
              )}
            </div>
          </div>
        </div>

        {/* Action buttons moved here */}
        {currentTranslation && (
          <div className="mt-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFeedback("");
                    setShowFeedback(true);
                  }}
                  disabled={isTranslating}
                  className="w-full h-10"
                >
                  Request Changes
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full h-10"
                  onClick={() => setCurrentTranslation(null)}
                >
                  ← Back
                </Button>
              </div>
              <Button 
                onClick={handleSaveCard} 
                disabled={isTranslating || isSaving} 
                className="flex-1 h-[88px] flex items-center justify-center"
                style={{ fontSize: "clamp(1.3125rem, 3.75vw, 1.875rem)" }}
              >
                {showSavedState ? (
                  <>
                    <Check className="mr-2 h-6 w-6 text-green-600 animate-in zoom-in-75 duration-200" />
                    <span className="animate-in fade-in-0 slide-in-from-left-2 duration-200">Saved</span>
                  </>
                ) : isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-6 w-6" />
                    Save Card
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Glassy Feedback Overlay */}
        {showFeedback && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col justify-center items-center p-8 animate-in fade-in duration-300">
            <div className="bg-card rounded-lg p-6 shadow-lg w-full max-w-md border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-lg">Your Feedback</h3>
                <button 
                  onClick={() => setShowFeedback(false)} 
                  className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"
                  aria-label="Close feedback form"
                >
                  {useEmojiMode ? <span className="text-lg">✖</span> : <span>✕</span>}
                </button>
              </div>

              <p className="text-muted-foreground mb-4">
                What would you like to improve about this translation?
              </p>

              <textarea
                placeholder="The translation seems incorrect because..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={isTranslating}
                className="min-h-[120px] mb-4 w-full p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
              />

              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    if (feedback.trim()) {
                      handleRequestNewTranslation(feedback);
                      setFeedback("");
                      setShowFeedback(false);
                    }
                  }}
                  disabled={isTranslating || !feedback.trim()}
                  className="w-full"
                >
                  {isTranslating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Getting new translation...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Get New Translation
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}