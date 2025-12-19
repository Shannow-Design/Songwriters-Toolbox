// modules/sequencer.js
import { ctx, playDrum, playStrum, startNote, stopAllSounds, INSTRUMENTS } from './audio.js';
import { getDiatonicChords } from './theory.js';

// --- DATA: DRUM PATTERNS ---
const DRUM_PATTERNS = {
    'Basic Rock': {
        kick:  [1, 0, 0, 0,  0, 0, 1, 0,  1, 0, 0, 0,  0, 0, 0, 0],
        snare: [0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0],
        hihat: [1, 0, 1, 0,  1, 0, 1, 0,  1, 0, 1, 0,  1, 0, 1, 0]
    },
    'Four on Floor (Disco)': {
        kick:  [1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0],
        snare: [0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0],
        hihat: [0, 0, 1, 0,  0, 0, 1, 0,  0, 0, 1, 0,  0, 0, 1, 0]
    },
    'Hip Hop / Trap': {
        kick:  [1, 0, 0, 0,  0, 0, 1, 0,  0, 0, 0, 0,  0, 1, 0, 0],
        snare: [0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0],
        hihat: [1, 0, 1, 0,  1, 1, 1, 0,  1, 0, 1, 0,  1, 0, 1, 1]
    },
    'Funk Break': {
        kick:  [1, 0, 0, 1,  0, 0, 1, 0,  0, 0, 0, 1,  0, 1, 0, 0],
        snare: [0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 1, 0,  1, 0, 0, 0],
        hihat: [1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 1, 1]
    },
    'Reggae (One Drop)': {
        kick:  [0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0],
        snare: [0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0],
        hihat: [0, 1, 1, 1,  0, 1, 1, 1,  0, 1, 1, 1,  0, 1, 1, 1]
    },
    'Driving Punk': {
        kick:  [1, 0, 0, 1,  0, 1, 0, 0,  1, 0, 0, 1,  0, 1, 0, 0],
        snare: [0, 0, 1, 0,  0, 0, 1, 0,  0, 0, 1, 0,  0, 0, 1, 0],
        hihat: [1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 1, 1]
    },
    'Empty': { 
        kick:  [0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0],
        snare: [0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0],
        hihat: [0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0]
    }
};

// --- DATA: BASS PATTERNS ---
const BASS_PATTERNS = {
    'Root Notes':    ['R',null,null,null, 'R',null,null,null, 'R',null,null,null, 'R',null,null,null],
    'Root & Fifth':  ['R',null,null,null, '5',null,null,null, 'R',null,null,null, '5',null,null,null],
    'Walking':       ['R',null,'3',null, '5',null,'O',null, 'R',null,'3',null, '5',null,'O',null],
    'Disco Octaves': ['R',null,'O',null, 'R',null,'O',null, 'R',null,'O',null, 'R',null,'O',null],
    'Offbeat Pump':  [null,'R',null,'R', null,'R',null,'R', null,'R',null,'R', null,'R',null,'R'],
    'Running 8ths':  ['R',null,'R',null, 'R',null,'R',null, 'R',null,'R',null, 'R',null,'R',null],
    'Empty':         [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null]
};

// --- DATA: MELODY / LEAD PATTERNS ---
// R=Root, 3=Third, 5=Fifth, 7=Seventh, O=Octave
const MELODY_PATTERNS = {
    'Arp Up (8ths)':     ['R',null,'3',null, '5',null,'O',null, 'R',null,'3',null, '5',null,'O',null],
    'Arp Down (8ths)':   ['O',null,'5',null, '3',null,'R',null, 'O',null,'5',null, '3',null,'R',null],
    'Fast Arp (16ths)':  ['R','3','5','O', '5','3','R','3', '5','O','R','3', '5','O','5','3'],
    'Alberti (Low-Hi-Mid-Hi)': ['R',null,'5',null, '3',null,'5',null, 'R',null,'5',null, '3',null,'5',null],
    'Staircase':         ['R',null,'3',null, 'R',null,'5',null, 'R',null,'O',null, 'R',null,'5',null],
    'Pedal Point (High)':['O',null,'3',null, 'O',null,'5',null, 'O',null,'R',null, 'O',null,'5',null],
    'Empty':             [null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null]
};

// --- DATA: DEFAULT CHORD PROGRESSIONS ---
const DEFAULT_PROGRESSIONS = {
    'Pop Hit (I-V-vi-IV)': [0, 4, 5, 3],
    'Doo Wop (I-vi-IV-V)': [0, 5, 3, 4],
    'Blues (I-IV-I-V)':    [0, 3, 0, 4],
    'Jazz ii-V-I':         [1, 4, 0, 0],
    'Minor Sad (vi-IV-I-V)': [5, 3, 0, 4],
    'Canon (Pachelbel)':   [0, 4, 5, 2, 3, 0, 3, 4],
    'Andalusian (vi-V-IV-III)': [5, 4, 3, 2],
    'Royal Road (IV-V-iii-vi)': [3, 4, 2, 5],
    'Circle of 5ths':      [0, 3, 6, 2, 5, 1, 4, 0]
};

const RHYTHM_PATTERNS = {
    'Whole Notes':     [1, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0],
    'Quarter Strum':   [1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0],
    'Driving 8ths':    [1, 0, 1, 0,  1, 0, 1, 0,  1, 0, 1, 0,  1, 0, 1, 0],
    'Syncopated':      [1, 0, 0, 1,  0, 0, 1, 0,  0, 0, 1, 0,  0, 0, 0, 0],
    'Reggae Skank':    [0, 0, 1, 0,  0, 0, 1, 0,  0, 0, 1, 0,  0, 0, 1, 0],
    'Gallop':          [1, 0, 0, 1,  1, 0, 0, 1,  1, 0, 0, 1,  1, 0, 0, 1],
    'Charleston':      [1, 0, 0, 1,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0] 
};

// Roman Numeral Display Helper
const ROMAN_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

export class Sequencer {
    constructor(containerId, getScaleDataCallback, onChordChangeCallback) {
        this.container = document.getElementById(containerId);
        this.getScaleData = getScaleDataCallback; 
        this.onChordChange = onChordChangeCallback; 

        // State
        this.isPlaying = false;
        this.bpm = 100;
        this.currentStep = 0;
        this.nextNoteTime = 0;
        this.timerID = null;
        this.lookahead = 25.0; 
        this.scheduleAheadTime = 0.1; 
        
        // Load Saved Custom Progressions
        this.customProgressions = JSON.parse(localStorage.getItem('custom_progressions')) || {};
        
        // Combine Defaults + Custom
        this.allProgressions = { ...DEFAULT_PROGRESSIONS, ...this.customProgressions };

        // Defaults
        this.progression = DEFAULT_PROGRESSIONS['Pop Hit (I-V-vi-IV)'];
        this.rhythm = RHYTHM_PATTERNS['Whole Notes'];
        this.drumPattern = DRUM_PATTERNS['Basic Rock'];
        this.bassPattern = BASS_PATTERNS['Root & Fifth']; 
        this.melodyPattern = MELODY_PATTERNS['Empty']; // Default to OFF
        
        this.settings = {
            metronome: false,
            metronomeSubdivision: 4, 
            drumKit: 'synth', 
            progressionIndex: 0,
            instrument: 'Acoustic Guitar',
            bassInstrument: 'Bass Guitar',
            leadInstrument: 'Piano'
        };

        this.renderUI();
        this.injectModal(); 
    }

    renderUI() {
        this.container.innerHTML = `
            <div class="sequencer-controls">
                
                <div class="seq-row">
                    <button id="btn-seq-play" class="play-btn">▶ PLAY TRACK</button>
                    <div class="bpm-control">
                        <label>BPM: <span id="bpm-val">100</span></label>
                        <input type="range" id="bpm-slider" min="40" max="200" value="100">
                    </div>
                    
                    <div style="display: flex; gap: 10px; align-items: center; border-left: 1px solid #444; padding-left: 15px;">
                        <div class="checkbox-group" style="margin-bottom:0;">
                            <input type="checkbox" id="cb-metronome"> <label for="cb-metronome">Click</label>
                        </div>
                        <select id="sel-metronome-sub" style="font-size: 0.8rem; padding: 2px;">
                            <option value="16">Whole (1/1)</option>
                            <option value="8">Half (1/2)</option>
                            <option value="4" selected>Quarter (1/4)</option>
                            <option value="2">Eighth (1/8)</option>
                        </select>
                    </div>
                </div>

                <div class="seq-row" style="background:#222; padding:10px; border-radius:4px;">
                    <strong style="color:#00e5ff; font-size:0.8rem; margin-right:10px; min-width:60px;">CHORDS:</strong>
                    <div class="control-group">
                        <label>Sound</label>
                        <select id="sel-instrument"></select>
                    </div>
                    <div class="control-group">
                        <label>Rhythm</label>
                        <select id="sel-rhythm"></select>
                    </div>
                </div>

                <div class="seq-row" style="background:#222; padding:10px; border-radius:4px;">
                    <strong style="color:#00e5ff; font-size:0.8rem; margin-right:10px; min-width:60px;">BASS:</strong>
                    <div class="control-group">
                        <label>Sound</label>
                        <select id="sel-bass-instrument"></select>
                    </div>
                    <div class="control-group">
                        <label>Pattern</label>
                        <select id="sel-bass-pattern"></select>
                    </div>
                </div>

                <div class="seq-row" style="background:#222; padding:10px; border-radius:4px;">
                    <strong style="color:#00e5ff; font-size:0.8rem; margin-right:10px; min-width:60px;">LEAD:</strong>
                    <div class="control-group">
                        <label>Sound</label>
                        <select id="sel-lead-instrument"></select>
                    </div>
                    <div class="control-group">
                        <label>Pattern</label>
                        <select id="sel-lead-pattern"></select>
                    </div>
                </div>

                <div class="seq-row">
                    <div class="control-group" style="flex:2;">
                        <label style="display:flex; justify-content:space-between;">
                            Chord Progression 
                            <div>
                                <button id="btn-delete-prog" class="btn-delete-custom" style="display:none;">DEL</button>
                                <button id="btn-new-prog" class="btn-new">+ NEW</button>
                            </div>
                        </label>
                        <select id="sel-progression"></select>
                    </div>
                    <div class="control-group" style="flex:1;">
                        <label>Drum Pattern</label>
                        <select id="sel-drums"></select>
                    </div>
                </div>

                <div class="step-tracker">
                    ${Array(16).fill(0).map((_, i) => `<div class="step-dot" id="step-${i}"></div>`).join('')}
                </div>
            </div>
        `;

        this.populateDropdowns();

        // Event Listeners
        this.container.querySelector('#btn-seq-play').addEventListener('click', () => this.togglePlay());
        
        const bpmSlider = this.container.querySelector('#bpm-slider');
        bpmSlider.addEventListener('input', (e) => {
            this.bpm = parseInt(e.target.value);
            this.container.querySelector('#bpm-val').textContent = this.bpm;
        });

        this.container.querySelector('#cb-metronome').addEventListener('change', (e) => this.settings.metronome = e.target.checked);
        this.container.querySelector('#sel-metronome-sub').addEventListener('change', (e) => this.settings.metronomeSubdivision = parseInt(e.target.value));

        // Track 1
        this.container.querySelector('#sel-instrument').addEventListener('change', (e) => this.settings.instrument = e.target.value);
        this.container.querySelector('#sel-rhythm').addEventListener('change', (e) => this.rhythm = RHYTHM_PATTERNS[e.target.value]);
        
        // Track 2
        this.container.querySelector('#sel-bass-instrument').addEventListener('change', (e) => this.settings.bassInstrument = e.target.value);
        this.container.querySelector('#sel-bass-pattern').addEventListener('change', (e) => this.bassPattern = BASS_PATTERNS[e.target.value]);

        // Track 3 (Lead)
        this.container.querySelector('#sel-lead-instrument').addEventListener('change', (e) => this.settings.leadInstrument = e.target.value);
        this.container.querySelector('#sel-lead-pattern').addEventListener('change', (e) => this.melodyPattern = MELODY_PATTERNS[e.target.value]);

        // Drums & Progression
        this.container.querySelector('#sel-drums').addEventListener('change', (e) => this.drumPattern = DRUM_PATTERNS[e.target.value]);

        const progSel = this.container.querySelector('#sel-progression');
        progSel.addEventListener('change', (e) => {
            this.progression = this.allProgressions[e.target.value];
            this.updateDeleteButtonVisibility(e.target.value);
        });

        // Modal Buttons
        this.container.querySelector('#btn-new-prog').addEventListener('click', () => this.openModal());
        this.container.querySelector('#btn-delete-prog').addEventListener('click', () => this.deleteCurrentProgression());
    }

    populateDropdowns() {
        const instSel = this.container.querySelector('#sel-instrument');
        const bassInstSel = this.container.querySelector('#sel-bass-instrument');
        const leadInstSel = this.container.querySelector('#sel-lead-instrument');
        
        Object.keys(INSTRUMENTS).forEach(k => {
            instSel.add(new Option(k, k));
            bassInstSel.add(new Option(k, k));
            leadInstSel.add(new Option(k, k));
        });
        instSel.value = 'Acoustic Guitar'; 
        bassInstSel.value = 'Bass Guitar';
        leadInstSel.value = 'Piano';

        const rhythmSel = this.container.querySelector('#sel-rhythm');
        Object.keys(RHYTHM_PATTERNS).forEach(k => rhythmSel.add(new Option(k, k)));

        const bassPatSel = this.container.querySelector('#sel-bass-pattern');
        Object.keys(BASS_PATTERNS).forEach(k => bassPatSel.add(new Option(k, k)));
        bassPatSel.value = 'Root & Fifth';

        const leadPatSel = this.container.querySelector('#sel-lead-pattern');
        Object.keys(MELODY_PATTERNS).forEach(k => leadPatSel.add(new Option(k, k)));
        leadPatSel.value = 'Empty'; // Default Lead to Empty

        const drumSel = this.container.querySelector('#sel-drums');
        Object.keys(DRUM_PATTERNS).forEach(k => drumSel.add(new Option(k, k)));

        this.refreshProgressionDropdown();
    }

    refreshProgressionDropdown(selectValue = null) {
        const progSel = this.container.querySelector('#sel-progression');
        progSel.innerHTML = '';
        
        const defaultsGroup = document.createElement('optgroup');
        defaultsGroup.label = "Standard Progressions";
        Object.keys(DEFAULT_PROGRESSIONS).forEach(k => defaultsGroup.appendChild(new Option(k, k)));
        progSel.appendChild(defaultsGroup);

        if (Object.keys(this.customProgressions).length > 0) {
            const customGroup = document.createElement('optgroup');
            customGroup.label = "My Custom Progressions";
            Object.keys(this.customProgressions).forEach(k => customGroup.appendChild(new Option(k, k)));
            progSel.appendChild(customGroup);
        }

        if (selectValue && this.allProgressions[selectValue]) {
            progSel.value = selectValue;
        } else {
            progSel.value = 'Pop Hit (I-V-vi-IV)';
        }
        
        this.updateDeleteButtonVisibility(progSel.value);
    }

    updateDeleteButtonVisibility(progName) {
        const btn = this.container.querySelector('#btn-delete-prog');
        if (this.customProgressions[progName]) {
            btn.style.display = 'inline-block';
        } else {
            btn.style.display = 'none';
        }
    }

    // --- MODAL LOGIC ---
    injectModal() {
        const modalHtml = `
            <div id="custom-prog-modal" class="modal-overlay">
                <div class="modal-content" style="max-width: 500px;">
                    <h3 class="modal-title">Create Chord Progression</h3>
                    <div style="margin-bottom:15px;">
                        <input type="text" id="new-prog-name" placeholder="Progression Name" style="width:100%; padding:10px; background:#222; border:1px solid #555; color:white; border-radius:4px;">
                    </div>
                    <div style="margin-bottom:10px; text-align:right;">
                        <button id="btn-add-chord" class="btn-new" style="background:#444; color:#fff; border:1px solid #666;">+ Add Step</button>
                        <button id="btn-remove-chord" class="btn-new" style="background:#444; color:#fff; border:1px solid #666;">- Remove</button>
                    </div>
                    <div id="chord-selectors-container" class="chord-selectors" style="flex-wrap:wrap; justify-content:center;"></div>
                    <div class="modal-actions">
                        <button id="btn-modal-cancel" class="btn-cancel">Cancel</button>
                        <button id="btn-modal-save" class="btn-save">Save & Select</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('btn-modal-cancel').addEventListener('click', () => this.closeModal());
        document.getElementById('btn-modal-save').addEventListener('click', () => this.saveCustomProgression());
        document.getElementById('btn-add-chord').addEventListener('click', () => this.addChordSelector());
        document.getElementById('btn-remove-chord').addEventListener('click', () => this.removeChordSelector());
    }

    openModal() {
        document.getElementById('custom-prog-modal').style.display = 'flex';
        document.getElementById('new-prog-name').value = '';
        const container = document.getElementById('chord-selectors-container');
        container.innerHTML = '';
        for(let i=0; i<4; i++) this.addChordSelector();
    }

    closeModal() {
        document.getElementById('custom-prog-modal').style.display = 'none';
    }
    
    addChordSelector() {
        const container = document.getElementById('chord-selectors-container');
        const count = container.children.length + 1;
        const div = document.createElement('div');
        div.className = 'chord-select-group';
        div.style.margin = "5px"; 
        div.innerHTML = `
            <label style="font-size:0.7rem; color:#888;">Step ${count}</label>
            <select class="custom-chord-select" style="background:#333; color:white; border:1px solid #555; width:60px;">
                ${ROMAN_NUMERALS.map((rom, idx) => `<option value="${idx}">${rom}</option>`).join('')}
            </select>
        `;
        container.appendChild(div);
    }
    
    removeChordSelector() {
        const container = document.getElementById('chord-selectors-container');
        if (container.children.length > 1) {
            container.removeChild(container.lastChild);
        }
    }

    saveCustomProgression() {
        const nameInput = document.getElementById('new-prog-name');
        const name = nameInput.value.trim() || "Untitled Progression";
        const selects = document.querySelectorAll('.custom-chord-select');
        const indices = Array.from(selects).map(sel => parseInt(sel.value));

        this.customProgressions[name] = indices;
        this.allProgressions = { ...DEFAULT_PROGRESSIONS, ...this.customProgressions };
        localStorage.setItem('custom_progressions', JSON.stringify(this.customProgressions));

        this.refreshProgressionDropdown(name);
        this.progression = this.allProgressions[name];
        this.closeModal();
    }

    deleteCurrentProgression() {
        const currentName = this.container.querySelector('#sel-progression').value;
        if (confirm(`Delete "${currentName}"?`)) {
            delete this.customProgressions[currentName];
            this.allProgressions = { ...DEFAULT_PROGRESSIONS, ...this.customProgressions };
            localStorage.setItem('custom_progressions', JSON.stringify(this.customProgressions));
            
            this.refreshProgressionDropdown('Pop Hit (I-V-vi-IV)');
            this.progression = DEFAULT_PROGRESSIONS['Pop Hit (I-V-vi-IV)'];
        }
    }

    // --- PLAYBACK ENGINE ---
    togglePlay() {
        this.isPlaying = !this.isPlaying;
        const btn = this.container.querySelector('#btn-seq-play');
        
        if (this.isPlaying) {
            if (ctx.state === 'suspended') ctx.resume();
            this.currentStep = 0;
            this.settings.progressionIndex = -1;
            this.nextNoteTime = ctx.currentTime;
            this.scheduler(); 
            btn.textContent = "⏹ STOP";
            btn.classList.add('playing');
        } else {
            clearTimeout(this.timerID);
            btn.textContent = "▶ PLAY TRACK";
            btn.classList.remove('playing');
            this.resetVisuals();
            stopAllSounds();
            if(this.onChordChange) this.onChordChange(-1); 
        }
    }

    scheduler() {
        if (this.nextNoteTime < ctx.currentTime - 0.2) {
             this.nextNoteTime = ctx.currentTime;
        }

        while (this.nextNoteTime < ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentStep, this.nextNoteTime);
            this.nextNote();
        }
        
        if (this.isPlaying) {
            this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
        }
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += 0.25 * secondsPerBeat; 
        
        this.currentStep++;
        if (this.currentStep === 16) {
            this.currentStep = 0;
        }
    }

    scheduleNote(stepNumber, time) {
        if (stepNumber === 0) {
            this.settings.progressionIndex = (this.settings.progressionIndex + 1) % this.progression.length;
        }

        requestAnimationFrame(() => {
            this.updateVisualTracker(stepNumber);
            if (stepNumber === 0 && this.onChordChange) {
                const degreeIndex = this.progression[this.settings.progressionIndex];
                this.onChordChange(degreeIndex);
            }
        });

        // 1. Drums / Metronome
        if (this.settings.metronome && (stepNumber % this.settings.metronomeSubdivision === 0)) {
            playDrum('metronome', time);
        }
        if (this.drumPattern?.kick?.[stepNumber]) playDrum('kick', time);
        if (this.drumPattern?.snare?.[stepNumber]) playDrum('snare', time);
        if (this.drumPattern?.hihat?.[stepNumber]) playDrum('hihat', time);

        // 2. Data Prep
        const { key, scale } = this.getScaleData();
        const chords = getDiatonicChords(key, scale);
        const degreeIndex = this.progression[this.settings.progressionIndex];
        const chord = chords[degreeIndex];

        if (chord) {
            // TRACK 1: CHORDS (STRUMS)
            if (this.rhythm[stepNumber]) {
                const isBassStr = this.settings.instrument === 'Bass Guitar';
                const octaveOffset = isBassStr ? -1 : 0; 
                const frequencies = chord.notes.map(note => {
                    return this.getFrequencyForChord(note, key, chord.root, octaveOffset);
                });
                playStrum(frequencies, time, this.settings.instrument);
            }

            // TRACK 2: BASS (SINGLE NOTES)
            const bassInstruction = this.bassPattern[stepNumber];
            if (bassInstruction) {
                let noteToPlay = chord.notes[0];
                let octaveShift = 0;
                if (bassInstruction === '3' && chord.notes[1]) noteToPlay = chord.notes[1];
                if (bassInstruction === '5' && chord.notes[2]) noteToPlay = chord.notes[2];
                if (bassInstruction === 'O') octaveShift = 1;

                const bassFreq = this.getBassFrequency(noteToPlay, octaveShift);
                startNote(bassFreq, -1, this.settings.bassInstrument, time, 0.4);
            }

            // TRACK 3: LEAD / MELODY (NEW)
            const melodyInstruction = this.melodyPattern[stepNumber];
            if (melodyInstruction) {
                let noteToPlay = chord.notes[0];
                // Handle 3rds, 5ths, 7ths (if avail)
                // Diatonic chords in our array only have 3 notes (triads) for now [0,1,2].
                // We can fake a 7th or just wrap around.
                
                if (melodyInstruction === '3' && chord.notes[1]) noteToPlay = chord.notes[1];
                if (melodyInstruction === '5' && chord.notes[2]) noteToPlay = chord.notes[2];
                // For 7th, we don't have it in the chord object yet.
                // Fallback: Octave of Root
                if (melodyInstruction === 'O' || melodyInstruction === '7') noteToPlay = chord.notes[0]; 

                // Calculate Frequency (High Octave: 4 or 5)
                // Use a dedicated helper to ensure it floats above chords
                const leadFreq = this.getMelodyFrequency(noteToPlay, melodyInstruction === 'O' ? 1 : 0);
                
                // Play shorter/staccato for clarity
                startNote(leadFreq, -1, this.settings.leadInstrument, time, 0.2);
            }
        }
    }
    
    // Helper: Chord Voicing
    getFrequencyForChord(noteName, keyRootName, chordRootName, octaveOffset = 0) {
        const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteIndex = SHARPS.indexOf(noteName);
        const keyIndex = SHARPS.indexOf(keyRootName);
        const chordRootIndex = SHARPS.indexOf(chordRootName);

        let chordBaseOctave = 3 + octaveOffset;
        if (chordRootIndex < keyIndex) chordBaseOctave += 1;

        let noteOctave = chordBaseOctave;
        if (noteIndex < chordRootIndex) noteOctave += 1;

        return 440 * Math.pow(2, ((noteIndex - 9) + (noteOctave - 4) * 12) / 12);
    }

    // Helper: Bass Voicing (Low)
    getBassFrequency(noteName, extraOctave = 0) {
        const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteIndex = SHARPS.indexOf(noteName);
        const targetOctave = 2 + extraOctave;
        return 440 * Math.pow(2, ((noteIndex - 9) + (targetOctave - 4) * 12) / 12);
    }

    // Helper: Lead Voicing (High)
    getMelodyFrequency(noteName, extraOctave = 0) {
        const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteIndex = SHARPS.indexOf(noteName);
        const targetOctave = 4 + extraOctave; // Starts at Octave 4, can go to 5
        return 440 * Math.pow(2, ((noteIndex - 9) + (targetOctave - 4) * 12) / 12);
    }

    updateVisualTracker(step) {
        const dots = this.container.querySelectorAll('.step-dot');
        dots.forEach((d, i) => {
            d.style.background = (i === step) ? '#00e5ff' : '#333';
            d.style.boxShadow = (i === step) ? '0 0 10px #00e5ff' : 'none';
        });
    }

    resetVisuals() {
        const dots = this.container.querySelectorAll('.step-dot');
        dots.forEach(d => {
            d.style.background = '#333';
            d.style.boxShadow = 'none';
        });
    }
}