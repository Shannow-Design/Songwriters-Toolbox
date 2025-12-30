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
                        <option value="simple">Simple</option>
                        <option value="medium" selected>Medium</option>
                        <option value="complex">Busy</option>
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

    generateMelody() {
        const { key, scale } = this.sequencer.getScaleData();
        const progName = this.sequencer.state.progressionName;
        const progIndices = this.sequencer.libraries.progression[progName];
        
        if (!progIndices) {
            alert("Please select a valid chord progression first.");
            return;
        }

        const scaleNotes = generateScale(key, scale);
        this.melody = [];
        
        const density = this.complexity === 'simple' ? 0.3 : (this.complexity === 'medium' ? 0.6 : 0.9);
        let currentOctave = 4; 

        progIndices.forEach((chordIndex, barIndex) => {
            const chordRoot = scaleNotes[chordIndex];
            const rootIdx = getNoteIndex(chordRoot);
            
            const chordTones = [
                scaleNotes[chordIndex % scaleNotes.length], 
                scaleNotes[(chordIndex + 2) % scaleNotes.length], 
                scaleNotes[(chordIndex + 4) % scaleNotes.length]  
            ];

            for (let s = 0; s < 16; s++) {
                let chance = density * 0.5;
                if (s % 4 === 0) chance += 0.4;
                if (s % 8 === 0) chance += 0.2;

                if (Math.random() < chance) {
                    let note;
                    if (Math.random() < 0.6) {
                        note = chordTones[Math.floor(Math.random() * chordTones.length)];
                    } else {
                        note = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
                    }

                    this.melody.push({
                        globalStep: (barIndex * 16) + s, 
                        note: note,
                        octave: currentOctave,
                        duration: 0.25 
                    });
                }
            }
        });

        this.updateVisualizer();
        this.container.querySelector('#vocal-status').textContent = `Generated ${this.melody.length} notes.`;
    }

    updateVisualizer() {
        const vis = this.container.querySelector('#vocal-visualizer');
        vis.innerHTML = '';
        
        const totalSteps = this.sequencer.libraries.progression[this.sequencer.state.progressionName].length * 16;
        
        this.melody.forEach(m => {
            const noteIndex = getNoteIndex(m.note);
            // Convert pitch to height % (C=0, B=11)
            // We map 0-11 to roughly 10% - 90% height
            const bottomPct = 10 + ((noteIndex / 11) * 80);
            
            const left = (m.globalStep / totalSteps) * 100;
            
            const dot = document.createElement('div');
            dot.style.position = 'absolute';
            dot.style.left = `${left}%`;
            dot.style.bottom = `${bottomPct}%`; 
            dot.style.width = '6px';
            dot.style.height = '6px';
            dot.style.background = '#00e5ff';
            dot.style.borderRadius = '50%';
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
            startNote(freq, -1, 'Vocal Lead', time, 0.3, 'vocal'); 
        });
    }

    getFrequency(note, octave) {
        const ni = SHARPS.indexOf(note);
        const semitonesFromA4 = (ni - 9) + ((octave - 4) * 12);
        return 440 * Math.pow(2, semitonesFromA4 / 12);
    }
}