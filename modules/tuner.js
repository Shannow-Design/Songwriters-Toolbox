// modules/tuner.js
import { ctx, Microphone } from './audio.js';
import { getNoteIndex } from './theory.js';

// --- STANDARD TUNINGS REFERENCE ---
// Arrays are defined from Low Pitch to High Pitch (mostly) or String N to String 1 order logic
const STANDARD_TUNINGS = {
    'guitar':  ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], // Indices: 0=String 6 ... 5=String 1
    'bass':    ['E1', 'A1', 'D2', 'G2'],             // Indices: 0=String 4 ... 3=String 1
    'violin':  ['G3', 'D4', 'A4', 'E5'],             // Indices: 0=String 4 ... 3=String 1
    'ukulele': ['G4', 'C4', 'E4', 'A4'],             // Indices: 0=String 4 (High G) ... 3=String 1
    'banjo':   ['G4', 'D3', 'G3', 'B3', 'D4'],       // Indices: 0=String 5 (Drone) ... 4=String 1
    'mandolin':['G3', 'D4', 'A4', 'E5']
};

export class Tuner {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.isRunning = false;
        this.frameId = null;
        this.currentMode = 'chromatic'; 
        this.targetNotes = []; 
        
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="tuner-header" style="display:flex; justify-content:space-between; width:100%; margin-bottom:10px;">
                <select id="tuner-mode" style="background:#222; color:#ccc; border:1px solid #444; padding:2px; font-size:0.75rem;">
                    <option value="chromatic">Chromatic (Auto)</option>
                    <option value="guitar">Guitar</option>
                    <option value="bass">Bass</option>
                    <option value="violin">Violin</option>
                    <option value="ukulele">Ukulele</option>
                    <option value="banjo">Banjo</option>
                    <option value="mandolin">Mandolin</option>
                </select>
                <div id="tuner-target-info" style="font-size:0.75rem; color:#888;">Any Note</div>
            </div>

            <div class="tuner-display">
                <div id="tuner-string-indicator" style="font-size: 0.9rem; color: #ffaa00; font-weight: bold; height: 1.2em; margin-bottom: 5px;"></div>

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
            .tuner-note { font-size: 3rem; font-weight: bold; color: #00e5ff; margin-bottom: 5px; min-height: 60px; line-height: 1; }
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

        this.container.querySelector('#tuner-mode').addEventListener('change', (e) => {
            this.currentMode = e.target.value;
            this.updateTargetNotes();
        });
    }

    updateTargetNotes() {
        const infoEl = document.getElementById('tuner-target-info');
        
        if (this.currentMode === 'chromatic') {
            this.targetNotes = [];
            infoEl.textContent = "Any Note";
            return;
        }

        let notesToTune = [];
        
        if (this.currentMode === 'guitar') {
            const globalTuningEl = document.getElementById('tuning-select');
            if (globalTuningEl && globalTuningEl.selectedOptions[0]) {
                const tuningName = globalTuningEl.selectedOptions[0].text;
                infoEl.textContent = tuningName;
                const rawNotes = this.getGlobalTuningNotes('tuning-select');
                if (rawNotes.length === 6) {
                    // Standard Octaves: 2 2 3 3 3 4
                    const octaves = [2, 2, 3, 3, 3, 4];
                    // Correction for Drop Tunings if needed (usually handled by rawNotes name check ideally)
                    // But for simple "Drop D", the low D becomes D2 (matches E2 slot).
                    // For "Baritone" logic we might need more complex octave mapping, but this covers standard variations.
                    notesToTune = rawNotes.map((n, i) => `${n}${octaves[i]}`);
                }
            }
        } 
        else if (this.currentMode === 'bass') {
            const globalBassEl = document.getElementById('bass-tuning-select');
            if (globalBassEl) {
                infoEl.textContent = globalBassEl.selectedOptions[0].text;
                const rawNotes = this.getGlobalTuningNotes('bass-tuning-select');
                if (rawNotes.length === 4) {
                    const octaves = [1, 1, 2, 2];
                    notesToTune = rawNotes.map((n, i) => `${n}${octaves[i]}`);
                } else if (rawNotes.length === 5) {
                    const octaves = [0, 1, 1, 2, 2];
                    notesToTune = rawNotes.map((n, i) => `${n}${octaves[i]}`);
                }
            }
        }

        if (notesToTune.length === 0) {
            notesToTune = STANDARD_TUNINGS[this.currentMode] || [];
            infoEl.textContent = `Standard ${this.currentMode.charAt(0).toUpperCase() + this.currentMode.slice(1)}`;
        }

        this.targetNotes = notesToTune.map(noteStr => {
            const name = noteStr.slice(0, -1);
            const oct = parseInt(noteStr.slice(-1));
            return {
                name: noteStr,
                freq: this.getFreq(name, oct)
            };
        });
    }

    getGlobalTuningNotes(elementId) {
        const el = document.getElementById(elementId);
        if(!el) return [];
        const val = el.value; 
        
        if (val === 'drop_d') return ['D', 'A', 'D', 'G', 'B', 'E'];
        if (val === 'dadgad') return ['D', 'A', 'D', 'G', 'A', 'D'];
        if (val === 'open_g') return ['D', 'G', 'D', 'G', 'B', 'D'];
        if (val === 'bass_drop_d') return ['D', 'A', 'D', 'G'];
        if (val === 'bass_5_string') return ['B', 'E', 'A', 'D', 'G'];
        
        if (elementId.includes('bass')) return ['E', 'A', 'D', 'G'];
        return ['E', 'A', 'D', 'G', 'B', 'E'];
    }

    getFreq(note, octave) {
        const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const index = notes.indexOf(note);
        const semitones = (index - 9) + ((octave - 4) * 12);
        return 440 * Math.pow(2, semitones / 12);
    }

    async start() {
        if (this.isRunning) return;
        await Microphone.init();
        if (ctx.state === 'suspended') await ctx.resume();
        
        this.updateTargetNotes(); 
        
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
        document.getElementById('tuner-string-indicator').textContent = "";
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
            if (this.currentMode === 'chromatic') {
                const noteData = this.getNote(pitch);
                this.updateUI(noteData, pitch);
            } else {
                // Find closest target string AND its index
                const result = this.findClosestTarget(pitch);
                const noteData = this.getNoteRelativeToTarget(pitch, result.target);
                this.updateUI(noteData, pitch, result.target.name, result.index);
            }
        }

        this.frameId = requestAnimationFrame(() => this.update());
    }

    findClosestTarget(pitch) {
        let closest = this.targetNotes[0];
        let closestIndex = 0;
        let minDiff = Math.abs(pitch - closest.freq);
        
        this.targetNotes.forEach((t, i) => {
            const diff = Math.abs(pitch - t.freq);
            if (diff < minDiff) {
                minDiff = diff;
                closest = t;
                closestIndex = i;
            }
        });
        return { target: closest, index: closestIndex };
    }

    getNoteRelativeToTarget(pitch, target) {
        const cents = 1200 * Math.log2(pitch / target.freq);
        return {
            name: target.name,
            cents: Math.round(cents),
            freq: pitch
        };
    }

    autoCorrelate(buf, sampleRate) {
        let SIZE = buf.length;
        let rms = 0;
        for (let i = 0; i < SIZE; i++) { const val = buf[i]; rms += val * val; }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) return -1;

        let r1 = 0, r2 = SIZE - 1, thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i]) < thres) { r1 = i; break; } }
        for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; } }
        buf = buf.slice(r1, r2); SIZE = buf.length;

        let c = new Array(SIZE).fill(0);
        for (let i = 0; i < SIZE; i++) { for (let j = 0; j < SIZE - i; j++) { c[i] = c[i] + buf[j] * buf[j + i]; } }

        let d = 0; while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < SIZE; i++) { if (c[i] > maxval) { maxval = c[i]; maxpos = i; } }
        let T0 = maxpos;

        let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        let a = (x1 + x3 - 2 * x2) / 2; let b = (x3 - x1) / 2;
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
        return { name: noteStrings[noteIndex] + octave, cents: cents };
    }

    updateUI(note, freq, targetName = null, stringIndex = null) {
        const noteEl = document.getElementById('tuner-note');
        const centsEl = document.getElementById('tuner-cents');
        const freqEl = document.getElementById('tuner-freq');
        const needle = document.getElementById('tuner-needle');
        const stringEl = document.getElementById('tuner-string-indicator');

        if (targetName !== null && stringIndex !== null) {
            // Calculate String Number (TotalStrings - Index)
            // e.g. Guitar (6 strings): Index 0 (Low E) -> 6-0 = String 6. Index 5 -> 6-5 = String 1.
            const totalStrings = this.targetNotes.length;
            const stringNum = totalStrings - stringIndex; 
            stringEl.textContent = `String ${stringNum}`;
            noteEl.textContent = targetName; 
        } else {
            stringEl.textContent = "";
            noteEl.textContent = note.name;
        }
        
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