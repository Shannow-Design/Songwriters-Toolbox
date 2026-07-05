// modules/studio.js
import { startStudioRecording, ctx, bufferToWav, decodeAudioFile, getTrackInput } from './audio.js';

export class Studio {
    constructor(containerId, sequencer, songBuilder) {
        this.container = document.getElementById(containerId);
        this.sequencer = sequencer;
        this.songBuilder = songBuilder;
        
        this.tracks = []; 
        this.isRecording = false;
        this.activeRecorder = null;
        this.recordingSource = 'mix'; 
        
        // NEW: Playback State
        this.isPlayingMix = false;
        this.mixTimer = null;
        
        this.settings = {
            masterVolume: 1.0,
            autoExport: false
        };

        this.render();
        this.bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="studio-header">
                <h3>STUDIO MIXER</h3>
                <div class="studio-controls">
                    <div style="display:flex; align-items:center; gap:5px; margin-right:10px;">
                        <input type="checkbox" id="cb-auto-export" style="accent-color:var(--primary-cyan);">
                        <label for="cb-auto-export">Auto-Export WAV</label>
                    </div>
                    
                    <button id="btn-studio-record-mic" class="btn-record">● REC MIC</button>
                    <button id="btn-studio-bounce" class="btn-bounce">● BOUNCE SONG</button>
                    
                    <div style="border-left: 1px solid #444; margin-left: 5px; padding-left: 15px; display:flex; gap:10px;">
                        <button id="btn-studio-play-mix" class="btn-play-mix">▶ PLAY MIX</button>
                        <button id="btn-studio-stop-mix" class="btn-stop-mix" style="display:none;">⏹ STOP MIX</button>
                    </div>

                    <button id="btn-studio-export" class="btn-export" disabled>💾 EXPORT ALL</button>
                </div>
            </div>

            <div class="studio-master-bus">
                <span style="color:#00e5ff; font-weight:bold; width:60px;">MASTER</span>
                <input type="range" id="studio-master-vol" min="0" max="1" step="0.05" value="1" style="flex:1; accent-color:#00e5ff;">
            </div>

            <div id="studio-tracks-list" class="studio-tracks-list">
                <div class="empty-state">No recorded tracks. Hit Record or Bounce to capture a take!</div>
            </div>
            
            <div class="studio-footer">
                <input type="file" id="studio-file-import" accept="audio/*" style="display:none;" multiple>
                <button id="btn-studio-import" class="btn-import">📂 IMPORT AUDIO FILES</button>
            </div>
        `;

        const style = document.createElement('style');
        style.innerHTML = `
            .studio-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid #444; padding-bottom: 10px; }
            .studio-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
            
            .btn-record { background: #aa0033; color: white; border: none; padding: 6px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .btn-record:hover { background: #ff0055; box-shadow: 0 0 10px rgba(255,0,85,0.5); }
            .btn-record.recording { background: #ff0055; animation: pulse-record 1s infinite; }
            
            .btn-bounce { background: #b86b00; color: white; border: none; padding: 6px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .btn-bounce:hover { background: #ff9900; box-shadow: 0 0 10px rgba(255,153,0,0.5); }
            .btn-bounce.recording { background: #ff9900; animation: pulse-bounce 1s infinite; }
            
            .btn-play-mix { background: #00e5ff; color: #000; border: none; padding: 6px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .btn-play-mix:hover { background: #00ffaa; box-shadow: 0 0 10px rgba(0,255,170,0.5); }
            
            .btn-stop-mix { background: #aa0033; color: white; border: none; padding: 6px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .btn-stop-mix:hover { background: #ff0055; box-shadow: 0 0 10px rgba(255,0,85,0.5); }

            @keyframes pulse-record { 0% { box-shadow: 0 0 5px #ff0055; } 50% { box-shadow: 0 0 20px #ff0055; } 100% { box-shadow: 0 0 5px #ff0055; } }
            @keyframes pulse-bounce { 0% { box-shadow: 0 0 5px #ff9900; } 50% { box-shadow: 0 0 20px #ff9900; } 100% { box-shadow: 0 0 5px #ff9900; } }
            
            .btn-export, .btn-import { background: #333; color: white; border: 1px solid #555; padding: 6px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
            .btn-export:hover:not(:disabled), .btn-import:hover { background: #444; color: var(--primary-cyan); border-color: var(--primary-cyan); }
            .btn-export:disabled { opacity: 0.5; cursor: not-allowed; }

            .studio-master-bus { display: flex; align-items: center; gap: 15px; background: #1a1a1a; padding: 10px 15px; border-radius: 6px; border: 1px solid #333; margin-bottom: 15px; }

            .studio-tracks-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; min-height: 100px; }
            .empty-state { text-align: center; color: #666; font-style: italic; padding: 30px; background: #111; border-radius: 6px; border: 1px dashed #333; }

            .studio-track-row { display: flex; align-items: center; gap: 15px; background: #222; padding: 10px 15px; border-radius: 6px; border-left: 4px solid #444; flex-wrap: wrap; }
            .studio-track-row.playing { border-left-color: #00ff55; background: #2a2a2a; box-shadow: inset 0 0 10px rgba(0,255,85,0.05); }
            
            .track-name-input { background: transparent; border: none; color: #fff; font-weight: bold; width: 120px; font-size: 0.9rem; border-bottom: 1px solid transparent; }
            .track-name-input:focus { outline: none; border-bottom-color: var(--primary-cyan); }
            
            .track-controls-group { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 200px; }
            .track-controls-group span { font-size: 0.65rem; color: #888; font-weight: bold; width: 30px; }
            .track-slider { flex: 1; accent-color: var(--primary-cyan); height: 4px; }
            
            .track-nudge-group { display: flex; align-items: center; gap: 5px; background: #111; padding: 2px 8px; border-radius: 4px; border: 1px solid #333; }
            .track-nudge-group input { width: 50px; background: transparent; border: none; color: var(--primary-cyan); font-size: 0.8rem; text-align: center; }

            .btn-mute { background: #333; border: 1px solid #555; color: #888; border-radius: 4px; width: 30px; height: 25px; cursor: pointer; font-weight: bold; }
            .btn-mute.muted { background: #ffaa00; color: #000; border-color: #ffaa00; }
            
            .btn-track-action { background: none; border: none; color: #666; cursor: pointer; font-size: 1.1rem; transition: color 0.2s; width: 25px;}
            .btn-track-action:hover { color: #fff; }
            .btn-track-action.del:hover { color: #ff5555; }
        `;
        this.container.appendChild(style);
    }

    bindEvents() {
        this.container.querySelector('#btn-studio-record-mic').addEventListener('click', () => this.toggleRecording('mic'));
        this.container.querySelector('#btn-studio-bounce').addEventListener('click', () => this.toggleRecording('mix'));

        this.container.querySelector('#btn-studio-play-mix').addEventListener('click', () => this.playMix());
        this.container.querySelector('#btn-studio-stop-mix').addEventListener('click', () => this.stopMix());

        this.container.querySelector('#cb-auto-export').addEventListener('change', (e) => {
            this.settings.autoExport = e.target.checked;
        });

        this.container.querySelector('#btn-studio-import').addEventListener('click', () => {
            this.container.querySelector('#studio-file-import').click();
        });

        this.container.querySelector('#studio-file-import').addEventListener('change', async (e) => {
            for (const file of e.target.files) {
                await this.importAudioFile(file);
            }
            e.target.value = ''; 
        });

        this.container.querySelector('#btn-studio-export').addEventListener('click', () => this.exportAllTracks());

        this.container.querySelector('#studio-master-vol').addEventListener('input', (e) => {
            this.settings.masterVolume = parseFloat(e.target.value);
            this.updateAllLiveVolumes();
        });
    }

    // --- MASTER MIX PLAYBACK ---
    playMix() {
        if (this.isPlayingMix || this.tracks.length === 0) return;
        if (ctx.state === 'suspended') ctx.resume();

        this.isPlayingMix = true;
        this.container.querySelector('#btn-studio-play-mix').style.display = 'none';
        this.container.querySelector('#btn-studio-stop-mix').style.display = 'inline-block';

        const now = ctx.currentTime + 0.05; // Tight buffer for perfect multi-track sync
        let maxDuration = 0;

        this.tracks.forEach(track => {
            if (!track.buffer || track.muted) return;

            // Stop track if it was individually previewing
            if (track._activeSource) {
                try { track._activeSource.stop(); } catch(e){}
                track._activeSource.onended = null;
            }
            if (track._activeGain) {
                try { track._activeGain.disconnect(); } catch(e){}
            }

            const source = ctx.createBufferSource();
            source.buffer = track.buffer;
            
            const panner = ctx.createStereoPanner();
            panner.pan.value = track.pan;
            
            const gain = ctx.createGain();
            gain.gain.value = track.volume * this.settings.masterVolume;
            
            source.connect(panner);
            panner.connect(gain);
            gain.connect(getTrackInput('vocal'));
            
            track._activeSource = source;
            track._activeGain = gain;
            track._activePanner = panner;

            // Math to handle positive vs negative nudging
            const nudgeSec = (track.nudge || 0) / 1000;
            let startTime = now + nudgeSec;
            let offset = 0;
            
            if (startTime < now) {
                offset = now - startTime;
                startTime = now;
            }

            const trackDur = track.buffer.duration - offset + nudgeSec;
            if (trackDur > maxDuration) maxDuration = trackDur;

            const row = document.getElementById(`studio-row-${track.id}`);
            const btn = row?.querySelector('.play-test');
            
            if (row) row.classList.add('playing');
            if (btn) {
                btn.textContent = "⏹";
                btn.style.color = "#00e5ff";
            }

            source.onended = () => {
                if (row) row.classList.remove('playing');
                if (btn) {
                    btn.textContent = "▶";
                    btn.style.color = "";
                }
                track._activeSource = null;
            };

            source.start(startTime, offset);
        });

        // Auto-reset when the longest track naturally finishes
        this.mixTimer = setTimeout(() => {
            this.stopMix();
        }, (maxDuration * 1000) + 100);
    }

    stopMix() {
        this.isPlayingMix = false;
        clearTimeout(this.mixTimer);

        this.container.querySelector('#btn-studio-play-mix').style.display = 'inline-block';
        this.container.querySelector('#btn-studio-stop-mix').style.display = 'none';

        this.tracks.forEach(track => {
            if (track._activeSource) {
                try { track._activeSource.stop(); } catch(e){}
                track._activeSource.onended = null;
                track._activeSource = null;
            }
            const row = document.getElementById(`studio-row-${track.id}`);
            const btn = row?.querySelector('.play-test');
            if (row) row.classList.remove('playing');
            if (btn) {
                btn.textContent = "▶";
                btn.style.color = "";
            }
        });
    }

    // --- RECORDING ---
    async toggleRecording(source = 'mix') {
        const btnMic = this.container.querySelector('#btn-studio-record-mic');
        const btnBounce = this.container.querySelector('#btn-studio-bounce');

        if (this.isPlayingMix) this.stopMix();

        if (this.isRecording) {
            this.isRecording = false;
            btnMic.classList.remove('recording');
            btnBounce.classList.remove('recording');
            btnMic.textContent = "● REC MIC";
            btnBounce.textContent = "● BOUNCE SONG";
            
            if (this.songBuilder && this.songBuilder.isPlaying) this.songBuilder.togglePlay();
            else if (this.sequencer && this.sequencer.isPlaying) this.sequencer.togglePlay();

            if (this.activeRecorder) {
                const blob = await this.activeRecorder.stop();
                this.activeRecorder = null;
                
                if (blob) {
                    const arrayBuffer = await blob.arrayBuffer();
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                    
                    const name = this.recordingSource === 'mic' ? 'Vocal Take' : 'Bounced Mix';
                    this.addTrack(audioBuffer, name);
                    
                    if (this.settings.autoExport) {
                        this.downloadBlob(blob, `${name}.webm`);
                    }
                }
            }
        } else {
            this.recordingSource = source;
            if (ctx.state === 'suspended') await ctx.resume();
            
            this.activeRecorder = startStudioRecording(this.recordingSource);
            this.isRecording = true;
            
            if (source === 'mic') {
                btnMic.classList.add('recording');
                btnMic.textContent = "⏹ STOP MIC";
            } else {
                btnBounce.classList.add('recording');
                btnBounce.textContent = "⏹ STOP BOUNCE";
            }

            if (this.songBuilder && this.songBuilder.playlist.length > 0) {
                if (!this.songBuilder.isPlaying) this.songBuilder.togglePlay();
            } else {
                if (!this.sequencer.isPlaying) this.sequencer.togglePlay();
            }
        }
    }

    async importAudioFile(file) {
        const buffer = await decodeAudioFile(file);
        if (buffer) {
            const name = file.name.replace(/\.[^/.]+$/, ""); 
            this.addTrack(buffer, name);
        }
    }

    addTrack(buffer, name) {
        const track = {
            id: Date.now() + Math.random(),
            name: name || `Track ${this.tracks.length + 1}`,
            buffer: buffer,
            volume: 1.0,
            pan: 0.0,
            nudge: 0, 
            muted: false,
            _activeSource: null,
            _activeGain: null,
            _activePanner: null
        };
        this.tracks.push(track);
        this.renderTrackList();
        this.updateExportButton();
    }

    removeTrack(id) {
        const index = this.tracks.findIndex(t => t.id === id);
        if (index > -1) {
            const track = this.tracks[index];
            if (track._activeSource) {
                try { track._activeSource.stop(); } catch(e){}
            }
            if (track._activeGain) {
                try { track._activeGain.disconnect(); } catch(e){}
            }
            this.tracks.splice(index, 1);
            this.renderTrackList();
            this.updateExportButton();
        }
    }

    updateTrackState(id, field, value) {
        const track = this.tracks.find(t => t.id === id);
        if (track) {
            track[field] = value;
            if (field === 'volume' || field === 'muted') this.updateLiveVolume(track);
            if (field === 'pan' && track._activePanner) {
                track._activePanner.pan.setTargetAtTime(track.pan, ctx.currentTime, 0.05);
            }
        }
    }

    updateLiveVolume(track) {
        if (track._activeGain) {
            const effectiveVol = track.muted ? 0 : (track.volume * this.settings.masterVolume);
            track._activeGain.gain.setTargetAtTime(effectiveVol, ctx.currentTime, 0.05);
        }
    }

    updateAllLiveVolumes() {
        this.tracks.forEach(t => this.updateLiveVolume(t));
    }

    updateExportButton() {
        const btn = this.container.querySelector('#btn-studio-export');
        if (btn) btn.disabled = this.tracks.length === 0;
    }

    downloadTrack(id) {
        const track = this.tracks.find(t => t.id === id);
        if (track && track.buffer) {
            const blob = bufferToWav(track.buffer);
            this.downloadBlob(blob, `${track.name}.wav`);
        }
    }

    exportAllTracks() {
        this.tracks.forEach(track => {
            if (track.buffer && !track.muted) {
                const blob = bufferToWav(track.buffer);
                this.downloadBlob(blob, `${track.name}.wav`);
            }
        });
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = filename.replace(/[^a-z0-9_\-\.\s]/gi, '').trim() || 'audio_file.wav';
        a.download = safeName;
        a.click();
        URL.revokeObjectURL(url);
    }

    renderTrackList() {
        const list = this.container.querySelector('#studio-tracks-list');
        list.innerHTML = '';

        if (this.tracks.length === 0) {
            list.innerHTML = `<div class="empty-state">No recorded tracks. Hit Record or Bounce to capture a take!</div>`;
            return;
        }

        this.tracks.forEach(track => {
            const row = document.createElement('div');
            row.className = 'studio-track-row';
            row.id = `studio-row-${track.id}`;

            row.innerHTML = `
                <button class="btn-track-action play-test" title="Play / Stop Track">▶</button>
                <input type="text" class="track-name-input" value="${track.name}">
                
                <button class="btn-mute ${track.muted ? 'muted' : ''}" title="Mute">M</button>
                
                <div class="track-controls-group">
                    <span>VOL</span>
                    <input type="range" class="track-slider vol-slider" min="0" max="1" step="0.05" value="${track.volume}">
                </div>
                
                <div class="track-controls-group">
                    <span>PAN</span>
                    <input type="range" class="track-slider pan-slider" min="-1" max="1" step="0.1" value="${track.pan}">
                </div>
                
                <div class="track-nudge-group" title="Nudge Timing (ms)">
                    <span style="font-size:0.6rem; color:#888;">NUDGE</span>
                    <input type="number" class="nudge-input" value="${track.nudge}" step="10">
                </div>

                <div style="margin-left:auto; display:flex; gap:10px;">
                    <button class="btn-track-action download" title="Download WAV">💾</button>
                    <button class="btn-track-action del" title="Delete Track">×</button>
                </div>
            `;

            row.querySelector('.track-name-input').addEventListener('change', (e) => this.updateTrackState(track.id, 'name', e.target.value));
            
            const btnMute = row.querySelector('.btn-mute');
            btnMute.addEventListener('click', () => {
                const isMuted = !track.muted;
                this.updateTrackState(track.id, 'muted', isMuted);
                if (isMuted) btnMute.classList.add('muted');
                else btnMute.classList.remove('muted');
            });

            row.querySelector('.vol-slider').addEventListener('input', (e) => this.updateTrackState(track.id, 'volume', parseFloat(e.target.value)));
            row.querySelector('.pan-slider').addEventListener('input', (e) => this.updateTrackState(track.id, 'pan', parseFloat(e.target.value)));
            row.querySelector('.nudge-input').addEventListener('change', (e) => this.updateTrackState(track.id, 'nudge', parseInt(e.target.value) || 0));

            row.querySelector('.download').addEventListener('click', () => this.downloadTrack(track.id));
            row.querySelector('.del').addEventListener('click', () => {
                if (confirm(`Delete "${track.name}"?`)) this.removeTrack(track.id);
            });

            row.querySelector('.play-test').addEventListener('click', () => this.testPlayTrack(track));

            list.appendChild(row);
        });
    }

    testPlayTrack(track) {
        if (!track.buffer) return;

        const row = document.getElementById(`studio-row-${track.id}`);
        const btn = row?.querySelector('.play-test');

        // NEW: Toggle logic - Stop if already playing
        if (track._activeSource) {
            try { track._activeSource.stop(); } catch(e){}
            track._activeSource.onended = null;
            track._activeSource = null;
            
            if (row) row.classList.remove('playing');
            if (btn) {
                btn.textContent = "▶";
                btn.style.color = "";
            }
            return;
        }

        if (track._activeGain) {
            try { track._activeGain.disconnect(); } catch(e){}
        }

        const source = ctx.createBufferSource();
        source.buffer = track.buffer;
        
        const panner = ctx.createStereoPanner();
        panner.pan.value = track.pan;
        
        const gain = ctx.createGain();
        gain.gain.value = track.muted ? 0 : (track.volume * this.settings.masterVolume);
        
        source.connect(panner);
        panner.connect(gain);
        
        const studioDest = getTrackInput('vocal'); 
        gain.connect(studioDest);
        
        track._activeSource = source;
        track._activeGain = gain;
        track._activePanner = panner;
        
        if (row) row.classList.add('playing');
        if (btn) {
            btn.textContent = "⏹";
            btn.style.color = "#00e5ff";
        }

        source.onended = () => {
            if (row) row.classList.remove('playing');
            if (btn) {
                btn.textContent = "▶";
                btn.style.color = "";
            }
            track._activeSource = null;
        };

        // Added Nudge support for individual track previews!
        const nudgeSec = (track.nudge || 0) / 1000;
        let startTime = ctx.currentTime + nudgeSec;
        let offset = 0;
        if (startTime < ctx.currentTime) {
            offset = ctx.currentTime - startTime;
            startTime = ctx.currentTime;
        }
        
        source.start(startTime, offset);
    }
}