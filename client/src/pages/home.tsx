import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Link } from "wouter";
import { PlusCircle, BookOpen, LibrarySquare, BarChart3, GripVertical, Camera, Settings } from "lucide-react";
import { usePreferences, HintName, HINTS, MenuItem, DEFAULT_MENU_ITEMS } from "@/lib/preferences-simple";
import { getLanguageLabel } from "@/lib/constants";
import { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { APIKeysSettings } from "@/components/ui/api-keys-settings";

export default function Home() {
  const {
    languages,
    useEmojiMode,
    toggleEmojiMode,
    incrementHintCounter,
    rotateHintIndex,
    shouldShowHint,
    currentHintIndex,
    menuItems,
    updateMenuOrder
  } = usePreferences();

  // Get the language label and ensure it exists
  const learningLanguage = getLanguageLabel(languages.learningLang || 'en');

  // State for the rotating hint system
  const [subtitle, setSubtitle] = useState<string>(`You're learning ${learningLanguage} with AI-powered flashcards`);

  // Fixed card height style for consistent sizes
  const cardStyle = "h-[140px] cursor-pointer hover:shadow-md transition-all border-2 border-transparent hover:border-primary/10";

  // Handler for toggling UI style
  const toggleStyle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleEmojiMode();

    // Increment the hint counter for the style toggle hint
    incrementHintCounter('styleToggle');
  };

  // Effect for rotating hints
  useEffect(() => {
    // All possible hint names in the precise order we want to show them
    const hintNames: HintName[] = [
      'styleToggle', 
      'offlineMode', 
      'memoryAid', 
      'studyModes', 
      'editText', 
      'dragAndDrop'
    ];

    // Get all the hints that should still be shown (under 3 views)
    const activeHints = hintNames.filter(hint => shouldShowHint(hint));

    // Default message with the full language label
    const defaultMessage = `You're learning ${learningLanguage} with AI-powered flashcards`;

    // Initial state should be default message
    setSubtitle(defaultMessage);

    console.log(`Active hints: ${activeHints.length}`);

    // If there are no active hints, just keep showing the default message
    if (activeHints.length === 0) {
      console.log("No active hints to display");
      return;
    }

    // Initialize state for tracking hint display
    let currentPosition = -1; // Start with -1 so first rotation shows default message
    let currentCycle = 0;     // Track which cycle we're on (show each hint 3 times total)
    const MAX_CYCLES = 3;     // Show all hints 3 times total

    // Function to rotate through hints
    const rotateHints = () => {
      currentPosition++;

      // If we've gone through all hints, reset to default message and increment cycle
      if (currentPosition >= activeHints.length) {
        currentPosition = -1; // Reset to default message
        currentCycle++;       // Move to next cycle
        console.log(`Completed hint cycle ${currentCycle}/${MAX_CYCLES}`);

        // If we've completed all 3 cycles, stop rotating hints
        if (currentCycle >= MAX_CYCLES) {
          console.log("All hint cycles completed - showing default message permanently");
          setSubtitle(defaultMessage);
          return false; // Signal to stop the interval
        }
      }

      // Show default message or a hint based on position
      if (currentPosition === -1) {
        console.log("Showing default message");
        setSubtitle(defaultMessage);
      } else {
        const hintToShow = activeHints[currentPosition];
        console.log(`Showing hint ${currentPosition+1}/${activeHints.length}: ${hintToShow}`);
        setSubtitle(HINTS[hintToShow]);
        incrementHintCounter(hintToShow);
      }

      return true; // Signal to continue the interval
    };

    // Initial call to start rotation
    rotateHints();

    // Set interval for 5 seconds exactly as requested
    const intervalId = setInterval(() => {
      const shouldContinue = rotateHints();
      if (!shouldContinue) {
        clearInterval(intervalId); // Stop rotation if we've shown all hints 3 times
      }
    }, 5000); // Exactly 5 second intervals

    // Clean up interval when component unmounts or dependencies change
    return () => {
      clearInterval(intervalId);
    };
  }, [languages, learningLanguage, shouldShowHint, incrementHintCounter]);

  // Style definitions for both designs
  const minimalStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={toggleStyle}
        style={{ width: "44px", height: "44px" }}
      >
        <PlusCircle size={28} />
      </div>
      <CardTitle>Create</CardTitle>
    </div>
  );

  const decoratedStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={toggleStyle}
        style={{ width: "44px", height: "44px" }}
      >
        <div className="text-2xl">✍️</div>
      </div>
      <CardTitle>Create</CardTitle>
    </div>
  );

  const minimalStudyStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={toggleStyle}
        style={{ width: "44px", height: "44px" }}
      >
        <BookOpen size={28} />
      </div>
      <CardTitle>Study</CardTitle>
    </div>
  );

  const decoratedStudyStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={toggleStyle}
        style={{ width: "44px", height: "44px" }}
      >
        <div className="text-2xl">📚</div>
      </div>
      <CardTitle>Study</CardTitle>
    </div>
  );

  const minimalCardsStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={toggleStyle}
        style={{ width: "44px", height: "44px" }}
      >
        <LibrarySquare size={28} />
      </div>
      <CardTitle>My Cards</CardTitle>
    </div>
  );

  const decoratedCardsStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={toggleStyle}
        style={{ width: "44px", height: "44px" }}
      >
        <div className="text-2xl">🗂️</div>
      </div>
      <CardTitle>My Cards</CardTitle>
    </div>
  );

  const minimalStatsStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={toggleStyle}
        style={{ width: "44px", height: "44px" }}
      >
        <BarChart3 size={28} />
      </div>
      <CardTitle>Stats</CardTitle>
    </div>
  );

  const decoratedStatsStyle = (
    <div className="flex items-center gap-3">
      <div 
        className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
        onClick={toggleStyle}
        style={{ width: "44px", height: "44px" }}
      >
        <div className="text-2xl">📊</div>
      </div>
      <CardTitle>Stats</CardTitle>
    </div>
  );

  // Handle drag end for menu items
  const handleDragEnd = (result: DropResult) => {
    // dropped outside the list or no destination
    if (!result.destination) {
      return;
    }

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    // Don't update if dragged to same position
    if (sourceIndex === destIndex) {
      return;
    }

    // Create a copy of the current menu items
    const newOrder = Array.from(menuItems);

    // Remove the item from the original position
    const [movedItem] = newOrder.splice(sourceIndex, 1);

    // Insert it into the new position
    newOrder.splice(destIndex, 0, movedItem);

    // Update the state
    updateMenuOrder(newOrder);
  };

  // Get the icon for a menu item
  const getMenuItemIcon = (item: MenuItem) => {
    if (useEmojiMode) {
      return <div className="text-2xl">{item.emojiIcon}</div>;
    }

    // Return the appropriate icon component based on the item's iconComponent name
    switch (item.iconComponent) {
      case 'PlusCircle':
        return <PlusCircle size={28} />;
      case 'Camera':
        return <Camera size={28} />;
      case 'BookOpen':
        return <BookOpen size={28} />;
      case 'LibrarySquare':
        return <LibrarySquare size={28} />;
      case 'BarChart3':
        return <BarChart3 size={28} />;
      default:
        return <PlusCircle size={28} />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8 relative">
        <div className="absolute top-0 right-0">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>
                  Manage your API keys and app preferences
                </DialogDescription>
              </DialogHeader>
              <APIKeysSettings />
            </DialogContent>
          </Dialog>
        </div>
        
        <h1 className="text-4xl font-bold mb-2">
          FlashLingo
        </h1>
        <div className="h-16 flex items-center justify-center overflow-hidden">
          <p className="text-muted-foreground text-xl transition-all duration-500 animate-fadeIn">
            {subtitle}
          </p>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="menu-items" direction="vertical">
          {(provided) => (
            <div 
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto"
            >
              {menuItems.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`${snapshot.isDragging ? 'opacity-75' : ''}`}
                    >
                      <Link href={item.path}>
                        <Card className={`${cardStyle} ${snapshot.isDragging ? 'border-primary' : ''} cursor-grab active:cursor-grabbing`}>
                          <CardHeader className="pb-0 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="p-2 rounded-full bg-primary/10 text-primary cursor-pointer flex items-center justify-center" 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleEmojiMode();
                                }}
                                style={{ width: "44px", height: "44px" }}
                              >
                                {getMenuItemIcon(item)}
                              </div>
                              <CardTitle>{item.title}</CardTitle>
                            </div>

                          </CardHeader>
                          <CardContent className="text-muted-foreground pt-2">
                            {item.description}
                          </CardContent>
                        </Card>
                      </Link>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Bottom hint is removed as it's now part of the rotating hints */}
    </div>
  );
}