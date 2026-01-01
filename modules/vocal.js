// modules/vocal.js
import { startNote, setTrackVolume } from './audio.js';
import { getNoteIndex, generateScale } from './theory.js';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export class VocalGenerator {
    constructor(containerId, sequencerInstance) {
        this.container = document.getElementById(containerId);
        this.sequencer = sequencerInstance;
        
        this.melody = []; 
        this.isMuted = false;
        this.volume = 0.8;
        this.complexity = 'medium'; 
        
        this.render();
        this.bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="vocal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="display:flex; flex-direction:column;">
                    <h3 style="margin:0; font-size:1rem; color:#fff;">VOCAL GENERATOR</h3>
                    <div style="font-size: 0.7rem; color: #888;">AI Topline Suggester</div>
                </div>
                <div style="display:flex; gap:10px;">
                    <select id="vocal-complexity" style="background:#222; color:#ccc; border:1px solid #444; font-size:0.7rem;">
                        <option value="simple">Simple (Ballad)</option>
                        <option value="medium" selected>Medium (Pop)</option>
                        <option value="complex">Busy (Jazz/Rap)</option>
                    </select>
                    <button id="btn-generate-vocal" style="background:linear-gradient(45deg, #00e5ff, #0099cc); border:none; padding:5px 10px; border-radius:3px; color:black; font-weight:bold; cursor:pointer; font-size:0.75rem;">⚡ GENERATE</button>
                </div>
            </div>

            <div class="vocal-controls" style="display:flex; gap:15px; background:#222; padding:10px; border-radius:4px; align-items:center;">
                <div style="display:flex; align-items:center; gap:5px;">
                    <button id="btn-vocal-mute" style="background:#333; border:1px solid #555; color:#ccc; width:30px; height:30px; border-radius:50%; cursor:pointer;">M</button>
                    <label style="font-size:0.7rem; color:#aaa;">Mute</label>
                </div>
                
                <div style="flex:1;">
                    <label style="font-size:0.65rem; color:#888; display:block;">VOLUME</label>
                    <input type="range" id="vocal-vol" min="0" max="1" step="0.1" value="${this.volume}" style="width:100%; accent-color:#00e5ff;">
                </div>

                <div class="vocal-status" id="vocal-status" style="font-size:0.8rem; color:#555; font-style:italic;">
                    No melody generated.
                </div>
            </div>
            
            <div id="vocal-visualizer" style="position:relative; margin-top:10px; height:120px; background:#111; border-radius:3px; overflow:hidden; border:1px solid #333;">
                <div style="position:absolute; top:25%; width:100%; height:1px; background:#222;"></div>
                <div style="position:absolute; top:50%; width:100%; height:1px; background:#333;"></div>
                <div style="position:absolute; top:75%; width:100%; height:1px; background:#222;"></div>
                <span style="position:absolute; left:2px; top:2px; font-size:0.6rem; color:#444;">High</span>
                <span style="position:absolute; left:2px; top:45%; font-size:0.6rem; color:#444;">Mid</span>
                <span style="position:absolute; left:2px; bottom:2px; font-size:0.6rem; color:#444;">Low</span>
            </div>
        `;
    }

    bindEvents() {
        this.container.querySelector('#btn-generate-vocal').addEventListener('click', () => this.generateMelody());
        
        this.container.querySelector('#vocal-complexity').addEventListener('change', (e) => {
            this.complexity = e.target.value;
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
    }

    generateMelody() {
        const { key, scale } = this.sequencer.getScaleData();
        const progName = this.sequencer.state.progressionName;
        const progIndices = this.sequencer.libraries.progression[progName];
        
        if (!progIndices) {
            alert("Please select a valid chord progression first.");
            return;
        }

        const scaleNotes = generateScale(key, scale);
        
        const pitchPool = [];
        [3, 4, 5].forEach(oct => {
            scaleNotes.forEach(note => pitchPool.push({ note, oct }));
        });
        
        let currentPoolIndex = Math.floor(pitchPool.length / 2); 
        this.melody = [];

        let noteProb = 0.7; 
        let minDur = 2; 
        let maxDur = 4; 
        
        if (this.complexity === 'simple') { noteProb = 0.5; minDur = 4; maxDur = 8; } 
        if (this.complexity === 'complex') { noteProb = 0.85; minDur = 1; maxDur = 4; }

        progIndices.forEach((chordIndex, barIndex) => {
            const chordRoot = scaleNotes[chordIndex];
            
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
                
                const move = this.pickNextStep(currentPoolIndex, pitchPool, chordTones, step);
                currentPoolIndex += move;

                if (currentPoolIndex < 0) currentPoolIndex = 0;
                if (currentPoolIndex >= pitchPool.length) currentPoolIndex = pitchPool.length - 1;

                const selectedPitch = pitchPool[currentPoolIndex];
                const isStable = chordTones.includes(selectedPitch.note);

                this.melody.push({
                    globalStep: (barIndex * 16) + step,
                    note: selectedPitch.note,
                    octave: selectedPitch.oct,
                    duration: (durationSteps * 0.25) * 0.95,
                    isStable: isStable // Mark for coloring
                });

                step += durationSteps;
            }
        });

        this.updateVisualizer();
        this.container.querySelector('#vocal-status').textContent = `Generated ${this.melody.length} notes.`;
    }

    pickNextStep(currentIndex, pool, chordTones, currentStep) {
        const r = Math.random();
        const currentNoteName = pool[currentIndex].note;
        const isChordTone = chordTones.includes(currentNoteName);
        const isStrongBeat = (currentStep % 4 === 0);
        const center = pool.length / 2;
        const drift = (currentIndex - center) / center; 
        
        let choice = 0;
        if (r < 0.35) choice = -1; 
        else if (r < 0.70) choice = 1; 
        else if (r < 0.85) choice = 0; 
        else if (r < 0.92) choice = -2; 
        else choice = 2; 

        if (isStrongBeat && !isChordTone) { if (Math.random() < 0.5) choice = choice * 2; }
        if (drift > 0.6) choice = -1; 
        if (drift < -0.6) choice = 1; 

        return choice;
    }

    // --- UPDATED VISUALIZER WITH LABELS ---
    updateVisualizer() {
        const vis = this.container.querySelector('#vocal-visualizer');
        // Clear previous dots (keep grid lines)
        const dots = vis.querySelectorAll('.vocal-dot');
        dots.forEach(d => d.remove());
        
        const totalSteps = this.sequencer.libraries.progression[this.sequencer.state.progressionName].length * 16;
        
        this.melody.forEach(m => {
            const noteIndex = getNoteIndex(m.note);
            // Map pitch to 0-100% height (C3 to B5 range)
            const absPitch = (m.octave * 12) + noteIndex;
            const minPitch = 3 * 12; // C3
            const maxPitch = 5 * 12 + 11; // B5
            const range = maxPitch - minPitch;
            
            const bottomPct = ((absPitch - minPitch) / range) * 80 + 10;
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
            dotWrapper.style.pointerEvents = 'none';

            // Label (Note Name)
            const label = document.createElement('span');
            label.textContent = `${m.note}${m.octave}`;
            label.style.fontSize = '0.55rem';
            label.style.color = '#888';
            label.style.marginBottom = '2px';
            label.style.textShadow = '1px 1px 0 #000';

            // The Note Bar
            const bar = document.createElement('div');
            bar.style.width = `${width}px`; 
            bar.style.height = '6px';
            bar.style.borderRadius = '3px';
            
            // Color Logic: Gold for Chord Tones, Cyan for Passing
            if (m.isStable) {
                bar.style.background = '#ffaa00'; // Gold
                bar.style.boxShadow = '0 0 5px rgba(255, 170, 0, 0.5)';
            } else {
                bar.style.background = '#00e5ff'; // Cyan
                bar.style.boxShadow = '0 0 5px rgba(0, 229, 255, 0.5)';
            }

            dotWrapper.appendChild(label);
            dotWrapper.appendChild(bar);
            vis.appendChild(dotWrapper);
        });
    }

    onStep(step, progIndex, progLength, cycleCount, time) {
        if (this.isMuted || this.melody.length === 0) return;

        const globalStep = step + (progIndex * 16);
        const notesToPlay = this.melody.filter(m => m.globalStep === globalStep);

        notesToPlay.forEach(n => {
            const freq = this.getFrequency(n.note, n.octave);
            // Visual Feedback: Highlight current note
            const vis = this.container.querySelector('#vocal-visualizer');
            // We can't easily select the exact DOM element created above without IDs, 
            // but the playback is the priority.
            startNote(freq, -1, 'Vocal Lead', time, n.duration, 'vocal'); 
        });
    }

    getFrequency(note, octave) {
        const ni = SHARPS.indexOf(note);
        const semitonesFromA4 = (ni - 9) + ((octave - 4) * 12);
        return 440 * Math.pow(2, semitonesFromA4 / 12);
    }
}