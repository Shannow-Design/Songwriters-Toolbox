// modules/visualizer.js
import { masterAnalyser, ctx } from './audio.js';

export class Visualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.canvas = document.createElement('canvas');
        
        // High resolution for sharp text
        this.canvas.width = 1000; 
        this.canvas.height = 300;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.borderRadius = '6px';
        this.canvas.style.background = '#111'; 
        this.container.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        this.isRunning = true;
        
        this.bufferLength = masterAnalyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);
        
        // Optimization: Pre-calculate Logarithmic scale indices
        this.barCount = 100;
        this.barWidth = this.canvas.width / this.barCount;
        this.barIndices = new Float32Array(this.barCount);
        
        const minFreq = 20;
        const maxFreq = 20000;
        const logMin = Math.log(minFreq);
        const logMax = Math.log(maxFreq);
        const nyquist = ctx.sampleRate / 2;

        for(let i=0; i<this.barCount; i++) {
            const percent = i / this.barCount;
            const freq = Math.exp(logMin + (percent * (logMax - logMin)));
            this.barIndices[i] = (freq / nyquist) * this.bufferLength;
        }

        // State for Title Screen
        this.lastAudioTime = performance.now();
        this.isIdle = true;
        this.pulsePhase = 0;
        
        this.draw();
    }

    draw() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.draw());

        // 1. Get Audio Data
        masterAnalyser.getByteFrequencyData(this.dataArray);

        // 2. Calculate Average Volume (RMS-ish) to detect silence
        let sum = 0;
        // Optimization: Only check every 4th bin to save CPU
        for (let i = 0; i < this.bufferLength; i += 4) {
            sum += this.dataArray[i];
        }
        const average = sum / (this.bufferLength / 4);

        // 3. State Machine Logic
        const now = performance.now();
        if (average > 1) {
            // Sound Detected! Wake up immediately
            this.lastAudioTime = now;
            this.isIdle = false;
        } else if (now - this.lastAudioTime > 2000) {
            // Silence for 2 seconds -> Go to Sleep
            this.isIdle = true;
        }

        // 4. Clear Screen
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, w, h);

        // 5. Render
        if (this.isIdle) {
            this.drawTitleScreen(w, h);
        } else {
            this.drawSpectrum(w, h);
        }
    }

    drawTitleScreen(w, h) {
        this.pulsePhase += 0.02;
        const opacity = 0.5 + (Math.sin(this.pulsePhase) * 0.2); // Pulse between 0.3 and 0.7

        this.ctx.save();
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Main Title
        this.ctx.font = 'bold 60px sans-serif';
        const gradient = this.ctx.createLinearGradient(0, 0, w, 0);
        gradient.addColorStop(0.3, '#00e5ff');
        gradient.addColorStop(0.7, '#aa00ff');
        this.ctx.fillStyle = gradient;
        
        // Glow Effect
        this.ctx.shadowColor = '#00e5ff';
        this.ctx.shadowBlur = 20 * opacity;
        this.ctx.fillText("SONGWRITERS TOOLBOX", w / 2, h / 2 - 10);

        // Subtitle
        this.ctx.shadowBlur = 0;
        this.ctx.font = '20px monospace';
        this.ctx.fillStyle = `rgba(150, 150, 150, ${opacity})`;
        this.ctx.fillText("WAITING FOR AUDIO INPUT...", w / 2, h / 2 + 40);

        this.ctx.restore();
    }

    drawSpectrum(w, h) {
        for (let i = 0; i < this.barCount; i++) {
            const index = this.barIndices[i];
            
            // Interpolation
            const lowerIndex = Math.floor(index);
            const upperIndex = lowerIndex + 1;
            const fraction = index - lowerIndex;

            const lowerValue = (lowerIndex < this.bufferLength) ? this.dataArray[lowerIndex] : 0;
            const upperValue = (upperIndex < this.bufferLength) ? this.dataArray[upperIndex] : 0;

            const value = lowerValue + (upperValue - lowerValue) * fraction;

            const barHeight = (value / 255) * h;
            
            const r = (i / this.barCount) * 150;
            const g = 200 - ((i / this.barCount) * 200);
            const b = 255;
            
            this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            this.ctx.fillRect(i * this.barWidth, h - barHeight, this.barWidth - 1, barHeight);
        }

        this.drawGrid(w, h);
    }

    drawGrid(w, h) {
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; 
        this.ctx.font = 'bold 12px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom'; 

        const dbLevels = [0.25, 0.5, 0.75]; 
        dbLevels.forEach(yPct => {
            const y = h - (h * yPct);
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(w, y);
            this.ctx.stroke();
        });

        const markers = [100, 1000, 10000]; 
        const labels = ['100Hz', '1kHz', '10kHz'];
        const minFreq = 20;
        const maxFreq = 20000;
        const logMin = Math.log(minFreq);
        const logMax = Math.log(maxFreq);

        markers.forEach((markFreq, i) => {
            const logFreq = Math.log(markFreq);
            const percent = (logFreq - logMin) / (logMax - logMin);
            const x = percent * w;

            if (x > 0 && x < w) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, h);
                this.ctx.stroke();

                this.ctx.fillStyle = '#fff';
                this.ctx.shadowColor = '#000';
                this.ctx.shadowBlur = 4;
                this.ctx.fillText(labels[i], x, h - 5);
                this.ctx.shadowBlur = 0; 
            }
        });
    }
    
    stop() {
        this.isRunning = false;
    }
    
    resume() {
        if(!this.isRunning) {
            this.isRunning = true;
            this.draw();
        }
    }
}