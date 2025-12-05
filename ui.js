import { STATE } from './config.js';
import { textureManifest, updateTerrainMaterial, regenerateAllChunks } from './terrain.js';

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

    // Save/Load could be implemented here or extended later
}

