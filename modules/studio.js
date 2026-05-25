// modules/studio.js
import { Microphone, startStudioRecording, ctx, bufferToWav, playDrum, shiftBuffer } from './audio.js';

export class Studio {
    constructor(containerId, sequencerInstance, songBuilderInstance) {
        this.container = document.getElementById(containerId);
        this.sequencer = sequencerInstance;
        this.songBuilder = songBuilderInstance;

        // State
        this.isRecording = false;
        this.isBouncing = false; 
        this.isCountingDown = false; 
        this.recorder = null;
        this.timerInterval = null;
        this.countdownInterval = null; 
        this.startTime = 0;
        this.isPlaying = false;
        
        // Recording Latency Compensation
        this.recordLatencyMs = 50; 
        
        // Track Management
        this.tracks = []; 
        this.trackCounter = 1;
        this.activeSources = []; 

        this.render();
        this.initCanvasMeter();
    }

    render() {
        this.container.innerHTML = `
            <div class="studio-panel">
                <div class="studio-controls-top">
                    <div class="transport-group">
                        <button id="btn-studio-rec" class="btn-transport rec" title="Record Microphone (Vocals only)">● REC NEW</button>
                        <button id="btn-studio-bounce" class="btn-transport bounce" title="Record Sequencer/Song to Audio Track (Backing only)">⚡ BOUNCE SONG</button>
                        <button id="btn-studio-play" class="btn-transport play" title="Play All">▶ PLAY MIX</button>
                        <button id="btn-studio-stop" class="btn-transport stop" title="Stop All">■ STOP</button>
                    </div>
                    
                    <div class="sync-controls" style="display:flex; flex-direction:column; align-items:center;">
                        <label style="font-size:0.6rem; color:#666; font-weight:bold;">AUTO-START</label>
                        <select id="sel-studio-sync" style="background:#222; color:#fff; border:1px solid #444; font-size:0.75rem; padding:2px;">
                            <option value="none">None (Rec Only)</option>
                            <option value="sequencer">Sequencer</option>
                            <option value="songbuilder">Song Builder</option>
                        </select>
                    </div>

                    <div id="studio-timer" class="studio-timer">00:00</div>
                </div>

                <div class="track-list-container" id="track-list">
                    <div class="empty-state">
                        No tracks yet.<br>
                        <span style="color:#00e5ff">⚡ BOUNCE SONG</span> to import your backing track.<br>
                        <span style="color:#ff0055">● REC NEW</span> to record vocals over it.
                    </div>
                </div>

                <div class="studio-footer">
                    <div class="mixer-global">
                        <label>INPUT MONITOR</label>
                        <canvas id="studio-vu-meter" width="150" height="10"></canvas>
                    </div>
                    <button id="btn-export-mix" class="btn-export" disabled>💾 RENDER & DOWNLOAD MIX</button>
                </div>
                
                <div class="input-settings">
                    <div class="slider-compact">
                        <label>Mic Gain</label>
                        <input type="range" id="studio-mic-gain" min="0" max="3" step="0.1" value="1">
                    </div>
                    <div class="slider-compact">
                        <label>Rec Latency (<span id="studio-lat-val">${this.recordLatencyMs}</span>ms)</label>
                        <input type="range" id="studio-latency" min="0" max="300" step="5" value="${this.recordLatencyMs}">
                    </div>
                    <div class="fx-toggle">
                        <input type="checkbox" id="cb-vocal-fx">
                        <label for="cb-vocal-fx">Vocal FX</label>
                    </div>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.innerHTML = `
            .studio-panel { 
                background: #181818; padding: 15px; border-radius: 8px; border: 1px solid #333;
                display: flex; flex-direction: column; gap: 15px; min-height: 300px;
            }

            /* TRANSPORT */
            .studio-controls-top { 
                display: flex; justify-content: space-between; align-items: center; 
                padding-bottom: 15px; border-bottom: 1px solid #333; flex-wrap: wrap; gap: 10px;
            }
            .transport-group { display: flex; gap: 5px; flex-wrap: wrap; }
            .btn-transport { 
                border: none; border-radius: 4px; padding: 10px 12px; font-weight: bold; cursor: pointer; color: white;
                font-family: monospace; font-size: 0.8rem; transition: all 0.2s; white-space: nowrap;
            }
            .btn-transport.rec { background: #aa0033; }
            .btn-transport.rec:hover { background: #ff0055; }
            .btn-transport.rec.recording { background: #ff0055; animation: pulse 1s infinite; }
            .btn-transport.rec.counting { background: #ffaa00; color: #000; } 
            
            .btn-transport.bounce { background: #005566; color: #00e5ff; border: 1px solid #004455; }
            .btn-transport.bounce:hover { background: #0088aa; color: #fff; }
            .btn-transport.bounce.recording { background: #00e5ff; color: #000; animation: pulse 1s infinite; }

            .btn-transport.play { background: #222; border: 1px solid #444; }
            .btn-transport.play:hover { background: #00e5ff; color: #000; border-color: #00e5ff; }
            .btn-transport.stop { background: #222; border: 1px solid #444; }
            .btn-transport.stop:hover { background: #fff; color: #000; }
            
            .studio-timer { font-family: monospace; font-size: 1.5rem; color: #00e5ff; min-width: 80px; text-align: right; }

            /* TRACK LIST */
            .track-list-container { 
                flex-grow: 1; background: #111; border: 1px inset #222; border-radius: 4px; 
                padding: 10px; overflow-y: auto; max-height: 250px; min-height: 100px;
            }
            .empty-state { color: #555; text-align: center; margin-top: 30px; font-style: italic; font-size: 0.8rem; line-height: 1.6; }

            .track-row { 
                display: flex; align-items: center; gap: 10px; background: #222; 
                margin-bottom: 5px; padding: 8px; border-radius: 4px; border-left: 3px solid #00e5ff;
            }
            .track-info { flex-grow: 1; display: flex; flex-direction: column; }
            .track-name { font-size: 0.8rem; font-weight: bold; color: #eee; margin-bottom: 2px; }
            .track-details { font-size: 0.65rem; color: #777; }
            
            .track-controls { display: flex; align-items: center; gap: 15px; }
            .control-column { display: flex; flex-direction: column; align-items: center; gap: 2px; }
            .control-label { font-size: 0.55rem; color: #666; font-weight: bold; }
            
            .track-vol-slider { width: 80px; height: 4px; accent-color: #00e5ff; }
            .track-pan-slider { width: 60px; height: 4px; accent-color: #00e5ff; }
            
            /* Remove spinners from number input */
            .track-nudge-input::-webkit-inner-spin-button, .track-nudge-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
            .track-nudge-input { -moz-appearance: textfield; }

            .btn-track-action { 
                background: none; border: none; color: #666; cursor: pointer; font-size: 0.8rem; 
            }
            .btn-track-action:hover { color: white; }
            .btn-track-action.delete:hover { color: #ff0055; }
            .btn-mute.muted { color: #ffaa00; text-decoration: line-through; }

            /* FOOTER */
            .studio-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
            .mixer-global { display: flex; flex-direction: column; gap: 5px; }
            .mixer-global label { font-size: 0.6rem; color: #666; font-weight: bold; }
            
            .btn-export { 
                background: linear-gradient(45deg, #00e5ff, #0099cc); border: none; padding: 10px 20px;
                border-radius: 4px; color: #000; font-weight: bold; cursor: pointer; opacity: 1;
            }
            .btn-export:disabled { background: #333; color: #555; cursor: default; }

            .input-settings { display: flex; gap: 15px; border-top: 1px solid #333; padding-top: 10px; flex-wrap: wrap; }
            .slider-compact { display: flex; align-items: center; gap: 5px; flex-grow: 1; min-width: 150px; }
            .slider-compact label { font-size: 0.7rem; color: #888; white-space: nowrap; }
            .slider-compact input { width: 100%; height: 4px; accent-color: #ff0055; }
            .fx-toggle { display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #888; }
            
            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        `;
        this.container.appendChild(style);

        this.bindEvents();
    }

    bindEvents() {
        this.container.querySelector('#btn-studio-rec').addEventListener('click', () => this.handleRecordButton());
        this.container.querySelector('#btn-studio-bounce').addEventListener('click', () => this.handleBounceButton());
        this.container.querySelector('#btn-studio-play').addEventListener('click', () => this.playMix());
        this.container.querySelector('#btn-studio-stop').addEventListener('click', () => this.stopAll());
        this.container.querySelector('#btn-export-mix').addEventListener('click', () => this.exportMix());
        this.container.querySelector('#studio-mic-gain').addEventListener('input', (e) => Microphone.setGain(parseFloat(e.target.value)));
        this.container.querySelector('#cb-vocal-fx').addEventListener('change', (e) => Microphone.setFxEnabled(e.target.checked));
        
        // NEW: Bind Latency Setting
        this.container.querySelector('#studio-latency').addEventListener('input', (e) => {
            this.recordLatencyMs = parseInt(e.target.value);
            this.container.querySelector('#studio-lat-val').textContent = this.recordLatencyMs;
        });
    }

    async handleBounceButton() {
        if (this.isBouncing) {
            this.stopAll();
            return;
        }

        const btn = this.container.querySelector('#btn-studio-bounce');
        btn.textContent = "■ FINISH";
        btn.classList.add('recording');
        this.isBouncing = true;

        Microphone.disconnectFromStudio(); 

        if (ctx.state === 'suspended') await ctx.resume();
        
        this.recorder = startStudioRecording('mix');
        this.startTime = Date.now();

        if (this.songBuilder && this.songBuilder.playlist.length > 0) {
            if (this.songBuilder.togglePlay) this.songBuilder.playSong();
        } else if (this.sequencer) {
            if (!this.sequencer.isPlaying) this.sequencer.togglePlay();
        }

        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            const secs = Math.floor(elapsed / 1000) % 60;
            const mins = Math.floor(elapsed / 60000);
            this.container.querySelector('#studio-timer').textContent = 
                `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            if (this.songBuilder && !this.songBuilder.isPlaying && this.isBouncing && elapsed > 1000) {
                this.stopAll(); 
            }
        }, 500);
    }

    handleRecordButton() {
        if (this.isRecording || this.isCountingDown) {
            this.stopAll(); 
        } else {
            this.startCountdown();
        }
    }

    startCountdown() {
        const btn = this.container.querySelector('#btn-studio-rec');
        const timerDisplay = this.container.querySelector('#studio-timer');
        
        this.isCountingDown = true;
        btn.classList.add('counting');
        btn.textContent = "GET READY";

        const bpm = this.sequencer ? this.sequencer.bpm : 100;
        const msPerBeat = 60000 / bpm;
        let beatsLeft = 4;
        
        timerDisplay.textContent = `-${beatsLeft}`;
        timerDisplay.style.color = "#ffaa00";

        if (ctx.state === 'suspended') ctx.resume();

        this.countdownInterval = setInterval(() => {
            beatsLeft--;
            if (beatsLeft > 0) {
                timerDisplay.textContent = `-${beatsLeft}`;
                if (beatsLeft <= 3) playDrum('metronome'); 
            } else {
                clearInterval(this.countdownInterval);
                this.isCountingDown = false;
                btn.classList.remove('counting');
                timerDisplay.style.color = "#00e5ff";
                this.startRecording(); 
            }
        }, msPerBeat);
    }

    async startRecording() {
        const btn = this.container.querySelector('#btn-studio-rec');
        const syncSource = this.container.querySelector('#sel-studio-sync').value;

        await Microphone.init();
        if (ctx.state === 'suspended') await ctx.resume();

        this.recorder = startStudioRecording('mic');
        this.isRecording = true;
        this.startTime = Date.now();
        
        btn.textContent = "■ STOP";
        btn.classList.add('recording');

        if (syncSource === 'sequencer' && this.sequencer) {
            if (!this.sequencer.isPlaying) this.sequencer.togglePlay();
        } else if (syncSource === 'songbuilder' && this.songBuilder) {
            if(this.songBuilder.playSong) this.songBuilder.playSong();
            else if(!this.sequencer.isPlaying) this.sequencer.togglePlay(); 
        }

        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            const secs = Math.floor(elapsed / 1000) % 60;
            const mins = Math.floor(elapsed / 60000);
            this.container.querySelector('#studio-timer').textContent = 
                `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }, 1000);
    }

    async stopRecording() {
        const btnRec = this.container.querySelector('#btn-studio-rec');
        const btnBounce = this.container.querySelector('#btn-studio-bounce');
        
        const wasBouncing = this.isBouncing;

        this.isRecording = false;
        this.isBouncing = false;
        
        clearInterval(this.timerInterval);
        
        btnRec.textContent = "● REC NEW";
        btnRec.classList.remove('recording');
        
        btnBounce.textContent = "⚡ BOUNCE SONG";
        btnBounce.classList.remove('recording');
        
        if (this.sequencer && this.sequencer.isPlaying) this.sequencer.togglePlay(); 
        if (this.songBuilder && this.songBuilder.isPlaying) this.songBuilder.stopSong();

        if (this.recorder) {
            const blob = await this.recorder.stop();
            const name = wasBouncing ? "Backing Track" : `Track ${this.trackCounter++}`;
            // If it was a Mic recording (!wasBouncing), apply the auto-latency shift
            await this.addTrackFromBlob(blob, name, !wasBouncing);
            this.recorder = null;
        }

        Microphone.disconnectFromStudio();
    }

    async addTrackFromBlob(blob, defaultName, applyLatency = false) {
        const arrayBuffer = await blob.arrayBuffer();
        let audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        
        // NEW: Automatically trim the start of the buffer based on Latency setting
        if (applyLatency && this.recordLatencyMs > 0) {
            audioBuffer = shiftBuffer(audioBuffer, this.recordLatencyMs);
        }
        
        const newTrack = {
            id: Date.now(),
            name: defaultName,
            buffer: audioBuffer,
            volume: 0.8,
            pan: 0.0, 
            nudge: 0, // NEW: Manual nudge in milliseconds
            muted: false,
            blob: blob,
            _activeGain: null,
            _activePanner: null
        };
        
        this.tracks.push(newTrack);
        this.renderTrackList();
        this.updateExportButton();
    }

    renderTrackList() {
        const list = this.container.querySelector('#track-list');
        list.innerHTML = '';

        if (this.tracks.length === 0) {
            list.innerHTML = '<div class="empty-state">No tracks yet.<br><span style="color:#00e5ff">⚡ BOUNCE SONG</span> to import your backing track.<br><span style="color:#ff0055">● REC NEW</span> to record vocals over it.</div>';
            return;
        }

        this.tracks.forEach((track, index) => {
            const div = document.createElement('div');
            div.className = 'track-row';
            div.innerHTML = `
                <div class="track-info">
                    <div class="track-name" contenteditable="true" title="Click to rename">${track.name}</div>
                    <div class="track-details">${track.buffer.duration.toFixed(1)}s</div>
                </div>
                <div class="track-controls">
                    <button class="btn-track-action btn-mute ${track.muted ? 'muted' : ''}" data-id="${track.id}">M</button>
                    
                    <div class="control-column">
                        <span class="control-label">VOL</span>
                        <input type="range" class="track-vol-slider" min="0" max="1" step="0.05" value="${track.volume}" data-id="${track.id}" title="Volume">
                    </div>

                    <div class="control-column">
                        <span class="control-label">PAN</span>
                        <input type="range" class="track-pan-slider" min="-1" max="1" step="0.1" value="${track.pan}" data-id="${track.id}" title="Pan (Left/Right)">
                    </div>

                    <div class="control-column">
                        <span class="control-label" style="color:#ffaa00;">NUDGE(ms)</span>
                        <input type="number" class="track-nudge-input" value="${track.nudge || 0}" data-id="${track.id}" step="10" style="width: 50px; font-size: 0.65rem; background: #111; color: #ffaa00; border: 1px solid #444; border-radius: 3px; text-align: center; padding: 2px;" title="Positive=Delay, Negative=Early">
                    </div>

                    <button class="btn-track-action delete" data-id="${track.id}">×</button>
                </div>
            `;
            
            div.querySelector('.track-name').addEventListener('blur', (e) => { track.name = e.target.textContent; });
            div.querySelector('.btn-mute').addEventListener('click', () => { track.muted = !track.muted; this.renderTrackList(); });
            
            div.querySelector('.track-vol-slider').addEventListener('input', (e) => { 
                const newVol = parseFloat(e.target.value);
                track.volume = newVol; 
                if (track._activeGain) track._activeGain.gain.setTargetAtTime(newVol, ctx.currentTime, 0.05);
            });

            div.querySelector('.track-pan-slider').addEventListener('input', (e) => { 
                const newPan = parseFloat(e.target.value);
                track.pan = newPan; 
                if (track._activePanner) track._activePanner.pan.setTargetAtTime(newPan, ctx.currentTime, 0.05);
            });

            // NEW: Nudge Event
            div.querySelector('.track-nudge-input').addEventListener('change', (e) => {
                track.nudge = parseInt(e.target.value) || 0;
            });

            div.querySelector('.delete').addEventListener('click', () => { if(confirm('Delete this track?')) { this.tracks.splice(index, 1); this.renderTrackList(); this.updateExportButton(); } });
            list.appendChild(div);
        });
    }

    playMix() {
        this.stopAll(); 
        if(this.tracks.length === 0) return;

        this.isPlaying = true;
        this.container.querySelector('#btn-studio-play').classList.add('recording'); 

        const now = ctx.currentTime;

        this.tracks.forEach(track => {
            if (track.muted) return;
            const source = ctx.createBufferSource();
            source.buffer = track.buffer;
            
            const pannerNode = ctx.createStereoPanner();
            pannerNode.pan.value = track.pan;
            track._activePanner = pannerNode;

            const gainNode = ctx.createGain();
            gainNode.gain.value = track.volume;
            track._activeGain = gainNode;

            source.connect(pannerNode);
            pannerNode.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            // NEW: Handle Nudge timing calculations
            let delayTime = 0;
            let bufferOffset = 0;
            
            if (track.nudge > 0) {
                delayTime = track.nudge / 1000;
            } else if (track.nudge < 0) {
                bufferOffset = Math.abs(track.nudge) / 1000;
                if (bufferOffset >= track.buffer.duration) bufferOffset = 0; // Failsafe
            }

            source.start(now + delayTime, bufferOffset);
            this.activeSources.push(source);
            
            source.onended = () => {
                this.activeSources = this.activeSources.filter(s => s !== source);
                track._activeGain = null; 
                track._activePanner = null;
                if(this.activeSources.length === 0) this.stopAll();
            };
        });
    }

    stopAll() {
        if (this.isRecording || this.isBouncing) {
            this.stopRecording();
            return; 
        }

        if (this.isCountingDown) {
            clearInterval(this.countdownInterval);
            this.isCountingDown = false;
            const btn = this.container.querySelector('#btn-studio-rec');
            btn.classList.remove('counting');
            btn.textContent = "● REC NEW";
            this.container.querySelector('#studio-timer').textContent = "00:00";
            this.container.querySelector('#studio-timer').style.color = "#00e5ff";
            return;
        }

        this.isPlaying = false;
        this.container.querySelector('#btn-studio-play').classList.remove('recording');
        
        this.activeSources.forEach(src => { try { src.stop(); } catch(e) {} });
        this.activeSources = [];
        this.tracks.forEach(t => { t._activeGain = null; t._activePanner = null; });
    }

    async exportMix() {
        if(this.tracks.length === 0) return;
        const btn = this.container.querySelector('#btn-export-mix');
        const originalText = btn.textContent;
        btn.textContent = "⏳ RENDERING...";
        btn.disabled = true;

        // Calculate maximum track duration + any positive nudges
        let maxDuration = 1.0; 
        this.tracks.forEach(t => { 
            if(!t.muted) {
                const end = t.buffer.duration + (t.nudge > 0 ? t.nudge / 1000 : 0);
                if(end > maxDuration) maxDuration = end; 
            }
        });

        const offlineCtx = new OfflineAudioContext(2, maxDuration * ctx.sampleRate, ctx.sampleRate);
        
        this.tracks.forEach(track => {
            if (track.muted) return;
            const source = offlineCtx.createBufferSource();
            source.buffer = track.buffer;
            
            const panner = offlineCtx.createStereoPanner();
            panner.pan.value = track.pan;

            const gain = offlineCtx.createGain();
            gain.gain.value = track.volume;
            
            source.connect(panner);
            panner.connect(gain);
            gain.connect(offlineCtx.destination);
            
            // NEW: Export also respects Nudge
            let delayTime = 0;
            let bufferOffset = 0;
            if (track.nudge > 0) delayTime = track.nudge / 1000;
            else if (track.nudge < 0) {
                bufferOffset = Math.abs(track.nudge) / 1000;
                if (bufferOffset >= track.buffer.duration) bufferOffset = 0;
            }
            
            source.start(delayTime, bufferOffset);
        });

        const renderedBuffer = await offlineCtx.startRendering();
        const wavBlob = bufferToWav(renderedBuffer); 
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `studio-mix-${new Date().toISOString().slice(0,10)}.wav`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            btn.textContent = originalText;
            btn.disabled = false;
        }, 100);
    }

    updateExportButton() {
        this.container.querySelector('#btn-export-mix').disabled = (this.tracks.length === 0);
    }

    initCanvasMeter() {
        const canvas = document.getElementById('studio-vu-meter');
        if (!canvas) return;
        const cCtx = canvas.getContext('2d');
        const draw = () => {
            requestAnimationFrame(draw);
            if (this.container.offsetParent === null) return; 
            const width = canvas.width;
            const height = canvas.height;
            cCtx.clearRect(0, 0, width, height);
            let level = 0;
            if (Microphone.isInitialized) level = Microphone.getLevel();
            cCtx.fillStyle = '#222';
            cCtx.fillRect(0, 0, width, height);
            const fillWidth = Math.min(width, level * width * 1.5); 
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