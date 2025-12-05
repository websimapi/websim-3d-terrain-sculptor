import { STATE } from './config.js';
import { textureManifest, updateTerrainMaterial, regenerateAllChunks } from './terrain.js';
import { saveProject, loadProject } from './io.js';

export function initUI(scene, camera) { // Needs scene/camera for regenerate
    // Populate texture palette
    const palette = document.getElementById('texture-palette');
    textureManifest.forEach(t => {
        const div = document.createElement('div');
        div.className = `texture-btn ${t.id === STATE.currentTexture ? 'active' : ''}`;
        div.style.backgroundImage = `url(${t.path})`;
        div.onclick = () => {
            document.querySelectorAll('.texture-btn').forEach(b => b.classList.remove('active'));
            div.classList.add('active');
            STATE.currentTexture = t.id;
            updateTerrainMaterial();
        };
        palette.appendChild(div);
    });

    // Tools
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            STATE.brush.mode = btn.dataset.tool;
        };
    });

    // Sliders
    document.getElementById('brush-size').addEventListener('input', (e) => {
        STATE.brush.radius = parseFloat(e.target.value);
    });
    document.getElementById('brush-intensity').addEventListener('input', (e) => {
        STATE.brush.strength = parseFloat(e.target.value) / 100;
    });

    // Action Buttons
    document.getElementById('btn-clear').onclick = () => {
        if(confirm("Clear all terrain edits?")) {
            STATE.heightData.clear();
            regenerateAllChunks(scene, camera);
        }
    };
    
    document.getElementById('btn-generate').onclick = () => {
         STATE.heightData.clear();
         STATE.seed = Math.random();
         regenerateAllChunks(scene, camera);
    };

    // Save/Load
    document.getElementById('btn-save').onclick = () => {
        saveProject();
    };

    const fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadProject(e.target.files[0], scene, camera);
        }
        e.target.value = ''; // Reset input
    });

    // Panel Toggle Logic
    const panel = document.getElementById('bottom-panel');
    const handle = document.getElementById('panel-handle');
    
    if (panel && handle) {
        let ignoreClick = false;

        const togglePanel = () => {
            panel.classList.toggle('collapsed');
        };
        
        handle.addEventListener('click', () => {
            if (!ignoreClick) togglePanel();
        });
        
        // Mobile swipe gesture support
        let startY = 0;
        
        handle.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            ignoreClick = false;
        }, { passive: true });
        
        handle.addEventListener('touchend', (e) => {
            const endY = e.changedTouches[0].clientY;
            const diff = endY - startY;
            
            // If dragged vertically significantly
            if (Math.abs(diff) > 10) {
                ignoreClick = true; // Prevent click from firing toggle again
                
                if (diff > 30 && !panel.classList.contains('collapsed')) {
                    panel.classList.add('collapsed');
                } else if (diff < -30 && panel.classList.contains('collapsed')) {
                    panel.classList.remove('collapsed');
                }
                
                // Reset click lock after a short delay
                setTimeout(() => ignoreClick = false, 300);
            }
        });
    }

    // Top bar hide/show toggle using handle bar
    const topPanel = document.getElementById('top-panel');
    const topHandle = document.getElementById('top-bar-handle');
    if (topPanel && topHandle) {
        topHandle.addEventListener('click', () => {
            topPanel.classList.toggle('collapsed');
        });
    }
}

