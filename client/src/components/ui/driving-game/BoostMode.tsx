import { useEffect, useRef, MutableRefObject } from 'react';
import * as THREE from 'three';

// Constants
export const BOOST_MULTIPLIER = 2.5; // Boost makes the car go 2.5x faster
export const BOOST_MAX_DURATION = 3000; // Maximum boost duration in milliseconds

interface BoostModeProps {
  isBoostActive: boolean;
  setIsBoostActive: (active: boolean) => void;
  baseSpeed: number;
  boostSpeedRef: MutableRefObject<number>;
  carRef: MutableRefObject<THREE.Object3D | null>;
  sceneRef: MutableRefObject<THREE.Scene | null>;
  boostStartTimeRef: MutableRefObject<number>;
}

/**
 * BoostMode component manages the speed boost functionality in the driving game.
 * It handles:
 * 1. Setting the correct speed when boost is activated/deactivated
 * 2. Creating smoke particle effects
 * 3. Tracking boost duration
 */
export const BoostMode: React.FC<BoostModeProps> = ({
  isBoostActive,
  setIsBoostActive,
  baseSpeed,
  boostSpeedRef,
  carRef,
  sceneRef,
  boostStartTimeRef,
}) => {
  // Update boost speed when isBoostActive changes
  useEffect(() => {
    if (isBoostActive) {
      console.log(`Boost activated! Setting speed to ${baseSpeed * BOOST_MULTIPLIER}`);
      boostSpeedRef.current = baseSpeed * BOOST_MULTIPLIER;
      boostStartTimeRef.current = Date.now();
    } else {
      console.log('Boost deactivated! Resetting to base speed');
      boostSpeedRef.current = baseSpeed;
    }
  }, [isBoostActive, baseSpeed, boostSpeedRef, boostStartTimeRef]);

  return null; // This is a logic-only component, no UI needed
};

/**
 * Creates smoke particles behind the car for visual effect during boost
 */
export function createSmokeParticles(
  carRef: MutableRefObject<THREE.Object3D | null>,
  sceneRef: MutableRefObject<THREE.Scene | null>
) {
  // Create smoke particles inline
  if (carRef.current && sceneRef.current) {
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

/**
 * Detects if the boost should end based on proximity to signs
 * Returns true if boost should end, false otherwise
 */
export function shouldEndBoost(
  isBoostActive: boolean,
  overheadSignsRef: MutableRefObject<any[]>,
  boostStartTimeRef: MutableRefObject<number>,
  CAMERA_POSITION_Z: number,
  SIGN_TRIGGER_Z_THRESHOLD: number
): { shouldEnd: boolean; reason: string; debugInfo?: any } {
  if (!isBoostActive) return { shouldEnd: false, reason: 'Boost not active' };
  
  // Find the closest sign ahead of the car
  let closestSignZ = Infinity;
  let closestSignDistance = Infinity;
  
  overheadSignsRef.current?.forEach((signStruct: { gantryGroup: { position: { z: number } } }) => {
    const signZ = signStruct.gantryGroup.position.z;
    // Only consider signs in front of the car
    if (signZ > (CAMERA_POSITION_Z - 10) && signZ < SIGN_TRIGGER_Z_THRESHOLD * 3) {
      const distanceToSign = signZ - (CAMERA_POSITION_Z - 5);
      if (distanceToSign > 0 && distanceToSign < closestSignDistance) {
        closestSignDistance = distanceToSign;
        closestSignZ = signZ;
      }
    }
  });

  // If we're close to a sign or we've been boosting for too long, end the boost
  const boostElapsedTime = Date.now() - boostStartTimeRef.current;
  const signThreshold = SIGN_TRIGGER_Z_THRESHOLD * 1.5;
  
  console.log('BOOST STATUS CHECK:');
  console.log(`- Distance to closest sign: ${closestSignDistance.toFixed(2)}`);
  console.log(`- Sign threshold: ${signThreshold.toFixed(2)}`);
  console.log(`- Time elapsed: ${boostElapsedTime}ms / ${BOOST_MAX_DURATION}ms`);
  console.log(`- Should end by distance: ${closestSignDistance < signThreshold}`);
  console.log(`- Should end by time: ${boostElapsedTime > BOOST_MAX_DURATION}`);

  if (closestSignDistance < signThreshold) {
    console.log('BOOST DEACTIVATING - Reached sign proximity threshold');
    return { 
      shouldEnd: true, 
      reason: 'Reached sign', 
      debugInfo: { closestSignDistance, closestSignZ } 
    };
  }
  
  if (boostElapsedTime > BOOST_MAX_DURATION) {
    console.log('BOOST DEACTIVATING - Maximum duration exceeded');
    return { 
      shouldEnd: true, 
      reason: 'Max duration exceeded', 
      debugInfo: { boostElapsedTime } 
    };
  }
  
  console.log('Boost continuing - No end conditions met');
  return { shouldEnd: false, reason: 'Boost continuing' };
}

/**
 * Handles smoke particle animation and updating
 */
export function animateSmokeParticles(scene: THREE.Scene) {
  if (!scene.userData.smokeParticles || scene.userData.smokeParticles.length === 0) {
    return;
  }
  
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

      // Update position based on velocity
      particle.position.x += particle.userData.velocity.x;
      particle.position.y += particle.userData.velocity.y;
      particle.position.z += particle.userData.velocity.z;

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
}