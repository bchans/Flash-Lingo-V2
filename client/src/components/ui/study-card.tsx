import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button, IconButton } from "@/components/ui/button";
import { Trash, Info, CheckCircle, XCircle, Volume2, VolumeX } from "lucide-react";
import type { Card as CardType } from "@shared/schema";
import { updateCard } from "@/lib/db";
import { cn } from "@/lib/utils";
import { audioToBase64, base64ToAudio } from "@/lib/api";
import { firebaseAPI } from "@/lib/firebase-api";
import { getCachedAudio, saveCardAudio } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";

interface StudyCardProps {
  card: CardType;
  onDelete?: (id: number) => void;
  onStatusChange?: (id: number, learned: boolean) => void;
  isSoundEnabled?: boolean;
}

export function StudyCard({ card, onDelete, onStatusChange, isSoundEnabled }: StudyCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [audioLoading, setAudioLoading] = useState<'front' | 'back' | null>(null);
  const { toast } = useToast();

  // Reset flip state when card changes
  useEffect(() => {
    setFlipped(false);
    setShowExplanation(false);
  }, [card.id]);

  // Swipe detection constants
  const minSwipeDistance = 50;

  const handleCardClick = () => {
    setFlipped(!flipped);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX);

    // Only trigger swipe actions if card is flipped and it's a horizontal swipe
    if (flipped && !isVerticalSwipe) {
      if (isLeftSwipe) {
        // Left swipe = "didn't know"
        handleStatusChange(false);
      } else if (isRightSwipe) {
        // Right swipe = "knew it"
        handleStatusChange(true);
      }
    }
  };

  async function handleStatusChange(learned: boolean) {
    if (isSoundEnabled) {
      handleTTS(card.targetText, 'back');
    }

    if (!onStatusChange || isUpdating) {
      return;
    }

    try {
      setIsUpdating(true);
      await updateCard(card.id, { ...card, learned });
      onStatusChange(card.id, learned);
    } catch (error) {
      console.error('Error updating card status');
    } finally {
      setIsUpdating(false);
    }
  }

  const handleDelete = () => {
    if (onDelete) {
      onDelete(card.id);
    }
  };

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
      setAudioLoading(side);
      
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
      setAudioLoading(null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div 
        className="relative cursor-pointer rounded-lg"
        style={{ 
          height: "280px",
          perspective: "1000px"
        }}
      >
        <div 
          className="absolute w-full h-full"
          style={{ 
            transformStyle: "preserve-3d",
            transition: "transform 0.6s",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)"
          }}
          onClick={handleCardClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Front of card */}
          <div
            className="absolute w-full h-full flex flex-col justify-between p-6 border rounded-lg bg-card"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="flex flex-col items-center justify-center flex-1">
              <p className="text-2xl font-medium">{card.sourceText}</p>
              <p className="text-muted-foreground text-sm mt-4">Click to flip</p>
            </div>


            {card.explanation && (
              <div 
                className="w-full relative mt-2 min-h-[2rem]"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExplanation(!showExplanation);
                }}
              >
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-7 mx-auto block overflow-hidden transition-all duration-300 ease-in-out"
                  style={{
                    width: showExplanation ? 'auto' : '120px',
                    minWidth: '120px',
                    maxWidth: showExplanation ? '100%' : '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--btn-background)'
                  }}
                >
                  <span 
                    className={`transition-all duration-300 ease-in-out transform ${
                      showExplanation ? 'translate-y-[-100%] opacity-0' : 'translate-y-0 opacity-100'
                    }`}
                  >
                    Show mnemonic
                  </span>
                  <span 
                    className={`transition-all duration-300 ease-in-out transform absolute ${
                      showExplanation ? 'translate-y-0 opacity-100' : 'translate-y-[100%] opacity-0'
                    }`}
                  >
                    {card.explanation}
                  </span>
                </Button>
              </div>
            )}
          </div>
          {/* Back of card */}
          <div
            className="absolute w-full h-full flex flex-col justify-center items-center p-6 border rounded-lg bg-card"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)"
            }}
          >
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <p className="text-2xl font-medium">{card.targetText}</p>

              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => handleStatusChange(false)}
                >
                  <XCircle className="h-4 w-4 mr-2"/> Didn't know
                </Button>
                <Button 
                  variant="default"
                  className="w-full"
                  onClick={() => handleStatusChange(true)}
                >
                  <CheckCircle className="h-4 w-4 mr-2"/> Knew it
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      
    </div>
  );
}