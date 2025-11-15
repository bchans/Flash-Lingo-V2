import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

export interface CameraFreeRoamControllerProps {
  camera: THREE.PerspectiveCamera | null;
  isEnabled: boolean;
  onToggle?: (isEnabled: boolean) => void;
}

// Camera movement speed and rotation speed constants
const MOVEMENT_SPEED = 0.25;
const ROTATION_SPEED = 0.02;

export function CameraFreeRoamController({
  camera,
  isEnabled,
  onToggle,
}: CameraFreeRoamControllerProps) {
  // Internal state for tracking key presses
  const keyStates = useRef<{ [key: string]: boolean }>({
    w: false, // Forward
    a: false, // Left
    s: false, // Backward
    d: false, // Right
    q: false, // Rotate left
    e: false, // Rotate right
  });

  // Store original camera position and rotation to restore when disabling free roam
  const originalCameraState = useRef<{
    position: THREE.Vector3 | null;
    rotation: THREE.Euler | null;
  }>({
    position: null,
    rotation: null,
  });

  // Flag to track if we've stored the original camera state
  const [hasStoredOriginalState, setHasStoredOriginalState] = useState(false);

  // Handler for keydown events
  const handleKeyDown = (e: KeyboardEvent) => {
    // Toggle free roam mode with F key
    if (e.key === "f" || e.key === "F") {
      const newState = !isEnabled;
      if (onToggle) onToggle(newState);
      return;
    }

    // Only process movement keys if free roam is enabled
    if (!isEnabled) return;

    // Update key states
    const key = e.key.toLowerCase();
    if (keyStates.current.hasOwnProperty(key)) {
      keyStates.current[key] = true;
    }
  };

  // Handler for keyup events
  const handleKeyUp = (e: KeyboardEvent) => {
    // Only process if free roam is enabled
    if (!isEnabled) return;

    // Update key states
    const key = e.key.toLowerCase();
    if (keyStates.current.hasOwnProperty(key)) {
      keyStates.current[key] = false;
    }
  };

  // Effect for setting up event listeners when component mounts
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isEnabled]);

  // Effect for storing original camera state when free roam is enabled
  useEffect(() => {
    if (!camera) return;

    if (isEnabled && !hasStoredOriginalState) {
      // Store original camera position and rotation
      originalCameraState.current = {
        position: camera.position.clone(),
        rotation: camera.rotation.clone(),
      };
      setHasStoredOriginalState(true);
      console.log("Free Roam Mode: Enabled - Original camera state stored");
    } else if (!isEnabled && hasStoredOriginalState) {
      // Restore original camera position and rotation
      if (originalCameraState.current.position && originalCameraState.current.rotation) {
        camera.position.copy(originalCameraState.current.position);
        camera.rotation.copy(originalCameraState.current.rotation);
        console.log("Free Roam Mode: Disabled - Original camera state restored");
      }
      setHasStoredOriginalState(false);
    }
  }, [isEnabled, camera, hasStoredOriginalState]);

  // Function to update camera position based on key states
  const updateCameraPosition = () => {
    if (!camera || !isEnabled) return;

    // Create direction vector in local camera space
    const direction = new THREE.Vector3();

    // Forward/backward movement (local Z axis)
    if (keyStates.current.w) direction.z -= MOVEMENT_SPEED;
    if (keyStates.current.s) direction.z += MOVEMENT_SPEED;

    // Left/right movement (local X axis)
    if (keyStates.current.a) direction.x -= MOVEMENT_SPEED;
    if (keyStates.current.d) direction.x += MOVEMENT_SPEED;

    // Apply movement in the camera's local space
    if (direction.length() > 0) {
      // Normalize for consistent movement speed
      direction.normalize().multiplyScalar(MOVEMENT_SPEED);
      
      // Convert direction from local to world space
      direction.applyQuaternion(camera.quaternion);
      
      // Apply movement
      camera.position.add(direction);
    }

    // Handle rotation
    if (keyStates.current.q) {
      camera.rotation.y += ROTATION_SPEED; // Rotate left around Y axis
    }
    if (keyStates.current.e) {
      camera.rotation.y -= ROTATION_SPEED; // Rotate right around Y axis
    }
  };

  // Effect for animation loop to update camera position
  useEffect(() => {
    if (!isEnabled || !camera) return;

    // Animation function
    const animate = () => {
      updateCameraPosition();
      animationRef.current = requestAnimationFrame(animate);
    };

    // Start animation loop
    const animationRef = { current: requestAnimationFrame(animate) };

    // Clean up animation frame on unmount or when disabled
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isEnabled, camera]);

  // Return null as this component doesn't render anything
  return null;
}