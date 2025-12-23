// modules/looper.js
import { Microphone, recordSample, autoTrimBuffer, applyFades, shiftBuffer, playSample, ctx, decodeAudioFile, bufferToWav } from './audio.js';
import { SampleStorage } from './storage.js';

export class Looper {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.banks = Array(4).fill(0).map((_, i) => ({ 
            id: i,
            buffer: null, 
            name: `Loop ${i+1}`,
            state: 'empty', 
            isMuted: false,
            volume: 1.0,
            recorder: null,
            startTime: 0,
            activeSource: null 
        }));
        
        this.bpm = 100; 
        this.latencyMs = 50; 
        
        this.render();
        this.startMeterLoop();
        this.loadLoops(); 
    }

    setBpm(bpm) {
        this.bpm = bpm;
    }

    async loadLoops() {
        for(let i=0; i<4; i++) {
            const entry = await SampleStorage.loadSample(i, ctx, 'loop');
            if (entry && entry.buffer) {
                const faded = applyFades(entry.buffer);
                this.banks[i].buffer = faded;
                this.banks[i].name = entry.name;
                this.banks[i].state = 'playing'; 
                this.updateBankUI(i);
            }
        }
    }

    // --- FIX: USE 'TIME' PARAMETER FOR SCHEDULING ---
    onStep(stepIndex, progIndex, progLength, cycleCount, time) {
        const isLoopStart = (stepIndex === 0 && progIndex === 0);
        const secondsPerBeat = 60.0 / this.bpm;
        const totalDuration = secondsPerBeat * 4 * progLength;

        this.banks.forEach(async (bank, index) => {
            if (bank.state === 'armed' && isLoopStart && cycleCount > 0) {
                this.startRecording(index, totalDuration);
                bank.state = 'recording';
                this.updateBankUI(index);
            }
            else if (bank.state === 'recording' && isLoopStart && bank.recorder) {
                // Check if we have recorded enough (using audio clock)
                if (ctx.currentTime - bank.startTime > 1.0) {
                    await this.finishRecording(index);
                    bank.state = 'playing';
                    this.updateBankUI(index);
                }
            }
            if (bank.state === 'playing' && bank.buffer && isLoopStart && !bank.isMuted) {
                if (bank.activeSource) {
                    try { bank.activeSource.stop(time); } catch(e){}
                }
                // Play at the EXACT SCHEDULED TIME, not 'now'
                const playTime = time || ctx.currentTime;
                const result = playSample(-1, playTime, null, 'looper', bank.buffer);
                if (result) bank.activeSource = result.osc; 
            }
        });
    }

    stopAll() {
        this.banks.forEach(bank => {
            if (bank.activeSource) {
                try { bank.activeSource.stop(); } catch(e){}
                bank.activeSource = null;
            }
            if (bank.state === 'recording' || bank.state === 'armed') {
                if(bank.recorder) bank.recorder.stop();
                bank.recorder = null;
                if(bank.state === 'recording') bank.state = bank.buffer ? 'playing' : 'empty';
                else if(bank.state === 'armed') bank.state = bank.buffer ? 'playing' : 'empty';
                this.updateBankUI(bank.id);
            }
        });
    }

    async startRecording(index, duration) {
        try {
            await Microphone.init();
            const stream = Microphone.stream;
            this.banks[index].startTime = ctx.currentTime;
            
            const controller = recordSample(stream, duration + 2.0);
            this.banks[index].recorder = controller;
            this.banks[index].stream = stream;
        } catch (err) {
            console.error("Looper Mic Error", err);
            this.banks[index].state = 'empty';
            this.updateBankUI(index);
        }
    }

    async finishRecording(index) {
        const bank = this.banks[index];
        if (!bank.recorder) return;

        bank.recorder.stop();
        let buffer = await bank.recorder.result;

        if (buffer) {
            buffer = shiftBuffer(buffer, this.latencyMs);
            bank.buffer = applyFades(buffer, 0.01);
            await SampleStorage.saveSample(index, bank.buffer, bank.name, 'loop');
        } else {
            bank.state = 'empty';
        }
        bank.recorder = null;
    }

    toggleArm(index) {
        const bank = this.banks[index];
        Microphone.init();

        if (bank.state === 'empty' || bank.state === 'playing') {
            this.banks.forEach((b, i) => {
                if(b.state === 'armed') { b.state = b.buffer ? 'playing' : 'empty'; this.updateBankUI(i); }
            });
            bank.state = 'armed';
        } else if (bank.state === 'armed') {
            bank.state = bank.buffer ? 'playing' : 'empty';
        }
        this.updateBankUI(index);
    }

    toggleMute(index) {
        const bank = this.banks[index];
        bank.isMuted = !bank.isMuted;
        if(bank.isMuted && bank.activeSource) {
            try { bank.activeSource.stop(); } catch(e){}
        }
        this.updateBankUI(index);
    }

    async clearBank(index) {
        if(confirm(`Clear Loop ${index+1}?`)) {
            const bank = this.banks[index];
            bank.buffer = null;
            bank.state = 'empty';
            bank.name = `Loop ${index+1}`;
            bank.isMuted = false;
            this.updateBankUI(index);
        }
    }

    async loadFile(index, file) {
        const buffer = await decodeAudioFile(file);
        if (buffer) {
            const bank = this.banks[index];
            const trimmed = autoTrimBuffer(buffer);
            bank.buffer = applyFades(trimmed);
            bank.state = 'playing';
            bank.name = file.name.replace(/\.[^/.]+$/, "") || `Loop ${index+1}`;
            await SampleStorage.saveSample(index, bank.buffer, bank.name, 'loop');
            this.updateBankUI(index);
        }
    }

    downloadLoop(index) {
        const bank = this.banks[index];
        if (bank.buffer) {
            const blob = bufferToWav(bank.buffer);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = bank.name.replace(/[^a-z0-9_\-\s]/gi, '').trim() || `loop_${index+1}`;
            a.download = `${safeName}.wav`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    updateName(index, newName) {
        const bank = this.banks[index];
        bank.name = newName;
        if(bank.buffer) SampleStorage.saveSample(index, bank.buffer, newName, 'loop');
    }

    render() {
        this.container.innerHTML = `
            <div class="input-controls-header">
                <div class="ctrl-group">
                    <label>MIC GAIN</label>
                    <input type="range" id="mic-gain" min="0" max="3" step="0.1" value="1" class="mini-slider">
                </div>
                <div class="ctrl-group">
                    <label>SYNC (MS)</label>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <input type="range" id="latency-slider" min="0" max="200" step="10" value="${this.latencyMs}" class="mini-slider">
                        <span id="latency-val" style="font-size:0.6rem; color:var(--primary-cyan); min-width:30px;">${this.latencyMs}ms</span>
                    </div>
                </div>
                <div class="ctrl-group" style="flex:1;">
                    <label>INPUT LEVEL</label>
                    <div class="meter-bg"><div class="meter-fill" id="input-meter"></div></div>
                </div>
            </div>

            <div class="looper-grid">
                ${this.banks.map((b, i) => {
                    const isLoaded = (b.state === 'playing' || b.state === 'recording' || b.state === 'armed');
                    const isActive = (b.state === 'recording' || (b.state === 'playing' && !b.isMuted));
                    const isRec = (b.state === 'recording');
                    
                    return `
                    <div class="looper-bank ${isLoaded ? 'loaded' : ''} ${isActive ? 'active-slot' : ''}" id="loop-bank-${i}">
                        <div class="loop-header">
                            <input type="text" class="loop-name-input" data-index="${i}" value="${b.name}">
                            <button class="btn-loop-clear" data-index="${i}" title="Clear">×</button>
                        </div>
                        
                        <div class="loop-status" id="loop-status-${i}">${b.state.toUpperCase()}</div>
                        
                        <div class="loop-controls">
                            <button class="btn-loop-arm ${b.state === 'armed' || isRec ? 'armed' : ''}" data-index="${i}">
                                ${isRec ? '● REC' : '● ARM'}
                            </button>
                            <button class="btn-loop-play ${!b.isMuted ? 'playing' : ''}" data-index="${i}">
                                ▶ PLAY
                            </button>
                        </div>

                        <div class="loop-file-controls">
                            <input type="file" id="loop-file-${i}" class="hidden-loop-input" accept="audio/*">
                            <button class="btn-loop-icon btn-loop-load" data-index="${i}" title="Load">📂</button>
                            <button class="btn-loop-icon btn-loop-save" data-index="${i}" title="Save">💾</button>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;

        const style = document.createElement('style');
        style.innerHTML = `
            .input-controls-header { 
                background: #1a1a1a; padding: 8px 15px; border-radius: 6px; margin-bottom: 10px; 
                display: flex; gap: 20px; align-items: center; border: 1px solid #333;
            }
            .ctrl-group { display: flex; flex-direction: column; gap: 2px; }
            .ctrl-group label { font-size: 0.65rem; color: #888; letter-spacing: 1px; font-weight:bold; }
            .mini-slider { height: 4px; width: 100px; accent-color: var(--primary-cyan); }
            
            .meter-bg { width: 100%; height: 6px; background: #333; border-radius: 3px; overflow: hidden; margin-top:5px; }
            .meter-fill { width: 0%; height: 100%; background: linear-gradient(90deg, #00e5ff, #00ff55, #ffff00, #ff0055); transition: width 0.05s; }

            .looper-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
            
            .looper-bank { 
                background: #222; border: 2px solid #333; border-radius: 6px; padding: 10px; 
                text-align: center; transition: all 0.2s; position: relative;
            }
            .looper-bank.active-slot { border-color: var(--primary-cyan); box-shadow: 0 0 10px rgba(0, 229, 255, 0.1); }
            .looper-bank.loaded .btn-loop-clear { visibility: visible; }

            .loop-header { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center; }
            .loop-name-input { 
                background: transparent; border: none; color: #888; width: 100px; font-size: 0.75rem; 
                font-weight: bold; text-transform: uppercase; border-bottom: 1px solid transparent; 
            }
            .loop-name-input:focus { outline:none; border-bottom: 1px solid var(--primary-cyan); color:white; }
            
            .btn-loop-clear { background:none; border:none; color:#666; cursor:pointer; font-weight:bold; visibility: hidden; }
            .btn-loop-clear:hover { color: #ff5555; }

            .loop-status { 
                font-weight: bold; font-size: 0.85rem; margin-bottom: 12px; color: #555; letter-spacing: 1px; height: 1.2em;
            }
            .active-slot .loop-status { color: #fff; }

            .loop-controls { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; }
            
            .btn-loop-arm, .btn-loop-play {
                border: none; border-radius: 4px; padding: 6px 10px; font-size: 0.7rem; font-weight: bold;
                cursor: pointer; width: 60px; transition: all 0.1s;
                background: #333; color: #888;
            }
            
            .btn-loop-arm:hover, .btn-loop-play:hover { background: #444; color: #fff; }

            /* ARM STATE */
            .btn-loop-arm.armed { background: #ff0055; color: white; box-shadow: 0 0 8px rgba(255, 0, 85, 0.4); }
            
            /* PLAY STATE */
            .btn-loop-play.playing { background: var(--primary-cyan); color: #000; box-shadow: 0 0 8px rgba(0, 229, 255, 0.4); }

            .loop-file-controls { display: flex; justify-content: center; gap: 15px; border-top: 1px solid #333; padding-top: 8px; }
            .hidden-loop-input { display: none; }
            .btn-loop-icon { background: transparent; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.3; transition: opacity 0.2s; }
            .btn-loop-icon:hover { opacity: 1; }
            .looper-bank.loaded .btn-loop-icon { opacity: 0.7; }
        `;
        this.container.appendChild(style);
        this.bindEvents();
    }

    bindEvents() {
        this.container.querySelectorAll('.btn-loop-arm').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleArm(parseInt(e.target.dataset.index)));
        });
        
        this.container.querySelectorAll('.btn-loop-play').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleMute(parseInt(e.target.dataset.index)));
        });

        this.container.querySelectorAll('.loop-name-input').forEach(inp => {
            inp.addEventListener('change', (e) => this.updateName(parseInt(e.target.dataset.index), e.target.value));
        });

        this.container.querySelectorAll('.btn-loop-clear').forEach(btn => {
            btn.addEventListener('click', (e) => this.clearBank(parseInt(e.target.dataset.index)));
        });

        this.container.querySelectorAll('.btn-loop-load').forEach(btn => {
            btn.addEventListener('click', (e) => document.getElementById(`loop-file-${e.target.dataset.index}`).click());
        });

        this.container.querySelectorAll('.hidden-loop-input').forEach(inp => {
            inp.addEventListener('change', (e) => {
                if(e.target.files.length > 0) this.loadFile(parseInt(e.target.id.split('-')[2]), e.target.files[0]);
            });
        });

        this.container.querySelectorAll('.btn-loop-save').forEach(btn => {
            btn.addEventListener('click', (e) => this.downloadLoop(parseInt(e.target.dataset.index)));
        });

        this.container.querySelector('#mic-gain').addEventListener('input', (e) => {
            Microphone.setGain(parseFloat(e.target.value));
        });
        
        const latSlider = this.container.querySelector('#latency-slider');
        const latVal = this.container.querySelector('#latency-val');
        latSlider.addEventListener('input', (e) => {
            this.latencyMs = parseInt(e.target.value);
            latVal.textContent = `${this.latencyMs}ms`;
        });
    }

    updateBankUI(index) {
        const bank = this.banks[index];
        const el = document.getElementById(`loop-bank-${index}`);
        const status = document.getElementById(`loop-status-${index}`);
        const btnArm = el.querySelector('.btn-loop-arm');
        const btnPlay = el.querySelector('.btn-loop-play');

        const isLoaded = (bank.state !== 'empty');
        const isActive = (bank.state === 'recording' || (bank.state === 'playing' && !bank.isMuted));
        
        // Update Card Classes
        if (isLoaded) el.classList.add('loaded'); else el.classList.remove('loaded');
        if (isActive) el.classList.add('active-slot'); else el.classList.remove('active-slot');

        // Status Text
        status.textContent = bank.state.toUpperCase();

        // Button States
        // ARM Button
        if (bank.state === 'armed' || bank.state === 'recording') {
            btnArm.classList.add('armed');
            btnArm.textContent = (bank.state === 'recording') ? '● REC' : '● ARM';
        } else {
            btnArm.classList.remove('armed');
            btnArm.textContent = '● ARM';
        }

        // PLAY Button (Mute Toggle)
        if (!bank.isMuted) {
            btnPlay.classList.add('playing');
        } else {
            btnPlay.classList.remove('playing');
        }
    }

    startMeterLoop() {
        const meter = document.getElementById('input-meter');
        const update = () => {
            if (meter && Microphone.isInitialized) {
                const level = Microphone.getLevel();
                const width = Math.min(100, level * 200); 
                meter.style.width = `${width}%`;
                if (width > 90) meter.style.background = "#ff0055";
                else meter.style.background = "linear-gradient(90deg, #00e5ff, #00ff55, #ffff00)";
            }
            requestAnimationFrame(update);
        };
        update();
    }
}