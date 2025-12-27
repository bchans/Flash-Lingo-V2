// src/DrivingGameScene.tsx

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SceneryManager } from "./SceneryManager";
import { LoadingScreen } from "./LoadingScreen";
import { CameraFreeRoamController } from "./CameraFreeRoamController";
import { FreeRoamModeOverlay } from "./FreeRoamModeOverlay";
import {
  BoostMode,
  createSmokeParticles,
  shouldEndBoost,
  animateSmokeParticles,
  BOOST_MULTIPLIER,
} from "./BoostMode";
import { getAssetUrl } from "@/lib/asset-utils";
import { StreakFireIndicator } from "@/components/ui/streak-fire-indicator";

// --- Interfaces ---
interface DrivingGameSceneProps {
  word: string;
  correctTranslation: string;
  options: string[];
  onSelectLeft: () => void;
  onSelectRight: () => void;
  progress: number; // Added progress prop
  showFeedback?: { isCorrect: boolean } | null; // Add feedback prop
  onExit?: () => void; // Add exit callback
  score?: number;
  totalCards?: number;
  selectedCarIndex?: number;
  streakSpeedMultiplier?: number;
  currentStreak?: number;
  isSoundEnabled?: boolean;
  onToggleSound?: () => void;
}

interface OverheadSign {
  gantryGroup: THREE.Group;
  leftSignPanel: THREE.Mesh;
  rightSignPanel: THREE.Mesh;
}

// --- Constants ---
// Increased number of segments for smoother looping
const NUM_ROAD_SEGMENTS = 8; // More smaller segments for smoother visual loop
const NUM_GROUND_SEGMENTS = 6; // More smaller segments for smoother visual loop
const NUM_SIGN_STRUCTURES_VISIBLE = 4;
const NUM_SIGN_STRUCTURES_TOTAL = NUM_SIGN_STRUCTURES_VISIBLE + 1; // Even more buffer for signs? 6 total.

const SIGN_DISTANCE = 50;
const FIRST_SIGN_Z = -25;

const LANE_WIDTH = 3;
const ANIMATION_DURATION = 500;
const BASE_FORWARD_SPEED = 0.15; // Base speed for city cab (car.glb)
const BOOST_SPEED = 0.35; // Faster speed when boost is active
const BOOST_DURATION = 2000; // Boost lasts for 2 seconds
const STREAK_SPEED_INCREMENT = 0.10; // 10% speed increase per correct answer in streak
const EXIT_BUTTON_VERTICAL_OFFSET_PX = 20;

// Car speed multipliers based on car index
const CAR_SPEED_MULTIPLIERS = [
  1.0,   // City Cab (car.glb) - base speed
  1.5,   // Vintage Car (car3.glb) - 50% faster
  1.4,   // Racing Car (car2.glb) - 40% faster  
  1.3,   // Police Car (car4.glb) - 30% faster
  1.2,   // Ambulance (car5.glb) - 20% faster
  1.1    // Delivery Car (car6.glb) - 10% faster
];

// Highway sign configuration - responsive sizing
const getResponsiveSignConfig = () => {
  const isMobile = window.innerWidth < 768;
  const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
  const isLargeDesktop = window.innerWidth >= 1440;
  
  if (isMobile) {
    return {
      height: 6, // 6vh for mobile - smaller to fit screen
      fontSize: 'clamp(10px, 2.5vh, 18px)', // Smaller on mobile
      minWidth: '18vw', // Smaller minimum width
      maxWidth: '40vw', // Never exceed 40% of screen width
      padding: '0.8vh 1.5vw'
    };
  } else if (isTablet) {
    return {
      height: 7, // 7vh for tablet
      fontSize: 'clamp(12px, 2.5vh, 22px)',
      minWidth: '12vw',
      maxWidth: '35vw', // Smaller max width
      padding: '1vh 1.5vw'
    };
  } else if (isLargeDesktop) {
    return {
      height: 6, // 6vh for large desktop - smaller relative to screen
      fontSize: 'clamp(14px, 2vh, 24px)', // Much smaller on large screens
      minWidth: '8vw', // Smaller minimum width
      maxWidth: '20vw', // Much smaller max width on large screens
      padding: '1vh 1.5vw'
    };
  } else {
    return {
      height: 7, // 7vh for standard desktop
      fontSize: 'clamp(14px, 2.5vh, 26px)', // Smaller font
      minWidth: '10vw', // Smaller minimum width
      maxWidth: '25vw', // Smaller max width
      padding: '1vh 1.5vw'
    };
  }
};

const ROAD_LENGTH_UNIT = 100;
// Create smaller segments to prevent visible gaps
const ROAD_SEGMENT_LENGTH = ROAD_LENGTH_UNIT * 0.5; // 50 - smaller segments
const GROUND_SEGMENT_LENGTH = ROAD_LENGTH_UNIT * 0.75; // 75 - smaller segments

// 3D car scaling
const CAR_MODEL_SCALE = 1.0; // doubled from 0.5 to make cars larger

// Loop distances determine how far ahead an element is repositioned
const ROAD_LOOP_DISTANCE = ROAD_SEGMENT_LENGTH * NUM_ROAD_SEGMENTS; // 400
const GROUND_LOOP_DISTANCE = GROUND_SEGMENT_LENGTH * NUM_GROUND_SEGMENTS; // 450
const SIGN_LOOP_DISTANCE = SIGN_DISTANCE * NUM_SIGN_STRUCTURES_TOTAL; // 300 (Adjusted for 6 signs)

const ESTIMATED_BUILDING_VIEW_DISTANCE = 200;

// Camera and Repositioning Constants (Used for Road, Ground, Signs)
const CAMERA_POSITION_Z = 8;
const REPOSITION_THRESHOLD_Z = 50; // Point well behind the car to trigger loop

// Sign Triggering
const SIGN_TRIGGER_Z_THRESHOLD = 5.5;

// --- Component ---
// No longer needed since we're using React refs instead of window properties

export const CAR_MODELS = [
  getAssetUrl('car.glb'),
  getAssetUrl('car3.glb'),
  getAssetUrl('car2.glb'),
  getAssetUrl('car4.glb'),
  getAssetUrl('car5.glb'),
  getAssetUrl('car6.glb')
];

export function DrivingGameScene({
  word,
  correctTranslation,
  options,
  onSelectLeft,
  onSelectRight,
  progress, // Added progress prop
  showFeedback = null,
  onExit,
  score = 0,
  totalCards = 0,
  selectedCarIndex = 0,
  streakSpeedMultiplier = 1,
  currentStreak = 0,
  isSoundEnabled = false,
  onToggleSound,
}: DrivingGameSceneProps) {
  const streakSpeedBonusPercent = Math.max(
    0,
    Math.round((streakSpeedMultiplier - 1) * 100),
  );
  // --- Refs ---
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const carRef = useRef<THREE.Group | null>(null);
  const roadSegmentsRef = useRef<THREE.Mesh[]>([]);
  const roadElementsRef = useRef<THREE.Object3D[]>([]);
  const groundSegmentsRef = useRef<THREE.Mesh[]>([]);
  const overheadSignsRef = useRef<OverheadSign[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const sceneryManagerRef = useRef<SceneryManager | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // --- State for Car Movement ---
  const carPositionRef = useRef<"center" | "left" | "right">("center");
  const isMovingRef = useRef(false);

  // --- State for Game Pause ---
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const moveStartTimeRef = useRef(0);
  const moveTargetXRef = useRef(0);
  const moveStartXRef = useRef(0);
  
  // Store exit callback in ref for access in event handlers
  const onExitRef = useRef(onExit);
  
  // Update ref when prop changes
  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onExitRef.current) {
        event.preventDefault();
        onExitRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- State for Loading Screen ---
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(true); // Add ref to track loading state
  const [assetsLoaded, setAssetsLoaded] = useState(0);
  const [totalAssets, setTotalAssets] = useState(1); // Start with 1 to avoid division by zero
  const loadingProgressRef = useRef(0);

  // --- Frame Timing State ---
  const lastFrameTimeRef = useRef(performance.now());
  
  // --- Responsive Sign Configuration ---
  const [signConfig, setSignConfig] = useState(getResponsiveSignConfig());

  // --- Sliding sign animation state ---
  const [showSignAnimation, setShowSignAnimation] = useState(false);
  const [rightSignAnimationPosition, setRightSignAnimationPosition] =
    useState(-400); // Start off-screen
  const [leftSignAnimationPosition, setLeftSignAnimationPosition] =
    useState(400); // Start off-screen (left side)

  // --- Sign feedback indicators ---
  const [showCorrectFeedback, setShowCorrectFeedback] = useState(false);
  const [showIncorrectFeedback, setShowIncorrectFeedback] = useState(false);
  const [selectedLane, setSelectedLane] = useState<"left" | "right" | null>(
    null,
  );
  const feedbackTimerRef = useRef<number | null>(null);

  // --- Dynamic speed calculation based on selected car ---
  const forwardSpeedRef = useRef(
    BASE_FORWARD_SPEED *
      (CAR_SPEED_MULTIPLIERS[selectedCarIndex] || 1.0) *
      streakSpeedMultiplier,
  );
  
  // --- Boost state for swipe up gesture ---
  const [isBoostActive, setIsBoostActive] = useState(false);
  const boostSpeedRef = useRef(forwardSpeedRef.current * 2.5); // Set to 2.5x the car-specific speed
  const boostStartTimeRef = useRef(0);
  // Ref for tracking swipe detection across handlers
  const swipeDetectedRef = useRef(false);
  // Add the ref for key press tracking here instead of in the event handler
  const isArrowUpPressedRef = useRef(false);
  // Add ref for tracking if a sign selection is being processed
  const isProcessingSelectionRef = useRef(false);

  // --- Window dimensions state for responsive layouts ---
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  // --- Refs for Callbacks and Trigger State ---
  const onSelectLeftRef = useRef(onSelectLeft);
  const onSelectRightRef = useRef(onSelectRight);
  const lastTriggeredSignRef = useRef<THREE.Object3D | null>(null);

  // --- Ref for Modulo-based Movement (Only for Scenery Manager now potentially) ---
  const totalDistanceScrolledRef = useRef<number>(0); // Keep for potential use by manager or score

  // --- Free Roam Camera Mode ---
  const [isFreeRoamMode, setIsFreeRoamMode] = useState(false);

  // --- Effects ---

  useEffect(() => {
    onSelectLeftRef.current = onSelectLeft;
    onSelectRightRef.current = onSelectRight;
  }, [onSelectLeft, onSelectRight]);

  // Add window resize listener to get accurate window dimensions
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      // Update responsive sign configuration
      setSignConfig(getResponsiveSignConfig());
    };

    window.addEventListener("resize", handleResize);
    // Initialize window dimensions
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // State to track if signs have been animated in
  const [signsAnimatedIn, setSignsAnimatedIn] = useState(false);

  // Effect to trigger and animate the sliding signs for both left and right lanes
  useEffect(() => {
    // Don't run animation if loading or paused
    if (isLoading || isPaused) return;
    
    // Don't re-run sign slide-in animation if it has already completed
    if (signsAnimatedIn) return;

    console.log("Starting sign slide-in animation");
    
    // Reset animation positions and start fresh
    // Use window width to ensure the signs start off-screen
    // Right sign starts off-screen to the right
    setRightSignAnimationPosition(-Math.max(400, windowDimensions.width));
    // Left sign starts off-screen to the left (negative value)
    setLeftSignAnimationPosition(-Math.max(400, windowDimensions.width));

    // Start the animation
    setShowSignAnimation(true);

    // Animate the RIGHT sign sliding in from right to left
    const rightAnimationInterval = setInterval(() => {
      setRightSignAnimationPosition((prev) => {
        // Stop the animation when the sign is fully visible
        if (prev >= 20) {
          clearInterval(rightAnimationInterval);
          return 20;
        }
        // Use a faster animation speed for larger screens
        const stepSize = Math.max(20, windowDimensions.width / 40);
        return prev + stepSize;
      });
    }, 30); // Update every 30ms for smooth animation

    // Animate the LEFT sign sliding in from left to right
    const leftAnimationInterval = setInterval(() => {
      setLeftSignAnimationPosition((prev) => {
        // Stop the animation when the sign is fully visible
        if (prev >= 20) {
          clearInterval(leftAnimationInterval);
          return 20;
        }
        // Use a faster animation speed for larger screens
        const stepSize = Math.max(20, windowDimensions.width / 40);
        return prev + stepSize; // Moving from negative (off-screen left) to positive (visible)
      });
    }, 30); // Update every 30ms for smooth animation

    // Mark signs as animated in when both intervals complete
    const checkComplete = setInterval(() => {
      if (leftSignAnimationPosition >= 20 && rightSignAnimationPosition >= 20) {
        console.log("Sign animation completed");
        setSignsAnimatedIn(true);
        clearInterval(checkComplete);
      }
    }, 100);

    return () => {
      clearInterval(rightAnimationInterval);
      clearInterval(leftAnimationInterval);
      clearInterval(checkComplete);
    };
  }, [isLoading, isPaused, windowDimensions]);
  
  // Reset animation state when options change and trigger new sliding highway signs
  useEffect(() => {
    console.log("🚧 SLIDING HIGHWAY SIGNS EFFECT TRIGGERED");
    console.log(`🚧 OPTIONS: [${options.join(', ')}] (length: ${options.length})`);
    console.log(`🚧 CURRENT SHOW_SIGN_ANIMATION: ${showSignAnimation}`);
    
    if (options && options.length >= 2) {
      console.log("🚧 RESETTING SLIDING HIGHWAY SIGNS FOR NEW OPTIONS");
      
      // Reset animation state first
      setSignsAnimatedIn(false);
      
      // Hide existing sliding highway signs
      setShowSignAnimation(false);
      setLeftSignAnimationPosition(-500);
      setRightSignAnimationPosition(-500);
      console.log("🚧 HIGHWAY SIGNS HIDDEN: Moving off-screen");
      
      // Reset processing state to allow new selections
      isProcessingSelectionRef.current = false;
      console.log("🚧 PROCESSING RESET: Ready for new selections");
      
      // Show new sliding highway signs with animation after a delay
      setTimeout(() => {
        console.log("🚧 STARTING SLIDING ANIMATION FOR NEW HIGHWAY SIGNS WITH OPTIONS:", options);
        setShowSignAnimation(true);
        
        // Start signs off-screen and animate them in
        setLeftSignAnimationPosition(-400);
        setRightSignAnimationPosition(-400);
        
        // Animate signs sliding in from the sides and keep them visible
        setTimeout(() => {
          setLeftSignAnimationPosition(50);
          setRightSignAnimationPosition(50);
          console.log("🚧 HIGHWAY SIGNS SLIDING IN: Left and Right moving to position 50");
          
          // Ensure they stay visible by setting a flag
          setTimeout(() => {
            console.log("🚧 HIGHWAY SIGNS: Animation complete, signs should stay visible");
          }, 500);
        }, 100);
      }, 300);
    } else if (options && options.length > 0) {
      console.log("🚧 INSUFFICIENT OPTIONS: Only resetting animation state");
      setSignsAnimatedIn(false);
    }
  }, [options]);

  // Update boost speed reference when car selection or streak speed changes
  useEffect(() => {
    const carMultiplier = CAR_SPEED_MULTIPLIERS[selectedCarIndex] || 1.0;
    const newSpeed = BASE_FORWARD_SPEED * carMultiplier * streakSpeedMultiplier;
    forwardSpeedRef.current = newSpeed;

    // Update boost speed reference to maintain 2.5x multiplier
    boostSpeedRef.current = isBoostActive ? newSpeed * 2.5 : newSpeed;

    console.log(
      `CAR SPEED UPDATE: Selected car ${selectedCarIndex}, Speed: ${newSpeed.toFixed(
        3,
      )} (car ${carMultiplier.toFixed(2)}x, streak ${streakSpeedMultiplier.toFixed(
        2,
      )}x)`,
    );
  }, [selectedCarIndex, streakSpeedMultiplier, isBoostActive]);

  // Manage boost speed when boost state changes
  useEffect(() => {
    if (isBoostActive) {
      boostSpeedRef.current = forwardSpeedRef.current * 2.5;
      console.log(`BOOST ACTIVATED: Speed set to ${boostSpeedRef.current.toFixed(3)} (2.5x normal)`);
    } else {
      boostSpeedRef.current = forwardSpeedRef.current;
      console.log(`BOOST DEACTIVATED: Speed reset to ${boostSpeedRef.current.toFixed(3)} (normal)`);
    }
  }, [isBoostActive]);

  // Effect to handle the feedback updates from DrivingGameCard
  useEffect(() => {
    if (showFeedback) {
      // Show feedback based on the prop
      console.log(
        `FEEDBACK FROM CARD: isCorrect=${showFeedback.isCorrect ? "✅" : "❌"}`,
      );

      // Clear any existing feedback timer
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }

      // Update feedback state
      setShowCorrectFeedback(showFeedback.isCorrect);
      setShowIncorrectFeedback(!showFeedback.isCorrect);

      // Auto-clear feedback after a delay
      feedbackTimerRef.current = window.setTimeout(() => {
        setShowCorrectFeedback(false);
        setShowIncorrectFeedback(false);
        feedbackTimerRef.current = null;
      }, 1500); // Show feedback for 1.5 seconds
    }
  }, [showFeedback]);

  // Helper function to track asset loading progress with duplicate protection
  const loadedAssetsSet = useRef(new Set<string>());

  const trackAssetLoading = (assetId?: string) => {
    // Generate unique ID if not provided, or use provided one
    const uniqueId =
      assetId ||
      `asset_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // Check if this asset has already been tracked
    if (loadedAssetsSet.current.has(uniqueId)) {
      console.log(
        `ASSET TRACKING: Already counted asset ${uniqueId} - skipping`,
      );
      return;
    }

    // Add to the set of tracked assets
    loadedAssetsSet.current.add(uniqueId);

    // Update the counter
    setAssetsLoaded((prev) => {
      const newVal = prev + 1;
      loadingProgressRef.current = newVal;

      // Only log every 5th asset to reduce console spam
      if (newVal % 5 === 0 || newVal >= totalAssets || newVal <= 5) {
        console.log(
          `ASSET LOADING: ${newVal}/${totalAssets} complete (${Math.round((newVal / totalAssets) * 100)}%)`,
        );
      }

      // Check if all assets are loaded
      if (newVal >= totalAssets && !loadingCompletedRef.current) {
        console.log(
          `ASSET LOADING COMPLETE: ${newVal}/${totalAssets}, triggering completion`,
        );
        setTimeout(() => completeLoading(), 1000); // Delay for UI update
      }

      return newVal;
    });
  };

  // Track if loading completion has been triggered
  const loadingCompletedRef = useRef<boolean>(false);

  // Function to mark loading as complete
  const completeLoading = () => {
    // Prevent multiple invocations of loading completion
    if (loadingCompletedRef.current) {
      console.log(
        "LOADING: Complete already triggered - ignoring duplicate call",
      );
      return;
    }

    loadingCompletedRef.current = true;
    console.log(
      `LOADING COMPLETE: Assets loaded (${loadingProgressRef.current}/${totalAssets})`,
    );

    // Shorter delay to improve user experience
    setTimeout(() => {
      console.log("LOADING: Screen removed, unpausing game");
      setIsLoading(false); // This will hide the loading screen
      isLoadingRef.current = false; // Update the ref to match the state

      // Start game immediately after loading screen disappears
      isPausedRef.current = false;
      setIsPaused(false);

      // Debug log to verify animation state
      console.log(
        `ANIMATION STATE: isPausedRef=${isPausedRef.current}, isPaused=${isPaused}, isLoadingRef=${isLoadingRef.current}, FORWARD_SPEED=${forwardSpeedRef.current}`,
      );
    }, 1500); // Reduced from 3000ms to 1500ms for better UX
  };

  useEffect(() => {
    console.log("--- DrivingGameScene: Initializing Setup ---");
    const container = containerRef.current;
    if (!container) return;

    // Reset loading state
    setIsLoading(true);
    isLoadingRef.current = true; // Update the ref to match the state
    setAssetsLoaded(0);
    setTotalAssets(68); // Estimated number of assets to load (textures, models, etc.)
    loadingProgressRef.current = 0;

    const width = container.clientWidth;
    const height = container.clientHeight;
    totalDistanceScrolledRef.current = 0;
    lastTriggeredSignRef.current = null;

    // --- Clear Refs ---
    console.log("Clearing previous refs...");
    roadSegmentsRef.current = [];
    roadElementsRef.current = [];
    groundSegmentsRef.current = [];
    overheadSignsRef.current = [];
    carRef.current = null;

    // --- Scene ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    // Load the skybox image texture with optimal portion
    const textureLoader = new THREE.TextureLoader();
    const skyboxTexture = textureLoader.load(getAssetUrl("skybox.png"), (texture) => {
      console.log("Skybox texture loaded successfully");
      trackAssetLoading(); // Track this asset load

      // Set optimal crop of the texture for the game
      // Use a specific portion of the texture to avoid deformation
      texture.offset.y = -0.9; // Shift the texture down to show more of the upper portion
      texture.repeat.y = 1.7; // Use 70% of the vertical height

      // Center the horizontal view
      texture.offset.x = -0.35; // Shift to focus on center portion
      texture.repeat.x = 1.7; // Use middle 50% horizontally to show center portion

      texture.needsUpdate = true;
    });

    scene.background = skyboxTexture;

    // Create sprite-based clouds using PNG images
    const createClouds = () => {
      console.log("Creating sprite-based clouds from PNGs...");
      const cloudsContainerGroup = new THREE.Group();
      scene.add(cloudsContainerGroup);

      const cloudTextures = [
        getAssetUrl("clouds/cloud1.png"),
        getAssetUrl("clouds/cloud2.png"),
        getAssetUrl("clouds/cloud3.png"),
        getAssetUrl("clouds/cloud4.png"),
      ];

      const numClouds = 4; // Reduced number of clouds
      const textureLoader = new THREE.TextureLoader();

      for (let i = 0; i < numClouds; i++) {
        const randomTextureUrl =
          cloudTextures[Math.floor(Math.random() * cloudTextures.length)];
        const cloudTexture = textureLoader.load(randomTextureUrl, () => {
          // Track cloud texture load
          trackAssetLoading();
        });
        cloudTexture.minFilter = THREE.LinearFilter;
        cloudTexture.magFilter = THREE.LinearFilter;

        const cloudMaterial = new THREE.SpriteMaterial({
          map: cloudTexture,
          transparent: true,
          opacity: 0.8,
          depthTest: true,
          depthWrite: true,
        });

        const cloud = new THREE.Sprite(cloudMaterial);
        cloud.renderOrder = -1; // Render before other objects but after skybox

        // Randomize cloud size
        const scale = 60 + Math.random() * 100;
        cloud.scale.set(scale, scale * 0.6, 1);

        // Position clouds higher in the sky
        const cloudX = -400 + Math.random() * 800;
        const cloudY = 80 + Math.random() * 65; // 30% higher
        const cloudZ = -600 + Math.random() * 500;

        cloud.position.set(cloudX, cloudY, cloudZ);

        // Add movement data
        cloud.userData = {
          speed: 0.01 + Math.random() * 0.02,
          initialX: cloudX,
        };

        cloudsContainerGroup.add(cloud);
      }

      // Add animation function for clouds
      const animateClouds = () => {
        if (isPausedRef.current) return;

        cloudsContainerGroup.children.forEach((cloud) => {
          // Move clouds slowly from left to right
          cloud.position.x += cloud.userData.speed;

          // If a cloud moves too far right, reset it to the left
          if (cloud.position.x > 500) {
            cloud.position.x = -500 - Math.random() * 100;
          }
        });
      };

      return animateClouds;
    };

    // Create clouds and get animation function
    const animateClouds = createClouds();

    // Store cloud animation in scene's userData
    scene.userData.animateClouds = animateClouds;

    console.log("Scene created with clouds.");

    // --- Camera ---
    const maxLoopDistance = Math.max(
      ROAD_LOOP_DISTANCE,
      GROUND_LOOP_DISTANCE,
      SIGN_LOOP_DISTANCE,
    );
    const cameraFarPlane =
      maxLoopDistance + ESTIMATED_BUILDING_VIEW_DISTANCE + 200;
    console.log(`Camera Far Plane calculated: ${cameraFarPlane}`);
    const camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      cameraFarPlane,
    );
    cameraRef.current = camera;
    camera.position.set(0, 2.5, CAMERA_POSITION_Z);
    camera.lookAt(0, 1, -10);
    scene.fog = new THREE.Fog(0xcce0ff, 50, cameraFarPlane - 150);
    console.log("Camera created and configured.");

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(8, 20, 12);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 150; // Keep reasonable for performance
    directionalLight.shadow.camera.left = -40;
    directionalLight.shadow.camera.right = 40;
    directionalLight.shadow.camera.top = 40;
    directionalLight.shadow.camera.bottom = -40;
    directionalLight.shadow.bias = -0.002;
    scene.add(directionalLight);
    console.log("Lighting added.");

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
    }); // Added logarithmicDepthBuffer potentially for Z-fighting at distance
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Set a consistent frame rate cap (60 FPS) on all devices
    // This prevents the initial high FPS that causes the drop later
    if (typeof window !== "undefined") {
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );
      console.log(
        `Setting renderer parameters for ${isMobile ? "mobile" : "desktop"} device`,
      );
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for better performance
    }

    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(renderer.domElement);
    console.log("Renderer created and configured.");

    // --- Setup Resize Observer ---
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current)
        return;

      const container = containerRef.current;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;

      console.log(`Resizing renderer to ${newWidth}x${newHeight}`);

      // Update camera aspect ratio
      const camera = cameraRef.current;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();

      // Update renderer size
      const renderer = rendererRef.current;
      renderer.setSize(newWidth, newHeight);
      // Always limit pixel ratio for consistent performance on all devices
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    // Create and start the ResizeObserver
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }

    resizeObserverRef.current = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserverRef.current.observe(container);

    // Also listen for fullscreenchange events as they might not trigger ResizeObserver
    const handleFullscreenChange = () => {
      console.log("Fullscreen change detected");
      setTimeout(handleResize, 100); // Small delay to ensure DOM has updated
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    console.log("Resize observer and fullscreen listeners configured");

    // --- Create Scene Elements (with individual positioning logic) ---
    console.log("--- Creating Game Elements ---");
    createRoadAndGround(); // Will NOT use initialZ
    loadCarModel();
    createOverheadSigns(); // Will NOT use initialZ for animation

    // --- Scenery Manager ---
    if (!sceneryManagerRef.current) {
      sceneryManagerRef.current = new SceneryManager();
    }

    // Log the progress value being passed to SceneryManager
    console.log(`Initializing SceneryManager with progress: ${progress}%`);

    sceneryManagerRef.current
      .initialize(scene, totalDistanceScrolledRef, progress)
      .then(() => {
        console.log("Scenery Manager initialized successfully.");
        // Track scenery manager initialization
        trackAssetLoading();

        // Check if we've loaded all assets and can start the game
        const loadingProgress = loadingProgressRef.current;
        const totalAssetsToLoad = Math.max(loadingProgress, totalAssets);
        console.log(
          `Current loading progress: ${loadingProgress}/${totalAssetsToLoad}`,
        );

        // If all assets are loaded, complete the loading process
        if (loadingProgress >= totalAssetsToLoad) {
          completeLoading();
        }
      })
      .catch((error) =>
        console.error("Failed to initialize Scenery Manager:", error),
      );

    // --- Event Listeners ---
    // Arrow up key is tracked by isArrowUpPressedRef at component level

    const handleKeyDown = (e: KeyboardEvent) => {
      // G key to toggle FPS display
      if (e.key === "g" || e.key === "G") {
        setShowFps(prev => !prev);
        return;
      }

      // Special handling for F key to toggle free roam mode
      if (e.key === "f" || e.key === "F") {
        handleFreeRoamToggle(!isFreeRoamMode);
        return;
      }

      // Skip processing driving controls if in free roam mode
      if (isFreeRoamMode) return;

      // Handle Space key for pausing/unpausing (only when not in free roam)
      if (e.key === " " || e.code === "Space") {
        // Toggle pause state
        const newPausedState = !isPausedRef.current;
        isPausedRef.current = newPausedState;
        setIsPaused(newPausedState);
        console.log(`Game ${newPausedState ? "paused" : "resumed"}`);
        return;
      }

      // Skip other control keys if game is paused
      if (isPausedRef.current) return;

      // For driving controls, avoid using WASD in regular game mode to prevent conflicts
      // with free roam mode. Just use arrow keys.
      if (e.key === "ArrowLeft") {
        // Skip if car is currently changing lanes
        if (isMovingRef.current) return;
        if (carPositionRef.current !== "left") moveCar("left");
      } else if (e.key === "ArrowRight") {
        // Skip if car is currently changing lanes
        if (isMovingRef.current) return;
        if (carPositionRef.current !== "right") moveCar("right");
      } else if (e.key === "ArrowUp") {
        // Mark that the Up arrow key is pressed
        isArrowUpPressedRef.current = true;

        // Up arrow for boost - activate if not already active
        if (!isBoostActive) {
          console.log("Forward key pressed - Activating boost!");
          setIsBoostActive(true);
          createSmokeParticles();
        }
      }
    };

    // Handle key up to detect when forward key is released
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        // Mark that the key is no longer pressed
        isArrowUpPressedRef.current = false;

        // Deactivate boost when key is released - DISABLE THIS TO MAKE BOOST ONLY DEACTIVATE ON SIGNS
        // if (isBoostActive) {
        //   console.log("Forward key released - Ending boost");
        //   setIsBoostActive(false);
        //   boostSpeedRef.current = FORWARD_SPEED;
        // }
      }
    };

    // Helper function to create smoke particles for visual boost effect
    const createSmokeParticles = () => {
      if (!carRef.current || !sceneRef.current) return;

      // Position smoke behind the car
      const smokeOrigin = new THREE.Vector3(
        carRef.current.position.x,
        carRef.current.position.y + 0.5,
        carRef.current.position.z + 1.5,
      );

      // Create 5-10 smoke particles
      const numParticles = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < numParticles; i++) {
        const smokeGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const smokeMaterial = new THREE.MeshBasicMaterial({
          color: 0x888888,
          transparent: true,
          opacity: 0.7,
        });

        const smokeParticle = new THREE.Mesh(smokeGeometry, smokeMaterial);
        smokeParticle.position.copy(smokeOrigin);

        // Add random offset
        smokeParticle.position.x += (Math.random() - 0.5) * 0.5;
        smokeParticle.position.y += (Math.random() - 0.5) * 0.5;
        smokeParticle.position.z += (Math.random() - 0.5) * 0.5;

        // Add user data for animation
        smokeParticle.userData = {
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.05,
            Math.random() * 0.05 + 0.02, // Always move up slightly
            Math.random() * 0.1 + 0.05, // Always move backwards
          ),
          createdAt: Date.now(),
          lifespan: 1000 + Math.random() * 2000, // 1-3 seconds
        };

        sceneRef.current.add(smokeParticle);

        // Store in scene userData for updating in animation loop
        if (!sceneRef.current.userData.smokeParticles) {
          sceneRef.current.userData.smokeParticles = [];
        }
        sceneRef.current.userData.smokeParticles.push(smokeParticle);
      }
    };

    // Touch controls for mobile
    const handleTouchStart = (e: TouchEvent) => {
      // Skip if in free roam mode
      if (isFreeRoamMode) return;

      // Skip if car is currently moving or game is paused
      if (isMovingRef.current || isPausedRef.current) return;

      // Get the touch position
      const touchX = e.touches[0].clientX;
      const containerWidth = containerRef.current?.clientWidth || 0;

      // Determine if touch is on left or right half of the screen
      if (touchX < containerWidth / 2) {
        // Left side touched
        if (carPositionRef.current !== "left") moveCar("left");
      } else {
        // Right side touched
        if (carPositionRef.current !== "right") moveCar("right");
      }
    };

    // Swipe controls for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let touchTimeStart = 0;

    const handleTouchStartSwipe = (e: TouchEvent) => {
      // Skip if in free roam mode
      if (isFreeRoamMode) return;

      // Reset swipe detection for this touch
      swipeDetectedRef.current = false;

      // Store initial touch position and time
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchTimeStart = Date.now();

      console.log(`Touch start - X: ${touchStartX}, Y: ${touchStartY}`);
    };

    // Add a touchmove handler to detect swipes as they happen
    const handleTouchMoveSwipe = (e: TouchEvent) => {
      // Skip if we've already detected a swipe in this touch
      if (swipeDetectedRef.current) return;

      // Skip if in free roam mode or game is paused
      if (isFreeRoamMode || isPausedRef.current) return;

      if (e.touches.length === 0) return;

      // Prevent default to ensure smooth touch handling
      e.preventDefault();

      const touchMoveX = e.touches[0].clientX;
      const touchMoveY = e.touches[0].clientY;
      const distanceY = touchStartY - touchMoveY; // Positive for upward swipe
      const distanceX = Math.abs(touchMoveX - touchStartX);

      // If we're moving primarily upward and past our threshold, activate boost
      if (distanceY > 10 && distanceY > distanceX && !isBoostActive) {
        console.log(
          `BOOST SWIPE: Upward swipe detected during move - Y distance: ${distanceY}px, X distance: ${distanceX}px`,
        );
        setIsBoostActive(true);
        swipeDetectedRef.current = true; // Mark as detected to avoid duplicate triggers

        // Create smoke particles for visual effect
        createSmokeParticles();
      }
    };

    const handleTouchEndSwipe = (e: TouchEvent) => {
      // Skip if in free roam mode
      if (isFreeRoamMode) return;

      // Skip if game is paused
      if (isPausedRef.current) return;

      // Skip if we already triggered boost in touchmove
      if (swipeDetectedRef.current) {
        // Reset swipe detection for next touch
        swipeDetectedRef.current = false;
        return;
      }

      if (e.changedTouches.length === 0) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchTimeElapsed = Date.now() - touchTimeStart;
      const touchDistanceX = touchEndX - touchStartX;
      const touchDistanceY = touchStartY - touchEndY; // Positive for upward swipe

      console.log(
        `Swipe detected - X: ${touchDistanceX}, Y: ${touchDistanceY}, Time: ${touchTimeElapsed}ms`,
      );

      // Calculate the absolute distances and determine which direction had more movement
      const absX = Math.abs(touchDistanceX);
      const absY = Math.abs(touchDistanceY);

      // Check if this is primarily a vertical swipe (more vertical than horizontal movement)
      const isVerticalSwipe = absY > absX;

      // More lenient upward swipe detection for mobile
      if (
        touchTimeElapsed < 800 &&
        touchDistanceY > 10 &&
        (isVerticalSwipe || absY > 5)
      ) {
        // Upward swipe detected - activate boost
        console.log(`BOOST SWIPE: Upward swipe detected on touch end - Y: ${touchDistanceY}px, time: ${touchTimeElapsed}ms`);
        if (!isBoostActive) {
          setIsBoostActive(true);
          swipeDetectedRef.current = true; // Mark as detected
          createSmokeParticles(); // Use our helper function for consistency
        }
        return;
      } else {
        console.log(`BOOST SWIPE: Swipe not detected - Y: ${touchDistanceY}px (needed >10), time: ${touchTimeElapsed}ms (needed <800), vertical: ${isVerticalSwipe}`);
      }

      // Only process horizontal swipes if car is not currently moving and boost wasn't activated
      // More restrictive horizontal swipe detection to avoid lane changes during boost swipes
      if (
        !isMovingRef.current &&
        touchTimeElapsed < 500 &&
        Math.abs(touchDistanceX) > 50 && // Increased threshold for horizontal movement
        Math.abs(touchDistanceX) > Math.abs(touchDistanceY) * 2 && // Must be significantly more horizontal than vertical
        !swipeDetectedRef.current // Don't move car if boost was detected
      ) {
        if (touchDistanceX > 0) {
          // Swipe right
          if (carPositionRef.current !== "right") moveCar("right");
        } else {
          // Swipe left
          if (carPositionRef.current !== "left") moveCar("left");
        }
      }
    };

    // Add keyboard event listeners
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp); // Add keyup listener for boost release

    // Add touch event listeners to document for better mobile compatibility
    document.addEventListener("touchstart", handleTouchStart, { passive: false });
    document.addEventListener("touchstart", handleTouchStartSwipe, { passive: false });
    document.addEventListener("touchmove", handleTouchMoveSwipe, { passive: false });
    document.addEventListener("touchend", handleTouchEndSwipe, { passive: false });
    
    // Also add to container as backup
    if (containerRef.current) {
      containerRef.current.addEventListener("touchstart", handleTouchStart);
      containerRef.current.addEventListener("touchstart", handleTouchStartSwipe);
      containerRef.current.addEventListener("touchmove", handleTouchMoveSwipe);
      containerRef.current.addEventListener("touchend", handleTouchEndSwipe);
    }

    console.log(
      "Keyboard and touch event listeners added with boost functionality.",
    );

    console.log("--- Starting Animation Loop ---");
    animate();
    updateAllSignTexts();

    // --- Cleanup ---
    return () => {
      console.log("--- DrivingGameScene: Cleaning up ---");
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);

      // Remove touch event listeners from document
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchstart", handleTouchStartSwipe);
      document.removeEventListener("touchmove", handleTouchMoveSwipe);
      document.removeEventListener("touchend", handleTouchEndSwipe);
      
      // Remove touch event listeners from container
      if (containerRef.current) {
        containerRef.current.removeEventListener("touchstart", handleTouchStart);
        containerRef.current.removeEventListener("touchstart", handleTouchStartSwipe);
        containerRef.current.removeEventListener("touchmove", handleTouchMoveSwipe);
        containerRef.current.removeEventListener("touchend", handleTouchEndSwipe);
      }

      // Cleanup ResizeObserver
      if (resizeObserverRef.current) {
        console.log("Disconnecting ResizeObserver");
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      // Remove fullscreen event listeners
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange,
      );
      console.log("Removed fullscreen change listeners");

      // Exit fullscreen if needed
      if (document.fullscreenElement) {
        document.exitFullscreen().catch((err) => {
          console.error("Error exiting fullscreen:", err);
        });
      }

      if (animationFrameRef.current !== null)
        cancelAnimationFrame(animationFrameRef.current);

      sceneryManagerRef.current?.dispose();
      sceneryManagerRef.current = null;
      console.log("Scenery Manager disposed.");

      // Dispose scene objects, textures, materials
      scene.traverse((object) => {
        if (object !== scene && !object.userData?.isManagedBySceneryManager) {
          if (object instanceof THREE.Mesh) {
            // Properly dispose of cloud geometries
            if (object.geometry instanceof THREE.BoxGeometry) {
              // Check if this could be a cloud component
              const parent = object.parent;
              if (
                parent &&
                parent.parent &&
                parent.parent.userData?.speed !== undefined
              ) {
                console.log("Disposing cloud geometry");
                object.geometry?.dispose();
                // Dispose material if unique to this cloud
                if (object.material && !Array.isArray(object.material)) {
                  (object.material as THREE.Material).dispose();
                }
              } else {
                // Other box geometries (non-cloud)
                object.geometry?.dispose();
              }
            } else {
              // Non-box geometries
              object.geometry?.dispose();
              // Careful with materials - dispose maps, maybe materials if unique
              if (Array.isArray(object.material)) {
                object.material.forEach((m) => m.map?.dispose());
              } else if (object.material) {
                object.material.map?.dispose();
              }
            }
            // Don't dispose shared materials like roadMat, groundMat here
          }
        }
      });
      // Dispose sign textures explicitly
      overheadSignsRef.current.forEach((signStruct) => {
        if (signStruct.leftSignPanel.userData.textTexture)
          signStruct.leftSignPanel.userData.textTexture.dispose();
        if (signStruct.rightSignPanel.userData.textTexture)
          signStruct.rightSignPanel.userData.textTexture.dispose();
      });
      // Dispose car model materials if necessary (often shared)
      carRef.current?.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry?.dispose();
      });
      console.log("Scene objects traversed for disposal.");

      rendererRef.current?.dispose();
      rendererRef.current?.forceContextLoss(); // Try forcing context loss
      console.log("Renderer disposed.");

      // Clear refs
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      carRef.current = null;
      roadSegmentsRef.current = [];
      roadElementsRef.current = [];
      groundSegmentsRef.current = [];
      overheadSignsRef.current = [];
      console.log("Refs cleared. Cleanup complete.");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log(`--- Options/Level Changed --- Progress: ${progress}%`);

    // Update SceneryManager with the new progress value
    if (sceneryManagerRef.current) {
      console.log(`Updating SceneryManager with new progress: ${progress}%`);
      // Make sure we're always passing the current progress to SceneryManager's update method
      sceneryManagerRef.current.update(progress);
    }

    updateAllSignTexts();
    lastTriggeredSignRef.current = null; // Reset trigger state
    console.log("Sign trigger state reset.");
    // Car position is NOT reset - it stays in the lane the player chose
  }, [options, progress]); // Added progress to dependency array

  function createRoadAndGround() {
    const scene = sceneRef.current;
    if (!scene) return;
    console.log(
      `Creating ${NUM_ROAD_SEGMENTS} road and ${NUM_GROUND_SEGMENTS} ground segments (Individual Loop Logic)`,
    );

    roadSegmentsRef.current = [];
    roadElementsRef.current = [];
    groundSegmentsRef.current = [];

    const textureLoader = new THREE.TextureLoader();

    // --- Road Material ---
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      side: THREE.DoubleSide,
      metalness: 0.2,
      roughness: 0.8,
    });
    console.log("Road material created.");

    // --- Ground Material (with detailed logging) ---
    let groundMat: THREE.MeshStandardMaterial;
    const fallbackGroundColor = 0x66bb6a;
    try {
      console.log(
        "GROUND: Attempting to load grass texture: /textures/grass.jpg",
      );
      const grassTexture = textureLoader.load(
        "/textures/grass.jpg",
        (texture) => {
          // Success
          console.log("GROUND TEXTURE: Load successful!");
          trackAssetLoading(); // Track this asset load

          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(15, 40);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy =
            rendererRef.current?.capabilities.getMaxAnisotropy() || 1; // Use anisotropy
          texture.needsUpdate = true;
          if (groundMat) {
            console.log(
              "GROUND TEXTURE: Applying texture to existing material.",
            );
            groundMat.map = texture;
            groundMat.color.set(0xffffff); // Reset tint when texture applied
            groundMat.needsUpdate = true;
          } else {
            console.warn(
              "GROUND TEXTURE: Material ref was null when texture loaded.",
            );
          }
        },
        (xhr) => {
          // Progress
          // console.log(`GROUND TEXTURE: Loading progress: ${(xhr.loaded / xhr.total) * 100}%`);
        },
        (error) => {
          // Error
          console.error("GROUND TEXTURE: Load failed!", error);
          // Material will keep the fallback color
          if (groundMat) {
            console.log(
              "GROUND TEXTURE: Falling back to color:",
              groundMat.color.getHexString(),
            );
          }
        },
      );

      // Create material initially with fallback color
      groundMat = new THREE.MeshStandardMaterial({
        color: fallbackGroundColor,
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0.1,
        // map: grassTexture // Map assigned in callback
      });
      console.log(
        "GROUND: Material created with fallback color:",
        groundMat.color.getHexString(),
      );
    } catch (e) {
      console.error("GROUND: Error during texture loading setup:", e);
      groundMat = new THREE.MeshStandardMaterial({
        color: fallbackGroundColor,
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0.1,
      });
      console.warn("GROUND: Using fallback material due to setup error.");
    }

    // --- Divider Material ---
    const dividerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      emissive: 0xbbbbbb,
      emissiveIntensity: 0.25,
      roughness: 0.7,
    });
    console.log("Divider material created.");

    // --- Create Road Segments ---
    for (let i = 0; i < NUM_ROAD_SEGMENTS; i++) {
      // Calculate initial Z position for placement only, not for looping logic
      const placementZ = -ROAD_SEGMENT_LENGTH / 2 - i * ROAD_SEGMENT_LENGTH;
      console.log(`ROAD: Creating segment ${i} at initial Z: ${placementZ}`);

      const roadGeom = new THREE.PlaneGeometry(10, ROAD_SEGMENT_LENGTH);
      const roadSegment = new THREE.Mesh(roadGeom, roadMat);
      roadSegment.rotation.x = -Math.PI / 2;
      roadSegment.position.set(0, 0.01, placementZ);
      roadSegment.receiveShadow = true;
      // NO userData.initialZ needed for this loop type
      scene.add(roadSegment);
      roadSegmentsRef.current.push(roadSegment);
      console.log(`ROAD: Added segment ${i} (UUID: ${roadSegment.uuid})`);

      // --- Road Elements positioned relative to this segment's initial placement ---
      const segmentCenterZ = placementZ;

      // Center dashed line
      const dashLength = 3;
      const dashGap = 5;
      const numDashes = Math.floor(
        ROAD_SEGMENT_LENGTH / (dashLength + dashGap),
      );
      for (let j = 0; j < numDashes; j++) {
        const dashGeom = new THREE.PlaneGeometry(0.2, dashLength);
        const dash = new THREE.Mesh(dashGeom, dividerMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.y = 0.02;
        const elementPlacementZ =
          segmentCenterZ -
          ROAD_SEGMENT_LENGTH / 2 +
          dashLength / 2 +
          j * (dashLength + dashGap);
        dash.position.z = elementPlacementZ;
        dash.receiveShadow = false;
        // NO userData.initialZ
        scene.add(dash);
        roadElementsRef.current.push(dash);
      }

      // Solid edge lines
      const edgeLineGeom = new THREE.PlaneGeometry(0.15, ROAD_SEGMENT_LENGTH);
      const leftLine = new THREE.Mesh(edgeLineGeom, dividerMat);
      leftLine.rotation.x = -Math.PI / 2;
      leftLine.position.set(-4.9, 0.02, segmentCenterZ);
      leftLine.receiveShadow = false;
      scene.add(leftLine);
      roadElementsRef.current.push(leftLine);

      const rightLine = new THREE.Mesh(edgeLineGeom, dividerMat);
      rightLine.rotation.x = -Math.PI / 2;
      rightLine.position.set(4.9, 0.02, segmentCenterZ);
      rightLine.receiveShadow = false;
      scene.add(rightLine);
      roadElementsRef.current.push(rightLine);

      // Dashed lane dividers
      const laneDashLength = 2.0;
      const laneDashGap = 4.0;
      const numLaneDashes = Math.floor(
        ROAD_SEGMENT_LENGTH / (laneDashLength + laneDashGap),
      );
      const laneDividerGeom = new THREE.PlaneGeometry(0.15, laneDashLength);
      for (let j = 0; j < numLaneDashes; j++) {
        const elementPlacementZ =
          segmentCenterZ -
          ROAD_SEGMENT_LENGTH / 2 +
          laneDashLength / 2 +
          j * (laneDashLength + laneDashGap);
        // Left
        const leftDiv = new THREE.Mesh(laneDividerGeom, dividerMat);
        leftDiv.rotation.x = -Math.PI / 2;
        leftDiv.position.set(-LANE_WIDTH, 0.015, elementPlacementZ);
        leftDiv.receiveShadow = false;
        scene.add(leftDiv);
        roadElementsRef.current.push(leftDiv);
        // Right
        const rightDiv = new THREE.Mesh(laneDividerGeom, dividerMat);
        rightDiv.rotation.x = -Math.PI / 2;
        rightDiv.position.set(LANE_WIDTH, 0.015, elementPlacementZ);
        rightDiv.receiveShadow = false;
        scene.add(rightDiv);
        roadElementsRef.current.push(rightDiv);
      }
      console.log(`ROAD: Added elements for segment ${i}`);
    }
    console.log(
      `ROAD: Total road elements created: ${roadElementsRef.current.length}`,
    );

    // --- Create Ground Segments ---
    for (let i = 0; i < NUM_GROUND_SEGMENTS; i++) {
      const placementZ = -GROUND_SEGMENT_LENGTH / 2 - i * GROUND_SEGMENT_LENGTH;
      console.log(`GROUND: Creating segment ${i} at initial Z: ${placementZ}`);

      const groundGeom = new THREE.PlaneGeometry(300, GROUND_SEGMENT_LENGTH); // Wide ground
      const groundSegment = new THREE.Mesh(groundGeom, groundMat); // Use the potentially textured ground material
      groundSegment.rotation.x = -Math.PI / 2;
      groundSegment.position.set(0, 0, placementZ);
      groundSegment.receiveShadow = true;
      // NO userData.initialZ
      scene.add(groundSegment);
      groundSegmentsRef.current.push(groundSegment);
      console.log(
        `GROUND: Added segment ${i} (UUID: ${groundSegment.uuid}). Material map UUID: ${groundSegment.material.map?.uuid || "None"}`,
      );
    }
    console.log("Road and Ground creation finished.");
  }

  function loadCarModel() {
    // No changes needed here from previous working versions
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const gltfLoader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    const modelPath = CAR_MODELS[selectedCarIndex];
    const paletteTexturePath = "/textures/kenney_car_palette.png";
    console.log("CAR: Loading model...");

    gltfLoader.load(
      modelPath,
      (gltf) => {
        // Track the car model load
        trackAssetLoading();

        const loadedCar = gltf.scene;
        loadedCar.scale.set(CAR_MODEL_SCALE, CAR_MODEL_SCALE, CAR_MODEL_SCALE);
        loadedCar.rotation.y = Math.PI;
        // Move car forward to avoid being covered by UI
        loadedCar.position.set(0, 0.1, CAMERA_POSITION_Z - 5);
        console.log("CAR: Model parsed. Loading texture...");

        textureLoader.load(
          paletteTexturePath,
          (texture) => {
            // Track the car texture load
            trackAssetLoading();

            texture.colorSpace = THREE.SRGBColorSpace;
            texture.flipY = false;
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.needsUpdate = true;
            console.log("CAR: Texture loaded. Applying material...");

            const carMaterial = new THREE.MeshStandardMaterial({
              map: texture,
              metalness: 0.1,
              roughness: 0.9,
            });

            loadedCar.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material = carMaterial;
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            carRef.current = loadedCar;
            scene.add(loadedCar);
            console.log("CAR: Added to scene with texture.");
          },
          undefined, // Progress
          (error) => {
            console.error("CAR: Failed to load texture:", error);
            loadedCar.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            carRef.current = loadedCar;
            scene.add(loadedCar);
            console.log("CAR: Added to scene WITHOUT texture.");
          },
        );
      },
      undefined, // Progress
      (error) => {
        console.error("CAR: Error loading model:", error);
      },
    );
  }

  function createOverheadSigns() {
    // No changes needed here from previous working versions
    const scene = sceneRef.current;
    if (!scene) return;
    console.log(
      `SIGNS: Creating ${NUM_SIGN_STRUCTURES_TOTAL} structures (Individual Loop Logic)`,
    );

    overheadSignsRef.current = [];

    const postMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.6,
      roughness: 0.6,
    });
    const beamMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777,
      metalness: 0.4,
      roughness: 0.7,
    });
    const signPanelMaterial = new THREE.MeshStandardMaterial({
      color: 0x009900,
      metalness: 0.1,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });

    const signWidth = 3.2;
    const signHeight = 2.0;
    const signThickness = 0.1;
    const postHeight = 5.5;
    const postRadius = 0.15;
    const beamLength = LANE_WIDTH * 4 + 1;
    const beamThickness = 0.2;
    const postOffset = LANE_WIDTH * 2 + 0.3;

    for (let i = 0; i < NUM_SIGN_STRUCTURES_TOTAL; i++) {
      const placementZ = FIRST_SIGN_Z - i * SIGN_DISTANCE;
      console.log(`SIGNS: Creating sign ${i} at initial Z: ${placementZ}`);

      const signGroup = new THREE.Group();
      signGroup.position.z = placementZ;

      // Posts, Beam, Panels... (geometry and mesh creation as before)
      const postGeom = new THREE.CylinderGeometry(
        postRadius,
        postRadius,
        postHeight,
        12,
      );
      const leftPost = new THREE.Mesh(postGeom, postMaterial);
      leftPost.position.set(-postOffset, postHeight / 2, 0);
      leftPost.castShadow = true;
      leftPost.receiveShadow = true;
      signGroup.add(leftPost);
      const rightPost = new THREE.Mesh(postGeom, postMaterial);
      rightPost.position.set(postOffset, postHeight / 2, 0);
      rightPost.castShadow = true;
      rightPost.receiveShadow = true;
      signGroup.add(rightPost);
      const beamGeom = new THREE.BoxGeometry(
        beamLength,
        beamThickness,
        beamThickness * 2,
      );
      const beam = new THREE.Mesh(beamGeom, beamMaterial);
      beam.position.set(0, postHeight - beamThickness / 2, 0);
      beam.castShadow = true;
      beam.receiveShadow = true;
      signGroup.add(beam);
      const signPanelGeom = new THREE.BoxGeometry(
        signWidth,
        signHeight,
        signThickness,
      );
      const leftSignPanel = new THREE.Mesh(
        signPanelGeom,
        signPanelMaterial.clone(),
      );
      leftSignPanel.position.set(
        -LANE_WIDTH,
        postHeight - beamThickness - signHeight / 2,
        0.1,
      );
      leftSignPanel.castShadow = true;
      signGroup.add(leftSignPanel);
      const rightSignPanel = new THREE.Mesh(
        signPanelGeom,
        signPanelMaterial.clone(),
      );
      rightSignPanel.position.set(
        LANE_WIDTH,
        postHeight - beamThickness - signHeight / 2,
        0.1,
      );
      rightSignPanel.castShadow = true;
      signGroup.add(rightSignPanel);

      scene.add(signGroup);
      overheadSignsRef.current.push({
        gantryGroup: signGroup,
        leftSignPanel,
        rightSignPanel,
      });
      console.log(`SIGNS: Added sign ${i} (Group UUID: ${signGroup.uuid})`);
    }
    console.log("SIGNS: Creation finished.");
  }

  function updateAllSignTexts() {
    console.log(`🔄 UPDATING SIGN TEXTS: Options [${options.join(', ')}]`);
    console.log(`🔄 SIGNS AVAILABLE: ${overheadSignsRef.current.length} overhead signs`);
    
    if (options.length >= 2 && overheadSignsRef.current.length > 0) {
      overheadSignsRef.current.forEach((signStruct, idx) => {
        console.log(`🔄 UPDATING SIGN ${idx}: Left="${options[0]}", Right="${options[1]}"`);
        updateSignText(signStruct.leftSignPanel, options[0]);
        updateSignText(signStruct.rightSignPanel, options[1]);
      });
      console.log(`🔄 SIGN UPDATE COMPLETE: All ${overheadSignsRef.current.length} signs updated`);
    } else {
      console.log(`🔄 SIGN UPDATE FAILED: options.length=${options.length}, signs.count=${overheadSignsRef.current.length}`);
    }
  }

  function updateSignText(signPanelMesh: THREE.Mesh, text: string) {
    // Track sign texture generation for loading screen
    if (!signPanelMesh) return;
    if (signPanelMesh.userData.textMesh)
      signPanelMesh.remove(signPanelMesh.userData.textMesh);
    if (signPanelMesh.userData.textTexture)
      signPanelMesh.userData.textTexture.dispose();
    signPanelMesh.userData.textMesh = null;
    signPanelMesh.userData.textTexture = null;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;
    const canvasWidth = 512;
    const canvasHeight = 256;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    context.fillStyle = "#009900";
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    // Mobile-responsive font sizing for 3D highway signs
    const isMobile = window.innerWidth < 768;
    let fontSize = isMobile ? 48 : 64;
    context.font = `bold ${fontSize}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "white";
    const maxWidth = canvasWidth * 0.9;
    let textMetrics = context.measureText(text);
    const minFontSize = isMobile ? 16 : 20;
    while (textMetrics.width > maxWidth && fontSize > minFontSize) {
      fontSize -= isMobile ? 2 : 4;
      context.font = `bold ${fontSize}px Arial`;
      textMetrics = context.measureText(text);
    }
    const words = text.split(" ");
    const lines = [];
    let currentLine = words[0] || "";
    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + " " + words[i];
      if (context.measureText(testLine).width < maxWidth || !currentLine) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    if (currentLine) lines.push(currentLine);
    const lineHeight = fontSize * 1.2;
    const startY = canvasHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) =>
      context.fillText(line, canvasWidth / 2, startY + index * lineHeight),
    );
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    const textMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
    });
    const panelGeom = signPanelMesh.geometry as THREE.BoxGeometry;
    const panelWidth = panelGeom?.parameters?.width ?? 3.0;
    const panelHeight = panelGeom?.parameters?.height ?? 2.0;
    const textGeometry = new THREE.PlaneGeometry(
      panelWidth * 0.95,
      panelHeight * 0.95,
    );
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.z = (panelGeom?.parameters?.depth ?? 0.1) / 2 + 0.01;
    signPanelMesh.add(textMesh);
    signPanelMesh.userData.textMesh = textMesh;
    signPanelMesh.userData.textTexture = texture;

    // Track sign texture generation as an asset load
    trackAssetLoading();
  }

  function moveCar(direction: "left" | "right") {
    // No changes needed
    const car = carRef.current;
    if (!car || isMovingRef.current) return;
    isMovingRef.current = true;
    moveStartTimeRef.current = Date.now();
    moveStartXRef.current = car.position.x;
    let targetX = 0;
    let targetLane: "center" | "left" | "right" = "center";
    if (direction === "left") {
      if (carPositionRef.current === "center") {
        targetX = -LANE_WIDTH;
        targetLane = "left";
      } else if (carPositionRef.current === "right") {
        targetX = 0;
        targetLane = "center";
      } else return;
    } else {
      if (carPositionRef.current === "center") {
        targetX = LANE_WIDTH;
        targetLane = "right";
      } else if (carPositionRef.current === "left") {
        targetX = 0;
        targetLane = "center";
      } else return;
    }
    moveTargetXRef.current = targetX;
    carPositionRef.current = targetLane;
  }

  // --- Animation Loop (Individual Repositioning for ALL) ---
  // Use this counter to track animation frames
  const animationFrameCounter = useRef(0);
  const lastMoveLogTime = useRef(0);

  // For frame timing - use delta time for consistent movement
  const TARGET_FRAME_TIME = 1000 / 60; // 16.67ms for 60fps baseline
  const fpsHistoryRef = useRef<number[]>([]);
  const [displayFps, setDisplayFps] = useState(60);
  const [showFps, setShowFps] = useState(false); // Hidden by default, toggle with G key

  function animate(timestamp = 0) {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const car = carRef.current;
    const manager = sceneryManagerRef.current;

    // Request next frame immediately
    animationFrameRef.current = requestAnimationFrame(animate);

    // Calculate actual delta time since last frame
    const now = timestamp || performance.now();
    const deltaTime = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;

    // Skip if deltaTime is unreasonably large (e.g., tab was inactive) or zero
    if (deltaTime <= 0 || deltaTime > 500) {
      return;
    }

    // Increment frame counter
    animationFrameCounter.current++;

    // Calculate and display FPS (update every 30 frames to avoid expensive state updates)
    const instantFps = 1000 / deltaTime;
    fpsHistoryRef.current.push(instantFps);
    if (fpsHistoryRef.current.length > 30) {
      fpsHistoryRef.current.shift();
    }
    if (animationFrameCounter.current % 30 === 0) {
      const avgFps = fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length;
      setDisplayFps(Math.round(avgFps));
    }

    if (!scene || !camera || !renderer) {
      console.log("ANIMATION: Missing key refs, skipping frame");
      return;
    }

    // Check if game is loading using the ref instead of state
    if (isLoadingRef.current) {
      // Just render the scene but don't update animations while loading
      renderer.render(scene, camera);
      return;
    }

    // Always allow rendering even if paused, but conditionally update animations
    const isGamePaused = isPausedRef.current;

    // Movement and animations only happen when the game is NOT paused
    if (!isGamePaused) {
      // --- GET THE CURRENT SPEED ---
      // Multiply by delta time factor to ensure consistent movement regardless of frame rate
      const deltaTimeFactor = deltaTime / TARGET_FRAME_TIME; // 1.0 at 60fps, scales with actual frame time
      const currentSpeed = boostSpeedRef.current * deltaTimeFactor;

      // --- 1. Update TotalScrolled Distance (Optional: For Manager/Score) ---
      totalDistanceScrolledRef.current += currentSpeed;

      // --- 2. Update Scenery Manager ---
      manager?.update(progress, currentSpeed); // Pass current speed to move scenery correctly

      // --- 2.5 Animate Clouds (even when player is not moving) ---
      if (scene.userData.animateClouds) {
        scene.userData.animateClouds();
      }


      // --- 2.7 Animate Smoke Particles ---
      if (
        scene.userData.smokeParticles &&
        scene.userData.smokeParticles.length > 0
      ) {
        const now = Date.now();

        // Animate each smoke particle
        scene.userData.smokeParticles = scene.userData.smokeParticles.filter(
          (particle: THREE.Mesh) => {
            if (!particle.userData) return false;

            // Check if particle has exceeded its lifespan
            const age = now - particle.userData.createdAt;
            if (age > particle.userData.lifespan) {
              scene.remove(particle);
              if (particle.geometry) particle.geometry.dispose();
              if (particle.material && !Array.isArray(particle.material)) {
                (particle.material as THREE.Material).dispose();
              }
              return false;
            }

            // Update position based on velocity (using deltaTimeFactor for frame-rate independence)
            particle.position.x += particle.userData.velocity.x * deltaTimeFactor;
            particle.position.y += particle.userData.velocity.y * deltaTimeFactor;
            particle.position.z += particle.userData.velocity.z * deltaTimeFactor;

            // Update opacity based on age
            const lifeProgress = age / particle.userData.lifespan;
            if (particle.material && !Array.isArray(particle.material)) {
              const mat = particle.material as THREE.MeshBasicMaterial;
              mat.opacity = 0.7 * (1 - lifeProgress);

              // Grow slightly as it ages
              const scale = 0.2 + lifeProgress * 0.3;
              particle.scale.set(scale, scale, scale);
            }

            return true;
          },
        );

        // Create new smoke particles if boost is active - COMPLETELY REBUILT FOR CONTINUOUS EFFECTS
        if (isBoostActive && carRef.current && sceneRef.current) {
          // Rate of particle generation depends on speed - faster = more particles
          // This creates a more impressive visual effect during boost
          const particleRate =
            boostSpeedRef.current > forwardSpeedRef.current * 1.5 ? 0.4 : 0.2;

          // Generate particles more consistently for a continuous smoke trail
          if (Math.random() < particleRate) {
            // Position smoke behind the car
            const smokeOrigin = new THREE.Vector3(
              carRef.current.position.x,
              carRef.current.position.y + 0.5,
              carRef.current.position.z + 1.5,
            );

            // Create 3-5 smoke particles (fewer for better performance)
            const numParticles = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < numParticles; i++) {
              const smokeGeometry = new THREE.SphereGeometry(0.2, 8, 8);
              const smokeMaterial = new THREE.MeshBasicMaterial({
                color: 0x888888,
                transparent: true,
                opacity: 0.7,
              });

              const smokeParticle = new THREE.Mesh(
                smokeGeometry,
                smokeMaterial,
              );
              smokeParticle.position.copy(smokeOrigin);

              // Add random offset
              smokeParticle.position.x += (Math.random() - 0.5) * 0.5;
              smokeParticle.position.y += (Math.random() - 0.5) * 0.5;
              smokeParticle.position.z += (Math.random() - 0.5) * 0.5;

              // Add user data for animation
              smokeParticle.userData = {
                velocity: new THREE.Vector3(
                  (Math.random() - 0.5) * 0.05,
                  Math.random() * 0.05 + 0.02, // Always move up slightly
                  Math.random() * 0.1 + 0.05, // Always move backwards
                ),
                createdAt: Date.now(),
                lifespan: 1000 + Math.random() * 2000, // 1-3 seconds
              };

              sceneRef.current.add(smokeParticle);

              // Store in scene userData for updating in animation loop
              if (!sceneRef.current.userData.smokeParticles) {
                sceneRef.current.userData.smokeParticles = [];
              }
              sceneRef.current.userData.smokeParticles.push(smokeParticle);
            }
          }
        }
      }

      // --- 3. Update Positions using INDIVIDUAL REPOSITIONING ---

      // Road Segments
      roadSegmentsRef.current.forEach((segment, i) => {
        segment.position.z += currentSpeed;

        // When a segment passes behind the camera + buffer, move it to the far end of the road chain
        if (segment.position.z > REPOSITION_THRESHOLD_Z) {
          segment.position.z -= ROAD_LOOP_DISTANCE;

          // Ensure the segment is visible again
          if (segment.material instanceof THREE.Material) {
            segment.material.opacity = 1.0;
            segment.material.transparent = false;
            segment.material.needsUpdate = true;
          }
        }
      });

      // Road Elements (Lines, Dashes)
      roadElementsRef.current.forEach((element) => {
        element.position.z += currentSpeed;

        if (element.position.z > REPOSITION_THRESHOLD_Z) {
          element.position.z -= ROAD_LOOP_DISTANCE;
        }
      });

      // Ground Segments
      groundSegmentsRef.current.forEach((segment) => {
        segment.position.z += currentSpeed;

        if (segment.position.z > REPOSITION_THRESHOLD_Z) {
          segment.position.z -= GROUND_LOOP_DISTANCE;

          // Ensure the segment is visible again with proper material
          if (segment.material instanceof THREE.Material) {
            segment.material.opacity = 1.0;
            segment.material.transparent = false;
            segment.material.needsUpdate = true;
          }
        }
      });

      // Overhead Signs
      overheadSignsRef.current.forEach((signStruct) => {
        const signGroup = signStruct.gantryGroup;
        signGroup.position.z += currentSpeed;

        if (signGroup.position.z > REPOSITION_THRESHOLD_Z) {
          signGroup.position.z -= SIGN_LOOP_DISTANCE;

          // Reset trigger state when a sign loops
          if (lastTriggeredSignRef.current === signGroup) {
            lastTriggeredSignRef.current = null;
          }
        }
      });

      // --- 4. Car-Specific Logic ---
      if (car) {
        // Wheel Rotation
        const wheelNames = [
          "wheel-back-left",
          "wheel-back-right",
          "wheel-front-left",
          "wheel-front-right",
        ];
        wheelNames.forEach((name) =>
          car.getObjectByName(name)?.rotateX(-currentSpeed * 2.5),
        );

        // Sign Trigger Check
        const currentLane = carPositionRef.current;
        let closestSignDistance = Infinity;
        let signToTrigger: THREE.Object3D | null = null;
        overheadSignsRef.current.forEach((signStruct) => {
          const signGroup = signStruct.gantryGroup;
          const signZ = signGroup.position.z;
          if (
            signZ < SIGN_TRIGGER_Z_THRESHOLD &&
            signZ > 0 &&
            signZ < closestSignDistance &&
            signGroup !== lastTriggeredSignRef.current
          ) {
            closestSignDistance = signZ;
            signToTrigger = signGroup;
          }
        });
        if (signToTrigger) {
          // Check if boost is active and deactivate it
          const actuallyBoosting = boostSpeedRef.current > forwardSpeedRef.current * 1.1;

          if (actuallyBoosting) {
            // Stop boost mode immediately - update both state and ref
            setIsBoostActive(false);
            boostSpeedRef.current = forwardSpeedRef.current;
          }

          lastTriggeredSignRef.current = signToTrigger;

          // Check if car is in the center lane (no choice was made)
          if (currentLane === "center") {
            return;
          }

          const isLeft = currentLane === "left";

          // Call the lane selection handler
          if (!isProcessingSelectionRef.current) {
            isProcessingSelectionRef.current = true;

            // Call the appropriate selection handler based on car position
            if (carPositionRef.current === "left") {
              onSelectLeftRef.current();
            } else {
              onSelectRightRef.current();
            }

            // Clear selected lane state and reset processing flag
            setTimeout(() => {
              setTimeout(() => {
                setSelectedLane(null);
              }, 300);

              setTimeout(() => {
                isProcessingSelectionRef.current = false;
              }, 1000);
            }, 100);
          }
        }

        // Lane Change Animation
        if (isMovingRef.current) {
          const elapsed = Date.now() - moveStartTimeRef.current;
          const duration = ANIMATION_DURATION;
          if (elapsed < duration) {
            const t = elapsed / duration;
            const smoothT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            car.position.x =
              moveStartXRef.current +
              (moveTargetXRef.current - moveStartXRef.current) * smoothT;
            const tiltAmount = 0.15;
            const direction =
              moveTargetXRef.current > moveStartXRef.current ? -1 : 1;
            car.rotation.z =
              direction * tiltAmount * Math.sin(Math.PI * smoothT);
          } else {
            car.position.x = moveTargetXRef.current;
            car.rotation.z = 0;
            isMovingRef.current = false;
          }
        }
      } // End car logic

    } // End of if(!isGamePaused) block

    // --- 5. Render (Always render the scene regardless of paused state) ---

    renderer.render(scene, camera);

    // We already requested the next frame at the beginning of this function
    // No need to call requestAnimationFrame again
  }

  // Handler for free roam mode toggle
  const handleFreeRoamToggle = (enabled: boolean) => {
    console.log(`Free Roam Mode ${enabled ? "Enabled" : "Disabled"}`);
    setIsFreeRoamMode(enabled);
  };

  // --- Render Component ---
  // Note: The outer div provides positioning context for all absolutely positioned UI overlays
  // The inner containerRef div is where Three.js mounts the canvas
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* FPS Counter - Toggle with G key */}
      {!isLoading && showFps && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            color: displayFps >= 50 ? "#00ff00" : displayFps >= 30 ? "#ffff00" : "#ff0000",
            padding: "4px 8px",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "14px",
            fontWeight: "bold",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          {displayFps} FPS
        </div>
      )}

      {/* Boost Mode Logic Component */}
      <BoostMode
        isBoostActive={isBoostActive}
        setIsBoostActive={setIsBoostActive}
        baseSpeed={forwardSpeedRef.current}
        boostSpeedRef={boostSpeedRef}
        carRef={carRef}
        sceneRef={sceneRef}
        boostStartTimeRef={boostStartTimeRef}
      />

      {/* Free Roam Camera Controller (No UI, just logic) */}
      <CameraFreeRoamController
        camera={cameraRef.current}
        isEnabled={isFreeRoamMode}
        onToggle={handleFreeRoamToggle}
      />

      {/* Free Roam Mode UI Overlay */}
      <FreeRoamModeOverlay isEnabled={isFreeRoamMode} />

      {/* Game UI at bottom of screen */}
      {!isLoading && !isPaused && (
        <>
          {/* Bottom-left UI container - aligned with left highway sign (fixed at 20px to match sign's final position) */}
          <div
            style={{
              position: "absolute",
              bottom: "2vh",
              left: "20px",
              zIndex: 200,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "8px",
            }}
          >
            {/* Sound toggle button */}
            {onToggleSound && (
              <button
                onClick={onToggleSound}
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.75)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "999px",
                  padding: "0.6rem 1rem",
                  fontSize: "min(2.3vh, 14px)",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
                  pointerEvents: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {isSoundEnabled ? "🔊" : "🔇"} Sound
              </button>
            )}
            
            {/* Score display */}
            <div
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "999px",
                padding: "0.6rem 1.4rem",
                fontFamily: "sans-serif",
                fontSize: "min(2.3vh, 14px)",
                fontWeight: 600,
                textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                pointerEvents: "none",
              }}
            >
              Score {score}/{totalCards}
            </div>

            {/* Exit button */}
            {onExit && (
              <button
                onClick={onExit}
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.75)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "999px",
                  padding: "0.6rem 1.4rem",
                  fontSize: "min(2.3vh, 14px)",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
                  pointerEvents: "auto",
                }}
              >
                Exit Game
              </button>
            )}
          </div>

          {/* Streak indicator bottom-right */}
          <div
            style={{
              position: "absolute",
              bottom: "3vh",
              right: "3vw",
              color: "white",
              zIndex: 150,
              fontFamily: "sans-serif",
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "4px",
              pointerEvents: "none",
            }}
          >
            <StreakFireIndicator
              streak={currentStreak}
              label="Streak"
              variant="compact"
              className="text-white"
            />
            {currentStreak > 0 && (
              <div style={{ fontSize: "min(2vh, 12px)" }}>
                +{streakSpeedBonusPercent}% speed
              </div>
            )}
          </div>

          {/* Current word to translate at bottom center - updates with highway signs */}
          <div
            style={{
              position: "absolute",
              bottom: "3vh",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              color: "white",
              padding: signConfig.padding,
              borderRadius: "8px",
              zIndex: 100,
              fontFamily: "sans-serif",
              fontSize: signConfig.fontSize,
              fontWeight: "bold",
              textAlign: "center",
              minWidth: signConfig.minWidth,
              maxWidth: signConfig.maxWidth,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {word}
          </div>

          {/* RIGHT Sliding highway sign animation using configurable constants */}
          {showSignAnimation && options.length > 1 && (
            <div
              style={{
                position: "absolute",
                top: `${EXIT_BUTTON_VERTICAL_OFFSET_PX}px`,
                right: `${rightSignAnimationPosition}px`,
                backgroundColor: "#009900", // Green highway sign color
                color: "white",
                padding: signConfig.padding,
                borderRadius: "8px",
                zIndex: 200, // Higher z-index to ensure visibility
                fontFamily: "sans-serif",
                fontSize: signConfig.fontSize,
                fontWeight: "bold",
                textAlign: "center",
                minWidth: signConfig.minWidth,
                maxWidth: signConfig.maxWidth,
                height: `${signConfig.height}vh`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
                border: "2px solid #ffffff",
                transition: "right 0.3s ease-out",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {options[1]} {/* Right lane option */}
            </div>
          )}

          {/* LEFT Sliding highway sign animation using configurable constants */}
          {showSignAnimation && options.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: `${EXIT_BUTTON_VERTICAL_OFFSET_PX}px`,
                left: `${leftSignAnimationPosition}px`,
                backgroundColor: "#009900", // Green highway sign color
                color: "white",
                padding: signConfig.padding,
                borderRadius: "8px",
                zIndex: 200, // Higher z-index to ensure visibility
                fontFamily: "sans-serif",
                fontSize: signConfig.fontSize,
                fontWeight: "bold",
                textAlign: "center",
                minWidth: signConfig.minWidth,
                maxWidth: signConfig.maxWidth,
                height: `${signConfig.height}vh`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
                border: "2px solid #ffffff",
                transition: "left 0.3s ease-out",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {options[0]} {/* Left lane option */}
            </div>
          )}

          {/* Feedback is handled by toast notifications and other visual cues */}
        </>
      )}

      {/* Full screen touch controls overlay */}
      <div
        className="touch-controls-overlay"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 50, // Above 3D scene but below UI elements
          display: !isLoading && !isPaused ? "block" : "none",
          pointerEvents: "auto",
        }}
      >
        {/* Left lane touch area */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "50%",
            height: "100%",
            cursor: "pointer",
          }}
          onClick={() => {
            if (
              !isMovingRef.current &&
              !isPausedRef.current &&
              !isFreeRoamMode
            ) {
              console.log("Touch control: Left side clicked");
              if (carPositionRef.current !== "left") moveCar("left");
            }
          }}
        />

        {/* Right lane touch area */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "50%",
            height: "100%",
            cursor: "pointer",
          }}
          onClick={() => {
            if (
              !isMovingRef.current &&
              !isPausedRef.current &&
              !isFreeRoamMode
            ) {
              console.log("Touch control: Right side clicked");
              if (carPositionRef.current !== "right") moveCar("right");
            }
          }}
        />
      </div>

      {/* Three.js Canvas Container - This is where the renderer mounts */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          minHeight: document.fullscreenElement ? "100vh" : "300px",
          border: document.fullscreenElement ? "none" : "1px solid #ccc",
          borderRadius: document.fullscreenElement ? "0" : "8px",
          overflow: "hidden",
          position: "relative",
          backgroundColor: "#333",
        }}
      />

      {/* Loading screen overlay - now using the dedicated component */}
      <LoadingScreen
        isLoading={isLoading}
        assetsLoaded={assetsLoaded}
        totalAssets={totalAssets}
      />

      {/* Pause overlay */}
      {!isLoading && isPaused && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              color: "white",
              fontSize: "24px",
              fontWeight: "bold",
              padding: "16px 24px",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              borderRadius: "8px",
              border: "2px solid white",
            }}
          >
            {loadingProgressRef.current >= totalAssets
              ? "READY TO PLAY"
              : "PAUSED"}
            <div
              style={{
                fontSize: "14px",
                marginTop: "8px",
                textAlign: "center",
              }}
            >
              Press SPACE to{" "}
              {loadingProgressRef.current >= totalAssets ? "start" : "resume"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
