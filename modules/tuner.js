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
        
        // Render Initial UI
        this.renderUI();
        this.ui = {
            note: this.container.querySelector('.tuner-note'),
            freq: this.container.querySelector('.tuner-freq'),
            needle: this.container.querySelector('.tuner-needle'),
            startBtn: this.container.querySelector('#btn-start-mic'),
            stopBtn: this.container.querySelector('#btn-stop-mic')
        };
    }

    renderUI() {
        this.container.innerHTML = `
            <div class="tuner-display">
                <div class="tuner-meter">
                    <div class="tuner-needle"></div>
                    <div class="tuner-center-marker"></div>
                </div>
                <div class="tuner-note">-</div>
                <div class="tuner-freq">Click 'Start Tuner'</div>
                
                <div class="tuner-controls">
                    <button id="btn-start-mic">Start Tuner</button>
                    <button id="btn-stop-mic" style="display:none;">Stop Tuner</button>
                </div>
            </div>
        `;
        
        // Bind Buttons
        this.container.querySelector('#btn-start-mic').addEventListener('click', () => this.start());
        this.container.querySelector('#btn-stop-mic').addEventListener('click', () => this.stop());
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
            
            // Toggle Buttons
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
        
        // Stop Audio Tracks
        if(this.mediaStream) this.mediaStream.getTracks().forEach(track => track.stop());
        if(this.audioContext) this.audioContext.close();
        cancelAnimationFrame(this.rafId);
        
        // Reset UI
        this.ui.note.textContent = "-";
        this.ui.note.style.color = "#444";
        this.ui.freq.textContent = "Stopped";
        this.ui.needle.style.transform = "rotate(0deg)";
        
        // Toggle Buttons
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
            // No sound detected
            this.ui.note.style.color = "#444";
        } else {
            const note = this.getNote(freq);
            const cents = this.getCents(freq, note);
            
            this.ui.note.textContent = noteStrings[note % 12];
            this.ui.freq.textContent = freq.toFixed(1) + " Hz";
            
            // Visual Updates
            if (Math.abs(cents) < 5) {
                this.ui.note.style.color = "#00ff00";
                this.ui.freq.style.color = "#00ff00";
            } else {
                this.ui.note.style.color = "var(--primary-cyan)";
                this.ui.freq.style.color = "#888";
            }

            const angle = Math.max(-45, Math.min(45, cents));
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

    getNote(freq) {
        const note = 12 * (Math.log(freq / 440) / Math.log(2));
        return Math.round(note) + 69;
    }

    getCents(freq, note) {
        return Math.floor(1200 * Math.log(freq / this.getStandardFrequency(note)) / Math.log(2));
    }

    getStandardFrequency(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }
}