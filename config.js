export const CONFIG = {
    chunkSize: 32, // Vertices per side
    chunkRes: 1,   // Distance between vertices
    renderDistance: 2, // Chunks radius
    fogColor: 0x88ccff,
};

export const STATE = {
    brush: {
        radius: 5,
        strength: 0.2,
        mode: 'raise', // raise, lower, flatten, smooth
        active: false
    },
    currentTexture: 'grass',
    textures: {},
    chunks: new Map(), // key: "x,z", value: ChunkMesh
    heightData: new Map(), // key: "x,z", value: Float32Array
    seed: Math.random()
};

