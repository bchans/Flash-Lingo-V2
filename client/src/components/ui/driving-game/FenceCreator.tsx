// FenceCreator.tsx - Dedicated component for creating fence structures
// This component handles perpendicular fences that extend along the X axis

import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getAssetUrl } from "@/lib/asset-utils";

// Configuration constants to control fence appearance and placement
export interface PerpFenceConfig {
    // Position adjustments
    xAxisOffset: number; // Move entire fence structure along X axis
    zAxisOffset: number; // Move entire fence structure along Z axis

    // Fence segment configuration
    segmentSpacing: number; // Gap between individual fence segments
    segmentsPerFence: number; // Number of segments in each perpendicular fence

    // Scale and appearance
    fenceScale: number; // Scale applied to fence segments (default: 1.5)
}

// Default configuration values that can be easily adjusted
export const PERP_FENCE_SEGMENT_SPACING = 1.5; // Distance between fence segments (increased from 4.0)
export const PERP_FENCE_SEGMENT_COUNT = 6; // Number of segments in perpendicular fence (increased from 3)
export const PERP_FENCE_SCALE = 1.5; // Fence scaling factor (increased from 1.5)

// Default configuration values as an object (for API compatibility)
export const DEFAULT_PERP_FENCE_CONFIG: PerpFenceConfig = {
    xAxisOffset: 0.0, // Base offset from house (handled by side-specific offsets)
    zAxisOffset: 0.0, // Standard Z offset (handled by side-specific offsets)
    segmentSpacing: PERP_FENCE_SEGMENT_SPACING, // Use the constant defined above
    segmentsPerFence: PERP_FENCE_SEGMENT_COUNT, // Use the constant defined above
    fenceScale: PERP_FENCE_SCALE, // Use the constant defined above
};

// Side-specific X offsets
const LEFT_SIDE_X_OFFSET = -1.6; // Negative for left side
const RIGHT_SIDE_X_OFFSET = 1.15; // Positive for right side

// Side-specific Z offsets
const LEFT_SIDE_Z_OFFSET = 2.0; // Further back
const RIGHT_SIDE_Z_OFFSET = 2.0; // Further forward

// Interface for the building instances tracking in SceneryManager
export interface BuildingInstance {
    group: THREE.Object3D;
    initialZ: number;
    initialX: number;
    userData?: {
        updatedForLevel?: number;
        buildingType?: string;
        type?: string;
        visibilityDistance?: number;
        loopDistance?: number;
        useDirectPositionUpdate?: boolean;
        [key: string]: any;
    };
}

export class FenceCreator {
    private scene: THREE.Scene | null = null;
    private gltfLoader = new GLTFLoader();
    private textureLoader = new THREE.TextureLoader();
    private buildingInstances: BuildingInstance[] = [];
    private sceneryLoopDistance: number;

    constructor(
        scene: THREE.Scene,
        buildingInstances: BuildingInstance[],
        sceneryLoopDistance: number,
    ) {
        this.scene = scene;
        this.buildingInstances = buildingInstances;
        this.sceneryLoopDistance = sceneryLoopDistance;
    }

    /**
     * Creates a perpendicular fence extending along X axis
     * @param originX Starting X position for the fence
     * @param originZ Z position for the fence
     * @param config Configuration options for fence appearance
     */
    public createPerpedicularFence(
        originX: number,
        originZ: number,
        side: number, // -1 for left, 1 for right
        config: PerpFenceConfig = DEFAULT_PERP_FENCE_CONFIG,
    ): void {
        if (!this.scene) {
            console.error(
                "FenceCreator: Cannot create fence - scene is not initialized.",
            );
            return;
        }

        // Ensure scene is definitely non-null for TypeScript
        const scene = this.scene;

        // Load the fence model
        this.gltfLoader.load(getAssetUrl("buildings/fence.glb"), (fenceGltf) => {
            // Load fence texture
            const fenceTexture = this.textureLoader.load(
                getAssetUrl("textures/colormaptree.png"),
                () => console.log("Perp Fence Texture: loaded successfully"),
                undefined,
                (err) => console.error("Failed to load fence texture", err),
            );

            // Configure texture properties
            fenceTexture.flipY = false;
            fenceTexture.magFilter = THREE.NearestFilter;
            fenceTexture.minFilter = THREE.NearestFilter;

            // Helper function to apply texture to a fence segment
            const applyFenceTexture = (segment: THREE.Group) => {
                segment.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                        if (
                            child.material instanceof THREE.MeshStandardMaterial
                        ) {
                            child.material = child.material.clone();
                            child.material.map = fenceTexture;
                            child.material.needsUpdate = true;
                        }
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
            };

            // Calculate gate position which will be our base reference
            const gateX =
                originX +
                (side === -1 ? LEFT_SIDE_X_OFFSET : RIGHT_SIDE_X_OFFSET);
            const gateZOffset =
                side === -1 ? LEFT_SIDE_Z_OFFSET : RIGHT_SIDE_Z_OFFSET;
            const gateZ = originZ + gateZOffset;

            // Create fence segments based on configuration, starting from the gate position
            for (let i = 0; i < config.segmentsPerFence; i++) {
                // Clone the fence model for this segment
                const fenceSegment = fenceGltf.scene.clone();

                // Apply texture to the segment
                applyFenceTexture(fenceSegment);

                // Calculate position for this segment with consistent spacing using gateX and gateZ
                const segmentX = gateX + i * config.segmentSpacing * side;
                const segmentZ = gateZ;

                // Position and scale the fence segment
                fenceSegment.position.set(segmentX, 0, segmentZ);
                fenceSegment.scale.set(
                    config.fenceScale,
                    config.fenceScale,
                    config.fenceScale,
                );

                // Rotate to extend along X axis with correct orientation for each side
                // Left side (-1): Math.PI (180 degrees) to face away from road
                // Right side (1): -Math.PI (-90 degrees) to face away from road
                fenceSegment.rotation.y = side === -1 ? Math.PI : -Math.PI;

                // Add to scene
                scene.add(fenceSegment);

                // Store for animation/recycling
                this.storeFenceSegment(fenceSegment, segmentX, segmentZ);

                console.log(
                    `PERP X-FENCE: Created segment ${i} at x=${segmentX.toFixed(2)}, z=${segmentZ.toFixed(2)}`,
                );
            }
        });
    }

    /**
     * Stores a fence segment in the building instances array for animation
     */
    private storeFenceSegment(
        segment: THREE.Group,
        posX: number,
        posZ: number,
    ): void {
        if (!this.buildingInstances) return;

        // Add to the building instances array for animation/recycling
        this.buildingInstances.push({
            group: segment,
            initialZ: posZ,
            initialX: posX,
            userData: {
                type: "perp-x-fence",
                useDirectPositionUpdate: false,
                visibilityDistance: 400,
                loopDistance: this.sceneryLoopDistance,
            },
        });
    }

    /**
     * Creates connected perp fence that attaches to an existing fence at a house
     * @param houseX X position of the house
     * @param houseZ Z position of the house
     * @param side Side of the road (-1 for left, 1 for right)
     * @param config Configuration options for fence appearance
     */
    public createConnectedPerpFence(
        houseX: number,
        houseZ: number,
        side: number, // -1 for left, 1 for right
        config: PerpFenceConfig = DEFAULT_PERP_FENCE_CONFIG,
    ): void {
        // Pass house position directly to createPerpedicularFence
        // The perpendicular fence method will apply all necessary offsets

        // Create the fence extending outward from the house
        this.createPerpedicularFence(houseX, houseZ, side, {
            ...config,
            // Ensure we're using the proper configuration values
            segmentsPerFence: config.segmentsPerFence,
            segmentSpacing: config.segmentSpacing,
            fenceScale: config.fenceScale,
        });
    }
}
