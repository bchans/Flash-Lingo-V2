
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export default function Achievements() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-2">Achievements</h1>
      <p className="text-center text-muted-foreground mb-8">
        View your earned badges and learning milestones 🌟
      </p>

      <div className="grid gap-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Your Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center py-8 text-muted-foreground">
              Achievements will appear here as you complete learning goals
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
