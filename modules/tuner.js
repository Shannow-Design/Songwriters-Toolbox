// modules/tuner.js
import { ctx, Microphone } from './audio.js';

export class Tuner {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.isRunning = false;
        this.frameId = null;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="tuner-display">
                <div class="tuner-note" id="tuner-note">--</div>
                <div class="tuner-cents" id="tuner-cents">0</div>
                <div class="tuner-meter">
                    <div class="tuner-needle" id="tuner-needle"></div>
                    <div class="tuner-center-mark"></div>
                </div>
                <div class="tuner-freq" id="tuner-freq">0.0 Hz</div>
                <button id="btn-tuner-start" style="margin-top:10px; padding:5px 15px; background:#333; color:white; border:none; cursor:pointer;">Start Tuner</button>
            </div>
        `;
        
        const style = document.createElement('style');
        style.innerHTML = `
            .tuner-display { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; }
            .tuner-note { font-size: 3rem; font-weight: bold; color: #00e5ff; margin-bottom: 5px; min-height: 60px; }
            .tuner-cents { font-size: 0.9rem; color: #888; margin-bottom: 10px; }
            .tuner-meter { position: relative; width: 200px; height: 10px; background: #222; border-radius: 5px; margin-bottom: 5px; overflow: hidden; }
            .tuner-center-mark { position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: #00e5ff; transform: translateX(-50%); }
            .tuner-needle { position: absolute; top: 0; bottom: 0; width: 4px; background: #ff0055; left: 50%; transform: translateX(-50%); transition: left 0.1s ease-out; }
            .tuner-freq { font-family: monospace; color: #666; font-size: 0.8rem; }
        `;
        this.container.appendChild(style);

        this.container.querySelector('#btn-tuner-start').addEventListener('click', () => {
            if (this.isRunning) this.stop(); else this.start();
        });
    }

    async start() {
        if (this.isRunning) return;
        await Microphone.init();
        if (ctx.state === 'suspended') await ctx.resume();
        
        this.isRunning = true;
        this.container.querySelector('#btn-tuner-start').textContent = "Stop Tuner";
        this.container.querySelector('#btn-tuner-start').style.background = "#ff0055";
        
        this.update();
    }

    stop() {
        this.isRunning = false;
        cancelAnimationFrame(this.frameId);
        this.container.querySelector('#btn-tuner-start').textContent = "Start Tuner";
        this.container.querySelector('#btn-tuner-start').style.background = "#333";
        this.resetUI();
    }

    resetUI() {
        document.getElementById('tuner-note').textContent = "--";
        document.getElementById('tuner-cents').textContent = "0";
        document.getElementById('tuner-freq').textContent = "0.0 Hz";
        document.getElementById('tuner-needle').style.left = "50%";
        document.getElementById('tuner-needle').style.background = "#ff0055";
    }

    update() {
        if (!this.isRunning) return;

        const bufferLength = Microphone.analyserNode.fftSize;
        const buffer = new Float32Array(bufferLength);
        Microphone.analyserNode.getFloatTimeDomainData(buffer);

        const pitch = this.autoCorrelate(buffer, ctx.sampleRate);

        if (pitch !== -1) {
            const noteData = this.getNote(pitch);
            this.updateUI(noteData, pitch);
        }

        this.frameId = requestAnimationFrame(() => this.update());
    }

    // --- ROBUST AUTOCORRELATION ALGORITHM ---
    autoCorrelate(buf, sampleRate) {
        let SIZE = buf.length;
        let rms = 0;

        for (let i = 0; i < SIZE; i++) {
            const val = buf[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);

        if (rms < 0.01) return -1;

        let r1 = 0, r2 = SIZE - 1, thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(buf[i]) < thres) { r1 = i; break; }
        }
        for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
        }

        buf = buf.slice(r1, r2);
        SIZE = buf.length;

        let c = new Array(SIZE).fill(0);
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE - i; j++) {
                c[i] = c[i] + buf[j] * buf[j + i];
            }
        }

        let d = 0; while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < SIZE; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }
        let T0 = maxpos;

        let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        let a = (x1 + x3 - 2 * x2) / 2;
        let b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);

        return sampleRate / T0;
    }

    getNote(freq) {
        const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const noteNum = 12 * (Math.log(freq / 440) / Math.log(2));
        const noteRounded = Math.round(noteNum) + 69;
        const noteIndex = noteRounded % 12;
        const octave = Math.floor(noteRounded / 12) - 1;
        
        const cents = Math.floor((noteNum - Math.round(noteNum)) * 100);
        
        return {
            name: noteStrings[noteIndex],
            octave: octave,
            cents: cents,
            freq: freq
        };
    }

    updateUI(note, freq) {
        const noteEl = document.getElementById('tuner-note');
        const centsEl = document.getElementById('tuner-cents');
        const freqEl = document.getElementById('tuner-freq');
        const needle = document.getElementById('tuner-needle');

        // --- UPDATED: Display Note + Octave (e.g., E2) ---
        noteEl.textContent = note.name + note.octave; 
        
        centsEl.textContent = note.cents > 0 ? `+${note.cents}` : note.cents;
        freqEl.textContent = freq.toFixed(1) + " Hz";

        let percent = 50 + (note.cents); 
        if(percent < 0) percent = 0; if(percent > 100) percent = 100;
        
        needle.style.left = `${percent}%`;

        if (Math.abs(note.cents) < 5) {
            needle.style.background = "#00ff00"; 
            noteEl.style.color = "#00ff00";
        } else {
            needle.style.background = "#ff0055";
            noteEl.style.color = "#00e5ff";
        }
    }
}