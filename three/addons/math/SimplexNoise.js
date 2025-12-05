import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class SimplexNoise {
    constructor() {
        this.gradients = {};
        this.perm = [];
        this.octaves = 6;
        this.falloff = 0.5;
    }

    seed(seed) {
        this.perm = [];
        for (let i = 0; i < 256; i++) {
            this.perm.push(Math.floor(Math.random() * 256));
        }
        if (seed) {
            for (let i = 0; i < 256; i++) {
                this.perm[i] = (this.perm[i] + seed) % 256;
            }
        }
    }

    noise(x, y, z) {
        let X = Math.floor(x) & 255;
        let Y = Math.floor(y) & 255;
        let Z = Math.floor(z) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        let u = this.fade(x);
        let v = this.fade(y);
        let w = this.fade(z);
        let A = this.perm[X] + Y;
        let B = this.perm[X + 1] + Y;
        let AA = this.perm[A] + Z;
        let BA = this.perm[B] + Z;
        let AB = this.perm[A + 1] + Z;
        let BB = this.perm[B + 1] + Z;
        return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.perm[AA], x, y, z),
            this.grad(this.perm[BA], x - 1, y, z)),
            this.lerp(u, this.grad(this.perm[AB], x, y - 1, z),
                this.grad(this.perm[BB], x - 1, y - 1, z))),
            this.lerp(v, this.lerp(u, this.grad(this.perm[AA + 1], x, y, z - 1),
                this.grad(this.perm[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.perm[AB + 1], x, y - 1, z - 1),
                    this.grad(this.perm[BB + 1], x - 1, y - 1, z - 1))));
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, y, z) {
        let h = hash % 12;
        let u = h < 4 ? x : h < 8 ? y : z;
        let v = h < 4 ? y : h < 8 ? z : x;
        let w = h < 4 ? z : h < 8 ? x : y;
        let noise = h % 2 === 0 ? u + v + w : u - v - w;
        return noise;
    }
}

export { SimplexNoise };