import { useEffect, useState } from "react";
import { getGrammarLessons, deleteGrammarLesson, updateGrammarLesson } from "@/lib/db";
import type { GrammarLesson } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Trash2, RotateCcw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLessonIcon } from "@/lib/gemini";

// Extended type to include runtime properties not in schema
interface LessonWithExtras extends GrammarLesson {
  icon?: string;
  isExam?: boolean;
  lessonNumber?: number;
}

export default function Lessons() {
  const [lessons, setLessons] = useState<LessonWithExtras[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadLessons();
  }, []);

  async function loadLessons() {
    const allLessons = await getGrammarLessons() as LessonWithExtras[];
    // Sort by lessonNumber ascending (lesson 1 first), then by createdAt
    allLessons.sort((a, b) => {
      const numA = a.lessonNumber || 0;
      const numB = b.lessonNumber || 0;
      if (numA !== numB) return numA - numB;
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
    setLessons(allLessons);
  }

  async function handleDelete(id: number) {
    try {
      await deleteGrammarLesson(id);
      await loadLessons();
      toast({
        title: "🗑️ Lesson deleted",
        description: "The lesson has been removed.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Failed to delete lesson.",
      });
    }
  }

  async function handleToggleCompleted(id: number, currentCompleted: boolean) {
    try {
      await updateGrammarLesson(id, { completed: !currentCompleted });
      await loadLessons();
      toast({
        title: currentCompleted ? "🔄 Lesson reset" : "✅ Lesson completed",
        description: currentCompleted 
          ? "The lesson has been marked as incomplete." 
          : "The lesson has been marked as complete.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Failed to update lesson.",
      });
    }
  }

  function getIcon(lesson: LessonWithExtras): string {
    // Use stored icon if available
    if (lesson.icon) return lesson.icon;
    // Generate from lessonNumber if available
    if (lesson.lessonNumber) {
      return getLessonIcon(lesson.lessonNumber, lesson.isExam || false);
    }
    // Fallback
    return lesson.isExam ? "🎓" : "📖";
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {lessons.length === 0 ? (
        <div className="text-center text-muted-foreground p-8">
          <p className="text-4xl mb-4">📚</p>
          <p>No lessons found. Lessons are generated during study sessions.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-4">Lesson No.</th>
                <th className="text-left p-4">Title</th>
                <th className="text-left p-4">Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson, index) => (
                <tr key={lesson.id} className="border-t">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl" title={lesson.isExam ? "Exam" : "Lesson"}>
                        {getIcon(lesson)}
                      </span>
                      <span className="font-medium text-muted-foreground">
                        {lesson.isExam ? "Exam" : `#${lesson.lessonNumber || index + 1}`}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium">{lesson.title}</div>
                    {lesson.newWords && lesson.newWords.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {lesson.newWords.length} new word{lesson.newWords.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      lesson.completed
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {lesson.completed ? '✅ Completed' : '📝 In Progress'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={lesson.completed ? "text-yellow-600 hover:text-yellow-700" : "text-green-600 hover:text-green-700"}
                        onClick={() => handleToggleCompleted(lesson.id, lesson.completed)}
                        title={lesson.completed ? "Mark as incomplete" : "Mark as complete"}
                      >
                        {lesson.completed ? (
                          <RotateCcw className="h-4 w-4" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDelete(lesson.id)}
                        title="Delete lesson"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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

