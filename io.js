import JSZip from 'jszip';
import { STATE, CONFIG } from './config.js';
import { regenerateAllChunks } from './terrain.js';

export async function saveProject() {
    const zip = new JSZip();

    // 1. Serialize Data
    const serializableData = {
        seed: STATE.seed,
        chunks: [],
        textures: STATE.currentTexture // Save selected texture
    };

    for (const [key, heights] of STATE.heightData) {
        serializableData.chunks.push({
            key: key,
            heights: Array.from(heights) // Float32Array to Array
        });
    }

    zip.file("terrain_data.json", JSON.stringify(serializableData));

    // 2. Generate Preview PNG
    try {
        const pngBlob = await generateHeightmapBlob();
        if (pngBlob) {
            zip.file("heightmap_preview.png", pngBlob);
        }
    } catch (e) {
        console.warn("Failed to generate preview PNG", e);
    }

    // 3. Download
    const content = await zip.generateAsync({type:"blob"});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `terrain_project_${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export async function loadProject(file, scene, camera) {
    try {
        const zip = await JSZip.loadAsync(file);

        let jsonData = null;
        if (zip.file("terrain_data.json")) {
            jsonData = await zip.file("terrain_data.json").async("string");
        } else if (zip.file("data.json")) { // Legacy/Fallback support if naming changes
            jsonData = await zip.file("data.json").async("string");
        }

        if (jsonData) {
            const data = JSON.parse(jsonData);

            // Restore State
            if (data.seed) STATE.seed = data.seed;
            if (data.textures) STATE.currentTexture = data.textures;

            // Restore Height Data
            STATE.heightData.clear();
            if (data.chunks) {
                for (const chunk of data.chunks) {
                    STATE.heightData.set(chunk.key, new Float32Array(chunk.heights));
                }
            }

            // Refresh
            regenerateAllChunks(scene, camera);

            // Trigger UI update for texture if possible (handled by UI init mostly, but visual updates might be needed)
            // We assume main UI loop handles texture state reading

            alert("Project loaded successfully!");
        } else {
            alert("Invalid project file: missing terrain_data.json");
        }
    } catch (e) {
        console.error(e);
        alert("Failed to load project: " + e.message);
    }
}

function generateHeightmapBlob() {
    return new Promise((resolve) => {
        // Calculate Bounds
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
            resolve(null);
            return;
        }

        // Determine Size
        const chunkSize = CONFIG.chunkSize;
        const width = (maxCx - minCx + 1) * chunkSize + 1;
        const height = (maxCz - minCz + 1) * chunkSize + 1;

        // Limit preview size to avoid massive canvas creation issues
        const MAX_DIM = 2048;
        let scale = 1;
        if (width > MAX_DIM || height > MAX_DIM) {
            scale = Math.min(MAX_DIM / width, MAX_DIM / height);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(width * scale);
        canvas.height = Math.floor(height * scale);
        const ctx = canvas.getContext('2d');

        // Draw Logic (Simplified for preview)
        // We will draw rects for pixels if scaling, or direct pixel data if 1:1
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Normalize Heights
        let minH = Infinity, maxH = -Infinity;
        for (const heights of STATE.heightData.values()) {
            for (let i = 0; i < heights.length; i++) {
                const h = heights[i];
                if (h < minH) minH = h;
                if (h > maxH) maxH = h;
            }
        }
        if (maxH - minH < 0.001) maxH = minH + 1;

        const rowVerts = chunkSize + 1;

        // If scaled down significantly, point cloud or rect filling is expensive.
        // But for "save" preview, a decent effort is fine.
        // We iterate chunks.

        for (const [key, heights] of STATE.heightData) {
            const [cx, cz] = key.split(',').map(Number);
            const baseX = (cx - minCx) * chunkSize;
            const baseY = (cz - minCz) * chunkSize;

            for (let i = 0; i < heights.length; i++) {
                const row = Math.floor(i / rowVerts);
                const col = i % rowVerts;

                const h = heights[i];
                const val = Math.floor(((h - minH) / (maxH - minH)) * 255);

                const x = (baseX + col) * scale;
                const y = (baseY + row) * scale;

                ctx.fillStyle = `rgb(${val},${val},${val})`;
                // Draw a small rect to cover the scaled area
                ctx.fillRect(x, y, Math.max(1, scale), Math.max(1, scale));
            }
        }

        canvas.toBlob(resolve, 'image/png');
    });
}