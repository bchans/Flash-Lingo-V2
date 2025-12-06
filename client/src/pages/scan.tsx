import { useState, useRef } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Camera, Upload as UploadIcon, Loader2, Check, X, ArrowLeftRight, Settings, FileText, Type, Zap, Hash, MessageSquare, Home, Dumbbell } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { usePreferences } from "@/lib/preferences-simple";
import { extractCardsFromImageWithGemini } from "@/lib/gemini";
import { getCards } from "@/lib/db";
import { ScanPreviewCard } from "@/components/ui/scan-preview-card";
import { LANGUAGES } from "@/lib/constants";
import { useAPIKeys } from "@/lib/api-keys-context";
import { ImportAPIKeysPrompt } from "@/components/ui/import-api-keys-prompt";

const getLanguageFlag = (langCode: string): string => {
  const flags: Record<string, string> = {
    'en': '🇺🇸',
    'es': '🇪🇸',
    'fr': '🇫🇷',
    'de': '🇩🇪',
    'it': '🇮🇹',
    'pt': '🇵🇹',
    'ja': '🇯🇵',
    'ko': '🇰🇷',
    'vi': '🇻🇳'
  };
  return flags[langCode] || '🌐';
};

interface ExtractedCard {
  id: string;
  sourceText: string;
  targetText: string;
  explanation: string;
  type: 'word' | 'sentence';
  isExisting: boolean;
  confidence: number;
}

export default function Scan() {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedCards, setExtractedCards] = useState<ExtractedCard[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [scanSourceLang, setScanSourceLang] = useState<string>('');
  const [scanTargetLang, setScanTargetLang] = useState<string>('');
  const [extractionType, setExtractionType] = useState<string>('nouns');
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { languages, useEmojiMode } = usePreferences();
  const { hasGeminiKey, importKeysFromFile, refreshKeys } = useAPIKeys();

  // Initialize scan languages from user preferences
  React.useEffect(() => {
    if (languages.learningLang && languages.nativeLang) {
      setScanSourceLang(languages.learningLang);
      setScanTargetLang(languages.nativeLang);
    }
  }, [languages]);

  const handleImageCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setImage(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcessImage = async () => {
    // Check for API key first
    if (!hasGeminiKey) {
      toast({
        variant: "destructive",
        title: "🔑 API Key Required",
        description: "Please import your API keys to use the scan feature. Click the 'Import API Keys' button.",
      });
      return;
    }

    if (!image || !scanSourceLang || !scanTargetLang) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select an image and ensure languages are configured."
      });
      return;
    }

    setIsProcessing(true);

    try {
      console.log('Processing image with Gemini AI...');
      
      // Get existing cards to check for duplicates
      const existingCards = await getCards();
      console.log('Existing cards count:', existingCards.length);
      
      // Extract cards from image using Gemini AI
      const cards = await extractCardsFromImageWithGemini({
        imageData: image,
        sourceLang: scanSourceLang,
        targetLang: scanTargetLang,
        extractionType
      });

      console.log('Extracted cards:', cards);
      setExtractedCards(cards);
      setShowResults(true);

      toast({
        title: "Image Processed",
        description: `Found ${cards.length} potential flashcards`
      });

    } catch (error) {
      console.error('Processing error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to process image";
      
      // Check if it's an API key issue
      if (errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('401')) {
        toast({
          variant: "destructive",
          title: "🔑 API Key Issue",
          description: "Your Gemini API key may be invalid or expired. Please check your API keys in Settings.",
        });
        refreshKeys(); // Refresh to update button state
      } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) {
        toast({
          variant: "destructive",
          title: "🌐 Network Error",
          description: "Could not connect to the AI service. Please check your internet connection.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Processing Failed",
          description: errorMessage
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setImage(null);
    setExtractedCards([]);
    setShowResults(false);
  };

  const triggerCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const swapLanguages = () => {
    const temp = scanSourceLang;
    setScanSourceLang(scanTargetLang);
    setScanTargetLang(temp);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon" className="mr-4">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{useEmojiMode ? '📷 ' : ''}Scan Mode</h1>
      </div>

      {!showResults ? (
        <div className="space-y-6">
          {/* Image Capture/Upload Section - moved to top */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              {!image ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">Add Image</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Capture or upload an image with text in {getLanguageFlag(scanSourceLang)}
                    </p>
                  </div>
                  
                  <div className="grid gap-3">
                    <Button 
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.setAttribute('capture', 'environment');
                          fileInputRef.current.click();
                        }
                      }}
                      className="h-16 text-base font-medium"
                      variant="outline"
                      size="lg"
                    >
                      <Camera className="h-5 w-5 mr-3" />
                      Take Photo
                    </Button>
                    
                    <Button 
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.removeAttribute('capture');
                          fileInputRef.current.click();
                        }
                      }}
                      className="h-16 text-base font-medium"
                      size="lg"
                    >
                      <UploadIcon className="h-5 w-5 mr-3" />
                      Upload Image
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <img 
                      src={image} 
                      alt="Captured content" 
                      className="w-full max-h-80 object-contain rounded-lg border"
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    {!hasGeminiKey ? (
                      <Button 
                        onClick={async () => {
                          const success = await importKeysFromFile();
                          if (success) {
                            toast({
                              title: "✅ API Keys Imported",
                              description: "Your API keys have been imported. You can now process images!",
                            });
                            refreshKeys();
                          }
                        }}
                        className="flex-1 h-12 border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                        variant="outline"
                        size="lg"
                      >
                        <UploadIcon className="mr-2 h-4 w-4" />
                        Import API Keys
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleProcessImage}
                        disabled={isProcessing}
                        className="flex-1 h-12"
                        size="lg"
                      >
                        {isProcessing ? (
                          <div className="flex items-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analyzing...
                          </div>
                        ) : (
                          "Process Image"
                        )}
                      </Button>
                    )}
                    
                    <Button 
                      onClick={handleReset}
                      variant="outline"
                      disabled={isProcessing}
                      size="lg"
                      className="h-12 px-4"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageCapture}
                accept="image/*"
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Extraction Type Selection */}
          <Card>
            <CardHeader className="pb-4 text-center">
              <CardTitle className="text-lg">What should I extract?</CardTitle>
              <p className="text-sm text-muted-foreground">Choose what type of content to turn into flashcards</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant={extractionType === 'nouns' ? 'default' : 'outline'}
                  onClick={() => setExtractionType('nouns')}
                  className={`h-12 justify-center p-4 transition-all ${
                    extractionType === 'nouns' 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                      : 'hover:bg-accent/50 hover:border-purple-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    <span className="font-medium">Nouns</span>
                  </div>
                </Button>
                
                <Button
                  variant={extractionType === 'verbs' ? 'default' : 'outline'}
                  onClick={() => setExtractionType('verbs')}
                  className={`h-12 justify-center p-4 transition-all ${
                    extractionType === 'verbs' 
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                      : 'hover:bg-accent/50 hover:border-orange-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Dumbbell className="h-4 w-4" />
                    <span className="font-medium">Verbs</span>
                  </div>
                </Button>
                
                <Button
                  variant={extractionType === 'sentences' ? 'default' : 'outline'}
                  onClick={() => setExtractionType('sentences')}
                  className={`h-12 justify-center p-4 transition-all ${
                    extractionType === 'sentences' 
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg' 
                      : 'hover:bg-accent/50 hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="font-medium">Only complete sentences</span>
                  </div>
                </Button>
                
                <Button
                  variant={extractionType === 'words' ? 'default' : 'outline'}
                  onClick={() => setExtractionType('words')}
                  className={`h-12 justify-center p-4 transition-all ${
                    extractionType === 'words' 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg' 
                      : 'hover:bg-accent/50 hover:border-green-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    <span className="font-medium">All individual words</span>
                  </div>
                </Button>
              </div>

              {/* Language Settings Toggle */}
              <div className="pt-4 border-t">
                {!showSettings ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowSettings(true)}
                    className="text-muted-foreground w-full justify-center"
                  >
                    <Settings className="h-4 w-4 mr-2" /> Language Settings
                  </Button>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowSettings(false)}
                    className="text-muted-foreground w-full justify-center"
                  >
                    <Settings className="h-4 w-4 mr-2" /> Hide Settings
                  </Button>
                )}
              </div>

              {/* Collapsible Language Settings */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                showSettings ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="space-y-4 mt-4 animate-in slide-in-from-top duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
                    <div className="space-y-2">
                      <Label htmlFor="source-lang" className="text-sm font-medium">From Language</Label>
                      <Select value={scanSourceLang} onValueChange={setScanSourceLang}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Source language" />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>
                              {getLanguageFlag(lang.value)} {lang.label.split(' ')[1]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Swap Languages Button - positioned between containers */}
                    <div className="absolute left-1/2 top-8 transform -translate-x-1/2 z-10 sm:block hidden">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={swapLanguages}
                        className="h-10 w-10 p-0 bg-background border-2 shadow-sm"
                        title="Swap languages"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="target-lang" className="text-sm font-medium">To Language</Label>
                      <Select value={scanTargetLang} onValueChange={setScanTargetLang}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Target language" />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>
                              {getLanguageFlag(lang.value)} {lang.label.split(' ')[1]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Swap Languages Button for mobile */}
                  <div className="flex items-center justify-center sm:hidden">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={swapLanguages}
                      className="h-10 w-10 p-0"
                      title="Swap languages"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardContent className="pt-6 text-center">
              <h3 className="font-semibold mb-3 text-sm">Tips for best results</h3>
              <ul className="text-xs text-muted-foreground space-y-1.5 text-left inline-block">
                <li>• Ensure good lighting and clear text</li>
                <li>• Keep the image focused and avoid blur</li>
                <li>• Simple layouts work better than complex ones</li>
                <li>• Processing may take 5-15 seconds</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Results Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    Found {extractedCards.length} cards
                  </h2>
                  <p className="text-muted-foreground">
                    Review and select cards to add to your collection
                  </p>
                </div>
                <Button onClick={handleReset} variant="outline">
                  New Scan
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Extracted Cards */}
          <div className="space-y-4">
            {extractedCards.map((card, index) => (
              <ScanPreviewCard
                key={card.id}
                card={card}
                index={index}
                sourceLang={scanTargetLang}
                targetLang={scanSourceLang}
              />
            ))}
          </div>

          {extractedCards.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">
                  No text could be extracted from this image. Try with a clearer image containing readable text.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}