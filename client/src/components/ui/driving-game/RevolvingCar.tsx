import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCards } from '@/lib/db';

interface RevolvingCarProps {
  width?: number;
  height?: number;
  onCarChange?: (carIndex: number) => void;
}

const CAR_MODELS = [
  { path: '/car.glb', name: 'City Cab', requiredCards: 0 },
  { path: '/car3.glb', name: 'Delivery Car', requiredCards: 10 },
  { path: '/car2.glb', name: 'Ambulance', requiredCards: 20 },
  { path: '/car4.glb', name: 'Police Car', requiredCards: 40 },
  { path: '/car5.glb', name: 'Racing Car', requiredCards: 80 },
  { path: '/car6.glb', name: 'Vintage Car', requiredCards: 160 }
];

export function RevolvingCar({ width = 160, height = 160, onCarChange }: RevolvingCarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const carModelRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [selectedCarIndex, setSelectedCarIndex] = useState(0);
  const [learnedCardsCount, setLearnedCardsCount] = useState(0);
  
  // Function to clean up resources
  const cleanupResources = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (rendererRef.current && rendererRef.current.domElement && containerRef.current) {
      try {
        if (rendererRef.current.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      } catch (error) {
        console.warn('Could not remove renderer DOM element:', error);
      }
      rendererRef.current.dispose();
    }
  };

  const isCarUnlocked = (carIndex: number) => {
    return learnedCardsCount >= CAR_MODELS[carIndex].requiredCards;
  };

  const handleCarChange = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'next' 
      ? (selectedCarIndex + 1) % CAR_MODELS.length
      : (selectedCarIndex - 1 + CAR_MODELS.length) % CAR_MODELS.length;
    
    setSelectedCarIndex(newIndex);
    
    // Always call onCarChange to update the speed indicator
    // The actual car used in gameplay will be determined elsewhere based on unlock status
    onCarChange?.(newIndex);
  };

  // Load learned cards count on mount
  useEffect(() => {
    const loadLearnedCardsCount = async () => {
      try {
        const cards = await getCards();
        const learnedCount = cards.filter(card => card.learned).length;
        setLearnedCardsCount(learnedCount);
      } catch (error) {
        console.error('Error loading learned cards count:', error);
      }
    };
    
    loadLearnedCardsCount();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Clean up any existing scene
    cleanupResources();
    
    // --- Scene ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x222222);
    
    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    cameraRef.current = camera;
    camera.position.set(0, 1.5, 5);
    camera.lookAt(0, 0.5, 0);
    
    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Add some rim light from behind
    const rimLight = new THREE.DirectionalLight(0x9eafff, 1);
    rimLight.position.set(-5, 3, -5);
    scene.add(rimLight);
    
    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    
    // Add to container
    container.appendChild(renderer.domElement);
    
    // --- Add a simple ground plane ---
    const groundGeometry = new THREE.PlaneGeometry(10, 10);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // --- Load Car Model ---
    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    
    // First load the texture palette
    const carTexture = textureLoader.load('/kenney_car_palette.png', (texture) => {
      console.log('Car texture palette loaded');
      texture.flipY = false; // Important for GLB/GLTF format
    });
      
    // Load car model based on selected index
    const loadCarModel = () => {
      // Remove existing car model
      if (carModelRef.current) {
        scene.remove(carModelRef.current);
        carModelRef.current = null;
      }
      
      loader.load(
        CAR_MODELS[selectedCarIndex].path,
        (gltf) => {
          const carModel = gltf.scene;
          carModelRef.current = carModel;
          
          // Scale the model to fit the scene
          carModel.scale.set(0.5, 0.5, 0.5);
          
          // Center model
          carModel.position.set(0, 0, 0);
          
          // Apply the texture to all materials in the car
          carModel.traverse((node) => {
            if (node instanceof THREE.Mesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              
              // If the node has a material, apply our texture
              if (node.material) {
                // Create a new MeshStandardMaterial with the texture
                const newMaterial = new THREE.MeshStandardMaterial({
                  map: carTexture,
                  roughness: 0.7,
                  metalness: 0.3,
                });
                
                // Apply the new material
                node.material = newMaterial;
              }
            }
          });
          
          // Add to scene
          scene.add(carModel);
          
          // Rotate to face front
          carModel.rotation.y = Math.PI;
          
          // Position camera to focus on the car
          const box = new THREE.Box3().setFromObject(carModel);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          // Adjust camera to view the entire model
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * (Math.PI / 180);
          let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
          
          // Adjust position with some padding
          camera.position.set(center.x, center.y + size.y * 0.5, center.z + cameraZ * 1.2);
          camera.lookAt(center.x, center.y, center.z);
          
          // Start animation
          animate();
        },
        undefined,
        (error) => {
          console.error('Error loading car model:', error);
          // Create fallback car and start animation
          createFallbackCar();
          animate();
        }
      );
    };
    
    // Fallback function to create a simple car if the model fails to load
    const createFallbackCar = () => {
      // Car body
      const bodyGeometry = new THREE.BoxGeometry(2, 0.6, 4);
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3366ff });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.position.y = 0.5;
      body.castShadow = true;
      
      // Cabin
      const cabinGeometry = new THREE.BoxGeometry(1.5, 0.6, 2);
      const cabinMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
      cabin.position.set(0, 1.1, -0.2);
      cabin.castShadow = true;
      
      // Wheels
      const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
      const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
      
      const wheelPositions = [
        [-0.8, 0.3, 1.2],
        [0.8, 0.3, 1.2],
        [-0.8, 0.3, -1.2],
        [0.8, 0.3, -1.2]
      ];
      
      wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(pos[0], pos[1], pos[2]);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        body.add(wheel);
      });
      
      const fallbackCar = new THREE.Group();
      fallbackCar.add(body);
      fallbackCar.add(cabin);
      
      carModelRef.current = fallbackCar;
      scene.add(fallbackCar);
    };
    
    // Animation loop
    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;
      
      // Rotate the car
      if (carModelRef.current) {
        carModelRef.current.rotation.y += 0.01;
      }
      
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    // Load the initial car model
    loadCarModel();
    
    // Clean up on unmount
    return () => {
      cleanupResources();
    };
  }, [selectedCarIndex, width, height]);

  return (
    <div className="relative">
      {/* Car name display */}
      <div className="text-center mb-2">
        <div className="font-medium text-sm flex items-center justify-center gap-2">
          {CAR_MODELS[selectedCarIndex].name}
          {!isCarUnlocked(selectedCarIndex) && <Lock className="h-3 w-3" />}
        </div>
        <div className="text-xs text-muted-foreground">
          {isCarUnlocked(selectedCarIndex) 
            ? `${selectedCarIndex + 1} of ${CAR_MODELS.length}`
            : `Unlock with ${CAR_MODELS[selectedCarIndex].requiredCards} learned cards`}
        </div>
      </div>
      
      {/* Car display with side arrows */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleCarChange('prev')}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        {/* 3D Car Display */}
        <div className="relative">
          <div 
            ref={containerRef}
            style={{ 
              width: `${width}px`, 
              height: `${height}px`, 
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          />
          {/* Lock Overlay for locked cars */}
          {!isCarUnlocked(selectedCarIndex) && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <Lock className="h-8 w-8 text-white/80 mx-auto mb-2" />
                <div className="text-white/80 text-xs font-medium">
                  {CAR_MODELS[selectedCarIndex].requiredCards - learnedCardsCount} more cards needed
                </div>
              </div>
            </div>
          )}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleCarChange('next')}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}