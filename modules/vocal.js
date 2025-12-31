// modules/vocal.js
import { startNote, setTrackVolume, setTrackReverb } from './audio.js';
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
            
            <div id="vocal-visualizer" style="position:relative; margin-top:10px; height:60px; background:#151515; border-radius:3px; overflow:hidden; border:1px solid #333;">
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

    // --- ALGORITHM: The Melodic Walker ---
    generateMelody() {
        const { key, scale } = this.sequencer.getScaleData();
        const progName = this.sequencer.state.progressionName;
        const progIndices = this.sequencer.libraries.progression[progName];
        
        if (!progIndices) {
            alert("Please select a valid chord progression first.");
            return;
        }

        const scaleNotes = generateScale(key, scale);
        
        // 1. Build a "Pitch Pool" spanning 2.5 octaves (Range C3 to G5 roughly)
        // This linearizes the scale so we can just say "index + 1" to go up a step.
        const pitchPool = [];
        [3, 4, 5].forEach(oct => {
            scaleNotes.forEach(note => pitchPool.push({ note, oct }));
        });
        
        // Start in the middle of the pool (approx C4/E4)
        let currentPoolIndex = Math.floor(pitchPool.length / 2); 
        this.melody = [];

        // Settings based on complexity
        let noteProb = 0.7; 
        let minDur = 2; // 8th note
        let maxDur = 4; // Quarter note
        
        if (this.complexity === 'simple') { noteProb = 0.5; minDur = 4; maxDur = 8; } 
        if (this.complexity === 'complex') { noteProb = 0.85; minDur = 1; maxDur = 4; }

        // 2. Iterate through Progression Bars
        progIndices.forEach((chordIndex, barIndex) => {
            const chordRoot = scaleNotes[chordIndex];
            
            // Define Chord Tones (Root, 3rd, 5th) to act as "Gravity"
            const chordTones = [
                scaleNotes[chordIndex % scaleNotes.length],
                scaleNotes[(chordIndex + 2) % scaleNotes.length],
                scaleNotes[(chordIndex + 4) % scaleNotes.length]
            ];

            let step = 0;
            while (step < 16) {
                // Chance to Rest vs Play
                // Higher chance to rest at end of phrases or if complexity is low
                if (Math.random() > noteProb) {
                    step += 2; // Small rest
                    continue;
                }

                // Determine Duration (favor on-grid durations)
                let durationSteps = Math.floor(Math.random() * (maxDur - minDur + 1)) + minDur;
                
                // Snap duration to grid (avoid hanging over bar line)
                if (step + durationSteps > 16) durationSteps = 16 - step;
                
                // Determine Pitch Movement (The Walker)
                const move = this.pickNextStep(currentPoolIndex, pitchPool, chordTones, step);
                currentPoolIndex += move;

                // Clamp to pool limits
                if (currentPoolIndex < 0) currentPoolIndex = 0;
                if (currentPoolIndex >= pitchPool.length) currentPoolIndex = pitchPool.length - 1;

                const selectedPitch = pitchPool[currentPoolIndex];

                this.melody.push({
                    globalStep: (barIndex * 16) + step,
                    note: selectedPitch.note,
                    octave: selectedPitch.oct,
                    duration: (durationSteps * 0.25) * 0.95 // Convert steps to seconds (approx) with slight gap
                });

                step += durationSteps;
            }
        });

        this.updateVisualizer();
        this.container.querySelector('#vocal-status').textContent = `Generated ${this.melody.length} notes (Humanized).`;
    }

    // Helper: Decides where to move next (Up, Down, Repeat, Leap)
    pickNextStep(currentIndex, pool, chordTones, currentStep) {
        const r = Math.random();
        
        // 1. Is the current note a Chord Tone?
        const currentNoteName = pool[currentIndex].note;
        const isChordTone = chordTones.includes(currentNoteName);
        
        // 2. Are we on a strong beat? (0, 4, 8, 12)
        const isStrongBeat = (currentStep % 4 === 0);

        // LOGIC:
        // If we are far from center, pull back
        const center = pool.length / 2;
        const drift = (currentIndex - center) / center; // -1 to 1
        
        // Bias: if drift is high (+), bias negative.
        let bias = -drift * 0.5; 

        // Weighted choices: -2 (skip down), -1 (step down), 0 (repeat), +1 (step up), +2 (skip up)
        // Standard Stepwise motion is most common
        
        let choice = 0;
        
        if (r < 0.35) choice = -1; // Step Down
        else if (r < 0.70) choice = 1; // Step Up
        else if (r < 0.85) choice = 0; // Repeat
        else if (r < 0.92) choice = -2; // Skip Down (3rd)
        else choice = 2; // Skip Up (3rd)

        // Apply "Gravity" towards chord tones on strong beats
        if (isStrongBeat && !isChordTone) {
            // Find nearest chord tone index direction
            // (Simplified: just randomize re-roll to encourage change)
            if (Math.random() < 0.5) choice = choice * 2; 
        }

        // Apply Range Bias
        if (drift > 0.6) choice = -1; // Force down if too high
        if (drift < -0.6) choice = 1; // Force up if too low

        return choice;
    }

    updateVisualizer() {
        const vis = this.container.querySelector('#vocal-visualizer');
        vis.innerHTML = '';
        
        const totalSteps = this.sequencer.libraries.progression[this.sequencer.state.progressionName].length * 16;
        
        this.melody.forEach(m => {
            const noteIndex = getNoteIndex(m.note);
            // Height calculation taking Octave into account for visual clarity
            // Oct 3 = low, Oct 5 = high.
            // Base score: (Octave * 12) + NoteIndex
            const absPitch = (m.octave * 12) + noteIndex;
            const minPitch = 3 * 12; // C3
            const maxPitch = 5 * 12 + 11; // B5
            const range = maxPitch - minPitch;
            
            const bottomPct = ((absPitch - minPitch) / range) * 80 + 10;
            const left = (m.globalStep / totalSteps) * 100;
            const width = Math.max(4, m.duration * 20); // Visualize duration roughly
            
            const dot = document.createElement('div');
            dot.style.position = 'absolute';
            dot.style.left = `${left}%`;
            dot.style.bottom = `${bottomPct}%`; 
            dot.style.width = `${width}px`; // Elongate for longer notes
            dot.style.height = '6px';
            dot.style.background = '#00e5ff';
            dot.style.borderRadius = '3px';
            dot.style.boxShadow = '0 0 5px rgba(0, 229, 255, 0.5)';
            vis.appendChild(dot);
        });
    }

    onStep(step, progIndex, progLength, cycleCount, time) {
        if (this.isMuted || this.melody.length === 0) return;

        const globalStep = step + (progIndex * 16);
        const notesToPlay = this.melody.filter(m => m.globalStep === globalStep);

        notesToPlay.forEach(n => {
            const freq = this.getFrequency(n.note, n.octave);
            // Play note with specific duration from generation
            startNote(freq, -1, 'Vocal Lead', time, n.duration, 'vocal'); 
        });
    }

    getFrequency(note, octave) {
        const ni = SHARPS.indexOf(note);
        const semitonesFromA4 = (ni - 9) + ((octave - 4) * 12);
        return 440 * Math.pow(2, semitonesFromA4 / 12);
    }
}