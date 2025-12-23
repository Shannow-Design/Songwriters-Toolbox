// modules/studio.js
import { Microphone, startStudioRecording, ctx } from './audio.js';

export class Studio {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        this.isRecording = false;
        this.recorder = null;
        this.timerInterval = null;
        this.startTime = 0;

        this.render();
        this.initCanvasMeter();
    }

    render() {
        this.container.innerHTML = `
            <div class="studio-panel">
                <div class="studio-controls">
                    <button id="btn-studio-rec" class="btn-big-rec">● REC</button>
                    <div id="studio-timer" class="studio-timer">00:00</div>
                </div>

                <div class="studio-mixer">
                    <div class="meter-container">
                        <canvas id="studio-vu-meter" width="200" height="20"></canvas>
                    </div>
                    
                    <div class="slider-group">
                        <label>VOCAL / MIC GAIN</label>
                        <input type="range" id="studio-mic-gain" min="0" max="3" step="0.1" value="1">
                    </div>

                    <div class="fx-group">
                        <input type="checkbox" id="cb-vocal-fx" class="fx-checkbox">
                        <label for="cb-vocal-fx">✨ Vocal Enhance (Comp + Rev + EQ)</label>
                    </div>
                    
                    <div class="slider-group" id="reverb-slider-group" style="display:none; margin-top:5px;">
                        <label>REVERB AMOUNT</label>
                        <input type="range" id="studio-reverb-amt" min="0" max="1" step="0.05" value="0.3">
                    </div>
                </div>

                <div class="studio-info">
                    <p>Records Everything: Sequencer + Loop Station + Vocals</p>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.innerHTML = `
            .studio-panel { 
                background: #1a1a1a; padding: 20px; border-radius: 8px; border: 1px solid #333;
                display: flex; flex-direction: column; align-items: center; gap: 20px;
            }
            .studio-controls { display: flex; align-items: center; gap: 20px; }
            
            .btn-big-rec { 
                width: 80px; height: 80px; border-radius: 50%; border: 4px solid #444;
                background: #222; color: #ff0055; font-weight: bold; font-size: 1.2rem;
                cursor: pointer; transition: all 0.2s;
            }
            .btn-big-rec:hover { border-color: #ff0055; background: #333; }
            .btn-big-rec.recording { 
                background: #ff0055; color: white; border-color: white; 
                box-shadow: 0 0 20px rgba(255, 0, 85, 0.6); animation: pulse 1.5s infinite;
            }

            @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }

            .studio-timer { font-family: monospace; font-size: 2rem; color: #00e5ff; text-shadow: 0 0 10px rgba(0,229,255,0.3); }

            .studio-mixer { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 15px; }
            
            .meter-container { background: #111; border-radius: 4px; border: 1px solid #333; padding: 2px; }
            #studio-vu-meter { width: 100%; height: 20px; display: block; }

            .slider-group { display: flex; flex-direction: column; gap: 5px; }
            .slider-group label { font-size: 0.7rem; color: #888; font-weight: bold; letter-spacing: 1px; }
            .slider-group input { width: 100%; accent-color: #ff0055; }

            .fx-group { display: flex; align-items: center; gap: 8px; justify-content: center; background: #222; padding: 8px; border-radius: 4px; border: 1px solid #333; }
            .fx-checkbox { width: 16px; height: 16px; accent-color: #00e5ff; cursor: pointer; }
            .fx-group label { color: #ccc; font-size: 0.9rem; cursor: pointer; }

            .studio-info { font-size: 0.8rem; color: #555; font-style: italic; }
        `;
        this.container.appendChild(style);

        // Bindings
        this.container.querySelector('#btn-studio-rec').addEventListener('click', () => this.toggleRecording());
        this.container.querySelector('#studio-mic-gain').addEventListener('input', (e) => {
            Microphone.setGain(parseFloat(e.target.value));
        });

        // Vocal FX Logic
        const cbFx = this.container.querySelector('#cb-vocal-fx');
        const revGroup = this.container.querySelector('#reverb-slider-group');
        const revSlider = this.container.querySelector('#studio-reverb-amt');

        cbFx.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            Microphone.setFxEnabled(enabled);
            revGroup.style.display = enabled ? 'flex' : 'none';
            // Need to re-connect if active
            if(Microphone.studioConnection) {
                Microphone.connectToStudio();
            }
        });

        revSlider.addEventListener('input', (e) => {
            Microphone.setReverbAmount(parseFloat(e.target.value));
        });
    }

    async toggleRecording() {
        const btn = this.container.querySelector('#btn-studio-rec');
        
        if (this.isRecording) {
            // STOP
            this.isRecording = false;
            clearInterval(this.timerInterval);
            btn.textContent = "● REC";
            btn.classList.remove('recording');
            
            if (this.recorder) {
                const blob = await this.recorder.stop();
                this.downloadRecording(blob);
                this.recorder = null;
            }
        } else {
            // START
            // Ensure Mic is initialized
            await Microphone.init();
            
            if (ctx.state === 'suspended') await ctx.resume();

            this.recorder = startStudioRecording();
            this.isRecording = true;
            this.startTime = Date.now();
            
            btn.textContent = "■ STOP";
            btn.classList.add('recording');

            this.timerInterval = setInterval(() => {
                const elapsed = Date.now() - this.startTime;
                const secs = Math.floor(elapsed / 1000) % 60;
                const mins = Math.floor(elapsed / 60000);
                this.container.querySelector('#studio-timer').textContent = 
                    `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }, 1000);
        }
    }

    downloadRecording(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `song-export-${timestamp}.webm`; // WebM is standard for browser recording
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    }

    initCanvasMeter() {
        const canvas = document.getElementById('studio-vu-meter');
        if (!canvas) return;
        const cCtx = canvas.getContext('2d');
        
        const draw = () => {
            requestAnimationFrame(draw);
            
            // Only draw if module is visible
            if (this.container.offsetParent === null) return; 

            const width = canvas.width;
            const height = canvas.height;
            cCtx.clearRect(0, 0, width, height);

            let level = 0;
            if (Microphone.isInitialized) {
                level = Microphone.getLevel();
            }

            // Draw Background
            cCtx.fillStyle = '#222';
            cCtx.fillRect(0, 0, width, height);

            // Draw Level
            const fillWidth = Math.min(width, level * width * 1.5); // 1.5x gain for visual
            
            // Gradient
            const grad = cCtx.createLinearGradient(0, 0, width, 0);
            grad.addColorStop(0, '#00ff55');
            grad.addColorStop(0.6, '#ffff00');
            grad.addColorStop(1, '#ff0055');
            
            cCtx.fillStyle = grad;
            cCtx.fillRect(0, 0, fillWidth, height);
        };
        draw();
    }
}