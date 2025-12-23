// modules/sampler.js
import { Microphone, recordSample, autoTrimBuffer, SAMPLE_BANKS, playSample, ctx, decodeAudioFile, bufferToWav } from './audio.js';
import { SampleStorage } from './storage.js';

export class Sampler {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.recordingSlot = null; 
        this.recorderController = null;
        this.activePromise = null;
        
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="sampler-grid">
                ${Array(8).fill(0).map((_, i) => {
                    const isRec = (this.recordingSlot === i);
                    return `
                    <div class="sampler-pad ${isRec ? 'recording' : ''}" id="pad-${i}">
                        <div class="pad-header">
                            <input type="text" class="pad-name-input" data-slot="${i}" value="Sampler ${i+1}">
                            <button class="btn-clear" data-slot="${i}" title="Clear">×</button>
                        </div>
                        <div class="pad-status">Empty</div>
                        <div class="pad-controls">
                            <button class="btn-rec" data-slot="${i}">${isRec ? '■ STOP' : '● REC'}</button>
                            <button class="btn-play" data-slot="${i}">▶</button>
                        </div>
                        <div class="pad-file-controls">
                            <input type="file" id="file-input-${i}" class="hidden-file-input" accept="audio/*">
                            <button class="btn-icon btn-load" data-slot="${i}" title="Load">📂</button>
                            <button class="btn-icon btn-save" data-slot="${i}" title="Save">💾</button>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;

        const style = document.createElement('style');
        style.innerHTML = `
            .pad-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
            .pad-name-input { background: transparent; border: none; color: #888; font-size: 0.75rem; width: 80px; text-transform: uppercase; border-bottom: 1px solid transparent; }
            .pad-name-input:focus { outline: none; border-bottom: 1px solid var(--primary-cyan); color: white; }
            .btn-clear { background: transparent; border: none; color: #666; font-weight: bold; cursor: pointer; visibility: hidden; }
            .btn-clear:hover { color: #ff0055; }
            .sampler-pad.loaded .btn-clear { visibility: visible; }
            .pad-status { font-size: 0.9rem; font-weight: bold; color: #fff; margin-bottom: 10px; height: 1.2em; }
            .pad-controls { display: flex; justify-content: center; gap: 8px; margin-bottom: 8px; }
            .btn-rec { width: 60px; border-radius: 4px; font-weight:bold; font-size:0.7rem; padding: 4px 0; transition: all 0.2s; }
            .sampler-pad.recording .btn-rec { background: #ff0055; color: white; border-color:white; animation: none; }
            .btn-play { width: 30px; border-radius: 4px; font-size:0.8rem; padding: 4px 0; }
            .pad-file-controls { display: flex; justify-content: center; gap: 10px; border-top: 1px solid #333; padding-top: 5px; }
            .hidden-file-input { display: none; }
            .btn-icon { background: transparent; border: none; cursor: pointer; font-size: 1rem; opacity: 0.5; transition: opacity 0.2s; }
            .btn-icon:hover { opacity: 1; }
            .sampler-pad:not(.loaded) .btn-save { display: none; }
        `;
        this.container.appendChild(style);
        this.bindEvents();
        this.updateStatus();
    }

    bindEvents() {
        // Name Input
        this.container.querySelectorAll('.pad-name-input').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const slot = parseInt(e.target.dataset.slot);
                const name = e.target.value;
                const entry = SAMPLE_BANKS[slot];
                if (entry && entry.buffer) {
                    entry.name = name; 
                    SampleStorage.saveSample(slot, entry.buffer, name);
                }
            });
        });

        // Record Button
        this.container.querySelectorAll('.btn-rec').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleRecording(e));
        });

        // Play Button
        this.container.querySelectorAll('.btn-play').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slot = parseInt(e.target.dataset.slot);
                playSample(slot, ctx.currentTime, null, 'lead'); 
                this.flashPad(slot);
            });
        });

        // Clear Button
        this.container.querySelectorAll('.btn-clear').forEach(btn => {
            btn.addEventListener('click', (e) => this.clearSample(parseInt(e.target.dataset.slot)));
        });

        // Load Button (Trigger File Input) - FIXED HERE
        this.container.querySelectorAll('.btn-load').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slot = e.target.dataset.slot;
                document.getElementById(`file-input-${slot}`).click();
            });
        });

        // Handle File Selection
        this.container.querySelectorAll('.hidden-file-input').forEach(inp => {
            inp.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    const slot = parseInt(e.target.id.split('-')[2]);
                    const file = e.target.files[0];
                    const buffer = await decodeAudioFile(file);
                    
                    if (buffer) {
                        const trimmed = autoTrimBuffer(buffer);
                        const name = file.name.replace(/\.[^/.]+$/, "") || `Sampler ${slot+1}`;
                        
                        SAMPLE_BANKS[slot] = { buffer: trimmed, name: name };
                        await SampleStorage.saveSample(slot, trimmed, name);
                        this.updateStatus();
                    } else {
                        alert("Could not decode audio file.");
                    }
                }
            });
        });

        // Save Button
        this.container.querySelectorAll('.btn-save').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slot = parseInt(e.target.dataset.slot);
                const entry = SAMPLE_BANKS[slot];
                
                if (entry && entry.buffer) {
                    const blob = bufferToWav(entry.buffer);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    
                    const input = document.querySelector(`.pad-name-input[data-slot="${slot}"]`);
                    const fileName = input ? input.value : `sample_${slot}`;
                    const safeName = fileName.replace(/[^a-z0-9_\-\s]/gi, '').trim() || "sample";
                    
                    a.download = `${safeName}.wav`;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            });
        });
    }

    async toggleRecording(e) {
        const slot = parseInt(e.target.dataset.slot);
        if (this.recordingSlot === slot) {
            await this.stopRecording();
        } else if (this.recordingSlot !== null) {
            alert("Already recording another slot!");
        } else {
            await this.startRecording(slot);
        }
    }

    async startRecording(slot) {
        if (ctx.state === 'suspended') await ctx.resume();
        this.recordingSlot = slot;
        this.render(); 

        try {
            // Use Central Microphone (respects gain)
            await Microphone.init();
            const stream = Microphone.stream;
            
            const controller = recordSample(stream, 10.0);
            this.recorderController = controller.stop;
            this.activePromise = controller.result;
            
            this.handleRecordingResult(slot, this.activePromise);

        } catch (err) {
            console.error("Mic Error", err);
            this.recordingSlot = null;
            this.render();
            alert("Could not access microphone.");
        }
    }

    async stopRecording() {
        if (this.recorderController) {
            this.recorderController(); 
            this.recorderController = null;
        }
    }

    async handleRecordingResult(slot, promise) {
        try {
            let buffer = await promise; 
            
            // Note: We do NOT stop the Microphone stream here because it is global
            
            if (buffer) {
                buffer = autoTrimBuffer(buffer);
                const nameInput = document.querySelector(`.pad-name-input[data-slot="${slot}"]`);
                const name = nameInput ? nameInput.value : `Sampler ${slot+1}`;
                
                if (buffer) {
                    SAMPLE_BANKS[slot] = { buffer: buffer, name: name };
                    await SampleStorage.saveSample(slot, buffer, name);
                } else {
                    alert("Silence detected.");
                }
            }
        } catch (err) {
            console.error("Processing Error:", err);
        } finally {
            this.recordingSlot = null;
            this.activePromise = null;
            this.render();
            this.updateStatus(); 
        }
    }

    async clearSample(slot) {
        if(confirm(`Clear Sampler ${slot+1}?`)) {
            SAMPLE_BANKS[slot] = null;
            this.updateStatus();
            this.render(); 
        }
    }

    updateStatus() {
        SAMPLE_BANKS.forEach((entry, i) => {
            const pad = document.getElementById(`pad-${i}`);
            if(!pad) return;
            const stat = pad.querySelector('.pad-status');
            const nameInput = pad.querySelector('.pad-name-input');
            const saveBtn = pad.querySelector('.btn-save');
            const clearBtn = pad.querySelector('.btn-clear');
            
            if (this.recordingSlot === i) return;

            if (entry && entry.buffer) {
                pad.classList.add('loaded');
                stat.textContent = `${entry.buffer.duration.toFixed(2)}s`;
                if(entry.name) nameInput.value = entry.name;
                saveBtn.style.display = 'inline-block';
                clearBtn.style.visibility = 'visible';
            } else {
                pad.classList.remove('loaded');
                stat.textContent = "Empty";
                saveBtn.style.display = 'none';
                clearBtn.style.visibility = 'hidden';
            }
        });
    }

    flashPad(slot) {
        const pad = document.getElementById(`pad-${slot}`);
        if(pad) {
            pad.style.borderColor = "#fff";
            setTimeout(() => pad.style.borderColor = "", 100);
        }
    }
}