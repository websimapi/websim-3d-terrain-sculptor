import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initLogger } from './logger.js';
import { CONFIG, STATE } from './config.js';
import { loadAssets, updateChunks, applyBrush } from './terrain.js';
import { initUI } from './ui.js';

// --- Global Engine State ---
let scene, camera, renderer, controls, raycaster, pointer;
let lightAmbient, lightDir;
const clock = new THREE.Clock();

async function init() {
    try {
        initLogger();
        console.log("Initializing Engine...");
        
        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(CONFIG.fogColor);
        scene.fog = new THREE.Fog(CONFIG.fogColor, 20, 100);

        // Camera
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
        camera.position.set(0, 30, 40);

        // Renderer
        const canvas = document.createElement('canvas');
        canvas.style.touchAction = 'none';
        document.getElementById('canvas-container').appendChild(canvas);
        
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;

        // Lighting
        lightAmbient = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(lightAmbient);

        lightDir = new THREE.DirectionalLight(0xffffff, 1.2);
        lightDir.position.set(50, 100, 50);
        lightDir.castShadow = true;
        lightDir.shadow.mapSize.width = 2048;
        lightDir.shadow.mapSize.height = 2048;
        scene.add(lightDir);

        // Controls
        controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2 - 0.1;
        controls.minDistance = 5;
        controls.maxDistance = 150;
        
        // Mobile Interactions
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.screenSpacePanning = false; // Pan on XZ plane (keeps camera height constant)
        controls.touches.ONE = THREE.TOUCH.ROTATE; // Default, but disabled by enableRotate = false
        controls.touches.TWO = THREE.TOUCH.DOLLY_PAN; // Two fingers to zoom/pan
        
        // Start in Sculpt mode (Rotation disabled prevents 1-finger interaction from moving camera)
        controls.enableRotate = false; 

        // Tools
        raycaster = new THREE.Raycaster();
        pointer = new THREE.Vector2();

        // Events
        window.addEventListener('resize', onWindowResize);
        setupInteraction();

        // Start
        await loadAssets();
        initUI(scene, camera, controls);
        setupExportPNG();

        // Initial Grid
        updateChunks(scene, camera);

        // Hide loader
        document.getElementById('loading').classList.add('hidden');
        
        console.log("Engine Started");
        animate();

    } catch (err) {
        console.error("Critical Init Error:", err);
        alert("Failed to initialize engine. Check logs.");
    }
}

function setupInteraction() {
    const container = document.getElementById('canvas-container');
    let isDragging = false;
    
    const onDown = (x, y) => {
        isDragging = true;
        sculpt(x, y);
    };

    const onMove = (x, y) => {
        if (isDragging) sculpt(x, y);
    };

    const onUp = () => {
        isDragging = false;
    };

    // Mouse
    container.addEventListener('mousedown', (e) => {
        if(STATE.brush.mode !== 'view' && e.button === 0) onDown(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
        onMove(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', onUp);

    // Touch
    container.addEventListener('touchstart', (e) => {
        // Only sculpt with 1 finger. 
        // If 2 fingers touch, OrbitControls handles it (DOLLY_PAN).
        if (e.touches.length === 1 && STATE.brush.mode !== 'view') {
            onDown(e.touches[0].clientX, e.touches[0].clientY);
        } else {
            isDragging = false; // Stop sculpting if second finger touches
        }
    }, { passive: false });
    
    container.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });
    
    container.addEventListener('touchend', (e) => {
        // Reset if no fingers left
        if (e.touches.length === 0) {
            onUp();
        }
    });
}

function sculpt(clientX, clientY) {
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    
    const terrainMeshes = Array.from(STATE.chunks.values()).map(c => c.mesh);
    const intersects = raycaster.intersectObjects(terrainMeshes);

    if (intersects.length > 0) {
        const hit = intersects[0];
        const point = hit.point;
        applyBrush(point);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupExportPNG() {
    const btn = document.getElementById('btn-export-img');
    if (!btn) return;

    btn.addEventListener('click', () => {
        try {
            // 1. Calculate Bounds
            let minCx = Infinity, maxCx = -Infinity;
            let minCz = Infinity, maxCz = -Infinity;
            let hasData = false;

            for (const key of STATE.heightData.keys()) {
                const [cx, cz] = key.split(',').map(Number);
                if (cx < minCx) minCx = cx;
                if (cx > maxCx) maxCx = cx;
                if (cz < minCz) minCz = cz;
                if (cz > maxCz) maxCz = cz;
                hasData = true;
            }

            if (!hasData) {
                alert("No terrain data to export.");
                return;
            }

            // 2. Calculate Height Range for Normalization
            let minH = Infinity, maxH = -Infinity;
            for (const heights of STATE.heightData.values()) {
                for (let i = 0; i < heights.length; i++) {
                    const h = heights[i];
                    if (h < minH) minH = h;
                    if (h > maxH) maxH = h;
                }
            }
            
            if (maxH - minH < 0.001) maxH = minH + 1;

            // 3. Create Canvas
            // Chunks of size N share edges. The logical pixel width is N. 
            // Total width = (numChunks * N) + 1 (for the final edge)
            const chunkSize = CONFIG.chunkSize;
            const width = (maxCx - minCx + 1) * chunkSize + 1;
            const height = (maxCz - minCz + 1) * chunkSize + 1;
            
            // Safety check for massive textures
            if (width > 16384 || height > 16384) {
                if (!confirm(`Warning: Map size is large (${width}x${height}). Export may fail. Continue?`)) return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, width, height);

            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            const rowVerts = chunkSize + 1; // 33 for size 32

            // 4. Rasterize Chunks
            for (const [key, heights] of STATE.heightData) {
                const [cx, cz] = key.split(',').map(Number);
                const baseX = (cx - minCx) * chunkSize;
                const baseY = (cz - minCz) * chunkSize;

                for (let i = 0; i < heights.length; i++) {
                    // Mapping: row index -> Z (Image Y), col index -> X (Image X)
                    const row = Math.floor(i / rowVerts);
                    const col = i % rowVerts;
                    
                    const h = heights[i];
                    const val = Math.floor(((h - minH) / (maxH - minH)) * 255);

                    const x = baseX + col;
                    const y = baseY + row;
                    
                    const idx = (y * width + x) * 4;
                    
                    // Only write if within bounds (should always be true)
                    if (idx < data.length) {
                        data[idx] = val;     // R
                        data[idx + 1] = val; // G
                        data[idx + 2] = val; // B
                        data[idx + 3] = 255; // A
                    }
                }
            }

            ctx.putImageData(imgData, 0, 0);

            // 5. Download
            const dataURL = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `terrain_heightmap_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (e) {
            console.error('Failed to export heightmap:', e);
            alert('Failed to export heightmap. Check logs.');
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Lazy load chunks on move
    if (clock.getElapsedTime() % 0.5 < 0.05) { 
         updateChunks(scene, camera);
    }

    renderer.render(scene, camera);
}

// Boot
init();