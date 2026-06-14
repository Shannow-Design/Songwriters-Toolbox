// modules/micfx.js
import { Microphone, startStudioRecording, ctx } from './audio.js';

export class MicFX {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.presets = {
            'Bypass (Dry)': { lowCut: 10, presence: 0, compression: 0, delay: 0, reverb: 0 },
            'Podcast / Broadcast': { lowCut: 80, presence: 4, compression: 0.8, delay: 0, reverb: 0 },
            'Pop Vocal': { lowCut: 120, presence: 6, compression: 0.6, delay: 0.15, reverb: 0.4 },
            'Stadium Rock': { lowCut: 100, presence: 3, compression: 0.5, delay: 0.4, reverb: 0.8 },
            'Telephone': { lowCut: 800, presence: 10, compression: 1.0, delay: 0, reverb: 0 }
        };

        this.customPresets = JSON.parse(localStorage.getItem('mic_fx_custom')) || {};
        this.currentSettings = JSON.parse(localStorage.getItem('mic_fx_current')) || { ...this.presets['Bypass (Dry)'] };

        // --- TEST BOOTH STATE ---
        this.isTesting = false;
        this.testRecorder = null;
        this.testBlobUrl = null;
        this.testAudio = new Audio();
        
        // Auto-reset the Play button when the test track finishes
        this.testAudio.onended = () => {
            const btnPlay = this.container.querySelector('#btn-micfx-test-play');
            const status = this.container.querySelector('#micfx-test-status');
            if (btnPlay) btnPlay.textContent = "▶ PLAY";
            if (status) status.textContent = "Ready to play.";
        };

        this.render();
        this.bindEvents();
        this.applyToEngine();
    }

    render() {
        const style = document.createElement('style');
        style.innerHTML = `
            .fx-slider-group {
                display: flex;
                flex-direction: column;
                flex: 1;
                min-width: 120px;
                background: #1a1a1a;
                padding: 10px;
                border-radius: 6px;
                border: 1px solid #333;
            }
            .fx-slider-group label {
                font-size: 0.7rem;
                color: #00e5ff;
                margin-bottom: 8px;
                font-weight: bold;
                letter-spacing: 1px;
            }
            .fx-slider-group input[type=range] {
                width: 100%;
                accent-color: var(--primary-cyan);
            }
            .fx-test-booth {
                margin-top: 15px; 
                padding-top: 15px; 
                border-top: 1px solid #333; 
                display: flex; 
                align-items: center; 
                gap: 10px;
                flex-wrap: wrap;
            }
            .btn-fx-test {
                font-size: 0.7rem; 
                padding: 6px 12px; 
                border: none; 
                border-radius: 3px; 
                font-weight: bold; 
                cursor: pointer;
                transition: all 0.2s;
            }
            .btn-fx-test:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        `;
        this.container.appendChild(style);

        const createSlider = (id, label, min, max, step) => `
            <div class="fx-slider-group">
                <label>${label}</label>
                <input type="range" id="fx-${id}" min="${min}" max="${max}" step="${step}" value="${this.currentSettings[id]}">
            </div>
        `;

        const html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; gap:10px; align-items:center;">
                    <select id="sel-micfx-preset" style="background:#111; color:#fff; border:1px solid #444; padding:6px 8px; border-radius:4px; font-size:0.8rem; width:200px;"></select>
                    <button id="btn-save-micfx" style="font-size:0.7rem; padding:6px 12px; background:#00e5ff; color:#000; border:none; border-radius:3px; font-weight:bold; cursor:pointer;">SAVE</button>
                    <button id="btn-del-micfx" style="font-size:0.7rem; padding:6px 12px; background:#aa0033; color:#fff; border:none; border-radius:3px; font-weight:bold; cursor:pointer; display:none;">X</button>
                </div>
            </div>
            
            <div style="display:flex; flex-wrap:wrap; gap:15px;">
                ${createSlider('lowCut', 'LOW CUT (Hz)', 10, 1000, 10)}
                ${createSlider('presence', 'PRESENCE (dB)', -10, 10, 0.5)}
                ${createSlider('compression', 'COMPRESSION', 0, 1, 0.05)}
                ${createSlider('delay', 'ECHO DELAY', 0, 1, 0.05)}
                ${createSlider('reverb', 'REVERB', 0, 1, 0.05)}
            </div>

            <div class="fx-test-booth">
                <button id="btn-micfx-test-rec" class="btn-fx-test" style="background:#aa0033; color:#fff;">● TEST REC</button>
                <button id="btn-micfx-test-play" class="btn-fx-test" style="background:#444; color:#fff;" disabled>▶ PLAY</button>
                <span id="micfx-test-status" style="font-size: 0.7rem; color: #888;">Record a short clip to test your FX settings.</span>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        this.container.appendChild(wrapper);

        this.populateDropdown();
    }

    bindEvents() {
        const ids = ['lowCut', 'presence', 'compression', 'delay', 'reverb'];
        ids.forEach(id => {
            const slider = this.container.querySelector(`#fx-${id}`);
            slider.addEventListener('input', (e) => {
                this.currentSettings[id] = parseFloat(e.target.value);
                this.applyToEngine();
                this.container.querySelector('#sel-micfx-preset').value = ""; // Jump to custom
            });
        });

        const sel = this.container.querySelector('#sel-micfx-preset');
        sel.addEventListener('change', (e) => {
            const name = e.target.value;
            if (!name) return;
            const data = this.presets[name] || this.customPresets[name];
            if (data) {
                this.currentSettings = { ...data };
                ids.forEach(id => {
                    this.container.querySelector(`#fx-${id}`).value = this.currentSettings[id];
                });
                this.applyToEngine();
            }
            this.updateDeleteButton();
        });

        this.container.querySelector('#btn-save-micfx').addEventListener('click', () => {
            const name = prompt("Save FX Preset as:", "My Vocal Chain");
            if (!name) return;
            this.customPresets[name] = { ...this.currentSettings };
            localStorage.setItem('mic_fx_custom', JSON.stringify(this.customPresets));
            this.populateDropdown();
            sel.value = name;
            this.updateDeleteButton();
        });

        this.container.querySelector('#btn-del-micfx').addEventListener('click', () => {
            const name = sel.value;
            if (name && confirm(`Delete preset "${name}"?`)) {
                delete this.customPresets[name];
                localStorage.setItem('mic_fx_custom', JSON.stringify(this.customPresets));
                this.populateDropdown();
                sel.value = 'Bypass (Dry)';
                sel.dispatchEvent(new Event('change'));
            }
        });

        // Test Booth Events
        this.container.querySelector('#btn-micfx-test-rec').addEventListener('click', () => this.toggleTestRecord());
        this.container.querySelector('#btn-micfx-test-play').addEventListener('click', () => this.playTest());
    }

    async toggleTestRecord() {
        const btnRec = this.container.querySelector('#btn-micfx-test-rec');
        const btnPlay = this.container.querySelector('#btn-micfx-test-play');
        const status = this.container.querySelector('#micfx-test-status');

        if (this.isTesting) {
            // STOP RECORDING
            this.isTesting = false;
            btnRec.textContent = "● TEST REC";
            btnRec.style.background = "#aa0033";
            btnRec.style.boxShadow = "none";
            status.textContent = "Processing audio...";
            
            if (this.testRecorder) {
                const blob = await this.testRecorder.stop();
                if (blob) {
                    if (this.testBlobUrl) URL.revokeObjectURL(this.testBlobUrl);
                    this.testBlobUrl = URL.createObjectURL(blob);
                    
                    btnPlay.disabled = false;
                    btnPlay.style.background = "#00e5ff";
                    btnPlay.style.color = "#000";
                    status.textContent = "Ready to play! Change sliders and record again to compare.";
                } else {
                    status.textContent = "Recording failed.";
                }
            }
        } else {
            // START RECORDING
            if (ctx.state === 'suspended') await ctx.resume();

            this.isTesting = true;
            btnRec.textContent = "⏹ STOP REC";
            btnRec.style.background = "#ff0055";
            btnRec.style.boxShadow = "0 0 10px rgba(255,0,85,0.5)";
            
            btnPlay.disabled = true;
            btnPlay.style.background = "#444";
            btnPlay.style.color = "#fff";
            status.textContent = "Recording through FX chain... (Speak now)";
            
            if (this.testAudio && !this.testAudio.paused) {
                this.testAudio.pause();
                this.testAudio.currentTime = 0;
            }

            if (!Microphone.isInitialized) await Microphone.init();
            
            // Sneakily route the mic to our custom recording tracker
            this.testRecorder = startStudioRecording('mic');
        }
    }

    playTest() {
        if (!this.testBlobUrl) return;
        
        const btnPlay = this.container.querySelector('#btn-micfx-test-play');
        const status = this.container.querySelector('#micfx-test-status');
        
        if (this.testAudio && !this.testAudio.paused) {
            // Stop playback early
            this.testAudio.pause();
            this.testAudio.currentTime = 0;
            btnPlay.textContent = "▶ PLAY";
            status.textContent = "Ready to play.";
            return;
        }

        // Play the recorded blob
        this.testAudio.src = this.testBlobUrl;
        this.testAudio.play();
        btnPlay.textContent = "⏹ STOP";
        status.textContent = "Playing back test recording...";
    }

    populateDropdown() {
        const sel = this.container.querySelector('#sel-micfx-preset');
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">--- Custom ---</option>';
        
        const groupBuiltIn = document.createElement('optgroup');
        groupBuiltIn.label = "Built-In Presets";
        Object.keys(this.presets).forEach(k => groupBuiltIn.appendChild(new Option(k, k)));
        sel.appendChild(groupBuiltIn);

        if (Object.keys(this.customPresets).length > 0) {
            const groupCustom = document.createElement('optgroup');
            groupCustom.label = "User Presets";
            Object.keys(this.customPresets).forEach(k => groupCustom.appendChild(new Option(k, k)));
            sel.appendChild(groupCustom);
        }

        if (currentVal && (this.presets[currentVal] || this.customPresets[currentVal])) {
            sel.value = currentVal;
        }
        this.updateDeleteButton();
    }

    updateDeleteButton() {
        const sel = this.container.querySelector('#sel-micfx-preset');
        const btn = this.container.querySelector('#btn-del-micfx');
        btn.style.display = (sel.value && this.customPresets[sel.value]) ? 'inline-block' : 'none';
    }

    applyToEngine() {
        localStorage.setItem('mic_fx_current', JSON.stringify(this.currentSettings));
        if (Microphone.isInitialized) {
            Microphone.applyFxSettings(this.currentSettings);
        }
    }
}