// modules/studio.js
import { Microphone, startStudioRecording, ctx, bufferToWav, playDrum } from './audio.js';

export class Studio {
    constructor(containerId, sequencerInstance, songBuilderInstance) {
        this.container = document.getElementById(containerId);
        this.sequencer = sequencerInstance;
        this.songBuilder = songBuilderInstance;

        // State
        this.isRecording = false;
        this.isCountingDown = false; 
        this.recorder = null;
        this.timerInterval = null;
        this.countdownInterval = null; 
        this.startTime = 0;
        this.isPlaying = false;
        
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
                        <button id="btn-studio-rec" class="btn-transport rec" title="Record New Track">● REC NEW</button>
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
                    <div class="empty-state">No tracks recorded yet. Select a Sync source and hit REC.</div>
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
                padding-bottom: 15px; border-bottom: 1px solid #333;
            }
            .transport-group { display: flex; gap: 10px; }
            .btn-transport { 
                border: none; border-radius: 4px; padding: 10px 15px; font-weight: bold; cursor: pointer; color: white;
                font-family: monospace; font-size: 0.9rem; transition: all 0.2s;
            }
            .btn-transport.rec { background: #aa0033; }
            .btn-transport.rec:hover { background: #ff0055; }
            .btn-transport.rec.recording { background: #ff0055; animation: pulse 1s infinite; }
            .btn-transport.rec.counting { background: #ffaa00; color: #000; } 
            
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
            .empty-state { color: #555; text-align: center; margin-top: 30px; font-style: italic; font-size: 0.8rem; }

            .track-row { 
                display: flex; align-items: center; gap: 10px; background: #222; 
                margin-bottom: 5px; padding: 8px; border-radius: 4px; border-left: 3px solid #00e5ff;
            }
            .track-info { flex-grow: 1; display: flex; flex-direction: column; }
            .track-name { font-size: 0.8rem; font-weight: bold; color: #eee; margin-bottom: 2px; }
            .track-details { font-size: 0.65rem; color: #777; }
            
            .track-controls { display: flex; align-items: center; gap: 10px; }
            .track-vol-slider { width: 80px; height: 4px; accent-color: #00e5ff; }
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

            .input-settings { display: flex; gap: 20px; border-top: 1px solid #333; padding-top: 10px; }
            .slider-compact { display: flex; align-items: center; gap: 5px; flex-grow: 1; }
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
        this.container.querySelector('#btn-studio-play').addEventListener('click', () => this.playMix());
        this.container.querySelector('#btn-studio-stop').addEventListener('click', () => this.stopAll());
        this.container.querySelector('#btn-export-mix').addEventListener('click', () => this.exportMix());
        this.container.querySelector('#studio-mic-gain').addEventListener('input', (e) => Microphone.setGain(parseFloat(e.target.value)));
        this.container.querySelector('#cb-vocal-fx').addEventListener('change', (e) => Microphone.setFxEnabled(e.target.checked));
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

        this.recorder = startStudioRecording();
        this.isRecording = true;
        this.startTime = Date.now();
        
        btn.textContent = "■ STOP";
        btn.classList.add('recording');

        if (syncSource === 'sequencer' && this.sequencer) {
            if (!this.sequencer.isPlaying) this.sequencer.togglePlay();
        } else if (syncSource === 'songbuilder' && this.songBuilder) {
            if(this.songBuilder.togglePlay) this.songBuilder.togglePlay();
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
        const btn = this.container.querySelector('#btn-studio-rec');
        
        this.isRecording = false;
        clearInterval(this.timerInterval);
        btn.textContent = "● REC NEW";
        btn.classList.remove('recording');
        
        const syncSource = this.container.querySelector('#sel-studio-sync').value;
        if ((syncSource === 'sequencer' || syncSource === 'songbuilder') && this.sequencer && this.sequencer.isPlaying) {
             this.sequencer.togglePlay(); 
        }

        if (this.recorder) {
            const blob = await this.recorder.stop();
            await this.addTrackFromBlob(blob);
            this.recorder = null;
        }
    }

    async addTrackFromBlob(blob) {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        
        const newTrack = {
            id: Date.now(),
            name: `Track ${this.trackCounter++}`,
            buffer: audioBuffer,
            volume: 0.8,
            muted: false,
            blob: blob,
            _activeGain: null // Placeholder for live gain node
        };
        
        this.tracks.push(newTrack);
        this.renderTrackList();
        this.updateExportButton();
    }

    renderTrackList() {
        const list = this.container.querySelector('#track-list');
        list.innerHTML = '';

        if (this.tracks.length === 0) {
            list.innerHTML = '<div class="empty-state">No tracks recorded yet. Select a Sync source and hit REC.</div>';
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
                    <input type="range" class="track-vol-slider" min="0" max="1" step="0.05" value="${track.volume}" data-id="${track.id}" title="Volume">
                    <button class="btn-track-action delete" data-id="${track.id}">×</button>
                </div>
            `;
            
            div.querySelector('.track-name').addEventListener('blur', (e) => { track.name = e.target.textContent; });
            div.querySelector('.btn-mute').addEventListener('click', () => { track.muted = !track.muted; this.renderTrackList(); });
            
            // --- FIXED: Real-time volume update ---
            div.querySelector('.track-vol-slider').addEventListener('input', (e) => { 
                const newVol = parseFloat(e.target.value);
                track.volume = newVol; 
                // If this track is currently playing, update the gain node immediately
                if (track._activeGain) {
                    track._activeGain.gain.setTargetAtTime(newVol, ctx.currentTime, 0.05);
                }
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

        this.tracks.forEach(track => {
            if (track.muted) return;
            const source = ctx.createBufferSource();
            source.buffer = track.buffer;
            
            const gainNode = ctx.createGain();
            gainNode.gain.value = track.volume;
            
            // Store reference so slider can access it
            track._activeGain = gainNode;

            source.connect(gainNode);
            gainNode.connect(ctx.destination);
            source.start(0);
            this.activeSources.push(source);
            
            source.onended = () => {
                this.activeSources = this.activeSources.filter(s => s !== source);
                track._activeGain = null; // Clean up reference
                if(this.activeSources.length === 0) this.stopAll();
            };
        });
    }

    stopAll() {
        if (this.isRecording) {
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
        
        // Clean up all gain references
        this.tracks.forEach(t => t._activeGain = null);
    }

    async exportMix() {
        if(this.tracks.length === 0) return;
        const btn = this.container.querySelector('#btn-export-mix');
        const originalText = btn.textContent;
        btn.textContent = "⏳ RENDERING...";
        btn.disabled = true;

        let maxDuration = 0;
        this.tracks.forEach(t => { if(t.buffer.duration > maxDuration) maxDuration = t.buffer.duration; });

        const offlineCtx = new OfflineAudioContext(2, maxDuration * ctx.sampleRate, ctx.sampleRate);
        this.tracks.forEach(track => {
            if (track.muted) return;
            const source = offlineCtx.createBufferSource();
            source.buffer = track.buffer;
            const gain = offlineCtx.createGain();
            gain.gain.value = track.volume;
            source.connect(gain);
            gain.connect(offlineCtx.destination);
            source.start(0);
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