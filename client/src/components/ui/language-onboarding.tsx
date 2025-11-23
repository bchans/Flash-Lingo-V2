import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { LANGUAGES } from "@/lib/constants";
import { usePreferences } from "@/lib/preferences-simple";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { getAssetUrl } from "@/lib/asset-utils";

const successImage = getAssetUrl("success-clippy.png");

interface Step {
  title: string;
  field: "nativeLang" | "learningLang";
}

const STEPS: Step[] = [
  {
    title: "What's your native language?",
    field: "nativeLang",
  },
  {
    title: "What language do you want to learn?",
    field: "learningLang",
  },
];

export function LanguageOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [currentLangIndex, setCurrentLangIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<{
    [key: string]: number;
  }>({
    nativeLang: 0, // Pre-select first language automatically
    learningLang: -1,
  });
  const [selections, setSelections] = useState({
    nativeLang: LANGUAGES[0].value, // Set initial language
    learningLang: "",
  });
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const { setLanguages, completeOnboarding } = usePreferences();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentStepData = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const isLanguageSelected = selectedIndices[currentStepData.field] !== -1;

  // Auto-select current language
  useEffect(() => {
    if (
      currentStep === 1 &&
      selectedIndices.learningLang === -1 &&
      currentLangIndex !== selectedIndices.nativeLang
    ) {
      // Don't auto-select the same language as native language
      handleSelectLanguage();
    }
  }, [currentStep, currentLangIndex]);

  // Touch event handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!isMobile) return;

    const swipeThreshold = 50; // Minimum distance for swipe
    const diff = touchEndX.current - touchStartX.current;

    if (diff > swipeThreshold) {
      // Swipe right (go to previous language)
      handlePrevious();
    } else if (diff < -swipeThreshold) {
      // Swipe left (go to next language)
      handleLangNext();
    }
  };

  const handlePrevious = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (currentLangIndex > 0) {
      const newIndex = currentLangIndex - 1;
      console.log('handlePrevious - New Index:', newIndex);
      setCurrentLangIndex(newIndex);
    }
  };

  const handleNext = () => {
    if (!isLanguageSelected) return;

    console.log('handleNext - Current Step:', currentStep);
    console.log('handleNext - Is Last Step:', isLastStep);
    console.log('handleNext - Current Selections Before:', selections);

    if (isLastStep) {
      // Ensure the current selection is included in final selections
      const finalSelections = {
        ...selections,
        [currentStepData.field]: LANGUAGES[currentLangIndex].value,
      };

      console.log('Language Onboarding - Final Selections:', finalSelections);
      console.log('Current State - Selected Indices:', selectedIndices);
      console.log('Current Step Data:', currentStepData);

      setLanguages(finalSelections);

      // Show success screen instead of just a toast
      setShowSuccessScreen(true);

      // Adjust timing to match completeOnboarding
      setTimeout(() => {
        console.log('Completing onboarding - Final Language State:', finalSelections);
        completeOnboarding();
      }, 1000); //Reduced timeout to 1000ms. Adjust as needed.
    } else {
      // Update selections before moving to next step
      const updatedSelections = {
        ...selections,
        [currentStepData.field]: LANGUAGES[currentLangIndex].value,
      };
      setSelections(updatedSelections);
      
      setCurrentStep((prev) => prev + 1);
      // Reset language index when moving to next step
      setCurrentLangIndex(0);
    }
  };

  const handleLangNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (currentLangIndex < LANGUAGES.length - 1) {
      const newIndex = currentLangIndex + 1;
      console.log('handleLangNext - New Index:', newIndex);
      setCurrentLangIndex(newIndex);
    }
  };

  const handleSelectLanguage = () => {
    console.log('handleSelectLanguage - Current Step:', currentStep);
    console.log('handleSelectLanguage - Current Index:', currentLangIndex);
    console.log('handleSelectLanguage - Selected Language:', LANGUAGES[currentLangIndex]);
    console.log('handleSelectLanguage - Current Step Data:', currentStepData);
    console.log('handleSelectLanguage - Before Update - Selections:', selections);
    console.log('handleSelectLanguage - Before Update - SelectedIndices:', selectedIndices);

    // Don't select same language for both steps
    if (
      isLastStep &&
      LANGUAGES[currentLangIndex].value === selections.nativeLang
    ) {
      toast({
        variant: "destructive",
        title: "⚠️ Same Language",
        description: "Please choose a different language to learn.",
        duration: 2000,
      });
      return;
    }

    const newIndices = {
      ...selectedIndices,
      [currentStepData.field]: currentLangIndex,
    };
    console.log('handleSelectLanguage - New Indices:', newIndices);
    setSelectedIndices(newIndices);

    const newSelections = {
      ...selections,
      [currentStepData.field]: LANGUAGES[currentLangIndex].value,
    };
    console.log('handleSelectLanguage - New Selections:', newSelections);
    console.log('handleSelectLanguage - Current Step Data Field:', currentStepData.field);
    console.log('handleSelectLanguage - Selected Language Value:', LANGUAGES[currentLangIndex].value);
    setSelections(newSelections);
  };

  // Navigation dots indicator
  const renderDots = () => {
    return (
      <div className="flex space-x-2 mt-4">
        {STEPS.map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full ${
              index === currentStep ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    );
  };

  // Animation classes for the flag and language
  const getLanguageClasses = () => {
    const isSelected =
      selectedIndices[currentStepData.field] === currentLangIndex;
    return {
      // The 'flag' class was for emoji flags, which we are not using for these icons.
      // We can leave it as is or simplify if we are certain no other part uses it for emojis.
      // For now, simplifying as it's not relevant to the custom image icons.
      flag: `text-8xl transition-all duration-300`, // Removed transform and scale
      text: `text-2xl font-medium transition-all duration-300 text-foreground`,
      flagContainer: `h-20 w-20 flex items-center justify-center`, // No visual feedback on selection
    };
  };

  const classes = getLanguageClasses();

  const renderSuccessScreen = () => {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md flex flex-col items-center space-y-8">
          <img src={successImage} alt="Success" className="h-36 w-36" />{" "}
          <h1 className="text-4xl font-bold text-center">You're all set!</h1>
          <div className="text-center text-xl">
            <p className="mb-4">
              Your language preferences have been saved, happy learning!
            </p>
          </div>
          <div className="w-full max-w-md h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-progress-bar" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {showSuccessScreen ? (
        renderSuccessScreen()
      ) : (
        <div className="w-full max-w-lg flex flex-col items-center space-y-8">
          <h1 className="text-4xl font-bold text-center">
            {currentStepData.title}
          </h1>

          {renderDots()}

          <div
            ref={containerRef}
            className="flex items-center justify-between w-full touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              disabled={currentLangIndex === 0}
              className="transition-opacity hover:opacity-100 disabled:opacity-0 touch-manipulation"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>

            <div
              className="flex flex-col items-center space-y-4 cursor-pointer select-none"
              onClick={handleSelectLanguage}
            >
              {/* Always use custom flag image as per current constants and requirements */}
              <div className={classes.flagContainer}>
                <img 
                  src={LANGUAGES[currentLangIndex].flagImage} 
                  alt={LANGUAGES[currentLangIndex].label.split(" ").slice(1).join(" ")} // Handle multi-word language names for alt
                  className="h-full w-full object-contain" // Make image fill the container which has fixed size
                />
              </div>
              <div className={classes.text}>
                {LANGUAGES[currentLangIndex].label.split(" ").slice(1).join(" ")}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLangNext}
              disabled={currentLangIndex === LANGUAGES.length - 1}
              className="transition-opacity hover:opacity-100 disabled:opacity-0 touch-manipulation"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          </div>

          {isMobile && (
            <p className="text-sm text-muted-foreground">
              Swipe left or right to browse languages
            </p>
          )}

          <Button
            onClick={handleNext}
            className="w-64 h-12 text-lg mt-8"
            variant="default"
            disabled={!isLanguageSelected}
          >
            {isLastStep ? (
              "Start Learning"
            ) : (
              <>
                Next
                <ChevronRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}