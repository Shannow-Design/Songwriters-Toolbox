// modules/vocal.js
import { startNote, setTrackVolume, ctx, Microphone } from './audio.js';
import { getNoteIndex, generateScale } from './theory.js';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export class VocalGenerator {
    constructor(containerId, sequencerInstance) {
        this.container = document.getElementById(containerId);
        this.sequencer = sequencerInstance;
        
        this.melody = []; 
        this.pitchPool = []; 
        
        this.isMuted = false;
        this.volume = 0.8;
        this.complexity = 'medium'; 
        
        this.rangeMin = 'C3';
        this.rangeMax = 'G4';
        
        // Practice Mode State
        this.isPracticeMode = false;
        this.detectedPitch = null;
        this.userTrail = []; 
        this.currentScore = 0;
        this.totalFrames = 0;
        this.hitFrames = 0;
        this.micGainVal = 1.0; 

        // Pitch Smoothing
        this.lastValidPitch = null;
        this.dropoutCounter = 0;

        // Drag State
        this.dragState = { active: false, noteObj: null, mode: null, startX: 0, startY: 0, startVal: 0 };

        this.render();
        this.populateRangeSelects();
        this.bindEvents();
        
        document.addEventListener('mousemove', (e) => this.handleDragMove(e));
        document.addEventListener('mouseup', () => this.handleDragEnd());
    }

    render() {
        this.container.innerHTML = `
            <style>
                .vocal-note-bar { cursor: grab; position: relative; transition: background 0.1s; }
                .vocal-note-bar:active { cursor: grabbing; }
                
                .vocal-delete-btn {
                    position: absolute; top: -10px; right: -8px; width: 16px; height: 16px;
                    background: #ff5555; color: white; border-radius: 50%;
                    font-size: 12px; line-height: 16px; text-align: center; font-weight: bold;
                    cursor: pointer; opacity: 0; transition: opacity 0.1s, transform 0.1s;
                    z-index: 100; box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                }
                .vocal-note-bar:hover .vocal-delete-btn, .vocal-delete-btn:hover { opacity: 1; }
                .vocal-delete-btn:hover { transform: scale(1.1); background: #ff0000; }

                .vocal-resize-handle {
                    position: absolute; right: 0; top: 0; bottom: 0; width: 10px;
                    cursor: e-resize; background: rgba(255,255,255,0.1);
                    border-top-right-radius: 3px; border-bottom-right-radius: 3px;
                }
                .vocal-resize-handle:hover { background: rgba(255,255,255,0.5); }

                .vocal-playhead {
                    position: absolute; top: 0; bottom: 0; width: 2px;
                    background: #ff0055; z-index: 10; pointer-events: none;
                    box-shadow: 0 0 10px #ff0055; transition: left 0.1s linear; display: none;
                }
                
                .vocal-btn {
                    background: #333; border: 1px solid #555; color: #ccc; 
                    font-size: 0.7rem; padding: 3px 8px; border-radius: 3px; cursor: pointer;
                }
                .vocal-btn:hover { background: #444; color: #fff; }
                
                .range-select { background: #222; color: #ccc; border: 1px solid #444; font-size: 0.7rem; width: 45px; }
                .practice-active { border-color: #00ff55 !important; color: #00ff55 !important; box-shadow: 0 0 10px rgba(0,255,85,0.3); }
                .score-val { color: #00e5ff; font-weight: bold; }
                
                /* NEW: Note Display Style */
                .note-readout {
                    font-family: monospace; font-size: 0.9rem; font-weight: bold;
                    color: #555; min-width: 40px; text-align: center;
                    margin-right: 10px;
                }
                .in-scale { color: #00ff55; text-shadow: 0 0 5px rgba(0,255,85,0.5); }
                .out-scale { color: #ff5555; }
                .perfect-hit { color: #00e5ff; text-shadow: 0 0 8px #00e5ff; }
            </style>
            
            <div class="vocal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="display:flex; flex-direction:column;">
                    <h3 style="margin:0; font-size:1rem; color:#fff;">VOCAL GENERATOR</h3>
                    <div style="font-size: 0.7rem; color: #888;">AI Topline Suggester</div>
                </div>
                
                <div style="display:flex; gap:10px; align-items:center;">
                    <div style="display:flex; flex-direction:column; align-items:center; margin-right:5px;">
                        <label style="font-size:0.55rem; color:#666; text-transform:uppercase;">Range</label>
                        <div style="display:flex; gap:2px;">
                            <select id="vocal-range-min" class="range-select"></select>
                            <span style="color:#444; font-size:0.7rem;">-</span>
                            <select id="vocal-range-max" class="range-select"></select>
                        </div>
                    </div>

                    <button id="btn-vocal-save" class="vocal-btn" title="Save">💾</button>
                    <button id="btn-vocal-load" class="vocal-btn" title="Load">📂</button>
                    <input type="file" id="vocal-file-input" style="display:none" accept=".json">
                    
                    <select id="vocal-complexity" style="background:#222; color:#ccc; border:1px solid #444; font-size:0.7rem;">
                        <option value="simple">Simple</option>
                        <option value="medium" selected>Medium</option>
                        <option value="complex">Busy</option>
                    </select>
                    <button id="btn-generate-vocal" style="background:linear-gradient(45deg, #00e5ff, #0099cc); border:none; padding:5px 10px; border-radius:3px; color:black; font-weight:bold; cursor:pointer; font-size:0.75rem;">⚡ GEN</button>
                </div>
            </div>

            <div class="vocal-controls" style="display:flex; gap:15px; background:#222; padding:10px; border-radius:4px; align-items:center;">
                <div style="display:flex; align-items:center; gap:5px;">
                    <button id="btn-vocal-mute" style="background:#333; border:1px solid #555; color:#ccc; width:30px; height:30px; border-radius:50%; cursor:pointer;">M</button>
                    <label style="font-size:0.7rem; color:#aaa;">Mute</label>
                </div>
                
                <div style="flex:1; display:flex; align-items:center; gap:10px;">
                    <div style="flex:1;">
                        <label style="font-size:0.65rem; color:#888; display:block;">VOLUME</label>
                        <input type="range" id="vocal-vol" min="0" max="1" step="0.1" value="${this.volume}" style="width:100%; accent-color:#00e5ff;">
                    </div>
                    
                    <div style="flex:1; border-left:1px solid #444; padding-left:10px;">
                        <label style="font-size:0.65rem; color:#888; display:block;">MIC GAIN</label>
                        <input type="range" id="vocal-mic-gain" min="0" max="3" step="0.1" value="${this.micGainVal}" style="width:100%; accent-color:#00ff55;">
                    </div>

                    <button id="btn-practice-mode" class="vocal-btn" style="height:30px; display:flex; align-items:center; gap:5px;">
                        🎤 Practice
                    </button>
                </div>

                <div class="vocal-status" style="display:flex; flex-direction:column; align-items:flex-end;">
                    <div id="vocal-status" style="font-size:0.7rem; color:#555; font-style:italic;">Ready.</div>
                    
                    <div id="vocal-score-container" style="display:none; flex-direction:row; align-items:center; margin-top:2px;">
                        <span id="vocal-detected-note" class="note-readout">--</span>
                        <div style="font-size:0.7rem; color:#888; font-weight:bold;">Score: <span class="score-val">0%</span></div>
                    </div>
                </div>
            </div>
            
            <div id="vocal-visualizer" style="position:relative; margin-top:10px; height:150px; background:#111; border-radius:3px; overflow:hidden; border:1px solid #333; user-select:none; cursor: crosshair;">
                <canvas id="vocal-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:5;"></canvas>

                <div style="position:absolute; top:25%; width:100%; height:1px; background:#222; pointer-events:none;"></div>
                <div style="position:absolute; top:50%; width:100%; height:1px; background:#333; pointer-events:none;"></div>
                <div style="position:absolute; top:75%; width:100%; height:1px; background:#222; pointer-events:none;"></div>
                
                <span id="vocal-vis-high" style="position:absolute; left:2px; top:2px; font-size:0.6rem; color:#444; pointer-events:none;">High</span>
                <span id="vocal-vis-mid" style="position:absolute; left:2px; top:45%; font-size:0.6rem; color:#444; pointer-events:none;">Mid</span>
                <span id="vocal-vis-low" style="position:absolute; left:2px; bottom:2px; font-size:0.6rem; color:#444; pointer-events:none;">Low</span>
                
                <div id="vocal-playhead" class="vocal-playhead"></div>
            </div>
        `;
        
        this.canvas = this.container.querySelector('#vocal-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = this.container.querySelector('#vocal-visualizer').clientWidth;
        this.canvas.height = 150;
    }

    populateRangeSelects() {
        const selMin = this.container.querySelector('#vocal-range-min');
        const selMax = this.container.querySelector('#vocal-range-max');
        const notes = [];
        for(let oct=2; oct<=6; oct++) { SHARPS.forEach(note => notes.push(`${note}${oct}`)); }
        notes.forEach(n => { selMin.appendChild(new Option(n, n)); selMax.appendChild(new Option(n, n)); });
        selMin.value = this.rangeMin; selMax.value = this.rangeMax;
    }

    bindEvents() {
        this.container.querySelector('#btn-generate-vocal').addEventListener('click', () => this.generateMelody());
        this.container.querySelector('#vocal-complexity').addEventListener('change', (e) => { this.complexity = e.target.value; });

        this.container.querySelector('#vocal-mic-gain').addEventListener('input', (e) => {
            this.micGainVal = parseFloat(e.target.value);
            if (Microphone.setGain) Microphone.setGain(this.micGainVal);
        });

        const btnMute = this.container.querySelector('#btn-vocal-mute');
        btnMute.addEventListener('click', () => {
            this.isMuted = !this.isMuted;
            btnMute.style.color = this.isMuted ? '#ffaa00' : '#ccc';
            btnMute.style.borderColor = this.isMuted ? '#ffaa00' : '#555';
        });

        this.container.querySelector('#vocal-vol').addEventListener('input', (e) => {
            this.volume = parseFloat(e.target.value);
            setTrackVolume('vocal', this.volume);
        });

        this.container.querySelector('#btn-vocal-save').addEventListener('click', () => this.saveMelody());
        this.container.querySelector('#btn-vocal-load').addEventListener('click', () => { this.container.querySelector('#vocal-file-input').click(); });
        this.container.querySelector('#vocal-file-input').addEventListener('change', (e) => { if(e.target.files.length > 0) this.loadMelody(e.target.files[0]); });

        const selMin = this.container.querySelector('#vocal-range-min');
        const selMax = this.container.querySelector('#vocal-range-max');
        selMin.addEventListener('change', (e) => {
            this.rangeMin = e.target.value;
            if(this.getNoteVal(this.rangeMin) >= this.getNoteVal(this.rangeMax)) { this.rangeMax = this.rangeMin; selMax.value = this.rangeMax; }
            this.updateRangeLabels();
        });
        selMax.addEventListener('change', (e) => {
            this.rangeMax = e.target.value;
            if(this.getNoteVal(this.rangeMax) <= this.getNoteVal(this.rangeMin)) { this.rangeMin = this.rangeMax; selMin.value = this.rangeMin; }
            this.updateRangeLabels();
        });

        const visualizer = this.container.querySelector('#vocal-visualizer');
        visualizer.addEventListener('dblclick', (e) => {
            if (e.target !== visualizer && e.target !== this.canvas) return;
            this.addNoteFromClick(e);
        });

        this.container.querySelector('#btn-practice-mode').addEventListener('click', () => this.togglePracticeMode());
    }

    rebuildPitchPool() {
        const { key, scale } = this.sequencer.getScaleData();
        const scaleNotes = generateScale(key, scale);
        
        if (!scaleNotes || scaleNotes.length === 0) return;

        const minVal = this.getNoteVal(this.rangeMin);
        const maxVal = this.getNoteVal(this.rangeMax);

        this.pitchPool = [];
        
        for (let oct = 2; oct <= 6; oct++) {
            SHARPS.forEach(note => {
                const val = (oct * 12) + SHARPS.indexOf(note);
                if (val >= minVal && val <= maxVal) {
                    if (scaleNotes.includes(note)) {
                        this.pitchPool.push({ note, octave: oct });
                    }
                }
            });
        }
    }

    detectPitchLoop() {
        if (!this.isPracticeMode) return;

        const analyser = Microphone.analyserNode;
        const bufferLength = analyser.fftSize;
        const buffer = new Float32Array(bufferLength);
        analyser.getFloatTimeDomainData(buffer);

        const pitch = this.autoCorrelate(buffer, ctx.sampleRate);
        
        if (pitch !== -1) {
            this.detectedPitch = pitch;
            this.lastValidPitch = pitch;
            this.dropoutCounter = 0; 
        } else {
            if (this.dropoutCounter < 15 && this.lastValidPitch) {
                this.detectedPitch = this.lastValidPitch;
                this.dropoutCounter++;
            } else {
                this.detectedPitch = null;
            }
        }

        requestAnimationFrame(() => this.detectPitchLoop());
    }

    autoCorrelate(buf, sampleRate) {
        let SIZE = buf.length;
        let rms = 0;
        for (let i=0; i<SIZE; i++) { rms += buf[i]*buf[i]; }
        rms = Math.sqrt(rms/SIZE);
        
        if (rms < 0.005) return -1; 

        let r1=0, r2=SIZE-1, thres=0.2;
        for (let i=0; i<SIZE/2; i++) { if (Math.abs(buf[i])<thres) { r1=i; break; } }
        for (let i=1; i<SIZE/2; i++) { if (Math.abs(buf[SIZE-i])<thres) { r2=SIZE-i; break; } }
        buf = buf.slice(r1, r2);
        SIZE = buf.length;

        let c = new Array(SIZE).fill(0);
        for (let i=0; i<SIZE; i++) { for (let j=0; j<SIZE-i; j++) { c[i] = c[i] + buf[j]*buf[j+i]; } }

        let d=0; while(c[d]>c[d+1]) d++;
        let maxval=-1, maxpos=-1;
        for(let i=d; i<SIZE; i++) { if(c[i] > maxval){ maxval=c[i]; maxpos=i; } }
        let T0 = maxpos;

        let x1=c[T0-1], x2=c[T0], x3=c[T0+1];
        let a = (x1 + x3 - 2*x2)/2;
        let b = (x3 - x1)/2;
        if(a) T0 = T0 - b/(2*a);

        let freq = sampleRate/T0;
        if (freq > 1500 || freq < 65) return -1;

        return freq;
    }

    // --- Rest of Logic ---
    async togglePracticeMode() {
        const btn = this.container.querySelector('#btn-practice-mode');
        const scorePanel = this.container.querySelector('#vocal-score-container');
        
        if (!this.isPracticeMode) {
            try {
                await Microphone.init();
                if (ctx.state === 'suspended') await ctx.resume();
                if (Microphone.setGain) Microphone.setGain(this.micGainVal);
                this.isPracticeMode = true;
                btn.classList.add('practice-active');
                btn.innerHTML = "🎤 Active";
                scorePanel.style.display = 'flex'; // Show score
                this.resetScore();
                this.detectPitchLoop();
            } catch (err) { console.error(err); alert("Could not access microphone."); }
        } else {
            this.isPracticeMode = false;
            btn.classList.remove('practice-active');
            btn.innerHTML = "🎤 Practice";
            scorePanel.style.display = 'none'; // Hide score
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    updatePracticeVisuals(globalStep, totalSteps) {
        if (!this.isPracticeMode) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const minVal = this.getNoteVal(this.rangeMin);
        const maxVal = this.getNoteVal(this.rangeMax);
        const range = maxVal - minVal;
        const currentX = (globalStep / totalSteps) * this.canvas.width;

        // --- NEW: Scale Validation Logic ---
        const noteDisplay = this.container.querySelector('#vocal-detected-note');
        
        if (this.detectedPitch) {
            // 1. Calculate Note
            const noteNum = 12 * (Math.log(this.detectedPitch / 440) / Math.log(2)) + 69;
            const noteIndex = Math.round(noteNum) % 12; 
            const octave = Math.floor(noteNum / 12) - 1;
            const noteName = SHARPS[noteIndex];
            const displayNote = `${noteName}${octave}`;
            
            // 2. Validate against Scale
            const { key, scale } = this.sequencer.getScaleData();
            const scaleNotes = generateScale(key, scale);
            const isInScale = scaleNotes.includes(noteName);

            // 3. Update Display
            noteDisplay.textContent = displayNote;
            noteDisplay.className = "note-readout"; // reset
            
            if (isInScale) noteDisplay.classList.add('in-scale');
            else noteDisplay.classList.add('out-scale');

            // 4. Drawing Logic
            const absPitch = noteNum - 12; 
            let bottomPct = ((absPitch - minVal) / range);
            const y = this.canvas.height - (bottomPct * (this.canvas.height * 0.8) + (this.canvas.height * 0.1));

            let trailColor = isInScale ? '#00ff55' : '#ff5555'; 
            let isHit = false;

            // Check against melody targets
            const activeNote = this.melody.find(m => {
                const start = m.globalStep;
                const end = m.globalStep + m.duration;
                return globalStep >= start && globalStep <= end;
            });

            if (activeNote) {
                const targetVal = this.getNoteVal(activeNote.note + activeNote.octave);
                if (Math.abs(absPitch - targetVal) < 0.6) {
                    isHit = true;
                    trailColor = '#00e5ff'; // Perfect Hit Color
                    noteDisplay.className = "note-readout perfect-hit";
                }
            }

            // Draw line (clamped to canvas)
            if (y > -10 && y < this.canvas.height + 10) {
                this.userTrail.push({ x: currentX, y: y, color: trailColor, hit: isHit });
            } else {
                this.userTrail.push(null);
            }
            
            if(activeNote) {
                this.totalFrames++;
                if (isHit) this.hitFrames++;
            }

        } else {
            this.userTrail.push(null); 
            noteDisplay.textContent = "--";
            noteDisplay.className = "note-readout";
        }

        // Draw Trail
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        for (let i = 1; i < this.userTrail.length; i++) {
            const p1 = this.userTrail[i-1];
            const p2 = this.userTrail[i];
            
            if (p1 && p2) {
                if (Math.abs(p2.x - p1.x) > 20) continue; 
                this.ctx.beginPath();
                this.ctx.moveTo(p1.x, p1.y);
                this.ctx.lineTo(p2.x, p2.y);
                this.ctx.strokeStyle = p2.color; 
                this.ctx.stroke();
            }
        }

        if (this.totalFrames > 0) {
            const pct = Math.round((this.hitFrames / this.totalFrames) * 100);
            this.container.querySelector('.score-val').textContent = `${pct}%`;
        }
    }

    resetScore() {
        this.userTrail = [];
        this.totalFrames = 0;
        this.hitFrames = 0;
        this.container.querySelector('.score-val').textContent = "0%";
    }

    getNoteVal(noteStr) {
        if(!noteStr) return 0;
        const octave = parseInt(noteStr.slice(-1));
        const name = noteStr.slice(0, -1);
        return (octave * 12) + SHARPS.indexOf(name);
    }

    updateRangeLabels() {
        this.container.querySelector('#vocal-vis-low').textContent = this.rangeMin;
        this.container.querySelector('#vocal-vis-high').textContent = this.rangeMax;
    }

    addNoteFromClick(e) {
        if (!this.sequencer.state.progressionName) { alert("Please create a chord progression first."); return; }
        this.rebuildPitchPool();
        if (this.pitchPool.length === 0) return;

        const vis = this.container.querySelector('#vocal-visualizer');
        const rect = vis.getBoundingClientRect();
        
        const x = e.clientX - rect.left;
        const prog = this.sequencer.libraries.progression[this.sequencer.state.progressionName];
        const totalSteps = prog.length * 16;
        const snappedStep = Math.round(((x / rect.width) * totalSteps) / 2) * 2; 
        const y = e.clientY - rect.top;
        const pctY = 100 - ((y / rect.height) * 100);
        const indexPct = (pctY - 10) / 80;
        let poolIndex = Math.floor(indexPct * this.pitchPool.length);
        if (poolIndex < 0) poolIndex = 0;
        if (poolIndex >= this.pitchPool.length) poolIndex = this.pitchPool.length - 1;
        const pitch = this.pitchPool[poolIndex];
        this.melody.push({ globalStep: snappedStep, note: pitch.note, octave: pitch.octave, duration: 4, isStable: true });
        this.updateVisualizer();
    }

    saveMelody() {
        if (this.melody.length === 0) { alert("No melody to save!"); return; }
        let filename = prompt("Enter a filename:", "my_melody");
        if (!filename) return; 
        if (!filename.endsWith(".json")) filename += ".json";
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.melody));
        const anchor = document.createElement('a');
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", filename);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }

    loadMelody(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    this.melody = data;
                    this.rebuildPitchPool(); 
                    this.updateVisualizer();
                } else { alert("Invalid file format."); }
            } catch (err) { console.error(err); alert("Error loading file."); }
        };
        reader.readAsText(file);
    }

    generateMelody() {
        const progName = this.sequencer.state.progressionName;
        const progIndices = this.sequencer.libraries.progression[progName];
        if (!progIndices) { alert("Please select a chord progression first."); return; }

        this.rebuildPitchPool();
        if (this.pitchPool.length === 0) {
            const sName = this.sequencer.state.scale || "Unknown Scale";
            alert(`No notes in Scale (${sName}) fit in the selected range (${this.rangeMin}-${this.rangeMax}). Try widening the range.`);
            return;
        }

        const { key, scale } = this.sequencer.getScaleData();
        const scaleNotes = generateScale(key, scale);

        let currentPoolIndex = Math.floor(this.pitchPool.length / 2); 
        this.melody = [];

        let noteProb = 0.7; let minDur = 2; let maxDur = 4; 
        if (this.complexity === 'simple') { noteProb = 0.5; minDur = 4; maxDur = 8; } 
        if (this.complexity === 'complex') { noteProb = 0.85; minDur = 1; maxDur = 4; }

        progIndices.forEach((chordIndex, barIndex) => {
            const chordTones = [
                scaleNotes[chordIndex % scaleNotes.length],
                scaleNotes[(chordIndex + 2) % scaleNotes.length],
                scaleNotes[(chordIndex + 4) % scaleNotes.length]
            ];

            let step = 0;
            while (step < 16) {
                if (Math.random() > noteProb) { step += 2; continue; }
                let durationSteps = Math.floor(Math.random() * (maxDur - minDur + 1)) + minDur;
                if (step + durationSteps > 16) durationSteps = 16 - step;
                
                const move = this.pickNextStep(currentPoolIndex, this.pitchPool, chordTones, step);
                currentPoolIndex += move;
                if (currentPoolIndex < 0) currentPoolIndex = 0;
                if (currentPoolIndex >= this.pitchPool.length) currentPoolIndex = this.pitchPool.length - 1;

                const selectedPitch = this.pitchPool[currentPoolIndex];
                const isStable = chordTones.includes(selectedPitch.note);

                this.melody.push({
                    globalStep: (barIndex * 16) + step,
                    note: selectedPitch.note,
                    octave: selectedPitch.octave,
                    duration: (durationSteps * 0.25) * 0.95,
                    isStable: isStable
                });
                step += durationSteps;
            }
        });
        this.updateVisualizer();
        this.container.querySelector('#vocal-status').textContent = `Generated ${this.melody.length} notes.`;
    }

    pickNextStep(currentIndex, pool, chordTones, currentStep) {
        const r = Math.random();
        const currentPitch = pool[currentIndex];
        const isChordTone = chordTones.includes(currentPitch.note);
        const isStrongBeat = (currentStep % 4 === 0);
        let choice = 0;
        if (r < 0.35) choice = -1; else if (r < 0.70) choice = 1; else if (r < 0.85) choice = 0; else choice = (Math.random() > 0.5) ? 2 : -2;
        if (isStrongBeat && !isChordTone) { if (Math.random() < 0.5) choice = choice * 2; }
        const center = pool.length / 2;
        const drift = (currentIndex - center) / center; 
        if (drift > 0.6) choice = -1; if (drift < -0.6) choice = 1; 
        return choice;
    }

    updateVisualizer() {
        const vis = this.container.querySelector('#vocal-visualizer');
        const dots = vis.querySelectorAll('.vocal-dot');
        dots.forEach(d => d.remove());
        
        if (!this.sequencer.libraries || !this.sequencer.state.progressionName) return;
        const prog = this.sequencer.libraries.progression[this.sequencer.state.progressionName];
        if (!prog) return;

        const totalSteps = prog.length * 16;
        const minVal = this.getNoteVal(this.rangeMin);
        const maxVal = this.getNoteVal(this.rangeMax);
        const range = maxVal - minVal;

        this.melody.forEach((m, mIndex) => {
            const noteIndex = getNoteIndex(m.note);
            const oct = typeof m.octave === 'number' ? m.octave : 4;
            const absPitch = (oct * 12) + noteIndex;
            let bottomPct = ((absPitch - minVal) / range) * 80 + 10;
            if(bottomPct < 0) bottomPct = 2; if(bottomPct > 95) bottomPct = 95;

            const left = (m.globalStep / totalSteps) * 100;
            const width = Math.max(10, m.duration * 30); 
            
            const dotWrapper = document.createElement('div');
            dotWrapper.className = 'vocal-dot';
            dotWrapper.style.position = 'absolute';
            dotWrapper.style.left = `${left}%`;
            dotWrapper.style.bottom = `${bottomPct}%`;
            dotWrapper.style.display = 'flex';
            dotWrapper.style.flexDirection = 'column';
            dotWrapper.style.alignItems = 'center';
            dotWrapper.ondragstart = () => false;

            const label = document.createElement('span');
            label.textContent = `${m.note}${m.octave}`;
            label.style.fontSize = '0.55rem';
            label.style.color = '#888';
            label.style.marginBottom = '2px';
            label.style.textShadow = '1px 1px 0 #000';
            label.style.pointerEvents = 'none';

            const bar = document.createElement('div');
            bar.className = 'vocal-note-bar';
            bar.style.width = `${width}px`; 
            bar.style.height = '8px';
            bar.style.borderRadius = '3px';
            
            if (m.isStable) {
                bar.style.background = '#ffaa00'; bar.style.boxShadow = '0 0 5px rgba(255, 170, 0, 0.5)';
            } else {
                bar.style.background = '#00e5ff'; bar.style.boxShadow = '0 0 5px rgba(0, 229, 255, 0.5)';
            }

            const delBtn = document.createElement('div');
            delBtn.className = 'vocal-delete-btn';
            delBtn.textContent = '×';
            delBtn.title = "Delete Note";
            
            delBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); this.melody.splice(mIndex, 1); this.updateVisualizer(); });
            bar.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); this.melody.splice(mIndex, 1); this.updateVisualizer(); });
            bar.addEventListener('dblclick', (e) => { e.stopPropagation(); this.melody.splice(mIndex, 1); this.updateVisualizer(); });

            bar.addEventListener('mousedown', (e) => {
                if(e.target === delBtn) return;
                e.stopPropagation();
                if (this.pitchPool.length === 0) this.rebuildPitchPool();

                const rect = bar.getBoundingClientRect();
                const isResize = (e.clientX - rect.left) > (rect.width - 10);
                
                this.dragState.active = true;
                this.dragState.noteObj = m;
                this.dragState.startX = e.clientX;
                this.dragState.startY = e.clientY;

                if (isResize) {
                    this.dragState.mode = 'duration';
                    this.dragState.startVal = m.duration;
                    document.body.style.cursor = 'e-resize';
                } else {
                    this.dragState.mode = 'pitch';
                    let pIndex = this.pitchPool.findIndex(p => p.note === m.note && p.octave === m.octave);
                    if (pIndex === -1) pIndex = Math.floor(this.pitchPool.length / 2);
                    this.dragState.startVal = pIndex;
                    document.body.style.cursor = 'ns-resize';
                    bar.style.background = '#fff';
                }
            });

            const handle = document.createElement('div');
            handle.className = 'vocal-resize-handle';
            bar.appendChild(handle);
            bar.appendChild(delBtn);

            dotWrapper.appendChild(label);
            dotWrapper.appendChild(bar);
            vis.appendChild(dotWrapper);
        });
    }

    handleDragMove(e) {
        if (!this.dragState.active || !this.dragState.noteObj) return;
        const dist = Math.sqrt(Math.pow(e.clientX - this.dragState.startX, 2) + Math.pow(e.clientY - this.dragState.startY, 2));
        if (dist < 5) return;
        if (this.pitchPool.length === 0) { this.handleDragEnd(); return; }

        const { noteObj, mode, startX, startY, startVal } = this.dragState;

        if (mode === 'pitch') {
            const dy = startY - e.clientY; 
            const steps = Math.round(dy / 10); 
            let newIndex = startVal + steps;
            if (newIndex < 0) newIndex = 0;
            if (newIndex >= this.pitchPool.length) newIndex = this.pitchPool.length - 1;
            const newPitch = this.pitchPool[newIndex];
            if (newPitch) { noteObj.note = newPitch.note; noteObj.octave = newPitch.octave; this.updateVisualizer(); }
        } 
        else if (mode === 'duration') {
            const dx = e.clientX - startX;
            let newDur = startVal + (dx / 30); 
            if (newDur < 0.25) newDur = 0.25; if (newDur > 4.0) newDur = 4.0;
            noteObj.duration = newDur;
            this.updateVisualizer();
        }
    }

    handleDragEnd() {
        if (this.dragState.active) {
            this.dragState.active = false;
            this.dragState.noteObj = null;
            document.body.style.cursor = 'default';
            this.updateVisualizer(); 
        }
    }

    onStep(step, progIndex, progLength, cycleCount, time) {
        const totalSteps = progLength * 16;
        const currentGlobalStep = (progIndex * 16) + step;
        const percent = (currentGlobalStep / totalSteps) * 100;
        
        const playhead = this.container.querySelector('#vocal-playhead');
        if (playhead) { playhead.style.display = 'block'; playhead.style.left = `${percent}%`; }

        if (step === 0 && progIndex === 0 && this.isPracticeMode) {
            if (this.totalFrames > 0) this.resetScore();
        }

        if (this.isPracticeMode) this.updatePracticeVisuals(currentGlobalStep, totalSteps);

        if (this.isMuted || this.melody.length === 0) return;

        const notesToPlay = this.melody.filter(m => { return Math.abs(m.globalStep - currentGlobalStep) < 0.1; });
        notesToPlay.forEach(n => {
            const freq = this.getFrequency(n.note, n.octave);
            startNote(freq, -1, 'Vocal Lead', time, n.duration, 'vocal'); 
        });
    }

    getFrequency(note, octave) {
        if (!note || octave === undefined) return 440;
        const ni = SHARPS.indexOf(note);
        if (ni === -1) return 440;
        const semitonesFromA4 = (ni - 9) + ((octave - 4) * 12);
        return 440 * Math.pow(2, semitonesFromA4 / 12);
    }
}