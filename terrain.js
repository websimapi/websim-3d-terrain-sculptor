import * as THREE from 'three';
import { createNoise2D } from 'https://esm.sh/simplex-noise@4.0.1';
import { CONFIG, STATE } from './config.js';

// --- Assets ---
const textureLoader = new THREE.TextureLoader();
export const textureManifest = [
    { id: 'grass', path: './asset_grass.png', name: 'Grass' },
    { id: 'rock', path: './asset_rock.png', name: 'Rock' },
    { id: 'dirt', path: './asset_dirt.png', name: 'Dirt' },
    { id: 'snow', path: './asset_snow.png', name: 'Snow' }
];

export async function loadAssets() {
    console.log("Loading assets...");
    const promises = textureManifest.map(t => {
        return new Promise((resolve) => {
            textureLoader.load(t.path, (tex) => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(4, 4); 
                tex.colorSpace = THREE.SRGBColorSpace;
                STATE.textures[t.id] = tex;
                resolve();
            }, undefined, (err) => {
                console.error(`Failed loading ${t.path}`, err);
                resolve(); // Resolve anyway
            });
        });
    });
    await Promise.all(promises);
    console.log("Assets loaded");
}

// --- Noise ---
const noise2D = createNoise2D();

function getBaseHeight(x, z) {
    const scale = 0.03;
    let y = noise2D(x * scale + STATE.seed * 100, z * scale + STATE.seed * 100) * 8;
    y += noise2D(x * scale * 4, z * scale * 4) * 2;
    return y;
}

// --- Chunks ---
function getChunkKey(cx, cz) {
    return `${cx},${cz}`;
}

export function getChunk(cx, cz, scene) {
    const key = getChunkKey(cx, cz);
    let chunk = STATE.chunks.get(key);

    if (!chunk) {
        chunk = createChunk(cx, cz);
        STATE.chunks.set(key, chunk);
        if (scene) scene.add(chunk.mesh);
    }
    return chunk;
}

function createChunk(cx, cz) {
    const size = CONFIG.chunkSize;
    const geom = new THREE.PlaneGeometry(
        size * CONFIG.chunkRes, 
        size * CONFIG.chunkRes, 
        size, 
        size
    );
    geom.rotateX(-Math.PI / 2);

    const worldX = cx * size * CONFIG.chunkRes;
    const worldZ = cz * size * CONFIG.chunkRes;
    geom.translate(worldX, 0, worldZ);

    const key = getChunkKey(cx, cz);
    let heights = STATE.heightData.get(key);

    const posAttr = geom.attributes.position;

    if (!heights) {
        heights = new Float32Array(posAttr.count);
        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const z = posAttr.getZ(i);
            heights[i] = getBaseHeight(x, z);
        }
        STATE.heightData.set(key, heights);
    }

    for (let i = 0; i < posAttr.count; i++) {
        posAttr.setY(i, heights[i]);
    }

    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: STATE.textures[STATE.currentTexture] || null,
        roughness: 0.8,
        metalness: 0.1,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.userData = { cx, cz, isTerrain: true };

    return { mesh, geometry: geom, key };
}

export function updateChunks(scene, camera) {
    const centerX = Math.floor(camera.position.x / (CONFIG.chunkSize * CONFIG.chunkRes));
    const centerZ = Math.floor(camera.position.z / (CONFIG.chunkSize * CONFIG.chunkRes));
    const range = CONFIG.renderDistance;

    const neededKeys = new Set();

    for (let x = centerX - range; x <= centerX + range; x++) {
        for (let z = centerZ - range; z <= centerZ + range; z++) {
            getChunk(x, z, scene); 
            neededKeys.add(getChunkKey(x, z));
        }
    }

    // Clean up distant chunks
    for (const [key, chunk] of STATE.chunks) {
        if (!neededKeys.has(key)) {
            if (scene) scene.remove(chunk.mesh);
            chunk.geometry.dispose();
            chunk.mesh.material.dispose();
            STATE.chunks.delete(key);
        }
    }
}

export function regenerateAllChunks(scene, camera) {
    for (const [key, chunk] of STATE.chunks) {
        if (scene) scene.remove(chunk.mesh);
        chunk.geometry.dispose();
    }
    STATE.chunks.clear();
    updateChunks(scene, camera);
}

export function updateTerrainMaterial() {
     const tex = STATE.textures[STATE.currentTexture];
     for (const [key, chunk] of STATE.chunks) {
         chunk.mesh.material.map = tex;
         chunk.mesh.material.needsUpdate = true;
     }
}

// --- Sculpting ---
export function applyBrush(centerPoint) {
    const r = STATE.brush.radius;
    const rSq = r * r;
    const strength = STATE.brush.strength;
    const mode = STATE.brush.mode;

    for (const chunk of STATE.chunks.values()) {
        const mesh = chunk.mesh;
        const geom = chunk.geometry;
        const posAttr = geom.attributes.position;
        const box = new THREE.Box3().setFromObject(mesh);

        if (!box.intersectsSphere(new THREE.Sphere(centerPoint, r))) continue;

        const heights = STATE.heightData.get(chunk.key);
        let modified = false;

        for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            const vz = posAttr.getZ(i);

            const dx = vx - centerPoint.x;
            const dz = vz - centerPoint.z;
            const distSq = dx*dx + dz*dz;

            if (distSq < rSq) {
                const dist = Math.sqrt(distSq);
                const falloff = 0.5 + 0.5 * Math.cos((dist / r) * Math.PI);
                const factor = strength * falloff;

                let newH = vy;

                if (mode === 'raise') {
                    newH += factor;
                } else if (mode === 'lower') {
                    newH -= factor;
                } else if (mode === 'flatten') {
                    newH = THREE.MathUtils.lerp(vy, centerPoint.y, factor * 0.5);
                } else if (mode === 'smooth') {
                    newH = THREE.MathUtils.lerp(vy, 0, factor * 0.1); 
                }

                if (newH !== vy) {
                    posAttr.setY(i, newH);
                    heights[i] = newH;
                    modified = true;
                }
            }
        }

        if (modified) {
            posAttr.needsUpdate = true;
            geom.computeVertexNormals();
        }
    }
}