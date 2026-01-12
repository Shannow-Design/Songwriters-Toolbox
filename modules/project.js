// modules/project.js
import { audioBufferToBase64, base64ToAudioBuffer, SAMPLE_BANKS, DRUM_SAMPLES, DRUM_VOLUMES, setDrumVolume, setTrackVolume, setTrackFilter, setTrackReverb, setTrackPan, loadSavedSamples } from './audio.js'; // Added setTrackPan
import { SampleStorage } from './storage.js';

export class ProjectManager {
    constructor(sequencer, songBuilder, looper, studio, sampler) {
        this.sequencer = sequencer;
        this.songBuilder = songBuilder;
        this.looper = looper;
        this.studio = studio;
        this.sampler = sampler; 
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
                muted: track.muted,
                data: b64
            });
        }

        // 3. Export Sampler Slots
        for (let i = 0; i < 8; i++) {
            const entry = SAMPLE_BANKS[i];
            if (entry && entry.buffer) {
                const b64 = await audioBufferToBase64(entry.buffer);
                projectData.audio.samples.push({ slot: i, name: entry.name, data: b64 });
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

        if (confirm("This will overwrite your current project. Continue?")) {
            // 1. Restore Sequencer Data
            if (data.sequencer) {
                this.sequencer.savedPresets = data.sequencer.presets || {};
                this.sequencer.customData = data.sequencer.customData || {};
                
                // Merge libraries
                const lib = this.sequencer.libraries;
                const cust = this.sequencer.customData;
                lib.progression = { ...lib.progression, ...cust.progressions };
                lib.rhythm = { ...lib.rhythm, ...cust.rhythm };
                lib.bass = { ...lib.bass, ...cust.bass };
                lib.lead = { ...lib.lead, ...cust.lead };
                lib.samples = { ...lib.samples, ...cust.samples };
                lib.drums = { ...lib.drums, ...cust.drums };
                
                localStorage.setItem('sequencer_presets', JSON.stringify(this.sequencer.savedPresets));
                
                if (data.sequencer.settings) this.sequencer.settings = data.sequencer.settings;
                if (data.sequencer.state) this.sequencer.state = data.sequencer.state;
                
                this.sequencer.populateDropdowns();
                this.sequencer.refreshPresetList();

                // --- NEW: Restore Mixer UI & Audio Engine (Including Pan) ---
                const s = this.sequencer.settings;
                ['chords', 'bass', 'lead', 'samples', 'drums'].forEach(t => {
                    // Volume
                    if (s.volumes && s.volumes[t] !== undefined) {
                        setTrackVolume(t, s.volumes[t]);
                        const el = document.getElementById(`vol-${t}`);
                        if (el) el.value = s.volumes[t];
                    }
                    // Filter
                    if (s.filters && s.filters[t] !== undefined) {
                        setTrackFilter(t, s.filters[t]);
                        const el = document.getElementById(`filt-${t}`);
                        if (el) el.value = s.filters[t];
                    }
                    // Pan (NEW)
                    if (s.pans && s.pans[t] !== undefined) {
                        setTrackPan(t, s.pans[t]);
                        const el = document.getElementById(`pan-${t}`);
                        if (el) el.value = s.pans[t];
                    }
                    // Reverb
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
                for(let i=0; i<8; i++) await this.looper.clearBank(i);
                
                for (const loop of data.audio.loops) {
                    const buffer = await base64ToAudioBuffer(loop.data);
                    if (buffer) {
                        const bank = this.looper.banks[loop.index];
                        bank.buffer = buffer;
                        bank.name = loop.name;
                        bank.volume = loop.volume;
                        bank.isMuted = loop.muted;
                        bank.state = 'playing';
                        await SampleStorage.saveSample(loop.index, buffer, loop.name, 'loop');
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
                            muted: t.muted,
                            _activeGain: null
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
                // Reload global audio arrays for both Sampler and Drums
                await loadSavedSamples();
                if(this.sampler) this.sampler.updateStatus();
            }

            alert("Project Imported Successfully!");
        }
    }
}