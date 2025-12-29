// modules/drumSampler.js
import { Microphone, recordSample, autoTrimBuffer, DRUM_SAMPLES, playDrum, ctx, decodeAudioFile, bufferToWav, setDrumVolume, unloadDrumSample } from './audio.js';
import { SampleStorage } from './storage.js';

const DRUM_NAMES = ['Kick', 'Snare', 'HiHat', 'Tom', 'Crash'];
const DRUM_KEYS = ['kick', 'snare', 'hihat', 'tom', 'crash'];

export class DrumSampler {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.recorders = new Array(5).fill(null);
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-gray-500 font-bold text-sm tracking-wider uppercase">Drum Sampler</h3>
                <div class="text-xs text-gray-500 font-mono">Hold REC to record • Sliders to mix</div>
            </div>
            <div class="drum-pads-container" id="drum-slots"></div>
        `;

        const slotsContainer = this.container.querySelector('#drum-slots');

        DRUM_NAMES.forEach((name, i) => {
            const pad = document.createElement('div');
            pad.className = 'drum-pad';
            pad.innerHTML = `
                <div class="pad-header">
                    <span class="pad-title">${name}</span>
                    <div class="status-led" id="drum-led-${i}" title="Synth Mode"></div>
                </div>
                
                <div class="pad-controls">
                    <button class="btn-drum-rec" data-index="${i}">● REC</button>
                    <button class="btn-drum-play" data-index="${i}">▶</button>
                </div>
                
                <div class="pad-volume-row">
                    <input type="range" class="drum-vol-slider" data-index="${i}" min="0" max="1.5" step="0.1" value="1.0" title="Volume">
                </div>

                <div class="pad-footer">
                    <input type="file" id="file-drum-${i}" accept="audio/*" style="display:none">
                    
                    <button class="btn-icon load-btn" data-index="${i}" title="Load Sample">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </button>

                    <button class="btn-icon save-btn" data-index="${i}" title="Download WAV">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                    </button>

                    <button class="btn-icon unload-btn" data-index="${i}" title="Unload / Revert to Synth">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
            slotsContainer.appendChild(pad);
        });

        this.addStyles();
        this.bindEvents();
        this.updateStatus();
    }

    addStyles() {
        if (document.getElementById('drum-sampler-styles')) return;
        const style = document.createElement('style');
        style.id = 'drum-sampler-styles';
        style.innerHTML = `
            .drum-pads-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: 12px;
            }
            .drum-pad {
                background: #1a1a1a; border: 1px solid #333; border-radius: 6px;
                padding: 10px; display: flex; flex-direction: column; gap: 10px;
                transition: border-color 0.2s; min-width: 110px;
            }
            .drum-pad:hover { border-color: #00e5ff; box-shadow: 0 0 10px rgba(0, 229, 255, 0.1); }
            
            .pad-header { display: flex; justify-content: space-between; align-items: center; }
            .pad-title { font-size: 0.75rem; font-weight: bold; color: #00e5ff; text-transform: uppercase; letter-spacing: 0.05em; }
            
            .status-led { width: 6px; height: 6px; background: #333; border-radius: 50%; box-shadow: inset 0 0 2px #000; }
            .status-led.active { background: #00ff00; box-shadow: 0 0 6px #00ff00; }
            
            .pad-controls { display: flex; gap: 6px; }
            .btn-drum-rec { flex: 2; background: #331111; color: #ffcccc; border: 1px solid #552222; font-size: 0.65rem; padding: 6px; border-radius: 4px; cursor: pointer; transition: all 0.2s; font-weight: bold; }
            .btn-drum-rec:hover { background: #551111; border-color: #772222; color: #fff; }
            .btn-drum-rec:active, .btn-drum-rec.recording { background: #ff0000; border-color: #ff0000; color: white; box-shadow: 0 0 8px #ff0000; animation: pulseRed 1s infinite; }
            
            .btn-drum-play { flex: 1; background: #222; color: #ccc; border: 1px solid #444; font-size: 0.65rem; padding: 6px; border-radius: 4px; cursor: pointer; transition: all 0.1s; }
            .btn-drum-play:hover { background: #333; border-color: #666; color: #fff; }
            .btn-drum-play:active { background: #00e5ff; border-color: #00e5ff; color: #000; }
            
            .pad-volume-row { display: flex; align-items: center; justify-content: center; height: 10px; }
            .drum-vol-slider { width: 100%; height: 3px; accent-color: #00e5ff; cursor: pointer; background: #333; border-radius: 2px; }

            .pad-footer { display: flex; justify-content: space-between; margin-top: auto; padding-top: 8px; border-top: 1px solid #2a2a2a; }
            .btn-icon { background: none; border: none; color: #555; cursor: pointer; padding: 2px; transition: color 0.2s; display: flex; align-items: center; }
            .btn-icon:hover { color: #aaa; }
            .btn-icon.load-btn:hover { color: #fbbf24; }
            .btn-icon.save-btn:hover { color: #00e5ff; }
            .btn-icon.unload-btn:hover { color: #ef4444; }

            @keyframes pulseRed { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    bindEvents() {
        // REC & PLAY
        const recBtns = this.container.querySelectorAll('.btn-drum-rec');
        const playBtns = this.container.querySelectorAll('.btn-drum-play');
        recBtns.forEach(btn => {
            const index = parseInt(btn.dataset.index);
            btn.addEventListener('mousedown', (e) => this.startRecording(index, e.target));
            btn.addEventListener('mouseup', () => this.stopRecording(index));
            btn.addEventListener('mouseleave', () => this.stopRecording(index));
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); this.startRecording(index, e.target); });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); this.stopRecording(index); });
        });
        playBtns.forEach(btn => {
            btn.addEventListener('click', () => { const index = parseInt(btn.dataset.index); playDrum(DRUM_KEYS[index]); this.flashLed(index); });
        });

        // VOLUME
        this.container.querySelectorAll('.drum-vol-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                setDrumVolume(index, parseFloat(e.target.value));
            });
        });

        // FILE LOAD
        this.container.querySelectorAll('.load-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = btn.dataset.index;
                const input = this.container.querySelector(`#file-drum-${index}`);
                if(input) input.click();
            });
        });
        this.container.querySelectorAll('input[type="file"]').forEach(input => {
            input.addEventListener('change', (e) => this.handleFileUpload(e));
        });

        // SAVE & UNLOAD
        this.container.querySelectorAll('.save-btn').forEach(btn => {
            btn.addEventListener('click', () => this.downloadSample(btn.dataset.index));
        });
        this.container.querySelectorAll('.unload-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if(confirm("Revert this pad to default synth sound?")) {
                    const index = parseInt(btn.dataset.index);
                    unloadDrumSample(index).then(() => {
                        this.updateStatus();
                        console.log("Unloaded drum " + index);
                    });
                }
            });
        });
    }

    async startRecording(index, btn) {
        if (this.recorders[index]) return;
        await Microphone.init();
        if (ctx.state === 'suspended') await ctx.resume();
        btn.classList.add('recording'); btn.textContent = "●";
        this.recorders[index] = recordSample(Microphone.stream, 5.0);
    }

    async stopRecording(index) {
        if (!this.recorders[index]) return;
        const recorder = this.recorders[index]; this.recorders[index] = null; 
        const btn = this.container.querySelector(`.btn-drum-rec[data-index="${index}"]`);
        btn.classList.remove('recording'); btn.textContent = "● REC";
        const rawBuffer = await recorder.stop();
        if (rawBuffer) {
            const trimmed = autoTrimBuffer(rawBuffer);
            await this.saveAndSetSample(index, trimmed, `Custom ${DRUM_NAMES[index]}`);
        }
    }

    async handleFileUpload(e) {
        const file = e.target.files[0]; if (!file) return;
        const index = parseInt(e.target.id.split('-')[2]);
        const buffer = await decodeAudioFile(file);
        if (buffer) { await this.saveAndSetSample(index, buffer, file.name); console.log(`Loaded ${file.name}`); }
        e.target.value = ''; 
    }

    async saveAndSetSample(index, buffer, name) {
        await SampleStorage.saveSample(index, buffer, name, 'drum');
        DRUM_SAMPLES[index] = { buffer: buffer, name: name };
        this.updateStatus();
    }

    downloadSample(index) {
        const sample = DRUM_SAMPLES[index];
        if (!sample || !sample.buffer) { alert("No sample recorded/loaded in this slot."); return; }
        const blob = bufferToWav(sample.buffer);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.style.display = 'none'; a.href = url; a.download = `${DRUM_NAMES[index]}_Sample.wav`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
    }

    updateStatus() {
        for(let i=0; i<5; i++) {
            const led = this.container.querySelector(`#drum-led-${i}`);
            if(led) {
                if (DRUM_SAMPLES[i] && DRUM_SAMPLES[i].buffer) { led.classList.add('active'); led.title = DRUM_SAMPLES[i].name; } 
                else { led.classList.remove('active'); led.title = "Synth Mode (Default)"; }
            }
        }
    }

    flashLed(index) {
        const led = this.container.querySelector(`#drum-led-${index}`);
        if(led) { led.style.background = '#fff'; setTimeout(() => { led.style.background = ''; }, 100); }
    }
}