import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, AlertTriangle, Edit } from "lucide-react";
import { saveCard } from "@/lib/db";
import { getCategoryForCard } from "@/lib/mistral";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ExtractedCard {
  id: string;
  sourceText: string;
  targetText: string;
  explanation: string;
  type: 'word' | 'sentence';
  isExisting: boolean;
  confidence: number;
}

interface ScanPreviewCardProps {
  card: ExtractedCard;
  index: number;
  sourceLang: string;
  targetLang: string;
}

export function ScanPreviewCard({ card, index, sourceLang, targetLang }: ScanPreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCard, setEditedCard] = useState(card);
  const [isSaving, setIsSaving] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (isAccepted || isSaving) return;

    try {
      setIsSaving(true);
      
      // Get category for the card automatically
      const categoryData = await getCategoryForCard(
        editedCard.sourceText,
        editedCard.targetText,
        editedCard.type
      );
      
      await saveCard({
        sourceText: editedCard.sourceText,
        targetText: editedCard.targetText,
        explanation: editedCard.explanation,
        sourceLang,
        targetLang,
        type: editedCard.type,
        category: categoryData.category,
        categoryEmoji: categoryData.categoryEmoji,
        createdAt: new Date(),
        learned: false,
        proficiency: 0,
        lastStudied: null
      });

      setIsAccepted(true);
      setIsEditing(false);
      
      toast({
        title: "Card saved!",
        description: "Flashcard added to your collection"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Could not save the flashcard"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = () => {
    setIsRejected(true);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.6) return "Medium";
    return "Low";
  };

  if (isRejected) {
    return (
      <Card className="opacity-50 border-red-200">
        <CardContent className="pt-4">
          <div className="flex items-center justify-center text-muted-foreground">
            <X className="h-4 w-4 mr-2" />
            Card rejected
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isAccepted) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-4">
          <div className="flex items-center justify-center text-green-700">
            <Check className="h-4 w-4 mr-2" />
            Card saved to collection
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${card.isExisting ? 'border-orange-200 bg-orange-50' : 'border-border'}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Card {index + 1}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {card.type === 'sentence' ? 'Sentence' : 'Word'}
            </Badge>
            <Badge className={getConfidenceColor(card.confidence)}>
              {getConfidenceLabel(card.confidence)} confidence
            </Badge>
            {card.isExisting && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Possible duplicate
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Source Text ({sourceLang})</label>
              <Input
                value={editedCard.sourceText}
                onChange={(e) => setEditedCard({ ...editedCard, sourceText: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Translation ({targetLang})</label>
              <Input
                value={editedCard.targetText}
                onChange={(e) => setEditedCard({ ...editedCard, targetText: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Memory Aid</label>
              <Textarea
                value={editedCard.explanation}
                onChange={(e) => setEditedCard({ ...editedCard, explanation: e.target.value })}
                className="mt-1"
                rows={2}
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? "Saving..." : "Save Card"}
              </Button>
              <Button 
                onClick={() => setIsEditing(false)} 
                variant="outline"
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{sourceLang}</p>
                <p className="font-medium">{card.sourceText}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{targetLang}</p>
                <p className="font-medium">{card.targetText}</p>
              </div>
            </div>
            
            {card.explanation && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Memory Aid</p>
                <p className="text-sm text-muted-foreground">{card.explanation}</p>
              </div>
            )}
            
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleSave} 
                disabled={isSaving || card.isExisting}
                className="flex-1"
              >
                {isSaving ? "Saving..." : "Add to Collection"}
              </Button>
              <Button onClick={handleEdit} variant="outline" size="icon">
                <Edit className="h-4 w-4" />
              </Button>
              <Button onClick={handleReject} variant="outline" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {card.isExisting && (
              <p className="text-xs text-orange-600">
                This card appears to be similar to one already in your collection.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}