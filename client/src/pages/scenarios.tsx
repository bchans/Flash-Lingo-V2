
import { useEffect, useState } from "react";
import { getCardsWithScenarios, removeCachedScenario } from "@/lib/db";
import type { Card as CardType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Scenario {
  cardId: number;
  scenario: string;
  sourceText: string;
  targetText: string;
  scenarioTheme: string;
  learned: boolean;
  category?: string;
  categoryEmoji?: string;
}

export default function Scenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadScenarios();
  }, []);

  async function loadScenarios() {
    const cardsWithScenarios = await getCardsWithScenarios();
    const allScenarios: Scenario[] = [];
    cardsWithScenarios.forEach((card: CardType) => {
      if (card.cachedScenarios) {
        card.cachedScenarios.forEach((scenario: string) => {
          try {
            // Parse the scenario JSON to extract the theme
            const parsedScenario = JSON.parse(scenario);
            allScenarios.push({
              cardId: card.id,
              scenario,
              sourceText: card.sourceText,
              targetText: card.targetText,
              scenarioTheme: parsedScenario.scenarioTheme || "Unknown Scenario",
              learned: card.learned || false,
              category: card.category,
              categoryEmoji: card.categoryEmoji,
            });
          } catch (error) {
            // If JSON parsing fails, use a fallback
            allScenarios.push({
              cardId: card.id,
              scenario,
              sourceText: card.sourceText,
              targetText: card.targetText,
              scenarioTheme: "Unknown Scenario",
              learned: card.learned || false,
              category: card.category,
              categoryEmoji: card.categoryEmoji,
            });
          }
        });
      }
    });
    setScenarios(allScenarios);
  }

  async function handleDelete(cardId: number, scenarioIndex: number) {
    try {
      await removeCachedScenario(cardId, scenarioIndex);
      await loadScenarios();
      toast({
        title: "🗑️ Scenario deleted",
        description: "The scenario has been removed from the card.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Failed to delete scenario.",
      });
    }
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {scenarios.length === 0 ? (
        <div className="text-center text-muted-foreground p-8">
          <p className="text-4xl mb-4">🎭</p>
          <p>No scenarios found. Scenarios are generated during study sessions.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-4">Scenario Name</th>
                <th className="text-left p-4">Source Word</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Category</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario, index) => (
                <tr key={index} className="border-t">
                  <td className="p-4">{scenario.scenarioTheme}</td>
                  <td className="p-4">{scenario.sourceText}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      scenario.learned
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {scenario.learned ? '✨ Learned' : '📚 Still Learning'}
                    </span>
                  </td>
                  <td className="p-4">
                    {scenario.category ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {scenario.categoryEmoji} {scenario.category}
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
                      onClick={() => handleDelete(scenario.cardId, index)}
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
  );
}
