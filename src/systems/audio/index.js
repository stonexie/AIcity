// Audio system entry point: procedural synth worker + WebAudio mix graph + reactive city soundscape.
import * as THREE from 'three/webgpu';
import { AudioCore } from './core.js';
import { Soundscape } from './soundscape.js';
import { ORDER, generate } from './synth.js';

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();

export default {
  async init(ctx) {
    this.ctx = ctx;
    this.core = new AudioCore();
    this.soundscape = null;
    this.started = false;

    const ensureStart = () => {
      if (this.started || ctx.isShot) return;
      const ac = this.core.start();
      if (!ac) return;
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      if (!this.soundscape) {
        this.soundscape = new Soundscape(this.core, ctx);
      }
      this.started = true;
    };

    if (!ctx.isShot && typeof window !== 'undefined') {
      const unlock = () => {
        ensureStart();
        if (this.core.ac?.state === 'running') {
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('keydown', unlock);
        }
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });

      // Synthesize procedural audio buffers in background Web Worker
      try {
        const worker = new Worker(new URL('./synth.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => {
          const d = e.data;
          if (d?.type === 'buffer') {
            this.core.addRaw(d.name, d);
          } else if (d?.type === 'done') {
            worker.terminate();
          }
        };
        worker.postMessage({ order: ORDER });
      } catch (e) {
        console.warn('[audio] worker fallback to main-thread lazy synth', e);
        setTimeout(() => {
          for (const name of ORDER.slice(0, 6)) {
            try { this.core.addRaw(name, generate(name)); } catch { /* ignore */ }
          }
        }, 500);
      }
    }

    ctx.api.audio = {
      core: this.core,
      get soundscape() { return this.soundscape; },
      start: ensureStart,
    };
  },

  update(dt, t, ctx) {
    if (!this.soundscape || !this.core.ac || this.core.ac.state !== 'running') return;
    const cam = ctx.camera;
    const listener = this.core.ac.listener;
    const p = cam.position;
    cam.getWorldDirection(_fwd);
    _up.set(0, 1, 0).applyQuaternion(cam.quaternion);

    if (listener.positionX) {
      const now = this.core.ac.currentTime;
      listener.positionX.setValueAtTime(p.x, now);
      listener.positionY.setValueAtTime(p.y, now);
      listener.positionZ.setValueAtTime(p.z, now);
      listener.forwardX.setValueAtTime(_fwd.x, now);
      listener.forwardY.setValueAtTime(_fwd.y, now);
      listener.forwardZ.setValueAtTime(_fwd.z, now);
      listener.upX.setValueAtTime(_up.x, now);
      listener.upY.setValueAtTime(_up.y, now);
      listener.upZ.setValueAtTime(_up.z, now);
    } else if (listener.setPosition) {
      listener.setPosition(p.x, p.y, p.z);
      listener.setOrientation(_fwd.x, _fwd.y, _fwd.z, _up.x, _up.y, _up.z);
    }

    this.soundscape.setListener(p);
    this.soundscape.update(dt, ctx);
  },
};
