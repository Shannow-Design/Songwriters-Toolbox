// modules/app.js
import { getNotes, SCALES, TUNINGS, generateScale, getNoteIndex, getDiatonicChords, TheoryEngine } from './theory.js';
import { Fretboard } from './fretboard.js';
import { ChordRenderer } from './chords.js';
import { Tuner } from './tuner.js';
import { Keyboard } from './keyboard.js';
import { Sequencer } from './sequencer.js';
import { Sampler } from './sampler.js';
import { Looper } from './looper.js'; 
import { SongBuilder } from './songbuilder.js'; 
import { Studio } from './studio.js'; 
import { playScaleSequence, playSingleNote, loadSavedSamples } from './audio.js';

// --- DOM Elements ---
const keySelect = document.getElementById('key-select');
const scaleSelect = document.getElementById('scale-select');
const tuningSelect = document.getElementById('tuning-select');
const bassTuningSelect = document.getElementById('bass-tuning-select'); 
const capoSelect = document.getElementById('capo-select');

// Mode Selectors
const guitarModeSelect = document.getElementById('guitar-display-mode');
const bassModeSelect = document.getElementById('bass-display-mode');

// Buttons & Displays
const playBtn = document.getElementById('play-btn');
const noteButtonsDisplay = document.getElementById('note-buttons-display');

// Checkboxes
const cbButtons = document.getElementById('cb-buttons');
const cbChords = document.getElementById('cb-chords');
const cbGuitar = document.getElementById('cb-guitar');
const cbBass = document.getElementById('cb-bass');
const cbTuner = document.getElementById('cb-tuner');
const cbKeyboard = document.getElementById('cb-keyboard');
const cbSequencer = document.getElementById('cb-sequencer');
const cbSampler = document.getElementById('cb-sampler');
const cbSongBuilder = document.getElementById('cb-songbuilder'); 
const cbLooper = document.getElementById('cb-looper');
const cbStudio = document.getElementById('cb-studio');

// Wrappers
const wrapperButtons = document.getElementById('wrapper-buttons');
const wrapperChords = document.getElementById('wrapper-chords');
const wrapperGuitar = document.getElementById('wrapper-guitar');
const wrapperBass = document.getElementById('wrapper-bass');
const wrapperTuner = document.getElementById('wrapper-tuner');
const wrapperKeyboard = document.getElementById('wrapper-keyboard');
const wrapperSequencer = document.getElementById('wrapper-sequencer');
const wrapperSampler = document.getElementById('wrapper-sampler');
const wrapperSongBuilder = document.getElementById('wrapper-songbuilder');
const wrapperLooper = document.getElementById('wrapper-looper');
const wrapperStudio = document.getElementById('wrapper-studio');

// --- Initialize Modules ---
const theory = new TheoryEngine(); 
const guitar = new Fretboard('fretboard-container');
const bass = new Fretboard('bass-fretboard-container');

const chordRenderer = new ChordRenderer('chords-container');
const tuner = new Tuner('tuner-container');
const keyboard = new Keyboard('keyboard-container');
const sampler = new Sampler('sampler-container');
const looper = new Looper('looper-module'); 
const studio = new Studio('studio-module');

// Placeholder for SongBuilder
let songBuilder; 

// STATE
let currentActiveChordNotes = []; 
let currentActiveChordRoot = null; 

// Initialize Sequencer
const sequencer = new Sequencer('sequencer-container', 
    // 1. Get Data Callback
    () => { return { key: keySelect.value, scale: scaleSelect.value }; },
    
    // 2. Chord Change Callback
    (chordIndex) => {
        if (chordIndex === -1) {
            chordRenderer.clearHighlights();
            updateFretboards([], null); 
            keyboard.clearHighlights();
        } else {
            chordRenderer.highlightChord(chordIndex);
            const chordsList = getDiatonicChords(keySelect.value, scaleSelect.value);
            if (chordsList && chordsList[chordIndex]) {
                const chord = chordsList[chordIndex];
                updateFretboards(chord.notes, chord.root);
                keyboard.highlightNotes(chord.notes, chord.name, chord.root);
            }
        }
    },

    // 3. Preset Load Callback
    (presetData) => {
        keySelect.value = presetData.key;
        scaleSelect.value = presetData.scale;
        keyboard.clearHighlights(); 
        updateFretboards([], null);
        updateDisplay();
        
        if (presetData.looper) {
            looper.applySettings(presetData.looper);
        }

        document.body.style.transition = "background 0.1s";
        document.body.style.background = "#222";
        setTimeout(() => document.body.style.background = "", 100);
    },

    // 4. Step Callback (Pulse for Looper & Song Builder)
    (step, progIndex, progLength, cycleCount, time) => {
        looper.onStep(step, progIndex, progLength, cycleCount, time);
        if (songBuilder) songBuilder.onStep(step, time);
    },

    // 5. Stop Callback (Tells Looper to cut sound)
    () => {
        looper.stopAll();
    },
    
    // 6. Callback to GET looper data for saving
    () => {
        return looper.getSettings();
    }
);

// --- INIT SONG BUILDER ---
songBuilder = new SongBuilder('songbuilder-module', sequencer);

// Sync BPM
const originalOnStep = looper.onStep.bind(looper);
looper.onStep = (step, progIndex, progLength, cycleCount, time) => {
    looper.setBpm(sequencer.bpm);
    originalOnStep(step, progIndex, progLength, cycleCount, time);
};

// --- Core Logic ---

function getActiveNotes() {
    return generateScale(keySelect.value, scaleSelect.value);
}

function updateFretboards(chordNotes, chordRoot = null) {
    currentActiveChordNotes = chordNotes; 
    currentActiveChordRoot = chordRoot;
    
    const scaleNotes = getActiveNotes();
    
    let gTuning = ['E','A','D','G','B','E'];
    if (TUNINGS[tuningSelect.value]) gTuning = TUNINGS[tuningSelect.value].notes;
    else if (TUNINGS.standard) gTuning = TUNINGS.standard.notes;

    let bTuning = ['E','A','D','G'];
    if (TUNINGS[bassTuningSelect.value]) bTuning = TUNINGS[bassTuningSelect.value].notes;
    else if (TUNINGS.bass_standard) bTuning = TUNINGS.bass_standard.notes;

    const capo = parseInt(capoSelect.value || 0);

    guitar.render(scaleNotes, keySelect.value, gTuning, capo, currentActiveChordNotes, currentActiveChordRoot);
    bass.render(scaleNotes, keySelect.value, bTuning, 0, currentActiveChordNotes, currentActiveChordRoot); 
}

function init() {
    getNotes().forEach(note => {
        const option = document.createElement('option');
        option.value = note;
        option.textContent = note;
        keySelect.appendChild(option);
    });
    keySelect.value = 'C'; 

    for (const [key, value] of Object.entries(SCALES)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = value.name;
        scaleSelect.appendChild(option);
    }
    scaleSelect.value = 'major';

    for (const [key, value] of Object.entries(TUNINGS)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = value.name;
        if (value.notes.length === 6) tuningSelect.appendChild(option);
        else if (value.notes.length === 4) bassTuningSelect.appendChild(option);
    }
    tuningSelect.value = 'standard';
    bassTuningSelect.value = 'bass_standard';

    // Logic Listeners
    keySelect.addEventListener('change', () => { keyboard.clearHighlights(); updateFretboards([], null); updateDisplay(); });
    scaleSelect.addEventListener('change', () => { keyboard.clearHighlights(); updateFretboards([], null); updateDisplay(); });
    tuningSelect.addEventListener('change', () => updateDisplay());
    capoSelect.addEventListener('change', () => updateDisplay());
    guitarModeSelect.addEventListener('change', () => { guitar.setDisplayMode(guitarModeSelect.value); updateDisplay(); });
    bassTuningSelect.addEventListener('change', () => updateDisplay());
    bassModeSelect.addEventListener('change', () => { bass.setDisplayMode(bassModeSelect.value); updateDisplay(); });

    if(playBtn) {
        playBtn.addEventListener('click', () => {
            const notes = getActiveNotes();
            playScaleSequence(notes);
            keyboard.highlightNotes(notes, "Scale Preview", notes[0]); 
        });
    }

    // --- DISPLAY OPTIONS LISTENERS ---
    cbButtons.addEventListener('change', () => { wrapperButtons.style.display = cbButtons.checked ? 'block' : 'none'; });
    cbChords.addEventListener('change', () => { wrapperChords.style.display = cbChords.checked ? 'block' : 'none'; });
    cbGuitar.addEventListener('change', () => { wrapperGuitar.style.display = cbGuitar.checked ? 'block' : 'none'; });
    cbBass.addEventListener('change', () => { wrapperBass.style.display = cbBass.checked ? 'block' : 'none'; });
    cbKeyboard.addEventListener('change', () => { wrapperKeyboard.style.display = cbKeyboard.checked ? 'block' : 'none'; });
    cbSequencer.addEventListener('change', () => { wrapperSequencer.style.display = cbSequencer.checked ? 'block' : 'none'; });
    cbSampler.addEventListener('change', () => { wrapperSampler.style.display = cbSampler.checked ? 'block' : 'none'; });
    
    // Song Builder Listener
    if(cbSongBuilder) {
        cbSongBuilder.addEventListener('change', () => { 
            wrapperSongBuilder.style.display = cbSongBuilder.checked ? 'block' : 'none'; 
        });
    }

    // Looper Listener
    if(cbLooper) {
        cbLooper.addEventListener('change', () => {
            wrapperLooper.style.display = cbLooper.checked ? 'block' : 'none';
        });
    }

    // NEW: Studio Listener
    if(cbStudio) {
        cbStudio.addEventListener('change', () => {
            wrapperStudio.style.display = cbStudio.checked ? 'block' : 'none';
        });
    }
    
    cbTuner.addEventListener('change', () => { 
        if (cbTuner.checked) { wrapperTuner.style.display = 'block'; } else { wrapperTuner.style.display = 'none'; tuner.stop(); } 
    });

    loadSavedSamples().then(() => { sampler.updateStatus(); });

    updateDisplay();
}

function updateDisplay() {
    const activeNotes = getActiveNotes();
    updateFretboards(currentActiveChordNotes, currentActiveChordRoot);
    keyboard.render(activeNotes, keySelect.value); 
    renderNoteButtons(activeNotes);

    const chordsList = getDiatonicChords(keySelect.value, scaleSelect.value);
    const capoValue = parseInt(capoSelect.value || 0); 
    let currentTuningNotes = ['E','A','D','G','B','E'];
    if(TUNINGS[tuningSelect.value]) currentTuningNotes = TUNINGS[tuningSelect.value].notes;

    chordRenderer.render(
        chordsList, 
        capoValue, 
        currentTuningNotes, 
        (notes) => {
            const clickedChord = chordsList.find(c => JSON.stringify(c.notes) === JSON.stringify(notes));
            const chordName = clickedChord ? clickedChord.name : notes.join(' ');
            const root = clickedChord ? clickedChord.root : notes[0];
            keyboard.highlightNotes(notes, chordName, root); 
            if (clickedChord) {
                updateFretboards(notes, clickedChord.root);
                const index = chordsList.indexOf(clickedChord);
                chordRenderer.highlightChord(index);
            } else {
                updateFretboards(notes, notes[0]);
            }
        },
        keySelect.value 
    );
}

function renderNoteButtons(scaleNotes) {
    if(!noteButtonsDisplay) return;
    noteButtonsDisplay.innerHTML = '';
    const intervals = ['R', '2', '3', '4', '5', '6', '7'];
    let currentOctave = 3; 
    let lastNoteIndex = -1;

    scaleNotes.forEach((note, index) => {
        const noteIndex = getNoteIndex(note);
        if (noteIndex < lastNoteIndex) currentOctave++;
        lastNoteIndex = noteIndex;
        const buttonOctave = currentOctave;

        const btn = document.createElement('div');
        btn.className = 'note-btn';
        btn.dataset.note = note; 
        if (index === 0) btn.classList.add('root');

        const noteName = document.createElement('span');
        noteName.className = 'note-name';
        noteName.textContent = note;
        const noteInterval = document.createElement('span');
        noteInterval.className = 'note-interval';
        noteInterval.textContent = (scaleNotes.length === 7) ? intervals[index] : '';

        btn.appendChild(noteName);
        btn.appendChild(noteInterval);
        
        btn.addEventListener('click', () => {
            playSingleNote(note, buttonOctave); 
            
            keyboard.highlightNotes([note], note, note); 
            updateFretboards([note], note);
            
            chordRenderer.clearHighlights();
            btn.style.transition = "transform 0.1s, border-color 0.1s";
            btn.style.borderColor = "#00e5ff";
            btn.style.transform = "scale(1.05)";
            setTimeout(() => {
                btn.style.borderColor = ""; 
                btn.style.transform = "";
            }, 200);
        });
        noteButtonsDisplay.appendChild(btn);
    });
}

init();