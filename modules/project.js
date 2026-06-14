// modules/project.js
import { audioBufferToBase64, base64ToAudioBuffer, SAMPLE_BANKS, DRUM_SAMPLES, DRUM_VOLUMES, setDrumVolume, setTrackVolume, setTrackFilter, setTrackReverb, setTrackPan, loadSavedSamples, setSamplePitchShift, stopAllSounds } from './audio.js'; 
import { SampleStorage } from './storage.js';

export class ProjectManager {
    constructor(sequencer, songBuilder, looper, studio, sampler) {
        this.sequencer = sequencer;
        this.songBuilder = songBuilder;
        this.looper = looper;
        this.studio = studio;
        this.sampler = sampler; 
    }

    async newProject() {
        if (!confirm("Start a New Project?\n\nThis will clear all tracks, song blocks, loops, and sample banks!")) {
            return;
        }

        stopAllSounds();

        // 1. Reset Sequencer State AND Project Presets!
        if (this.sequencer) {
            this.sequencer.savedPresets = {}; 
            localStorage.setItem('sequencer_presets', '{}');

            this.sequencer.state = {
                progressionName: 'Pop Hit (I-V-vi-IV)',
                rhythmName: 'Whole Notes',
                drumName: 'Basic Rock',
                fillName: 'Tom Rundown',
                bassName: 'Root & Fifth',
                leadName: 'Empty',
                samplesName: 'Whole Note (Drone)'
            };
            
            const s = this.sequencer.settings;
            s.volumes = { chords:0.8, bass:0.8, lead:0.8, samples:0.8, drums:0.8 };
            s.filters = { chords:1.0, bass:1.0, lead:1.0, samples:1.0, drums:1.0 };
            s.reverbs = { chords:0.1, bass:0.1, lead:0.1, samples:0.1 };
            s.pans = { chords:0, bass:0, lead:0, samples:0, drums:0 };
            s.octaves = { chords: 0, bass: 0, lead: 0, samples: 0 };
            s.drops = { chords: false, bass: false, lead: false, samples: false };

            ['chords', 'bass', 'lead', 'samples', 'drums'].forEach(t => {
                setTrackVolume(t, s.volumes[t]);
                const elVol = document.getElementById(`vol-${t}`);
                if (elVol) elVol.value = s.volumes[t];

                setTrackFilter(t, s.filters[t]);
                const elFilt = document.getElementById(`filt-${t}`);
                if (elFilt) elFilt.value = s.filters[t];

                setTrackPan(t, s.pans[t]);
                const elPan = document.getElementById(`pan-${t}`);
                if (elPan) elPan.value = s.pans[t];

                if (t !== 'drums') {
                    setTrackReverb(t, s.reverbs[t]);
                    const elVerb = document.getElementById(`verb-${t}`);
                    if (elVerb) elVerb.value = s.reverbs[t];
                }
            });

            this.sequencer.populateDropdowns();
            this.sequencer.refreshPresetList();
        }

        // 2. Clear SongBuilder
        if (this.songBuilder) {
            this.songBuilder.playlist = [];
            this.songBuilder.renderList();
        }

        // 3. Clear Looper Banks
        if (this.looper) {
            for (let i = 0; i < this.looper.banks.length; i++) {
                const bank = this.looper.banks[i];
                bank.buffer = null;
                bank.state = 'empty';
                bank.name = `Loop ${i+1}`;
                await SampleStorage.deleteSample(i, 'loop');
            }
            this.looper.banks.forEach((b, i) => this.looper.updateBankUI(i));
        }

        // 4. Clear Studio Tracks
        if (this.studio) {
            this.studio.tracks = [];
            this.studio.renderTrackList();
            this.studio.updateExportButton();
        }

        // 5. Clear Sampler Slots
        for (let i = 0; i < 8; i++) {
            const cb = document.querySelector(`#pitch-shift-${i}`);
            const isPitched = cb ? cb.checked : true;
            SAMPLE_BANKS[i] = { buffer: null, name: `Sampler ${i+1}`, pitchShift: isPitched };
            await SampleStorage.deleteSample(i, 'slot');
        }

        // 6. Clear Drum Samples
        for (let i = 0; i < 5; i++) {
            DRUM_SAMPLES[i] = null;
            await SampleStorage.deleteSample(i, 'drum');
        }

        if (this.sampler) this.sampler.updateStatus();

        alert("New Project Ready!");
    }

    async exportProject() {
        const filename = prompt("Enter project name:", "MyProject");
        if (!filename) return;

        const projectData = {
            version: "1.1",
            date: new Date().toISOString(),
            name: filename,
            song: {
                playlist: this.songBuilder.playlist,
                savedSongs: this.songBuilder.savedSongs
            },
            sequencer: {
                presets: this.sequencer.savedPresets, 
                customData: this.sequencer.customData,
                state: this.sequencer.state,
                settings: this.sequencer.settings 
            },
            audio: {
                loops: [],
                samples: [],
                drums: [],
                drumVolumes: DRUM_VOLUMES, 
                studioTracks: []
            }
        };

        // 1. Export Looper Banks
        for (let i = 0; i < this.looper.banks.length; i++) {
            const bank = this.looper.banks[i];
            if (bank.buffer) {
                const b64 = await audioBufferToBase64(bank.buffer);
                projectData.audio.loops.push({ index: i, name: bank.name, volume: bank.volume, muted: bank.muted, data: b64 });
            }
        }

        // 2. Export Studio Tracks
        for (let i = 0; i < this.studio.tracks.length; i++) {
            const track = this.studio.tracks[i];
            const b64 = await audioBufferToBase64(track.buffer);
            projectData.audio.studioTracks.push({
                name: track.name,
                volume: track.volume,
                pan: track.pan,
                nudge: track.nudge,
                muted: track.muted,
                data: b64
            });
        }

        // 3. Export Sampler Slots
        for (let i = 0; i < 8; i++) {
            const entry = SAMPLE_BANKS[i];
            if (entry && entry.buffer) {
                const b64 = await audioBufferToBase64(entry.buffer);
                const isPitched = entry.pitchShift !== false; 
                projectData.audio.samples.push({ slot: i, name: entry.name, data: b64, pitchShift: isPitched });
            }
        }

        // 4. Export Drum Samples
        for (let i = 0; i < 5; i++) {
            const entry = DRUM_SAMPLES[i];
            if (entry && entry.buffer) {
                const b64 = await audioBufferToBase64(entry.buffer);
                projectData.audio.drums.push({ slot: i, name: entry.name, data: b64 });
            }
        }

        // 5. Download
        const jsonStr = JSON.stringify(projectData);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async importProject(file) {
        const text = await file.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            alert("Invalid Project File");
            return;
        }

        if (confirm("This will overwrite your current project and clear all existing loops. Continue?")) {
            
            // 1. Restore Sequencer Data
            if (data.sequencer) {
                this.sequencer.savedPresets = data.sequencer.presets || {};
                this.sequencer.customData = data.sequencer.customData || {};
                
                const lib = this.sequencer.libraries;
                const cust = this.sequencer.customData;
                
                if (!cust.fills) cust.fills = {};

                lib.progression = { ...lib.progression, ...cust.progressions };
                lib.rhythm = { ...lib.rhythm, ...cust.rhythm };
                lib.bass = { ...lib.bass, ...cust.bass };
                lib.lead = { ...lib.lead, ...cust.lead };
                lib.samples = { ...lib.samples, ...cust.samples };
                lib.drums = { ...lib.drums, ...cust.drums };
                lib.fills = { ...lib.fills, ...cust.fills };
                
                localStorage.setItem('sequencer_presets', JSON.stringify(this.sequencer.savedPresets));
                
                if (data.sequencer.settings) this.sequencer.settings = data.sequencer.settings;
                if (data.sequencer.state) this.sequencer.state = data.sequencer.state;
                
                this.sequencer.populateDropdowns();
                this.sequencer.refreshPresetList();

                const s = this.sequencer.settings;
                ['chords', 'bass', 'lead', 'samples', 'drums'].forEach(t => {
                    if (s.volumes && s.volumes[t] !== undefined) {
                        setTrackVolume(t, s.volumes[t]);
                        const el = document.getElementById(`vol-${t}`);
                        if (el) el.value = s.volumes[t];
                    }
                    if (s.filters && s.filters[t] !== undefined) {
                        setTrackFilter(t, s.filters[t]);
                        const el = document.getElementById(`filt-${t}`);
                        if (el) el.value = s.filters[t];
                    }
                    if (s.pans && s.pans[t] !== undefined) {
                        setTrackPan(t, s.pans[t]);
                        const el = document.getElementById(`pan-${t}`);
                        if (el) el.value = s.pans[t];
                    }
                    if (s.reverbs && s.reverbs[t] !== undefined && t !== 'drums') {
                        setTrackReverb(t, s.reverbs[t]);
                        const el = document.getElementById(`verb-${t}`);
                        if (el) el.value = s.reverbs[t];
                    }
                });
            }

            // 2. Restore SongBuilder
            if (data.song) {
                this.songBuilder.savedSongs = data.song.savedSongs || {};
                localStorage.setItem('songbuilder_saved_songs', JSON.stringify(this.songBuilder.savedSongs));
                this.songBuilder.playlist = data.song.playlist || [];
                this.songBuilder.refreshSongList();
                this.songBuilder.renderList();
            }

            // 3. Restore Audio (Loops)
            if (data.audio && data.audio.loops) {
                // NEW: Ensure enough banks exist for incoming project without throwing errors!
                let maxIndex = -1;
                data.audio.loops.forEach(loop => { if (loop.index > maxIndex) maxIndex = loop.index; });
                
                while (this.looper.banks.length <= maxIndex) {
                    this.looper.addBank(false); // Add without triggering a full redraw yet
                }
                
                // Now we need to redraw so the UI elements exist before we update them!
                this.looper.render();
                this.looper.bindEvents();

                for(let i=0; i < this.looper.banks.length; i++) {
                    const bank = this.looper.banks[i];
                    bank.buffer = null;
                    bank.state = 'empty';
                    await SampleStorage.deleteSample(i, 'loop'); 
                }
                
                for (const loop of data.audio.loops) {
                    const buffer = await base64ToAudioBuffer(loop.data);
                    if (buffer) {
                        const bank = this.looper.banks[loop.index];
                        if (bank) {
                            bank.buffer = buffer;
                            bank.name = loop.name;
                            bank.volume = loop.volume;
                            bank.isMuted = loop.muted;
                            bank.state = 'playing';
                            await SampleStorage.saveSample(loop.index, buffer, loop.name, 'loop');
                        }
                    }
                }
                this.looper.banks.forEach((b, i) => this.looper.updateBankUI(i));
            }

            // 4. Restore Studio Tracks
            if (data.audio && data.audio.studioTracks) {
                this.studio.tracks = []; 
                for (const t of data.audio.studioTracks) {
                    const buffer = await base64ToAudioBuffer(t.data);
                    if (buffer) {
                        this.studio.tracks.push({
                            id: Date.now() + Math.random(),
                            name: t.name,
                            buffer: buffer,
                            volume: t.volume,
                            pan: t.pan || 0.0, 
                            nudge: t.nudge || 0,
                            muted: t.muted,
                            _activeGain: null,
                            _activePanner: null
                        });
                    }
                }
                this.studio.renderTrackList();
            }

            // 5. Restore Sampler Slots
            if (data.audio && data.audio.samples) {
                for (const s of data.audio.samples) {
                    const buffer = await base64ToAudioBuffer(s.data);
                    if (buffer) {
                        await SampleStorage.saveSample(s.slot, buffer, s.name, 'slot');
                        
                        const isPitched = s.pitchShift !== false; 
                        setSamplePitchShift(s.slot, isPitched);
                        
                        const pitchSettings = JSON.parse(localStorage.getItem('sampler_pitch_settings') || '{}');
                        pitchSettings[s.slot] = isPitched;
                        localStorage.setItem('sampler_pitch_settings', JSON.stringify(pitchSettings));
                    }
                }
            }

            // 6. Restore Drums & Volumes
            if (data.audio) {
                if (data.audio.drums) {
                    for (const d of data.audio.drums) {
                        const buffer = await base64ToAudioBuffer(d.data);
                        if (buffer) {
                            await SampleStorage.saveSample(d.slot, buffer, d.name, 'drum');
                        }
                    }
                }
                if (data.audio.drumVolumes) {
                    data.audio.drumVolumes.forEach((vol, i) => setDrumVolume(i, vol));
                }
                
                await loadSavedSamples();
                if(this.sampler) this.sampler.updateStatus();
            }

            alert("Project Imported Successfully!");
        }
    }
}