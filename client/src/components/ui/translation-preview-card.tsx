import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Volume2, Edit, Brain, Sparkles, Loader2, Minus, Plus } from "lucide-react";
import { getLanguageLabel } from "@/lib/constants";
import { usePreferences } from "@/lib/preferences-simple";
import { incrementHintCounter } from "@/lib/db";

interface TranslationPreviewProps {
  sourceText: string;
  translation: string;
  explanation: string;
  sourceLang: string;
  targetLang: string;
  onSave: () => Promise<void>;
  onRequestNewTranslation: (feedback: string) => void;
  onRequestNewMemoryAid?: (memoryAidType?: string) => Promise<string>;
  onTranslationChange?: (translation: string) => void;
  onExplanationChange?: (explanation: string) => void;
  isLoading?: boolean;
  isMemoryAidLoading?: boolean;
}

export function TranslationPreviewCard({
  sourceText,
  translation,
  explanation,
  sourceLang,
  targetLang,
  onSave,
  onRequestNewTranslation,
  onRequestNewMemoryAid,
  onTranslationChange,
  onExplanationChange,
  isLoading = false,
  isMemoryAidLoading = false
}: TranslationPreviewProps) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentTranslation, setCurrentTranslation] = useState(translation);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedState, setShowSavedState] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState(explanation);
  const [editingTranslation, setEditingTranslation] = useState(false);
  const [editingExplanation, setEditingExplanation] = useState(false);
  const [memoryAidType, setMemoryAidType] = useState('random');
  const [showMemoryAid, setShowMemoryAid] = useState(true);
  const { useEmojiMode, incrementHintCounter } = usePreferences();

  // Update states when props change
  useEffect(() => {
    setCurrentTranslation(translation);
  }, [translation]);

  useEffect(() => {
    setCurrentExplanation(explanation);
  }, [explanation]);

  // Get language labels for display
  const sourceLangLabel = getLanguageLabel(sourceLang);
  const targetLangLabel = getLanguageLabel(targetLang);

  // Increment memory aid hint counter when user requests new memory aid
  const handleRequestMemoryAid = async () => {
    if (!isMemoryAidLoading && onRequestNewMemoryAid) {
      // Increment hint counter to track usage of this feature
      incrementHintCounter('memoryAid');
      const newMemoryAid = await onRequestNewMemoryAid(memoryAidType);
      setCurrentExplanation(newMemoryAid);
      if (onExplanationChange) onExplanationChange(newMemoryAid);
    }
  };

  const handleTranslationChange = (value: string) => {
    setCurrentTranslation(value);
    if (onTranslationChange) onTranslationChange(value);
  };

  const handleExplanationChange = (value: string) => {
    setCurrentExplanation(value);
    if (onExplanationChange) onExplanationChange(value);
  };

  return (
    <Card className="w-full h-full border-0 shadow-none relative">
      {/* Overlay feedback form when shown */}
      {showFeedback && (
        <div className="absolute inset-0 z-10 bg-background/90 backdrop-blur-sm flex flex-col justify-center items-center p-8 animate-in fade-in duration-300">
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

            <Textarea
              placeholder="The translation seems incorrect because..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={isLoading}
              className="min-h-[120px] mb-4"
              autoFocus
            />

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  if (feedback.trim()) {
                    onRequestNewTranslation(feedback);
                    // We'll keep the overlay open until the new translation is ready
                    // setFeedback("");
                    // setShowFeedback(false);
                  }
                }}
                disabled={isLoading || !feedback.trim()}
                className="w-full"
              >
                {isLoading ? (
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

      {/* Main translation card content */}
      <CardHeader>
        <CardTitle>Translation Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="font-medium">Original Text ({sourceLangLabel})</h3>
          <p className="text-muted-foreground text-lg p-3 bg-muted/10 rounded-md">{sourceText}</p>
        </div>

        <div className="space-y-2">
          <h3 className="font-medium">Translation ({targetLangLabel})</h3>
          <div 
            className="text-primary text-xl font-medium p-3 bg-primary/5 rounded-md cursor-pointer hover:bg-primary/10 transition-colors min-h-[60px] flex items-start relative"
            onClick={() => setEditingTranslation(true)}
            title="Click to edit"
          >
            {editingTranslation ? (
              <textarea
                value={currentTranslation}
                onChange={(e) => handleTranslationChange(e.target.value)}
                className="absolute inset-0 w-full h-full bg-transparent border-none outline-none resize-none text-primary text-xl font-medium p-3 rounded-md"
                placeholder="Edit translation..."
                autoFocus
                onBlur={() => setEditingTranslation(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    setEditingTranslation(false);
                  }
                  if (e.key === 'Escape') {
                    setEditingTranslation(false);
                  }
                }}
              />
            ) : (
              currentTranslation
            )}
          </div>
        </div>

        <div className={`border rounded-md bg-muted/5 relative overflow-hidden transition-all duration-300 ease-in-out ${
          showMemoryAid 
            ? 'max-w-full max-h-[300px] opacity-100' 
            : 'max-w-[40px] max-h-[40px] opacity-40'
        }`}>
          {/* Toggle button positioned absolutely to always remain visible */}
          <Button
            variant="ghost"
            size="sm"
            className={`absolute h-6 w-6 p-0 hover:bg-muted/50 z-20 transition-all duration-300 ease-in-out ${
              showMemoryAid ? 'top-2 right-2 opacity-100' : 'top-[7px] right-[7px] opacity-50'
            }`}
            onClick={() => setShowMemoryAid(!showMemoryAid)}
          >
            {showMemoryAid ? (
              <Minus className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
          
          <div className={`flex items-center justify-between p-4 pb-2 transition-all duration-300 ease-in-out ${
            showMemoryAid ? 'opacity-100' : 'opacity-0'
          }`}>
            <div className="flex items-center gap-2">
              {useEmojiMode ? (
                <span className="text-xl">🧠</span>
              ) : (
                <Brain className="h-5 w-5 text-purple-500" />
              )}
              <h3 className="font-medium">Memory Aid</h3>
            </div>
            {/* Spacer to account for the absolutely positioned button */}
            <div className="w-6 h-6"></div>
          </div>

          <div 
            className={`transition-all duration-300 ease-in-out ${
              showMemoryAid 
                ? 'max-h-[200px] opacity-100' 
                : 'max-h-0 opacity-0'
            }`}
          >
            <div className="px-4 pb-4">
              <div 
                className="text-muted-foreground p-2 rounded-md cursor-pointer hover:bg-muted/20 transition-colors min-h-[80px] flex items-start relative"
                onClick={() => setEditingExplanation(true)}
                title="Click to edit"
              >
                {editingExplanation ? (
                  <textarea
                    value={currentExplanation}
                    onChange={(e) => handleExplanationChange(e.target.value)}
                    className="absolute inset-0 w-full h-full text-muted-foreground resize-none border-none bg-transparent outline-none p-2 rounded-md"
                    placeholder="Edit memory aid..."
                    autoFocus
                    onBlur={() => setEditingExplanation(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        setEditingExplanation(false);
                      }
                      if (e.key === 'Escape') {
                        setEditingExplanation(false);
                      }
                    }}
                  />
                ) : (
                  currentExplanation
                )}
              </div>

              {/* New Idea button and Memory Aid Type dropdown positioned at bottom left */}
              {onRequestNewMemoryAid && (
                <div className="flex justify-start items-center gap-2 mt-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-muted-foreground hover:text-primary"
                    onClick={handleRequestMemoryAid}
                    disabled={isMemoryAidLoading || isLoading}
                  >
                    {isMemoryAidLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : useEmojiMode ? (
                      <span className="text-lg mr-1">✨</span>
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1 text-yellow-500" />
                    )}
                    <span className="text-xs">New Idea</span>
                  </Button>
                  <Select value={memoryAidType} onValueChange={setMemoryAidType}>
                    <SelectTrigger className="w-[100px] h-6 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Random</SelectItem>
                      <SelectItem value="acronym">Acronym</SelectItem>
                      <SelectItem value="rhyme">Rhyme</SelectItem>
                      <SelectItem value="visual">Visual</SelectItem>
                      <SelectItem value="phonetic">Phonetic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>

    </Card>
  );
}