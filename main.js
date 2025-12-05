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

        // Tools
        raycaster = new THREE.Raycaster();
        pointer = new THREE.Vector2();

        // Events
        window.addEventListener('resize', onWindowResize);
        setupInteraction();

        // Start
        await loadAssets();
        initUI(scene, camera);
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
        controls.enabled = false;
        sculpt(x, y);
    };

    const onMove = (x, y) => {
        if (isDragging) sculpt(x, y);
    };

    const onUp = () => {
        isDragging = false;
        controls.enabled = true;
    };

    // Mouse
    container.addEventListener('mousedown', (e) => {
        if(e.button === 0) onDown(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
        onMove(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', onUp);

    // Touch
    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            onDown(e.touches[0].clientX, e.touches[0].clientY);
        } else {
            isDragging = false;
            controls.enabled = true;
        }
    }, { passive: false });
    
    container.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });
    
    container.addEventListener('touchend', onUp);
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
            // Make sure the latest frame is rendered
            renderer.render(scene, camera);

            const dataURL = renderer.domElement.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = 'terrain.png';

            // For iOS Safari, programmatic click must be in same event loop tick
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error('Failed to export PNG:', e);
            alert('Failed to export PNG. Check logs for details.');
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