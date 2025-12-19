// modules/tuner.js

const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export class Tuner {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.audioContext = null;
        this.analyser = null;
        this.rafId = null;
        this.mediaStream = null;
        this.isPlaying = false;
        
        this.baseFreq = 440; // Default Standard Tuning
        
        // Render Initial UI
        this.renderUI();
        this.ui = {
            note: this.container.querySelector('.tuner-note'),
            freq: this.container.querySelector('.tuner-freq'),
            needle: this.container.querySelector('.tuner-needle'),
            hzLabel: this.container.querySelector('#hz-val'),
            startBtn: this.container.querySelector('#btn-start-mic'),
            stopBtn: this.container.querySelector('#btn-stop-mic')
        };
    }

    renderUI() {
        this.container.innerHTML = `
            <div class="tuner-display">
                <div class="tuner-meter">
                    ${this.generateTicks()}
                    <div class="tuner-center-marker"></div>
                    <div class="tuner-needle"></div>
                </div>
                
                <div class="tuner-note">-</div>
                <div class="tuner-freq">Click 'Start Tuner'</div>
                
                <div class="tuner-settings">
                    <label>Ref:</label>
                    <input type="range" id="hz-slider" min="430" max="450" value="440" step="1">
                    <span id="hz-val">440 Hz</span>
                </div>

                <div class="tuner-controls">
                    <button id="btn-start-mic">Start Tuner</button>
                    <button id="btn-stop-mic" style="display:none;">Stop Tuner</button>
                </div>
            </div>
        `;
        
        // Bind Buttons
        this.container.querySelector('#btn-start-mic').addEventListener('click', () => this.start());
        this.container.querySelector('#btn-stop-mic').addEventListener('click', () => this.stop());
        
        // Bind Hz Slider
        const slider = this.container.querySelector('#hz-slider');
        const label = this.container.querySelector('#hz-val');
        slider.addEventListener('input', (e) => {
            this.baseFreq = parseInt(e.target.value);
            label.textContent = this.baseFreq + " Hz";
        });
    }

    // Helper to generate visual tick marks
    generateTicks() {
        let ticksHtml = '';
        // 45 degrees corresponds to 50 cents in our visual
        // Range: -45deg to +45deg
        // Ticks every 10 cents? 
        // 50 cents = 45deg -> 1 cent = 0.9 deg
        
        const tickSteps = [-40, -30, -20, -10, 10, 20, 30, 40]; // Cents
        const majorSteps = [-50, -25, 25, 50]; // Major markers

        // Small Ticks
        tickSteps.forEach(cent => {
            const deg = cent * 0.9; 
            // Position ticks using rotation from bottom center
            // left:50% is the pivot. 
            // We need to rotate them and push them to the edge visually.
            // Actually, CSS transform: rotate() works perfectly if origin is bottom center.
            ticksHtml += `<div class="tuner-tick" style="left:50%; transform: translateX(-50%) rotate(${deg}deg); height:8px;"></div>`;
        });

        // Major Ticks
        majorSteps.forEach(cent => {
            const deg = cent * 0.9;
            ticksHtml += `<div class="tuner-tick major" style="left:50%; transform: translateX(-50%) rotate(${deg}deg);"></div>`;
        });
        
        return ticksHtml;
    }

    async start() {
        if (this.isPlaying) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
            microphone.connect(this.analyser);
            
            this.isPlaying = true;
            
            this.ui.startBtn.style.display = 'none';
            this.ui.stopBtn.style.display = 'inline-block';
            
            this.update();
        } catch (err) {
            console.error(err);
            this.ui.freq.textContent = "Mic Error: " + err.message;
        }
    }

    stop() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        
        if(this.mediaStream) this.mediaStream.getTracks().forEach(track => track.stop());
        if(this.audioContext) this.audioContext.close();
        cancelAnimationFrame(this.rafId);
        
        this.ui.note.textContent = "-";
        this.ui.note.style.color = "#444";
        this.ui.freq.textContent = "Stopped";
        this.ui.needle.style.transform = "translateX(-50%) rotate(0deg)";
        
        this.ui.startBtn.style.display = 'inline-block';
        this.ui.stopBtn.style.display = 'none';
    }

    update() {
        if (!this.isPlaying) return;

        const bufferLength = this.analyser.fftSize;
        const buffer = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(buffer);

        const freq = this.autoCorrelate(buffer, this.audioContext.sampleRate);

        if (freq === -1) {
            this.ui.note.style.color = "#444";
            // Don't reset needle immediately to reduce jitter, or slowly return to 0
        } else {
            const note = this.getNote(freq);
            const octave = Math.floor(note / 12) - 1; 
            const cents = this.getCents(freq, note);
            
            this.ui.note.textContent = noteStrings[note % 12] + octave;
            this.ui.freq.textContent = freq.toFixed(1) + " Hz";
            
            if (Math.abs(cents) < 5) {
                this.ui.note.style.color = "#00ff00";
                this.ui.freq.style.color = "#00ff00";
                this.ui.needle.style.background = "#00ff00";
                this.ui.needle.style.boxShadow = "0 0 10px #00ff00";
            } else {
                this.ui.note.style.color = "var(--primary-cyan)";
                this.ui.freq.style.color = "#888";
                this.ui.needle.style.background = "#ff0055";
                this.ui.needle.style.boxShadow = "0 0 5px rgba(255, 0, 85, 0.5)";
            }

            // Visual Mapping: -50 cents = -45deg, +50 cents = +45deg
            // Multiplier = 0.9
            const angle = Math.max(-45, Math.min(45, cents * 0.9));
            this.ui.needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;
        }

        this.rafId = requestAnimationFrame(() => this.update());
    }

    // --- MATH & PHYSICS ---
    autoCorrelate(buffer, sampleRate) {
        let SIZE = buffer.length;
        let rms = 0;
        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) return -1; 

        let r1 = 0, r2 = SIZE - 1, thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
        }
        for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
        }

        buffer = buffer.slice(r1, r2);
        SIZE = buffer.length;

        const c = new Array(SIZE).fill(0);
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE - i; j++) {
                c[i] = c[i] + buffer[j] * buffer[j + i];
            }
        }

        let d = 0;
        while (c[d] > c[d + 1]) d++;
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

    // UPDATED: Uses this.baseFreq (default 440)
    getNote(freq) {
        // Standard formula: Note = 12 * log2(freq / Ref)
        const note = 12 * (Math.log(freq / this.baseFreq) / Math.log(2));
        return Math.round(note) + 69;
    }

    getCents(freq, note) {
        return Math.floor(1200 * Math.log(freq / this.getStandardFrequency(note)) / Math.log(2));
    }

    // UPDATED: Uses this.baseFreq
    getStandardFrequency(note) {
        return this.baseFreq * Math.pow(2, (note - 69) / 12);
    }
}