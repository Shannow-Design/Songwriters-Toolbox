// modules/app.js
import { getNotes, SCALES, TUNINGS, generateScale, getNoteIndex, getDiatonicChords } from './theory.js';
import { Fretboard } from './fretboard.js';
import { ChordRenderer } from './chords.js';
import { Tuner } from './tuner.js';
import { Keyboard } from './keyboard.js';
import { Sequencer } from './sequencer.js';
import { playScaleSequence, playSingleNote } from './audio.js';

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

// Wrappers
const wrapperButtons = document.getElementById('wrapper-buttons');
const wrapperChords = document.getElementById('wrapper-chords');
const wrapperGuitar = document.getElementById('wrapper-guitar');
const wrapperBass = document.getElementById('wrapper-bass');
const wrapperTuner = document.getElementById('wrapper-tuner');
const wrapperKeyboard = document.getElementById('wrapper-keyboard');
const wrapperSequencer = document.getElementById('wrapper-sequencer');


// --- Initialize Modules ---
const guitar = new Fretboard('fretboard-container', TUNINGS.standard.notes, 6);
const bass = new Fretboard('bass-fretboard-container', TUNINGS.bass_standard.notes, 4);

const chordRenderer = new ChordRenderer('chords-container');
const tuner = new Tuner('tuner-container');
const keyboard = new Keyboard('keyboard-container');

// STATE
let currentActiveChordNotes = []; 
let currentActiveChordRoot = null; 

// Initialize Sequencer
const sequencer = new Sequencer('sequencer-container', 
    () => { return { key: keySelect.value, scale: scaleSelect.value }; },
    (chordIndex) => {
        // --- SEQUENCER CALLBACK (ON BEAT 1) ---
        if (chordIndex === -1) {
            // Stop / Clear
            chordRenderer.clearHighlights();
            updateFretboards([], null); 
            keyboard.clearHighlights();
        } else {
            // Highlight Chord Card
            chordRenderer.highlightChord(chordIndex);
            
            // Highlight Fretboards & Keyboard
            const chordsList = getDiatonicChords(keySelect.value, scaleSelect.value);
            if (chordsList[chordIndex]) {
                const chord = chordsList[chordIndex];
                
                // 1. Update Fretboards (Pass Notes + Root)
                updateFretboards(chord.notes, chord.root);
                
                // 2. Update Keyboard (Pass Notes + Label + Root)
                keyboard.highlightNotes(chord.notes, chord.name, chord.root);
            }
        }
    }
);


// --- Core Logic ---

function getActiveNotes() {
    return generateScale(keySelect.value, scaleSelect.value);
}

// Helper to update both fretboards
function updateFretboards(chordNotes, chordRoot = null) {
    currentActiveChordNotes = chordNotes; 
    currentActiveChordRoot = chordRoot;
    
    const scaleNotes = getActiveNotes();
    guitar.render(scaleNotes, chordNotes, chordRoot);
    bass.render(scaleNotes, chordNotes, chordRoot);
}

function init() {
    // 1. Populate Dropdowns
    getNotes().forEach(note => {
        const option = document.createElement('option');
        option.value = note;
        option.textContent = note;
        keySelect.appendChild(option);
    });

    for (const [key, value] of Object.entries(SCALES)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = value.name;
        scaleSelect.appendChild(option);
    }

    for (const [key, value] of Object.entries(TUNINGS)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = value.name;
        if (value.notes.length === 6) tuningSelect.appendChild(option);
        else if (value.notes.length === 4) bassTuningSelect.appendChild(option);
    }

    // 2. Logic Event Listeners
    keySelect.addEventListener('change', () => {
        keyboard.clearHighlights(); 
        updateFretboards([], null);
        updateDisplay();
    });
    scaleSelect.addEventListener('change', () => {
        keyboard.clearHighlights();
        updateFretboards([], null);
        updateDisplay();
    });
    
    // Guitar Settings
    tuningSelect.addEventListener('change', () => {
        guitar.setTuning(TUNINGS[tuningSelect.value].notes);
        updateDisplay();
    });
    capoSelect.addEventListener('change', () => {
        guitar.setCapo(capoSelect.value);
        updateDisplay();
    });
    guitarModeSelect.addEventListener('change', () => {
        guitar.setDisplayMode(guitarModeSelect.value); 
    });

    // Bass Settings
    bassTuningSelect.addEventListener('change', () => {
        bass.setTuning(TUNINGS[bassTuningSelect.value].notes);
        updateDisplay();
    });
    bassModeSelect.addEventListener('change', () => {
        bass.setDisplayMode(bassModeSelect.value); 
    });

    // Audio Play Button
    if(playBtn) {
        playBtn.addEventListener('click', () => {
            const notes = getActiveNotes();
            playScaleSequence(notes);
            // Highlight Keyboard with Root (Index 0 is root)
            keyboard.highlightNotes(notes, "Scale Preview", notes[0]); 
        });
    }

    // 3. Display Option Listeners
    cbButtons.addEventListener('change', () => { wrapperButtons.style.display = cbButtons.checked ? 'block' : 'none'; });
    cbChords.addEventListener('change', () => { wrapperChords.style.display = cbChords.checked ? 'block' : 'none'; });
    cbGuitar.addEventListener('change', () => { wrapperGuitar.style.display = cbGuitar.checked ? 'block' : 'none'; });
    cbBass.addEventListener('change', () => { wrapperBass.style.display = cbBass.checked ? 'block' : 'none'; });
    cbKeyboard.addEventListener('change', () => { wrapperKeyboard.style.display = cbKeyboard.checked ? 'block' : 'none'; });
    cbSequencer.addEventListener('change', () => { wrapperSequencer.style.display = cbSequencer.checked ? 'block' : 'none'; });
    
    cbTuner.addEventListener('change', () => { 
        if (cbTuner.checked) {
            wrapperTuner.style.display = 'block';
        } else {
            wrapperTuner.style.display = 'none';
            tuner.stop(); 
        }
    });

    // 4. Initial Render
    updateDisplay();
}

function updateDisplay() {
    const activeNotes = getActiveNotes();
    
    // Render Fretboards
    guitar.render(activeNotes, currentActiveChordNotes, currentActiveChordRoot);
    bass.render(activeNotes, currentActiveChordNotes, currentActiveChordRoot);
    
    // Render Keyboard 
    keyboard.render(activeNotes); 

    // Render Note Buttons
    renderNoteButtons(activeNotes);

    // Render Chords
    const chordsList = getDiatonicChords(keySelect.value, scaleSelect.value);
    const capoValue = capoSelect.value; 
    const currentTuningNotes = TUNINGS[tuningSelect.value].notes;
    
    // Click Listener for Chords
    chordRenderer.render(
        chordsList, 
        capoValue, 
        currentTuningNotes, 
        (notes) => {
            // Callback: User Clicked a Chord Card
            const clickedChord = chordsList.find(c => JSON.stringify(c.notes) === JSON.stringify(notes));
            const chordName = clickedChord ? clickedChord.name : notes.join(' ');
            
            // Get Root from the chord object, or fallback to first note
            const root = clickedChord ? clickedChord.root : notes[0];
            
            // 1. Highlight Keyboard
            keyboard.highlightNotes(notes, chordName, root); 
            
            // 2. Highlight Fretboards
            if (clickedChord) {
                updateFretboards(notes, clickedChord.root);
                
                // Manual highlight sync for the card itself
                const index = chordsList.indexOf(clickedChord);
                chordRenderer.highlightChord(index);
            } else {
                updateFretboards(notes, notes[0]);
            }
        },
        keySelect.value // <--- Pass Key Root for smart audio calculation
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
            
            // Highlight Keyboard (This note is Root)
            keyboard.highlightNotes([note], note, note); 
            
            // Highlight Fretboards (Single Note = Chord & Root)
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