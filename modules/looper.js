// modules/looper.js
import { Microphone, recordSample, applyFades, playSample, ctx, decodeAudioFile, bufferToWav, getTrackInput, createVocalChain } from './audio.js';
import { SampleStorage } from './storage.js';

function normalizeLoopBuffer(buffer) {
    if (!buffer) return null;
    let maxAmp = 0;
    
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < data.length; i++) {
            if (Math.abs(data[i]) > maxAmp) maxAmp = Math.abs(data[i]);
        }
    }
    
    if (maxAmp > 0) {
        const gainMult = 0.95 / maxAmp;
        for (let c = 0; c < buffer.numberOfChannels; c++) {
            const data = buffer.getChannelData(c);
            for (let i = 0; i < data.length; i++) {
                data[i] *= gainMult;
            }
        }
    }
    return buffer;
}

function processLoopBuffer(buffer, trimStartMs, exactDurationSec) {
    if (!buffer) return null;
    const trimSamples = Math.floor((trimStartMs / 1000) * buffer.sampleRate);
    const exactSamples = Math.floor(exactDurationSec * buffer.sampleRate);
    
    const availableSamples = buffer.length - trimSamples;
    if (availableSamples <= 0) return null;

    const newLen = Math.min(exactSamples, availableSamples);
    const newBuf = ctx.createBuffer(buffer.numberOfChannels, newLen, buffer.sampleRate);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const oldData = buffer.getChannelData(c);
        const newData = newBuf.getChannelData(c);
        for (let i = 0; i < newLen; i++) {
            newData[i] = oldData[i + trimSamples];
        }
    }
    return newBuf;
}

export class Looper {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        this.bankCount = parseInt(localStorage.getItem('looper_bank_count')) || 16;
        this.banks = [];
        for(let i = 0; i < this.bankCount; i++) {
            this.banks.push(this.createBank(i));
        }

        this.bpm = 100; 
        this.latencyMs = 50; 
        this.isLatencyTesting = false;
        
        this.lastCycleCount = -1; 
        
        this.render();
        this.startMeterLoop();
        this.loadLoops(); 
        this.bindEvents(); 
    }

    createBank(i) {
        const gainNode = ctx.createGain();
        const pannerNode = ctx.createStereoPanner();
        const fxChain = createVocalChain(); 
        
        gainNode.gain.value = 1.0;
        pannerNode.pan.value = 0;
        
        gainNode.connect(fxChain.input);
        fxChain.output.connect(pannerNode);
        pannerNode.connect(getTrackInput('looper'));

        return { 
            id: i,
            buffer: null, 
            name: `Loop ${i+1}`,
            state: 'empty', 
            isMuted: false, 
            volume: 1.0,
            pan: 0.0, 
            fx: { lowCut: 10, presence: 0, compression: 0, delay: 0, reverb: 0 },
            fxChain: fxChain,
            recorder: null,
            startTime: 0,
            scheduledTime: 0, 
            activeSource: null,
            gainNode: gainNode,
            pannerNode: pannerNode
        };
    }

    addBank(renderUI = true) {
        const newIndex = this.banks.length;
        this.banks.push(this.createBank(newIndex));
        this.bankCount = this.banks.length;
        localStorage.setItem('looper_bank_count', this.bankCount);
        
        if (renderUI) {
            this.render();
            this.bindEvents();
        }
    }

    async removeBank() {
        if (this.banks.length <= 1) {
            alert("You must have at least 1 loop station!");
            return;
        }

        const index = this.banks.length - 1;
        const bank = this.banks[index];
        
        const proceed = bank.buffer ? confirm(`Delete "${bank.name}"?\n\nRemoving this station will permanently delete its recorded audio.`) : true;
        
        if (proceed) {
            if (bank.activeSource) { try { bank.activeSource.stop(); } catch(e){} }
            await SampleStorage.deleteSample(index, 'loop');
            
            try { bank.gainNode.disconnect(); bank.pannerNode.disconnect(); } catch(e){}

            this.banks.pop();
            this.bankCount = this.banks.length;
            localStorage.setItem('looper_bank_count', this.bankCount);
            
            this.render();
            this.bindEvents();
        }
    }

    setBpm(bpm) {
        this.bpm = bpm;
    }

    isRecordingOrArmed() {
        return this.banks.some(b => b.state === 'recording' || b.state === 'armed');
    }

    getSettings() {
        const settings = this.banks.map(b => ({
            muted: b.isMuted,
            volume: b.volume,
            pan: b.pan,
            fx: b.fx
        }));
        return {
            banks: settings,
            latencyMs: this.latencyMs,
            micGain: parseFloat(this.container.querySelector('#mic-gain').value)
        };
    }

    applySettings(data) {
        if (!data) return;
        
        if (data.latencyMs) {
            this.latencyMs = data.latencyMs;
            const slider = this.container.querySelector('#latency-slider');
            const val = this.container.querySelector('#latency-val');
            if(slider) slider.value = this.latencyMs;
            if(val) val.textContent = `${this.latencyMs}ms`;
        }
        
        if (data.micGain) {
            const slider = this.container.querySelector('#mic-gain');
            if(slider) {
                slider.value = data.micGain;
                Microphone.setGain(data.micGain);
            }
        }

        const settings = data.banks || data; 
        if (Array.isArray(settings)) {
            settings.forEach((s, i) => {
                const bank = this.banks[i];
                if (bank) {
                    const shouldMute = s.muted; 
                    if (shouldMute && !bank.isMuted && bank.activeSource) {
                        try { bank.activeSource.stop(); } catch(e) {}
                        bank.activeSource = null;
                    }
                    bank.isMuted = shouldMute;

                    const newVol = (typeof s.volume === 'number') ? s.volume : 1.0;
                    this.updateVolume(i, newVol);
                    const volSlider = this.container.querySelector(`.loop-vol-slider[data-index="${i}"]`);
                    if(volSlider) volSlider.value = newVol;

                    const newPan = (typeof s.pan === 'number') ? s.pan : 0.0;
                    this.updatePan(i, newPan);
                    const panSlider = this.container.querySelector(`.loop-pan-slider[data-index="${i}"]`);
                    if(panSlider) panSlider.value = newPan;

                    if (s.fx) {
                        Object.keys(s.fx).forEach(param => {
                            this.updateFX(i, param, s.fx[param]);
                            const fxSlider = this.container.querySelector(`.loop-fx-slider[data-index="${i}"][data-param="${param}"]`);
                            if(fxSlider) fxSlider.value = s.fx[param];
                        });
                    }
                    
                    this.updateBankUI(i);
                }
            });
        }
    }

    async loadLoops() {
        for(let i=0; i < this.banks.length; i++) {
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

    onStep(stepIndex, progIndex, progLength, cycleCount, time, beatsPerBar = 4) {
        let isLoopStart = false;
        
        if (cycleCount !== this.lastCycleCount) {
            isLoopStart = true;
            this.lastCycleCount = cycleCount;
        }
        
        if (stepIndex === 0 && progIndex === 0 && cycleCount === 0) {
            isLoopStart = true;
            this.lastCycleCount = 0;
        }

        const secondsPerBeat = 60.0 / this.bpm;
        const fallbackDuration = secondsPerBeat * beatsPerBar * progLength;

        this.banks.forEach(async (bank, index) => {
            if (bank.state === 'armed' && isLoopStart && cycleCount > 0) {
                this.startRecording(index, fallbackDuration * 2, time);
                bank.state = 'recording';
                this.updateBankUI(index);
            }
            else if (bank.state === 'recording' && isLoopStart && bank.recorder) {
                if (ctx.currentTime - bank.startTime > 0.5) {
                    bank.state = 'playing';
                    this.updateBankUI(index);
                    
                    const exactDuration = time - bank.scheduledTime;
                    
                    const lookaheadDelta = Math.max(0, time - ctx.currentTime);
                    const stopDelay = lookaheadDelta + (this.latencyMs / 1000) + 0.1; 
                    
                    setTimeout(() => {
                        this.finishRecording(index, exactDuration, time);
                    }, stopDelay * 1000);
                }
            }
            
            if (bank.state === 'playing' && bank.buffer && isLoopStart && !bank.isMuted) {
                if (bank.activeSource) {
                    try { bank.activeSource.stop(time); } catch(e){}
                }
                const result = playSample(-1, time, null, 'looper', bank.buffer, bank.gainNode);
                if (result) bank.activeSource = result.osc; 
            }
        });
    }

    stopAll() {
        this.lastCycleCount = -1; 
        this.banks.forEach(bank => {
            if (bank.activeSource) {
                try { bank.activeSource.stop(); } catch(e){}
                bank.activeSource = null;
            }
            if (bank.state === 'recording' || bank.state === 'armed') {
                if(bank.recorder) bank.recorder.stop();
                bank.recorder = null;
                bank.state = bank.buffer ? 'playing' : 'empty';
                this.updateBankUI(bank.id);
            }
        });
    }

    async startRecording(index, maxDuration, scheduledTime) {
        const bank = this.banks[index];

        bank.buffer = null;
        if (bank.activeSource) {
            try { bank.activeSource.stop(); } catch(e) {}
            bank.activeSource = null;
        }

        try {
            await Microphone.init();
            const stream = Microphone.stream;
            
            bank.scheduledTime = scheduledTime; 
            bank.startTime = ctx.currentTime;
            
            const controller = recordSample(stream, maxDuration + 2.0); 
            bank.recorder = controller;
            bank.stream = stream;
        } catch (err) {
            console.error("Looper Mic Error", err);
            bank.state = 'empty';
            this.updateBankUI(index);
        }
    }

    async finishRecording(index, exactDuration, currentDownbeatTime) {
        const bank = this.banks[index];
        if (!bank.recorder) return;

        bank.recorder.stop();
        let buffer = await bank.recorder.result;

        if (buffer) {
            const lookaheadDelayMs = Math.max(0, (bank.scheduledTime - bank.startTime) * 1000);
            const totalTrimMs = Math.max(0, this.latencyMs + lookaheadDelayMs);
            
            const processed = processLoopBuffer(buffer, totalTrimMs, exactDuration);
            
            if (processed) {
                bank.buffer = applyFades(normalizeLoopBuffer(processed), 0.01);
                
                if (!bank.isMuted && bank.state === 'playing') {
                    const offset = ctx.currentTime - currentDownbeatTime;
                    if (offset > 0 && offset < exactDuration) {
                        const source = ctx.createBufferSource();
                        source.buffer = bank.buffer;
                        source.connect(bank.gainNode);
                        source.start(ctx.currentTime, offset);
                        bank.activeSource = source;
                    }
                }
                await SampleStorage.saveSample(index, bank.buffer, bank.name, 'loop');
            } else {
                bank.state = 'empty';
            }
        } else {
            bank.state = 'empty';
        }
        bank.recorder = null;
        this.updateBankUI(index);
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
            await SampleStorage.deleteSample(index, 'loop');
            this.updateBankUI(index);
        }
    }

    async loadFile(index, file) {
        const buffer = await decodeAudioFile(file);
        if (buffer) {
            const bank = this.banks[index];
            const normalized = normalizeLoopBuffer(buffer);
            bank.buffer = applyFades(normalized);
            bank.state = 'playing';
            bank.name = file.name.replace(/\.[^/.]+$/, "") || `Loop ${index+1}`;
            await SampleStorage.saveSample(index, bank.buffer, bank.name, 'loop');
            this.updateBankUI(index);
        }
    }

    // NEW: Offline rendering to "print" the FX chain directly into the downloaded WAV file
    async downloadLoop(index) {
        const bank = this.banks[index];
        if (!bank.buffer) return;

        // Briefly show user it's rendering
        const btn = document.querySelector(`.btn-loop-save[data-index="${index}"]`);
        const origText = btn.textContent;
        if (btn) btn.textContent = '⏳';

        try {
            const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            const offlineCtx = new OfflineCtx(2, bank.buffer.length, bank.buffer.sampleRate);
            
            const source = offlineCtx.createBufferSource();
            source.buffer = bank.buffer;

            // Reconstruct the loop's specific FX chain for the offline render
            const lowCut = offlineCtx.createBiquadFilter();
            lowCut.type = 'highpass';
            lowCut.frequency.value = bank.fx.lowCut || 10;

            const highShelf = offlineCtx.createBiquadFilter();
            highShelf.type = 'highshelf';
            highShelf.frequency.value = 5000;
            highShelf.gain.value = bank.fx.presence || 0;

            const compRatio = bank.fx.compression || 0;
            const compressor = offlineCtx.createDynamicsCompressor();
            compressor.threshold.value = -40 * compRatio;
            compressor.ratio.value = 1 + (11 * compRatio);
            compressor.attack.value = 0.005;
            compressor.release.value = 0.1;

            const delayNode = offlineCtx.createDelay(2.0);
            delayNode.delayTime.value = 0.3;
            
            const delayFeedback = offlineCtx.createGain();
            delayFeedback.gain.value = (bank.fx.delay || 0) * 0.4;
            
            const delayOutput = offlineCtx.createGain();
            delayOutput.gain.value = (bank.fx.delay || 0) * 0.5;

            // Quick offline impulse response for reverb
            const reverbNode = offlineCtx.createConvolver();
            const revLen = offlineCtx.sampleRate * 2.0;
            const impulse = offlineCtx.createBuffer(2, revLen, offlineCtx.sampleRate);
            for(let i=0; i<revLen; i++){
                let val = (Math.random()*2-1) * Math.pow(1 - i/revLen, 2.0);
                impulse.getChannelData(0)[i] = val;
                impulse.getChannelData(1)[i] = val;
            }
            reverbNode.buffer = impulse;

            const reverbSend = offlineCtx.createGain();
            reverbSend.gain.value = bank.fx.reverb || 0;

            const masterOutput = offlineCtx.createGain();
            masterOutput.gain.value = bank.volume; 

            const panner = offlineCtx.createStereoPanner();
            panner.pan.value = bank.pan; 

            // Connect offline graph
            source.connect(lowCut);
            lowCut.connect(highShelf);
            highShelf.connect(compressor);
            
            compressor.connect(delayNode);
            delayNode.connect(delayFeedback);
            delayFeedback.connect(delayNode);
            delayNode.connect(delayOutput);

            compressor.connect(masterOutput);
            delayOutput.connect(masterOutput);

            compressor.connect(reverbSend);
            reverbSend.connect(reverbNode);
            reverbNode.connect(masterOutput);

            masterOutput.connect(panner);
            panner.connect(offlineCtx.destination);

            source.start(0);

            // Render and Download
            const renderedBuffer = await offlineCtx.startRendering();
            const blob = bufferToWav(renderedBuffer);
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = bank.name.replace(/[^a-z0-9_\-\s]/gi, '').trim() || `loop_${index+1}`;
            a.download = `${safeName}_FX.wav`;
            a.click();
            URL.revokeObjectURL(url);
            
        } catch(e) {
            console.error("Offline Render Failed:", e);
        }

        if (btn) btn.textContent = origText;
    }

    updateName(index, newName) {
        const bank = this.banks[index];
        bank.name = newName;
        if(bank.buffer) SampleStorage.saveSample(index, bank.buffer, newName, 'loop');
    }

    updateVolume(index, val) {
        const bank = this.banks[index];
        bank.volume = val;
        if (bank.gainNode && isFinite(val)) {
            bank.gainNode.gain.setTargetAtTime(val, ctx.currentTime, 0.05);
        }
    }

    updatePan(index, val) {
        const bank = this.banks[index];
        bank.pan = val;
        if (bank.pannerNode && isFinite(val)) {
            bank.pannerNode.pan.setTargetAtTime(val, ctx.currentTime, 0.05);
        }
    }

    updateFX(index, param, val) {
        const bank = this.banks[index];
        bank.fx[param] = val;
        const now = ctx.currentTime;
        
        if (param === 'lowCut') bank.fxChain.nodes.lowCut.frequency.setTargetAtTime(val, now, 0.05);
        if (param === 'presence') bank.fxChain.nodes.highShelf.gain.setTargetAtTime(val, now, 0.05);
        if (param === 'compression') {
            bank.fxChain.nodes.compressor.threshold.setTargetAtTime(-40 * val, now, 0.05);
            bank.fxChain.nodes.compressor.ratio.setTargetAtTime(1 + (11 * val), now, 0.05);
        }
        if (param === 'delay') {
            bank.fxChain.nodes.delayOutput.gain.setTargetAtTime(val * 0.5, now, 0.05);
            bank.fxChain.nodes.delayFeedback.gain.setTargetAtTime(val * 0.4, now, 0.05);
        }
        if (param === 'reverb') {
            bank.fxChain.reverbSend.gain.setTargetAtTime(val, now, 0.05);
        }
    }

    async runLatencyTest() {
        const btn = this.container.querySelector('#btn-auto-latency');
        const originalText = btn.textContent;
        
        await Microphone.init();
        if (ctx.state === 'suspended') await ctx.resume();

        this.isLatencyTesting = true;

        btn.textContent = "WAIT...";
        btn.style.background = "#ffaa00";
        btn.disabled = true;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);

        const startTime = performance.now();
        const analyser = Microphone.analyserNode;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        let found = false;
        
        const checkVolume = () => {
            if (found) return;
            if (performance.now() - startTime > 1000) {
                this.isLatencyTesting = false; 
                btn.textContent = "FAIL";
                btn.style.background = "#ff0055";
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = "#333";
                    btn.disabled = false;
                }, 2000);
                return;
            }

            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for(let i = 0; i < bufferLength; i++) {
                const x = (dataArray[i] - 128) / 128.0;
                sum += x * x;
            }
            const rms = Math.sqrt(sum / bufferLength);

            if (rms > 0.05) {
                found = true;
                this.isLatencyTesting = false; 
                const endTime = performance.now();
                let lag = Math.round(endTime - startTime) - 20; 
                if(lag < 0) lag = 0;

                this.latencyMs = lag;
                
                const slider = this.container.querySelector('#latency-slider');
                const val = this.container.querySelector('#latency-val');
                if(slider) slider.value = lag;
                if(val) val.textContent = `${lag}ms`;

                btn.textContent = "OK";
                btn.style.background = "#00e5ff";
                btn.style.color = "#000";
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = "#333";
                    btn.style.color = "#fff";
                    btn.disabled = false;
                }, 1500);
            } else {
                requestAnimationFrame(checkVolume);
            }
        };
        setTimeout(() => { requestAnimationFrame(checkVolume); }, 10);
    }

    render() {
        this.container.innerHTML = `
            <div class="input-controls-header">
                <div class="ctrl-group">
                    <label>STATIONS</label>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <button id="btn-remove-bank" title="Remove Station" style="background:#444; border:none; color:white; border-radius:3px; padding:2px 8px; cursor:pointer; font-weight:bold;">-</button>
                        <span style="color:#00e5ff; font-size:0.8rem; font-weight:bold; width:20px; text-align:center;">${this.banks.length}</span>
                        <button id="btn-add-bank" title="Add Station" style="background:#444; border:none; color:white; border-radius:3px; padding:2px 8px; cursor:pointer; font-weight:bold;">+</button>
                    </div>
                </div>

                <div class="ctrl-group" style="border-left: 1px solid #333; padding-left: 15px; margin-left: 5px;">
                    <label>MIC GAIN</label>
                    <input type="range" id="mic-gain" min="0" max="3" step="0.1" value="1" class="mini-slider">
                </div>
                <div class="ctrl-group">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <label>SYNC (MS)</label>
                        <button id="btn-auto-latency" style="background:#333; border:1px solid #555; color:#fff; font-size:0.6rem; padding:2px 6px; cursor:pointer; border-radius:3px;">TEST</button>
                    </div>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <input type="range" id="latency-slider" min="0" max="200" step="10" value="${this.latencyMs}" class="mini-slider">
                        <span id="latency-val" style="font-size:0.6rem; color:var(--primary-cyan); min-width:30px;">${this.latencyMs}ms</span>
                    </div>
                </div>
                <div class="ctrl-group" style="flex:1;">
                    <label>INPUT LEVEL</label>
                    <div class="meter-bg"><div class="meter-fill" id="looper-input-meter"></div></div>
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

                        <div style="display:flex; flex-direction:column; gap:2px; margin-top:5px; background:#181818; padding:4px; border-radius:4px;">
                            <div style="display:flex; align-items:center; justify-content:space-between;">
                                <span style="font-size:0.55rem; color:#666; font-weight:bold; width:20px;">VOL</span>
                                <input type="range" class="loop-vol-slider" data-index="${i}" min="0" max="1" step="0.05" value="${b.volume}" style="width:75%; height:3px; accent-color:var(--primary-cyan);">
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between;">
                                <span style="font-size:0.55rem; color:#666; font-weight:bold; width:20px;">PAN</span>
                                <input type="range" class="loop-pan-slider" data-index="${i}" min="-1" max="1" step="0.1" value="${b.pan}" style="width:75%; height:3px; accent-color:var(--primary-cyan);">
                            </div>
                            
                            <button class="btn-toggle-fx" data-index="${i}" style="width:100%; margin-top:4px; background:#222; border:1px solid #333; color:#00e5ff; font-size:0.55rem; border-radius:3px; cursor:pointer; font-weight:bold; padding:2px;">FX CHAIN ▼</button>
                            
                            <div id="loop-fx-panel-${i}" style="display:none; flex-direction:column; gap:2px; margin-top:4px; border-top:1px dashed #333; padding-top:4px;">
                                <div style="display:flex; align-items:center; justify-content:space-between;">
                                    <span style="font-size:0.5rem; color:#00e5ff; font-weight:bold; width:30px; text-align:left;">LCUT</span>
                                    <input type="range" class="loop-fx-slider" data-index="${i}" data-param="lowCut" min="10" max="1000" step="10" value="${b.fx.lowCut}" style="width:65%; height:3px; accent-color:var(--primary-cyan);">
                                </div>
                                <div style="display:flex; align-items:center; justify-content:space-between;">
                                    <span style="font-size:0.5rem; color:#00e5ff; font-weight:bold; width:30px; text-align:left;">PRES</span>
                                    <input type="range" class="loop-fx-slider" data-index="${i}" data-param="presence" min="-10" max="10" step="0.5" value="${b.fx.presence}" style="width:65%; height:3px; accent-color:var(--primary-cyan);">
                                </div>
                                <div style="display:flex; align-items:center; justify-content:space-between;">
                                    <span style="font-size:0.5rem; color:#00e5ff; font-weight:bold; width:30px; text-align:left;">COMP</span>
                                    <input type="range" class="loop-fx-slider" data-index="${i}" data-param="compression" min="0" max="1" step="0.05" value="${b.fx.compression}" style="width:65%; height:3px; accent-color:var(--primary-cyan);">
                                </div>
                                <div style="display:flex; align-items:center; justify-content:space-between;">
                                    <span style="font-size:0.5rem; color:#00e5ff; font-weight:bold; width:30px; text-align:left;">DLY</span>
                                    <input type="range" class="loop-fx-slider" data-index="${i}" data-param="delay" min="0" max="1" step="0.05" value="${b.fx.delay}" style="width:65%; height:3px; accent-color:var(--primary-cyan);">
                                </div>
                                <div style="display:flex; align-items:center; justify-content:space-between;">
                                    <span style="font-size:0.5rem; color:#00e5ff; font-weight:bold; width:30px; text-align:left;">REV</span>
                                    <input type="range" class="loop-fx-slider" data-index="${i}" data-param="reverb" min="0" max="1" step="0.05" value="${b.fx.reverb}" style="width:65%; height:3px; accent-color:var(--primary-cyan);">
                                </div>
                            </div>
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
                flex-wrap: wrap; 
            }
            .ctrl-group { display: flex; flex-direction: column; gap: 2px; }
            .ctrl-group label { font-size: 0.65rem; color: #888; letter-spacing: 1px; font-weight:bold; }
            .mini-slider { height: 4px; width: 100px; accent-color: var(--primary-cyan); }
            .meter-bg { width: 100%; height: 6px; background: #333; border-radius: 3px; overflow: hidden; margin-top:5px; }
            .meter-fill { width: 0%; height: 100%; background: linear-gradient(90deg, #00e5ff, #00ff55, #ffff00, #ff0055); transition: width 0.05s; }
            .looper-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
            .looper-bank { background: #222; border: 2px solid #333; border-radius: 6px; padding: 10px; text-align: center; transition: all 0.2s; position: relative; }
            .looper-bank.active-slot { border-color: var(--primary-cyan); box-shadow: 0 0 10px rgba(0, 229, 255, 0.1); }
            .looper-bank.loaded .btn-loop-clear { visibility: visible; }
            .loop-header { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center; }
            .loop-name-input { background: transparent; border: none; color: #888; width: 100px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid transparent; }
            .loop-name-input:focus { outline:none; border-bottom: 1px solid var(--primary-cyan); color:white; }
            .btn-loop-clear { background:none; border:none; color:#666; cursor:pointer; font-weight:bold; visibility: hidden; }
            .btn-loop-clear:hover { color: #ff5555; }
            .loop-status { font-weight: bold; font-size: 0.85rem; margin-bottom: 12px; color: #555; letter-spacing: 1px; height: 1.2em; }
            .active-slot .loop-status { color: #fff; }
            .loop-controls { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 5px; }
            .btn-loop-arm, .btn-loop-play { border: none; border-radius: 4px; padding: 6px 10px; font-size: 0.7rem; font-weight: bold; cursor: pointer; width: 60px; transition: all 0.1s; background: #333; color: #888; }
            .btn-loop-arm:hover, .btn-loop-play:hover { background: #444; color: #fff; }
            .btn-loop-arm.armed { background: #ff0055; color: white; box-shadow: 0 0 8px rgba(255, 0, 85, 0.4); }
            .btn-loop-play.playing { background: var(--primary-cyan); color: #000; box-shadow: 0 0 8px rgba(0, 229, 255, 0.4); }
            .loop-file-controls { display: flex; justify-content: center; gap: 15px; border-top: 1px solid #333; padding-top: 8px; margin-top:5px; }
            .hidden-loop-input { display: none; }
            .btn-loop-icon { background: transparent; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.3; transition: opacity 0.2s; }
            .btn-loop-icon:hover { opacity: 1; }
            .looper-bank.loaded .btn-loop-icon { opacity: 0.7; }
        `;
        this.container.appendChild(style);
    }

    bindEvents() {
        this.container.querySelector('#btn-add-bank').addEventListener('click', () => this.addBank());
        this.container.querySelector('#btn-remove-bank').addEventListener('click', () => this.removeBank());

        this.container.querySelectorAll('.btn-loop-arm').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleArm(parseInt(e.target.dataset.index)));
        });
        
        this.container.querySelectorAll('.btn-loop-play').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleMute(parseInt(e.target.dataset.index)));
        });

        this.container.querySelectorAll('.loop-name-input').forEach(inp => {
            inp.addEventListener('change', (e) => this.updateName(parseInt(e.target.dataset.index), e.target.value));
        });

        this.container.querySelectorAll('.loop-vol-slider').forEach(inp => {
            inp.addEventListener('input', (e) => {
                this.updateVolume(parseInt(e.target.dataset.index), parseFloat(e.target.value));
            });
        });

        this.container.querySelectorAll('.loop-pan-slider').forEach(inp => {
            inp.addEventListener('input', (e) => {
                this.updatePan(parseInt(e.target.dataset.index), parseFloat(e.target.value));
            });
        });

        this.container.querySelectorAll('.loop-fx-slider').forEach(inp => {
            inp.addEventListener('input', (e) => {
                this.updateFX(parseInt(e.target.dataset.index), e.target.dataset.param, parseFloat(e.target.value));
            });
        });

        this.container.querySelectorAll('.btn-toggle-fx').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.dataset.index;
                const panel = this.container.querySelector(`#loop-fx-panel-${idx}`);
                if (panel.style.display === 'none') {
                    panel.style.display = 'flex';
                    e.target.textContent = 'FX CHAIN ▲';
                    e.target.style.background = '#00e5ff';
                    e.target.style.color = '#000';
                } else {
                    panel.style.display = 'none';
                    e.target.textContent = 'FX CHAIN ▼';
                    e.target.style.background = '#222';
                    e.target.style.color = '#00e5ff';
                }
            });
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

        this.container.querySelector('#btn-auto-latency').addEventListener('click', () => this.runLatencyTest());
    }

    updateBankUI(index) {
        const bank = this.banks[index];
        const el = document.getElementById(`loop-bank-${index}`);
        if(!el) return;
        
        const status = document.getElementById(`loop-status-${index}`);
        const btnArm = el.querySelector('.btn-loop-arm');
        const btnPlay = el.querySelector('.btn-loop-play');
        const nameInput = el.querySelector('.loop-name-input'); 

        const isLoaded = (bank.state !== 'empty');
        const isActive = (bank.state === 'recording' || (bank.state === 'playing' && !bank.isMuted));
        
        if (isLoaded) el.classList.add('loaded'); else el.classList.remove('loaded');
        if (isActive) el.classList.add('active-slot'); else el.classList.remove('active-slot');

        status.textContent = bank.state.toUpperCase();
        
        if (nameInput) nameInput.value = bank.name; 

        if (bank.state === 'armed' || bank.state === 'recording') {
            btnArm.classList.add('armed');
            btnArm.textContent = (bank.state === 'recording') ? '● REC' : '● ARM';
        } else {
            btnArm.classList.remove('armed');
            btnArm.textContent = '● ARM';
        }

        if (!bank.isMuted) {
            btnPlay.classList.add('playing'); 
        } else {
            btnPlay.classList.remove('playing');
        }
    }

    startMeterLoop() {
        const update = () => {
            const meter = this.container.querySelector('#looper-input-meter');
            
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