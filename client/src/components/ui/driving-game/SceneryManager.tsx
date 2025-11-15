// src/SceneryManager.tsx

// --- CORRECT IMPORTS for TypeScript/Three.js ---
import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RefObject } from "react";
import { FenceCreator, PerpFenceConfig } from "./FenceCreator";
// --- END CORRECT IMPORTS ---

// --- Configuration ---
const NUM_BUILDINGS = 20;
const NUM_TREES = 30; // Number of trees to place around the scene
const NUM_LIGHTPOSTS = 5; // Number of lightposts to place along the boardwalk
const PATH_OFFSET = 9.0; // Distance from road centerline to path center
const BUILDING_FOOTPRINT_Z_ESTIMATE = 5.0;
const SCENERY_LOOP_DISTANCE_BUILDINGS =
    BUILDING_FOOTPRINT_Z_ESTIMATE * NUM_BUILDINGS;
const SIDE_OFFSET_MIN = 7.5; // Balanced distance - visible but not too close to the road
const SIDE_OFFSET_RANDOM = 0.3; // Reduced from 0.5 for more consistent placement
const BUILDING_PART_HEIGHT_ESTIMATE = 2.0; // ESTIMATE - Height of one floor part - ADJUST!
const BUILDING_SCALE_FACTOR = 1.5;
const BOARDWALK_WIDTH = 4.0; // Width of the boardwalk
const BOARDWALK_OFFSET = 8.0; // Distance from road centerline to boardwalk centerline
const LIGHTPOST_OFFSET = 6.5; // Distance from road centerline to lightpost
const LIGHTPOST_SPACING = 20.0; // Distance between lightposts

// Standard visibility distance for all assets (for consistent line of sight)
const STANDARD_VISIBILITY_DISTANCE = 600; // Use the same value as house implementation

// Road related constants to match DrivingGameScene.tsx exactly
const NUM_ROAD_SEGMENTS = 8; // Must match DrivingGameScene.tsx
const ROAD_LENGTH_UNIT = 100;
const ROAD_SEGMENT_LENGTH = ROAD_LENGTH_UNIT * 0.5; // 50 - smaller segments
const ROAD_LOOP_DISTANCE = ROAD_SEGMENT_LENGTH * NUM_ROAD_SEGMENTS; // 400
const REPOSITION_THRESHOLD_Z = 50; // Point to trigger loop, must match DrivingGameScene.tsx exactly
const SCENERY_REPOSITION_THRESHOLD_Z = 5; // Separate threshold for scenery assets
const FORWARD_SPEED = 0.15; // Must match DrivingGameScene.tsx exactly

// X-axis perpendicular fence constants
// Import fence configuration from FenceCreator to ensure consistent values
import {
    DEFAULT_PERP_FENCE_CONFIG,
    PERP_FENCE_SEGMENT_SPACING,
    PERP_FENCE_SEGMENT_COUNT,
    PERP_FENCE_SCALE,
} from "./FenceCreator";

// --- Asset Paths (Relative to /public folder) ---
const BUILDING_PALETTE_TEXTURE_PATH = "/textures/colormap.png";
// Full list of parts to attempt loading
const BUILDING_PART_FILES: string[] = [
    "/buildings/window-white-wide.glb",
    // Samples & Steps
    "/buildings/building-edges-door.glb",
    "/buildings/building-sample-house-a.glb",
    "/buildings/building-sample-house-b.glb",
    "/buildings/building-sample-house-c.glb",
    "/buildings/building-sample-tower-a.glb",
    "/buildings/building-sample-tower-b.glb",
    "/buildings/building-sample-tower-c.glb",
    "/buildings/building-sample-tower-d.glb",
    "/buildings/building-steps-narrow.glb",
    "/buildings/building-steps-narrow-windows.glb",
    "/buildings/building-steps-narrow-windows-round.glb",
    "/buildings/building-steps-wide.glb",
];

// --- EXACT Filename Lists Based on User Rules ---
const exactGroundFloorOnlyNames: ReadonlySet<string> = new Set([]);

const exactGroundOrMiddleFloorNames: ReadonlySet<string> = new Set([]);

const exactMiddleFloorOnlyNames: ReadonlySet<string> = new Set([
    "/buildings/building-window-balcony.glb",
]);

const exactRoofGable1x1Names: ReadonlySet<string> = new Set([
    "/buildings/roof-gable.glb",
]);

const exactSampleBuildingNames: ReadonlySet<string> = new Set([
    "/buildings/building-sample-house-a.glb",
    "/buildings/building-sample-house-b.glb",
    "/buildings/building-sample-house-c.glb",
    "/buildings/building-sample-tower-a.glb",
    "/buildings/building-sample-tower-b.glb",
    "/buildings/building-sample-tower-c.glb",
    "/buildings/building-sample-tower-d.glb",
]);

interface BuildingPart {
    name: string;
    scene: THREE.Group;
}
interface BuildingInstance {
    group: THREE.Object3D; // Changed from THREE.Group to THREE.Object3D to support both Groups and Meshes
    initialZ: number;
    initialX: number;
    userData?: {
        updatedForLevel?: number;
        buildingType?: string;
        [key: string]: any;
    };
}

export class SceneryManager {
    private scene: THREE.Scene | null = null;
    private totalDistanceScrolledRef: RefObject<number> | null = null;
    private progressPercentage: number = 0;
    private buildingPaletteTexture: THREE.Texture | null = null;
    private loadedParts: Map<string, BuildingPart> = new Map();
    private buildingInstances: BuildingInstance[] = [];
    private fenceCreator: FenceCreator | null = null;

    // --- Categorized part name arrays (populated by categorizeParts) ---
    private groundFloorPartNames: string[] = [];
    private middleFloorPartNames: string[] = []; // Combined list for random selection
    private middleFloorBalconyNames: string[] = []; // Kept separate for specific logic/chance
    private roof1x1PartNames: string[] = [];
    private sampleBuildingPartNames: string[] = [];

    private gltfLoader = new GLTFLoader();
    private textureLoader = new THREE.TextureLoader();
    private assetsLoaded = false;
    private buildingsCreated = false;
    private disposalTimeoutId: NodeJS.Timeout | null = null;

    // --- Initialization ---
    async initialize(
        scene: THREE.Scene,
        totalDistanceScrolledRef: RefObject<number>,
        initialProgress: number = 0,
    ) {
        console.log("SceneryManager: Initializing...");
        this.scene = scene;
        this.totalDistanceScrolledRef = totalDistanceScrolledRef;
        this.progressPercentage = initialProgress;
        this.assetsLoaded = false;
        this.buildingsCreated = false;
        this.loadedParts.clear();
        this.buildingInstances = [];
        if (this.disposalTimeoutId) clearTimeout(this.disposalTimeoutId);

        this.fenceCreator = new FenceCreator(
            scene,
            this.buildingInstances,
            SCENERY_LOOP_DISTANCE_BUILDINGS,
        );

        try {
            await this.loadAssets();
            if (this.assetsLoaded && this.loadedParts.size > 0) {
                this.categorizeParts();
                this.createInitialBuildings();
                this.createBenchesAlongRoad();
                this.createFoliageAroundBuildings();
                this.createBoardwalk();
                this.createLightposts();
            } else {
                console.warn(
                    "SceneryManager: Initialization skipped - asset loading incomplete.",
                );
            }
        } catch (error) {
            console.error(
                "SceneryManager: Initialization failed critically.",
                error,
            );
            throw error;
        }
    }

    private async loadAssets(): Promise<void> {
        if (this.assetsLoaded) return;
        console.log("SceneryManager: Loading assets...");
        try {
            console.log(
                `SceneryManager: Attempting to load palette texture from ${BUILDING_PALETTE_TEXTURE_PATH}`,
            );
            this.buildingPaletteTexture = await this.textureLoader.loadAsync(
                BUILDING_PALETTE_TEXTURE_PATH,
            );
            this.buildingPaletteTexture.flipY = false;
            this.buildingPaletteTexture.magFilter = THREE.NearestFilter;
            this.buildingPaletteTexture.minFilter = THREE.NearestFilter;
            console.log("SceneryManager: Palette texture loaded successfully.");
        } catch (error) {
            console.error(
                `SceneryManager: WARNING - Failed to load palette texture ${BUILDING_PALETTE_TEXTURE_PATH}. Buildings may be untextured.`,
                error,
            );
            this.buildingPaletteTexture = null;
        }
        if (
            !Array.isArray(BUILDING_PART_FILES) ||
            BUILDING_PART_FILES.length === 0
        ) {
            console.error("SceneryManager: BUILDING_PART_FILES is invalid.");
            this.assetsLoaded = true;
            return;
        }
        console.log(
            `SceneryManager: Attempting to load ${BUILDING_PART_FILES.length} building parts...`,
        );

        const loadPromises: Promise<GLTF | null>[] = [];
        const sampleHouseFiles = [
            "/buildings/building-sample-house-a.glb",
            "/buildings/building-sample-house-b.glb",
            "/buildings/building-sample-house-c.glb",
            "/buildings/building-sample-tower-a.glb",
            "/buildings/building-sample-tower-b.glb",
            "/buildings/building-sample-tower-c.glb",
            "/buildings/building-sample-tower-d.glb",
        ];

        for (const file of sampleHouseFiles) {
            const promise = this.gltfLoader.loadAsync(file).catch((err) => {
                console.error(
                    `SceneryManager: Failed to load building part ${file}`,
                    err,
                );
                return null;
            });
            loadPromises.push(promise);
        }

        const results = await Promise.all(loadPromises);
        let loadedCount = 0;
        results.forEach((gltf, index) => {
            if (gltf) {
                loadedCount++;
                if (this.buildingPaletteTexture) {
                    gltf.scene.traverse((child) => {
                        if (child instanceof THREE.Mesh && child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach((mat) => {
                                    if (
                                        mat instanceof
                                            THREE.MeshStandardMaterial &&
                                        !mat.map &&
                                        this.buildingPaletteTexture
                                    ) {
                                        mat.map = this.buildingPaletteTexture;
                                        mat.needsUpdate = true;
                                    }
                                });
                            } else if (
                                child.material instanceof
                                    THREE.MeshStandardMaterial &&
                                !child.material.map &&
                                this.buildingPaletteTexture
                            ) {
                                child.material.map =
                                    this.buildingPaletteTexture;
                                child.material.needsUpdate = true;
                            }
                        }
                    });
                }
                this.loadedParts.set(sampleHouseFiles[index], {
                    name: sampleHouseFiles[index],
                    scene: gltf.scene,
                });
            }
        });
        if (loadedCount === 0 && BUILDING_PART_FILES.length > 0) {
            this.assetsLoaded = false;
            console.error(
                "SceneryManager: CRITICAL - No building parts geometry loaded.",
            );
        } else {
            this.assetsLoaded = true;
        }
        console.log(
            `SceneryManager: ${loadedCount} / ${BUILDING_PART_FILES.length} building parts processed.`,
        );
    }

    private applyPaletteTexture(
        material: THREE.Material | THREE.Material[],
    ): void {
        if (!this.buildingPaletteTexture) return;
        const apply = (mat: THREE.Material) => {
            if (
                mat instanceof THREE.MeshStandardMaterial ||
                mat instanceof THREE.MeshBasicMaterial ||
                mat instanceof THREE.MeshPhysicalMaterial
            ) {
                if (!mat.map) {
                    mat.map = this.buildingPaletteTexture;
                    mat.needsUpdate = true;
                }
            }
        };
        if (Array.isArray(material)) {
            material.forEach(apply);
        } else {
            apply(material);
        }
    }

    private categorizeParts(): void {
        this.groundFloorPartNames = [];
        this.middleFloorPartNames = [];
        this.middleFloorBalconyNames = [];
        this.roof1x1PartNames = [];
        this.sampleBuildingPartNames = [];

        const loadedKeys = Array.from(this.loadedParts.keys());
        console.log(`TOWER DEBUG: Loaded keys: ${loadedKeys.join(", ")}`);

        const towerBuildingPaths = [
            "/buildings/building-sample-tower-a.glb",
            "/buildings/building-sample-tower-b.glb",
            "/buildings/building-sample-tower-c.glb",
            "/buildings/building-sample-tower-d.glb",
        ];

        console.log(`TOWER DEBUG: Looking specifically for tower models...`);
        for (const towerPath of towerBuildingPaths) {
            if (!this.loadedParts.has(towerPath)) {
                console.log(
                    `TOWER DEBUG: Tower model ${towerPath} not found in loaded parts. Attempting to load it now.`,
                );
                this.gltfLoader.load(
                    towerPath,
                    (gltf) => {
                        console.log(
                            `TOWER DEBUG: Successfully loaded tower model ${towerPath}`,
                        );
                        this.loadedParts.set(towerPath, {
                            name: towerPath,
                            scene: gltf.scene,
                        });
                        this.sampleBuildingPartNames.push(towerPath);
                    },
                    undefined,
                    (error) => {
                        console.error(
                            `TOWER DEBUG: Failed to load tower model ${towerPath}`,
                            error,
                        );
                    },
                );
            } else {
                console.log(
                    `TOWER DEBUG: Tower model ${towerPath} already loaded.`,
                );
                this.sampleBuildingPartNames.push(towerPath);
            }
        }

        for (const name of loadedKeys) {
            if (exactGroundFloorOnlyNames.has(name)) {
                this.groundFloorPartNames.push(name);
            } else if (exactGroundOrMiddleFloorNames.has(name)) {
                this.middleFloorPartNames.push(name);
            } else if (exactMiddleFloorOnlyNames.has(name)) {
                this.middleFloorBalconyNames.push(name);
                this.middleFloorPartNames.push(name);
            } else if (exactRoofGable1x1Names.has(name)) {
                this.roof1x1PartNames.push(name);
            } else if (exactSampleBuildingNames.has(name)) {
                if (!this.sampleBuildingPartNames.includes(name)) {
                    this.sampleBuildingPartNames.push(name);
                }
            }
        }

        const towerModels = this.sampleBuildingPartNames.filter((name) =>
            name.includes("tower"),
        );
        console.log(
            `Categorized parts: ${this.groundFloorPartNames.length} ground, ${this.middleFloorPartNames.length} middle (incl ${this.middleFloorBalconyNames.length} balconies), ${this.roof1x1PartNames.length} roof1x1, ${this.sampleBuildingPartNames.length} samples (including ${towerModels.length} towers).`,
        );

        console.log(
            `TOWER DEBUG: Tower models found: ${towerModels.join(", ")}`,
        );

        if (
            this.groundFloorPartNames.length === 0 ||
            this.middleFloorPartNames.length === 0 ||
            this.roof1x1PartNames.length === 0
        ) {
            console.warn(
                "SceneryManager: Missing essential parts for MODULAR assembly based on exact lists.",
            );
        }
        if (this.sampleBuildingPartNames.length === 0) {
            console.warn(
                "SceneryManager: No sample buildings loaded based on exact lists.",
            );
        }
    }

    private assembleBuilding(): THREE.Group | null {
        if (this.sampleBuildingPartNames.length === 0) {
            console.error("Cannot assemble building: No sample parts loaded");
            return null;
        }

        const building = new THREE.Group();
        const isSecondHalf = this.progressPercentage >= 50;

        console.log(
            `BUILDING ASSEMBLY: Creating building - isSecondHalf=${isSecondHalf}, progressPercentage=${this.progressPercentage}%`,
        );

        const availableBuildingNames = this.sampleBuildingPartNames.filter(
            (name) => {
                const isTower = name.includes("tower");
                return isSecondHalf ? isTower : !isTower;
            },
        );

        if (availableBuildingNames.length === 0) {
            console.warn(
                `BUILDING ASSEMBLY: No suitable buildings for current progress: ${this.progressPercentage}%. Falling back to any sample building.`,
            );
            const randomIndex = Math.floor(
                Math.random() * this.sampleBuildingPartNames.length,
            );
            const fallbackName = this.sampleBuildingPartNames[randomIndex];
            console.log(`BUILDING ASSEMBLY: Falling back to ${fallbackName}`);
            const part = this.loadedParts.get(fallbackName);
            if (part && part.scene) {
                const clonedScene = part.scene.clone();
                building.add(clonedScene);
            } else {
                return null;
            }
        } else {
            const randomIndex = Math.floor(
                Math.random() * availableBuildingNames.length,
            );
            const selectedName = availableBuildingNames[randomIndex];

            console.log(
                `BUILDING ASSEMBLY: Selected ${selectedName} from ${availableBuildingNames.length} matching buildings`,
            );

            const part = this.loadedParts.get(selectedName);
            if (part && part.scene) {
                const clonedScene = part.scene.clone();
                building.add(clonedScene);
            } else {
                console.error(`Part not found for ${selectedName}`);
                return null;
            }
        }

        if (this.buildingPaletteTexture) {
            building.traverse((child) => {
                if (child instanceof THREE.Mesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat) => {
                            if (
                                mat instanceof THREE.MeshStandardMaterial &&
                                !mat.map
                            ) {
                                mat.map = this.buildingPaletteTexture;
                                mat.needsUpdate = true;
                            }
                        });
                    } else if (
                        child.material instanceof THREE.MeshStandardMaterial &&
                        !child.material.map
                    ) {
                        child.material.map = this.buildingPaletteTexture;
                        child.material.needsUpdate = true;
                    }
                }
            });
        }

        building.scale.set(
            BUILDING_SCALE_FACTOR,
            BUILDING_SCALE_FACTOR,
            BUILDING_SCALE_FACTOR,
        );
        building.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        building.userData.isManagedBySceneryManager = true;

        return building;
    }

    private createInitialBuildings(): void {
        if (!this.scene || this.buildingsCreated || !this.assetsLoaded) return;

        if (this.sampleBuildingPartNames.length === 0) {
            console.error(
                "SceneryManager: Cannot create buildings - no sample houses available.",
            );
            this.buildingsCreated = true;
            return;
        }

        if (
            this.groundFloorPartNames.length === 0 ||
            this.middleFloorPartNames.length === 0 ||
            this.roof1x1PartNames.length === 0
        ) {
            console.warn(
                "SceneryManager: Missing building parts for tower buildings - will use sample houses only.",
            );
        }
        console.log("SceneryManager: Creating initial buildings in rows...");

        const placedBuildings: { x: number; z: number; side: number }[] = [];
        const MIN_BUILDING_DISTANCE = BUILDING_FOOTPRINT_Z_ESTIMATE + 12;
        let lastZ = 0;
        const OPTIMAL_MIN_DISTANCE = 16;
        const OPTIMAL_MAX_DISTANCE = 22;

        for (let i = 0; i < NUM_BUILDINGS; i++) {
            const buildingGroup = this.assembleBuilding();
            if (!buildingGroup) continue;

            const side = i % 2 === 0 ? -1 : 1;
            const initialX =
                side *
                (OPTIMAL_MIN_DISTANCE +
                    Math.random() *
                        (OPTIMAL_MAX_DISTANCE - OPTIMAL_MIN_DISTANCE));
            let initialZ =
                lastZ - (BUILDING_FOOTPRINT_Z_ESTIMATE + 8 + Math.random() * 4);

            const sameSlideBuildings = placedBuildings.filter(
                (b) => b.side === side,
            );
            let tooClose = false;

            if (sameSlideBuildings.length > 0) {
                let attempts = 0;
                const MAX_ATTEMPTS = 5;

                do {
                    tooClose = false;
                    for (const building of sameSlideBuildings) {
                        const distance = Math.abs(building.z - initialZ);
                        if (distance < MIN_BUILDING_DISTANCE) {
                            tooClose = true;
                            initialZ = initialZ - MIN_BUILDING_DISTANCE / 2;
                            break;
                        }
                    }

                    attempts++;
                } while (tooClose && attempts < MAX_ATTEMPTS);

                if (tooClose) {
                    console.log(
                        `SceneryManager: Could not place building ${i} without overlap after ${MAX_ATTEMPTS} attempts.`,
                    );
                }
            }

            placedBuildings.push({
                x: initialX,
                z: initialZ,
                side: side,
            });

            buildingGroup.position.set(initialX, 0, initialZ);
            buildingGroup.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;

            buildingGroup.userData.initialZ = initialZ;
            buildingGroup.userData.initialX = initialX;
            buildingGroup.userData.buildingType = "sample";
            buildingGroup.userData.isManagedBySceneryManager = true;

            this.scene.add(buildingGroup);
            this.createRoadFromHouseToBoardwalk(initialX, initialZ, side);

            const buildingInstance = {
                group: buildingGroup,
                initialZ,
                initialX,
                userData: {
                    buildingType: "sample",
                },
            };
            this.buildingInstances.push(buildingInstance);

            lastZ = initialZ;
        }
        this.buildingsCreated = true;
        console.log(
            `SceneryManager: Created ${this.buildingInstances.length} building instances.`,
        );
    }

    private createBenchesAlongRoad(): void {
        if (!this.scene) return;
        console.log("SceneryManager: Creating benches next to lightposts...");

        this.gltfLoader.load("/buildings/bench.glb", (gltf) => {
            const treeTexture = this.textureLoader.load(
                "/textures/colormaptree.png",
                () =>
                    console.log(
                        "Bench Texture: colormaptree.png loaded successfully via shared loader.",
                    ),
                undefined,
                (err) =>
                    console.error(
                        "Bench Texture: FAILED to load colormaptree.png via shared loader!",
                        err,
                    ),
            );

            treeTexture.flipY = false;
            treeTexture.magFilter = THREE.NearestFilter;
            treeTexture.minFilter = THREE.NearestFilter;

            for (let i = 0; i < NUM_LIGHTPOSTS; i++) {
                const zPos = -i * LIGHTPOST_SPACING;

                const leftBench = gltf.scene.clone();
                leftBench.scale.set(1, 1, 1);

                const rightBench = gltf.scene.clone();
                rightBench.scale.set(2, 2, 2);

                leftBench.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                        if (
                            child.material instanceof THREE.MeshStandardMaterial
                        ) {
                            child.material = child.material.clone();
                            child.material.map = treeTexture;
                            child.material.needsUpdate = true;
                        }
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                rightBench.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                        if (
                            child.material instanceof THREE.MeshStandardMaterial
                        ) {
                            child.material = child.material.clone();
                            child.material.map = treeTexture;
                            child.material.needsUpdate = true;
                        }
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                const benchOffsetX = 3;
                leftBench.position.set(
                    -LIGHTPOST_OFFSET - benchOffsetX,
                    0,
                    zPos,
                );
                leftBench.rotation.y = Math.PI / 2;

                rightBench.position.set(
                    LIGHTPOST_OFFSET + benchOffsetX,
                    0,
                    zPos,
                );
                rightBench.rotation.y = -Math.PI / 2;

                leftBench.userData = {
                    initialZ: zPos,
                    type: "bench",
                    initialX: -LIGHTPOST_OFFSET - benchOffsetX,
                    useDirectPositionUpdate: true,
                    visibilityDistance: STANDARD_VISIBILITY_DISTANCE,
                    repositionThreshold: SCENERY_REPOSITION_THRESHOLD_Z,
                    loopDistance: LIGHTPOST_SPACING * NUM_LIGHTPOSTS,
                };
                rightBench.userData = {
                    initialZ: zPos,
                    type: "bench",
                    initialX: LIGHTPOST_OFFSET + benchOffsetX,
                    useDirectPositionUpdate: true,
                    visibilityDistance: STANDARD_VISIBILITY_DISTANCE,
                    repositionThreshold: SCENERY_REPOSITION_THRESHOLD_Z,
                    loopDistance: LIGHTPOST_SPACING * NUM_LIGHTPOSTS,
                };

                if (this.scene) {
                    this.scene.add(leftBench);
                    this.scene.add(rightBench);
                }

                this.buildingInstances.push({
                    group: leftBench,
                    initialZ: zPos,
                    initialX: -LIGHTPOST_OFFSET - benchOffsetX,
                    userData: {
                        type: "bench",
                        useDirectPositionUpdate: true,
                        visibilityDistance: STANDARD_VISIBILITY_DISTANCE,
                        repositionThreshold: SCENERY_REPOSITION_THRESHOLD_Z,
                        loopDistance: LIGHTPOST_SPACING * NUM_LIGHTPOSTS,
                    },
                });

                this.buildingInstances.push({
                    group: rightBench,
                    initialZ: zPos,
                    initialX: LIGHTPOST_OFFSET + benchOffsetX,
                    userData: {
                        type: "bench",
                        useDirectPositionUpdate: true,
                        visibilityDistance: STANDARD_VISIBILITY_DISTANCE,
                        repositionThreshold: SCENERY_REPOSITION_THRESHOLD_Z,
                        loopDistance: LIGHTPOST_SPACING * NUM_LIGHTPOSTS,
                    },
                });
            }

            console.log(
                `SceneryManager: Created ${NUM_LIGHTPOSTS * 2} benches next to lightposts.`,
            );
        });
    }

    private createBoardwalk(): void {
        if (!this.scene) return;
        console.log("SceneryManager: Creating boardwalk along the road...");

        const gridCanvas = document.createElement("canvas");
        gridCanvas.width = 256;
        gridCanvas.height = 256;
        const ctx = gridCanvas.getContext("2d");
        if (ctx) {
            ctx.fillStyle = "#808080";
            ctx.fillRect(0, 0, 256, 256);

            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2;

            for (let x = 0; x <= 256; x += 32) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, 256);
                ctx.stroke();
            }

            for (let y = 0; y <= 256; y += 32) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(256, y);
                ctx.stroke();
            }
        }

        const gridTexture = new THREE.CanvasTexture(gridCanvas);
        gridTexture.wrapS = THREE.RepeatWrapping;
        gridTexture.wrapT = THREE.RepeatWrapping;
        gridTexture.repeat.set(4, 1);

        const boardwalkGeometry = new THREE.PlaneGeometry(
            BOARDWALK_WIDTH,
            ROAD_SEGMENT_LENGTH,
        );

        const boardwalkMaterial = new THREE.MeshStandardMaterial({
            map: gridTexture,
            roughness: 0.9,
            metalness: 0.1,
            side: THREE.DoubleSide,
        });

        const NUM_SEGMENTS = NUM_ROAD_SEGMENTS;
        const boardwalkSegments = [];

        for (let i = 0; i < NUM_SEGMENTS; i++) {
            const placementZ =
                -ROAD_SEGMENT_LENGTH / 2 - i * ROAD_SEGMENT_LENGTH;

            const leftBoardwalkMesh = new THREE.Mesh(
                boardwalkGeometry,
                boardwalkMaterial.clone(),
            );
            leftBoardwalkMesh.rotation.x = -Math.PI / 2;
            leftBoardwalkMesh.position.set(0, 0, 0);
            leftBoardwalkMesh.receiveShadow = true;

            const leftBoardwalk = new THREE.Group();
            leftBoardwalk.position.set(-BOARDWALK_OFFSET, 0.04, placementZ);
            leftBoardwalk.add(leftBoardwalkMesh);

            const rightBoardwalkMesh = new THREE.Mesh(
                boardwalkGeometry,
                boardwalkMaterial.clone(),
            );
            rightBoardwalkMesh.rotation.x = -Math.PI / 2;
            rightBoardwalkMesh.position.set(0, 0, 0);
            rightBoardwalkMesh.receiveShadow = true;

            const rightBoardwalk = new THREE.Group();
            rightBoardwalk.position.set(BOARDWALK_OFFSET, 0.04, placementZ);
            rightBoardwalk.add(rightBoardwalkMesh);

            this.scene.add(leftBoardwalk);
            this.scene.add(rightBoardwalk);

            boardwalkSegments.push(leftBoardwalk);
            boardwalkSegments.push(rightBoardwalk);

            this.buildingInstances.push({
                group: leftBoardwalk,
                initialZ: placementZ,
                initialX: -BOARDWALK_OFFSET,
                userData: {
                    type: "boardwalk",
                    side: "left",
                    useDirectPositionUpdate: true,
                    repositionThreshold: REPOSITION_THRESHOLD_Z,
                    loopDistance: ROAD_LOOP_DISTANCE,
                },
            });

            this.buildingInstances.push({
                group: rightBoardwalk,
                initialZ: placementZ,
                initialX: BOARDWALK_OFFSET,
                userData: {
                    type: "boardwalk",
                    side: "right",
                    useDirectPositionUpdate: true,
                    repositionThreshold: REPOSITION_THRESHOLD_Z,
                    loopDistance: ROAD_LOOP_DISTANCE,
                },
            });
        }

        console.log(
            `SceneryManager: Created ${NUM_SEGMENTS * 2} boardwalk segments with exact road behavior.`,
        );
    }

    private readonly ROAD_MODEL_DEFAULT_LENGTH = 1.0;
    private readonly ROAD_MODEL_Y_OFFSET = 0.01;

    private createRoadFromHouseToBoardwalk(
        houseX: number,
        houseZ: number,
        side: number,
    ): void {
        if (!this.scene) return;

        const shouldCreateFence = Math.random() < 0.3;

        if (shouldCreateFence) {
            this.gltfLoader.load("/buildings/fence-gate.glb", (gateGltf) => {
                const boardwalkEdgeX = side * PATH_OFFSET;
                const gate = gateGltf.scene.clone();

                if (this.fenceCreator) {
                    this.fenceCreator.createConnectedPerpFence(
                        boardwalkEdgeX,
                        houseZ,
                        side,
                        {
                            xAxisOffset: 0.0,
                            zAxisOffset: 0.0,
                            segmentSpacing: PERP_FENCE_SEGMENT_SPACING,
                            segmentsPerFence: PERP_FENCE_SEGMENT_COUNT,
                            fenceScale: PERP_FENCE_SCALE,
                        },
                    );
                }

                const gateTexture = this.textureLoader.load(
                    "/textures/colormaptree.png",
                    () =>
                        console.log("Fence Gate Texture: loaded successfully"),
                );
                gateTexture.flipY = false;
                gateTexture.magFilter = THREE.NearestFilter;
                gateTexture.minFilter = THREE.NearestFilter;

                gate.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                        if (
                            child.material instanceof THREE.MeshStandardMaterial
                        ) {
                            child.material = child.material.clone();
                            child.material.map = gateTexture;
                            child.material.needsUpdate = true;
                        }
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                gate.position.set(boardwalkEdgeX, 0, houseZ);
                gate.scale.set(1.5, 1.5, 1.5);
                gate.rotation.y = (Math.PI / 2) * -side;

                this.scene?.add(gate);
                console.log(
                    `FENCE GATE: Placed at exact boardwalk edge x=${boardwalkEdgeX.toFixed(2)}, z=${houseZ.toFixed(2)}`,
                );

                this.gltfLoader.load("/buildings/fence.glb", (fenceGltf) => {
                    const fenceTexture = this.textureLoader.load(
                        "/textures/colormaptree.png",
                        () =>
                            console.log(
                                "Fence Segment Texture: loaded successfully",
                            ),
                    );
                    fenceTexture.flipY = false;
                    fenceTexture.magFilter = THREE.NearestFilter;
                    fenceTexture.minFilter = THREE.NearestFilter;

                    const FENCE_SPACING_Z = 3.2;
                    const FENCE_SEGMENT_LENGTH = 6.0;
                    const FENCE_SCALE = 1.5;

                    const FENCE_GATE_Z_GAP = 1.0;

                    const PERP_FENCE_LEFT_X_OFFSET = 1.5;
                    const PERP_FENCE_RIGHT_X_OFFSET = 1.5;
                    const PERP_FENCE_Z_OFFSET = 3.2;

                    const pathLength = Math.abs(houseX - boardwalkEdgeX);
                    const numSegmentsNeeded =
                        Math.ceil(pathLength / FENCE_SEGMENT_LENGTH) + 1;

                    const applyFenceTexture = (segment: THREE.Group) => {
                        segment.traverse((child) => {
                            if (child instanceof THREE.Mesh && child.material) {
                                if (
                                    child.material instanceof
                                    THREE.MeshStandardMaterial
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

                    const storeFenceSegment = (
                        segment: THREE.Group,
                        posX: number,
                        posZ: number,
                        fenceType: string = "fence",
                    ) => {
                        this.scene?.add(segment);

                        this.buildingInstances.push({
                            group: segment,
                            initialZ: posZ,
                            initialX: posX,
                            userData: {
                                type: fenceType,
                                useDirectPositionUpdate: false,
                                visibilityDistance:
                                    STANDARD_VISIBILITY_DISTANCE,
                                loopDistance: SCENERY_LOOP_DISTANCE_BUILDINGS,
                            },
                        });
                    };

                    for (
                        let zOffset = -FENCE_GATE_Z_GAP * 2;
                        zOffset <= FENCE_GATE_Z_GAP * 2;
                        zOffset += FENCE_GATE_Z_GAP
                    ) {
                        if (Math.abs(zOffset) < 0.1) continue;

                        const fenceSegment = fenceGltf.scene.clone();
                        applyFenceTexture(fenceSegment);

                        fenceSegment.position.set(
                            boardwalkEdgeX,
                            0,
                            houseZ + zOffset,
                        );
                        fenceSegment.scale.set(
                            FENCE_SCALE,
                            FENCE_SCALE,
                            FENCE_SCALE,
                        );
                        fenceSegment.rotation.y = (Math.PI / 2) * -side;

                        storeFenceSegment(
                            fenceSegment,
                            boardwalkEdgeX,
                            houseZ + zOffset,
                            "fence-z",
                        );

                        console.log(
                            `FENCE Z-SEGMENT: Placed at gate x=${boardwalkEdgeX.toFixed(2)}, z=${(houseZ + zOffset).toFixed(2)}`,
                        );
                    }

                    for (
                        let offsetIndex = -1;
                        offsetIndex <= 1;
                        offsetIndex++
                    ) {
                        const offsetZ = offsetIndex * FENCE_SPACING_Z;

                        for (
                            let segmentIndex = 1;
                            segmentIndex < numSegmentsNeeded;
                            segmentIndex++
                        ) {
                            const segmentOffsetX =
                                segmentIndex *
                                FENCE_SEGMENT_LENGTH *
                                (side === -1 ? 1 : -1);
                            const fenceX = boardwalkEdgeX + segmentOffsetX;

                            if (
                                (side === -1 && fenceX > houseX) ||
                                (side === 1 && fenceX < houseX)
                            ) {
                                continue;
                            }

                            const fenceSegment = fenceGltf.scene.clone();
                            applyFenceTexture(fenceSegment);

                            fenceSegment.position.set(
                                fenceX,
                                0,
                                houseZ + offsetZ,
                            );
                            fenceSegment.scale.set(
                                FENCE_SCALE,
                                FENCE_SCALE,
                                FENCE_SCALE,
                            );
                            fenceSegment.rotation.y = (Math.PI / 2) * -side;

                            storeFenceSegment(
                                fenceSegment,
                                fenceX,
                                houseZ + offsetZ,
                            );

                            console.log(
                                `FENCE X-SEGMENT: Placed row=${offsetIndex}, segment=${segmentIndex} at x=${fenceX.toFixed(2)}, z=${(houseZ + offsetZ).toFixed(2)}`,
                            );
                        }
                    }
                });

                this.buildingInstances.push({
                    group: gate,
                    initialZ: houseZ,
                    initialX: boardwalkEdgeX,
                    userData: {
                        type: "fence",
                        useDirectPositionUpdate: false,
                        visibilityDistance: STANDARD_VISIBILITY_DISTANCE,
                        loopDistance: SCENERY_LOOP_DISTANCE_BUILDINGS,
                    },
                });
            });
        }

        if (!this.scene) return;
        console.log(
            `SceneryManager: Creating simple path from house at (${houseX.toFixed(1)}, ${houseZ.toFixed(1)}) to boardwalk...`,
        );

        const gateX = side * PATH_OFFSET; // Gate position becomes our reference point

        console.log(
            `PATH DEBUG: side=${side}, gateX=${gateX.toFixed(2)}, houseX=${houseX.toFixed(2)}`,
        );

        const pathLength = Math.abs(houseX - gateX);
        const pathCenterX = (houseX + gateX) / 2;
        const PATH_WIDTH = 0.5;

        const pathGeometry = new THREE.PlaneGeometry(pathLength, PATH_WIDTH);

        const pathCanvas = document.createElement("canvas");
        pathCanvas.width = 256;
        pathCanvas.height = 256;
        const ctx = pathCanvas.getContext("2d");

        if (ctx) {
            ctx.fillStyle = "#8B4513";
            ctx.fillRect(0, 0, 256, 256);

            ctx.strokeStyle = "#5D2906";
            ctx.lineWidth = 2;

            for (let x = 0; x <= 256; x += 32) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, 256);
                ctx.stroke();
            }

            for (let y = 0; y <= 256; y += 32) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(256, y);
                ctx.stroke();
            }
        }

        const pathTexture = new THREE.CanvasTexture(pathCanvas);
        pathTexture.wrapS = THREE.RepeatWrapping;
        pathTexture.wrapT = THREE.RepeatWrapping;
        pathTexture.repeat.set(4, 1);

        const pathMaterial = new THREE.MeshStandardMaterial({
            map: pathTexture,
            roughness: 0.9,
            metalness: 0.1,
            side: THREE.DoubleSide,
        });

        const pathMesh = new THREE.Mesh(pathGeometry, pathMaterial);
        pathMesh.rotation.x = -Math.PI / 2;

        const pathGroup = new THREE.Group();
        pathGroup.position.set(pathCenterX, 0.03, houseZ);

        pathGroup.add(pathMesh);

        if (this.scene) {
            this.scene.add(pathGroup);
        }

        const pathUserData = {
            type: "houseRoad",
            initialZ: houseZ,
            initialX: pathCenterX,
            useDirectPositionUpdate: false,
            visibilityDistance: STANDARD_VISIBILITY_DISTANCE,
            loopDistance: SCENERY_LOOP_DISTANCE_BUILDINGS,
        };

        pathGroup.userData = pathUserData;

        this.buildingInstances.push({
            group: pathGroup,
            initialZ: houseZ,
            initialX: pathCenterX,
            userData: pathUserData,
        });

        console.log(
            `Created simple brown path connecting house to boardwalk at z=${houseZ.toFixed(1)}, Length=${pathLength.toFixed(1)}`,
        );
    }

    private createLightposts(): void {
        if (!this.scene) return;
        console.log(
            "SceneryManager: Creating lightposts along the boardwalk...",
        );

        this.gltfLoader.load("/buildings/lightpost-single.glb", (gltf) => {
            const treeTexture = this.textureLoader.load(
                "/textures/colormaptree.png",
                () =>
                    console.log(
                        "Lightpost Texture: colormaptree.png loaded successfully via shared loader.",
                    ),
                undefined,
                (err) =>
                    console.error(
                        "Lightpost Texture: FAILED to load colormaptree.png via shared loader!",
                        err,
                    ),
            );

            treeTexture.flipY = false;
            treeTexture.magFilter = THREE.NearestFilter;
            treeTexture.minFilter = THREE.NearestFilter;

            for (let i = 0; i < NUM_LIGHTPOSTS; i++) {
                const zOffset = i * LIGHTPOST_SPACING + (Math.random() * 2 - 1);

                const leftLightpost = gltf.scene.clone();
                leftLightpost.scale.set(2, 2, 2);

                const rightLightpost = gltf.scene.clone();
                rightLightpost.scale.set(2, 2, 2);

                leftLightpost.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                        if (
                            child.material instanceof THREE.MeshStandardMaterial
                        ) {
                            child.material = child.material.clone();
                            child.material.map = treeTexture;
                            child.material.needsUpdate = true;
                        }
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                rightLightpost.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                        if (
                            child.material instanceof THREE.MeshStandardMaterial
                        ) {
                            child.material = child.material.clone();
                            child.material.map = treeTexture;
                            child.material.needsUpdate = true;
                        }
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                const zPos = -i * LIGHTPOST_SPACING;
                leftLightpost.position.set(-LIGHTPOST_OFFSET, 0, zPos);
                leftLightpost.rotation.y = Math.PI / 2;

                rightLightpost.position.set(LIGHTPOST_OFFSET, 0, zPos);
                rightLightpost.rotation.y = -Math.PI / 2;

                leftLightpost.userData = {
                    initialZ: zPos,
                    type: "lightpost",
                    initialX: -LIGHTPOST_OFFSET,
                    useDirectPositionUpdate: true,
                    visibilityDistance: STANDARD_VISIBILITY_DISTANCE,
                    repositionThreshold: SCENERY_REPOSITION_THRESHOLD_Z,
                    loopDistance: LIGHTPOST_SPACING * NUM_LIGHTPOSTS,
                };
                rightLightpost.userData = {
                    initialZ: zPos,
                    type: "lightpost",
                    initialX: LIGHTPOST_OFFSET,
                    useDirectPositionUpdate: true,
                    visibilityDistance: STANDARD_VISIBILITY_DISTANCE,
                    repositionThreshold: SCENERY_REPOSITION_THRESHOLD_Z,
                    loopDistance: LIGHTPOST_SPACING * NUM_LIGHTPOSTS,
                };

                if (this.scene) {
                    this.scene.add(leftLightpost);
                    this.scene.add(rightLightpost);
                }

                this.buildingInstances.push({
                    group: leftLightpost,
                    initialZ: zPos,
                    initialX: -LIGHTPOST_OFFSET,
                    userData: {
                        type: "lightpost",
                        useDirectPositionUpdate: true,
                        visibilityDistance: STANDARD_VISIBILITY_DISTANCE,
                        repositionThreshold: SCENERY_REPOSITION_THRESHOLD_Z,
                        loopDistance: LIGHTPOST_SPACING * NUM_LIGHTPOSTS,
                    },
                });

                this.buildingInstances.push({
                    group: rightLightpost,
                    initialZ: zPos,
                    initialX: LIGHTPOST_OFFSET,
                    userData: {
                        type: "lightpost",
                        useDirectPositionUpdate: true,
                        visibilityDistance: STANDARD_VISIBILITY_DISTANCE,
                        repositionThreshold: SCENERY_REPOSITION_THRESHOLD_Z,
                        loopDistance: LIGHTPOST_SPACING * NUM_LIGHTPOSTS,
                    },
                });
            }

            console.log(
                `SceneryManager: Created ${NUM_LIGHTPOSTS * 2} lightposts with direct position updates.`,
            );
        });
    }

    private createFoliageAroundBuildings(): void {
        if (!this.scene) return;
        console.log("SceneryManager: Creating foliage around buildings...");

        const treeTexture = this.textureLoader.load(
            "/textures/colormaptree.png",
        );
        treeTexture.flipY = false;
        treeTexture.magFilter = THREE.NearestFilter;
        treeTexture.minFilter = THREE.NearestFilter;

        const treeModels = [
            "/buildings/pine.glb",
            "/buildings/pine-crooked.glb",
        ];

        const loadTrees = () => {
            const applyTreeTexture = (object: THREE.Object3D) => {
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach((mat) => {
                                if (!mat.map) {
                                    mat.map = treeTexture;
                                    mat.needsUpdate = true;
                                }
                            });
                        } else if (!child.material.map) {
                            child.material.map = treeTexture;
                            child.material.needsUpdate = true;
                        }
                    }
                });
            };
            for (let i = 0; i < NUM_TREES; i++) {
                const randomTreeModel =
                    treeModels[Math.floor(Math.random() * treeModels.length)];

                this.gltfLoader.load(randomTreeModel, (gltf) => {
                    const tree = gltf.scene;
                    applyTreeTexture(tree);

                    tree.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    if (this.buildingInstances.length > 0) {
                        const buildingOnly = this.buildingInstances.filter(
                            (instance) =>
                                !instance.userData?.type ||
                                instance.userData?.type === "building",
                        );

                        if (buildingOnly.length === 0) return;

                        const randomBuildingIndex = Math.floor(
                            Math.random() * buildingOnly.length,
                        );
                        const randomBuilding =
                            buildingOnly[randomBuildingIndex];

                        const isLeftSide = randomBuilding.initialX < 0;
                        let treeX;

                        const buildingWidth = 5;
                        const safeDistance = 3;

                        if (isLeftSide) {
                            const buildingEdge =
                                randomBuilding.initialX + buildingWidth / 2;
                            const boardwalkEdge = -(
                                BOARDWALK_OFFSET -
                                BOARDWALK_WIDTH / 2
                            );

                            const availableSpace =
                                Math.abs(
                                    buildingEdge + safeDistance - boardwalkEdge,
                                ) - 2;

                            if (availableSpace <= 0) {
                                return;
                            }

                            treeX =
                                buildingEdge +
                                safeDistance +
                                Math.random() * availableSpace * 0.7;

                            if (treeX > boardwalkEdge) {
                                return;
                            }
                        } else {
                            const buildingEdge =
                                randomBuilding.initialX - buildingWidth / 2;
                            const boardwalkEdge =
                                BOARDWALK_OFFSET - BOARDWALK_WIDTH / 2;

                            const availableSpace =
                                Math.abs(
                                    buildingEdge - safeDistance - boardwalkEdge,
                                ) - 2;

                            if (availableSpace <= 0) {
                                return;
                            }

                            treeX =
                                buildingEdge -
                                safeDistance -
                                Math.random() * availableSpace * 0.7;

                            if (treeX < boardwalkEdge) {
                                return;
                            }
                        }

                        const safeZDistance = 3;
                        const offsetZ =
                            (Math.random() * 2 + safeZDistance) *
                            (Math.random() < 0.5 ? -1 : 1);
                        const treeZ = randomBuilding.initialZ + offsetZ;

                        const scale = 0.6 + Math.random() * 0.8;
                        tree.scale.set(scale, scale, scale);

                        tree.rotation.y = Math.random() * Math.PI * 2;

                        tree.position.set(treeX, 0, treeZ);

                        tree.userData = {
                            initialZ: treeZ,
                            type: "foliage",
                            initialX: treeX,
                            useDirectPositionUpdate: true,
                            visibilityDistance: STANDARD_VISIBILITY_DISTANCE,
                            repositionThreshold: SCENERY_REPOSITION_THRESHOLD_Z,
                            loopDistance: SCENERY_LOOP_DISTANCE_BUILDINGS,
                        };

                        if (this.scene) {
                            this.scene.add(tree);
                        }

                        this.buildingInstances.push({
                            group: tree,
                            initialZ: treeZ,
                            initialX: treeX,
                            userData: {
                                type: "foliage",
                                useDirectPositionUpdate: true,
                                visibilityDistance:
                                    STANDARD_VISIBILITY_DISTANCE,
                                repositionThreshold:
                                    SCENERY_REPOSITION_THRESHOLD_Z,
                                loopDistance: SCENERY_LOOP_DISTANCE_BUILDINGS,
                            },
                        });
                    }
                });
            }

            console.log(
                `SceneryManager: Created ${NUM_TREES} trees around buildings.`,
            );
        };

        loadTrees();
    }

    public update(progress: number, currentSpeed?: number): void {
        if (!this.buildingsCreated || !this.totalDistanceScrolledRef?.current)
            return;

        if (progress !== this.progressPercentage) {
            this.progressPercentage = progress;

            const shouldUseTowerModels = progress >= 50;

            console.log(
                `BUILDING PROGRESS: Current progress = ${progress}%, shouldUseTowerModels = ${shouldUseTowerModels}`,
            );

            const hasTowerModels = this.sampleBuildingPartNames.some((name) =>
                name.includes("tower"),
            );
            console.log(
                `BUILDING PROGRESS: Has tower models available = ${hasTowerModels}, model names: ${this.sampleBuildingPartNames.join(", ")}`,
            );

            this.buildingInstances.forEach((instance, index) => {
                if (
                    instance.userData?.updatedForProgress ===
                    this.progressPercentage
                )
                    return;

                if (shouldUseTowerModels) {
                    instance.userData = {
                        ...instance.userData,
                        updatedForProgress: this.progressPercentage,
                    };

                    if (!this.scene?.userData.towerPhaseReached) {
                        console.log(
                            `TOWER PHASE REACHED: Progress at ${this.progressPercentage}% - New buildings will now be towers`,
                        );
                        if (this.scene) {
                            this.scene.userData.towerPhaseReached = true;
                        }
                    }
                }
            });
        }

        const scroll = this.totalDistanceScrolledRef.current;
        let recycledObjectsCount = 0;
        const startUpdateTime = performance.now();

        if (Math.random() < 0.001) {
            console.log(
                `SCENERY TRACKING: Total scroll distance ${scroll.toFixed(2)}`,
            );
        }

        this.buildingInstances.forEach((instance, index) => {
            if (instance.userData?.useDirectPositionUpdate) {
                instance.group.position.z += currentSpeed || FORWARD_SPEED;

                if (index === 0 && Math.random() < 0.002) {
                    const threshold =
                        instance.userData?.repositionThreshold ||
                        REPOSITION_THRESHOLD_Z;
                    const elementType =
                        instance.userData?.type === "foliage"
                            ? "TREE"
                            : instance.userData?.type === "lightpost"
                              ? "LIGHTPOST"
                              : instance.userData?.type === "bench"
                                ? "BENCH"
                                : "BOARDWALK";
                    console.log(
                        `${elementType} TRACKING: First element at z=${instance.group.position.z.toFixed(2)}, threshold=${threshold} (custom=${instance.userData?.repositionThreshold ? "yes" : "no"})`,
                    );
                }

                // Use custom threshold if available, otherwise use default
                const threshold =
                    instance.userData?.repositionThreshold ||
                    REPOSITION_THRESHOLD_Z;

                if (instance.group.position.z > threshold) {
                    const oldZ = instance.group.position.z;

                    // Determine how far back to reposition based on the type of object
                    let repositionDistance = ROAD_LOOP_DISTANCE;

                    // For objects that should be based on their count and spacing
                    if (instance.userData?.type === "foliage") {
                        // For trees, we need to calculate the total span based on count and spacing
                        const treeSpacing = 10.0; // Default tree spacing
                        repositionDistance = NUM_TREES * treeSpacing;
                    } else if (instance.userData?.type === "lightpost") {
                        repositionDistance = NUM_LIGHTPOSTS * LIGHTPOST_SPACING;
                    } else if (instance.userData?.type === "bench") {
                        // Benches use same pattern as lightposts
                        repositionDistance = NUM_LIGHTPOSTS * LIGHTPOST_SPACING;
                    }

                    instance.group.position.z -= repositionDistance;
                    recycledObjectsCount++;

                    const elementType =
                        instance.userData?.type === "foliage"
                            ? "TREE"
                            : instance.userData?.type === "lightpost"
                              ? "LIGHTPOST"
                              : instance.userData?.type === "bench"
                                ? "BENCH"
                                : "BOARDWALK";
                    console.log(
                        `${elementType} LOOP: Element ${index % 10} recycled from z=${oldZ.toFixed(2)} to z=${instance.group.position.z.toFixed(2)} (threshold=${threshold})`,
                    );
                }

                const distanceFromCamera = Math.abs(instance.group.position.z);
                const visibilityDistance =
                    instance.userData?.visibilityDistance || 600;

                if (distanceFromCamera > visibilityDistance) {
                    if (instance.group.visible) {
                        instance.group.visible = false;
                    }
                } else {
                    if (!instance.group.visible) {
                        instance.group.visible = true;
                    }
                }
            } else {
                const loopDistance =
                    instance.userData?.loopDistance ||
                    SCENERY_LOOP_DISTANCE_BUILDINGS;

                const worldZ = instance.initialZ + scroll;
                const loopZ =
                    ((worldZ % loopDistance) + loopDistance) % loopDistance;
                const finalZ = loopZ - loopDistance;

                const oldZ = instance.group.position.z;

                if (
                    instance.userData?.type === "fence" &&
                    typeof instance.userData?.relativeOffsetZ === "number"
                ) {
                    instance.group.position.z =
                        finalZ + instance.userData.relativeOffsetZ;
                    instance.group.position.x = instance.initialX;
                } else {
                    instance.group.position.z = finalZ;
                    instance.group.position.x = instance.initialX;
                }

                if (index === 0 && Math.random() < 0.001) {
                    console.log(
                        `SCENERY UPDATE: First building at z=${finalZ.toFixed(2)}, moved from ${oldZ.toFixed(2)}`,
                    );

                    const type = instance.userData?.buildingType || "standard";
                    console.log(
                        `SCENERY TYPE: ${type}, visible=${instance.group.visible}`,
                    );
                }

                const bigPositionChange = Math.abs(oldZ - finalZ) > 50;
                if (bigPositionChange) {
                    recycledObjectsCount++;

                    if (Math.random() < 0.1) {
                        console.log(
                            `SCENERY LOOP: ${instance.userData?.type || "Building"} recycled from z=${oldZ.toFixed(2)} to z=${finalZ.toFixed(2)}`,
                        );
                    }
                }

                const distanceFromCamera = Math.abs(finalZ);
                const visibilityDistance =
                    instance.userData?.visibilityDistance ||
                    STANDARD_VISIBILITY_DISTANCE;

                if (distanceFromCamera > visibilityDistance) {
                    if (instance.group.visible) {
                        if (index < 3 && Math.random() < 0.1) {
                            console.log(
                                `SCENERY HIDE: ${instance.userData?.type || "scenery"} at distance=${distanceFromCamera.toFixed(2)} hidden (beyond ${visibilityDistance})`,
                            );
                        }
                        instance.group.visible = false;
                    }
                } else {
                    if (!instance.group.visible) {
                        if (index < 3 && Math.random() < 0.1) {
                            console.log(
                                `SCENERY SHOW: ${instance.userData?.type || "scenery"} at distance=${distanceFromCamera.toFixed(2)} shown (within ${visibilityDistance})`,
                            );
                        }
                        instance.group.visible = true;
                    }
                }
            }
        });

        if (recycledObjectsCount > 0) {
            const updateTime = performance.now() - startUpdateTime;
            console.log(
                `RECYCLING EVENT: Moved ${recycledObjectsCount} objects, update took ${updateTime.toFixed(2)}ms`,
            );
        }
    }

    public dispose(): void {
        console.log(
            "SceneryManager: Dispose called. Scheduling delayed removal...",
        );
        if (this.disposalTimeoutId) {
            clearTimeout(this.disposalTimeoutId);
            this.disposalTimeoutId = null;
        }
        const scene = this.scene;
        const instancesToDispose = [...this.buildingInstances];

        const UNIFIED_DISPOSE_TIMEOUT = 30000;

        this.disposalTimeoutId = setTimeout(() => {
            console.log(
                "SceneryManager: Executing delayed disposal for ALL scenery elements...",
            );
            if (scene) {
                const sceneryTypes = instancesToDispose.reduce(
                    (acc, instance) => {
                        const type = instance.userData?.type || "building";
                        acc[type] = (acc[type] || 0) + 1;
                        return acc;
                    },
                    {} as Record<string, number>,
                );

                instancesToDispose.forEach((instance) => {
                    const isInScene = scene.children.includes(instance.group);
                    if (isInScene) {
                        scene.remove(instance.group);
                    }

                    instance.group.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            if (child.geometry) {
                                child.geometry.dispose();
                            }

                            if (Array.isArray(child.material)) {
                                child.material.forEach((material) => {
                                    if (material.map) material.map.dispose();
                                    material.dispose();
                                });
                            } else if (child.material) {
                                if (child.material.map)
                                    child.material.map.dispose();
                                child.material.dispose();
                            }
                        }
                    });
                });

                console.log(
                    "SceneryManager: Disposed scenery counts:",
                    Object.entries(sceneryTypes)
                        .map(([type, count]) => `${type}: ${count}`)
                        .join(", "),
                );
            } else {
                console.log(
                    "SceneryManager: Scene was null during delayed disposal.",
                );
            }
            this.disposalTimeoutId = null;
        }, UNIFIED_DISPOSE_TIMEOUT);

        this.loadedParts.clear();
        this.buildingPaletteTexture?.dispose();
        this.buildingPaletteTexture = null;
        this.assetsLoaded = false;
        this.buildingsCreated = false;
        this.groundFloorPartNames = [];
        this.middleFloorPartNames = [];
        this.middleFloorBalconyNames = [];
        this.roof1x1PartNames = [];
        this.sampleBuildingPartNames = [];
        console.log(
            "SceneryManager: Non-building resources disposed, removal scheduled.",
        );
    }
}
