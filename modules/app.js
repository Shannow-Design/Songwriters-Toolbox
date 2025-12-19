// modules/app.js
import { getNotes, SCALES, TUNINGS, generateScale, getNoteIndex, getDiatonicChords } from './theory.js';
import { Fretboard } from './fretboard.js';
import { ChordRenderer } from './chords.js';
import { Tuner } from './tuner.js';
import { Keyboard } from './keyboard.js';
import { playScaleSequence, playSingleNote } from './audio.js';

// --- DOM Elements ---

// Dropdowns
const keySelect = document.getElementById('key-select');
const scaleSelect = document.getElementById('scale-select');
const tuningSelect = document.getElementById('tuning-select');
const bassTuningSelect = document.getElementById('bass-tuning-select'); 
const capoSelect = document.getElementById('capo-select');

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

// Wrappers (Areas to hide/show)
const wrapperButtons = document.getElementById('wrapper-buttons');
const wrapperChords = document.getElementById('wrapper-chords');
const wrapperGuitar = document.getElementById('wrapper-guitar');
const wrapperBass = document.getElementById('wrapper-bass');
const wrapperTuner = document.getElementById('wrapper-tuner');
const wrapperKeyboard = document.getElementById('wrapper-keyboard');


// --- Initialize Modules ---
const guitar = new Fretboard('fretboard-container', TUNINGS.standard.notes, 2);
const bass = new Fretboard('bass-fretboard-container', TUNINGS.bass_standard.notes, 1);
const chordRenderer = new ChordRenderer('chords-container');
const tuner = new Tuner('tuner-container');
const keyboard = new Keyboard('keyboard-container');


// --- Core Logic ---

function getActiveNotes() {
    return generateScale(keySelect.value, scaleSelect.value);
}

function init() {
    // 1. Populate Dropdowns
    // Keys
    getNotes().forEach(note => {
        const option = document.createElement('option');
        option.value = note;
        option.textContent = note;
        keySelect.appendChild(option);
    });

    // Scales
    for (const [key, value] of Object.entries(SCALES)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = value.name;
        scaleSelect.appendChild(option);
    }

    // Tunings (Guitar & Bass)
    for (const [key, value] of Object.entries(TUNINGS)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = value.name;
        
        if (value.notes.length === 6) {
            tuningSelect.appendChild(option);
        } else if (value.notes.length === 4) {
            bassTuningSelect.appendChild(option);
        }
    }

    // 2. Logic Event Listeners
    keySelect.addEventListener('change', () => {
        keyboard.clearHighlights(); // Clear keyboard on key change
        updateDisplay();
    });
    scaleSelect.addEventListener('change', () => {
        keyboard.clearHighlights(); // Clear keyboard on scale change
        updateDisplay();
    });
    
    // Guitar Specific
    tuningSelect.addEventListener('change', () => {
        guitar.setTuning(TUNINGS[tuningSelect.value].notes);
        updateDisplay();
    });
    capoSelect.addEventListener('change', () => {
        guitar.setCapo(capoSelect.value);
        updateDisplay();
    });

    // Bass Specific
    bassTuningSelect.addEventListener('change', () => {
        bass.setTuning(TUNINGS[bassTuningSelect.value].notes);
        updateDisplay();
    });

    // Audio Play Button
    if(playBtn) {
        playBtn.addEventListener('click', () => {
            const notes = getActiveNotes();
            playScaleSequence(notes);
            keyboard.highlightNotes(notes, "Scale Preview"); // Label the scale
        });
    }

    // 3. Display Option Listeners (Hide/Show Sections)
    cbButtons.addEventListener('change', () => { wrapperButtons.style.display = cbButtons.checked ? 'block' : 'none'; });
    cbChords.addEventListener('change', () => { wrapperChords.style.display = cbChords.checked ? 'block' : 'none'; });
    cbGuitar.addEventListener('change', () => { wrapperGuitar.style.display = cbGuitar.checked ? 'block' : 'none'; });
    cbBass.addEventListener('change', () => { wrapperBass.style.display = cbBass.checked ? 'block' : 'none'; });
    cbKeyboard.addEventListener('change', () => { wrapperKeyboard.style.display = cbKeyboard.checked ? 'block' : 'none'; });
    
    // Tuner Toggle Logic (Stop microphone if hidden)
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
    guitar.render(activeNotes);
    bass.render(activeNotes);
    
    // Render Keyboard (Note: This keeps the visual scale logic if needed, but we mostly rely on highlights now)
    // We pass activeNotes so the keyboard CAN show safe keys if we want, 
    // but the clearHighlights call above keeps it clean on change.
    keyboard.render(activeNotes); 

    // Render Note Buttons
    renderNoteButtons(activeNotes);

    // Render Chords
    const chordsList = getDiatonicChords(keySelect.value, scaleSelect.value);
    const capoValue = capoSelect.value; 
    const currentTuningNotes = TUNINGS[tuningSelect.value].notes;
    
    // --- CONNECT CHORDS TO KEYBOARD ---
    chordRenderer.render(chordsList, capoValue, currentTuningNotes, (notes) => {
        // Find the chord object that matches these notes to get its name
        const clickedChord = chordsList.find(c => JSON.stringify(c.notes) === JSON.stringify(notes));
        const chordName = clickedChord ? clickedChord.name : notes.join(' ');
        
        keyboard.highlightNotes(notes, chordName); // Pass Name to Display
    });
}

// Function to render the big square note buttons
function renderNoteButtons(scaleNotes) {
    if(!noteButtonsDisplay) return;
    
    noteButtonsDisplay.innerHTML = '';
    const intervals = ['R', '2', '3', '4', '5', '6', '7'];
    
    let currentOctave = 3; 
    let lastNoteIndex = -1;

    scaleNotes.forEach((note, index) => {
        const noteIndex = getNoteIndex(note);
        
        // Octave logic
        if (noteIndex < lastNoteIndex) currentOctave++;
        lastNoteIndex = noteIndex;
        
        const buttonOctave = currentOctave;

        // Build Button HTML
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
        
        // Add Click Listener
        btn.addEventListener('click', () => {
            playSingleNote(note, buttonOctave); 
            
            // --- CONNECT BUTTON TO KEYBOARD ---
            keyboard.highlightNotes([note], note); // Show just "C" or "F#" on screen

            // Visual Animation (Pulse Cyan)
            btn.style.transition = "transform 0.1s, border-color 0.1s";
            btn.style.borderColor = "#00e5ff";
            btn.style.transform = "scale(1.05)";
            
            // Reset after 200ms
            setTimeout(() => {
                btn.style.borderColor = ""; 
                btn.style.transform = "";
            }, 200);
        });
        
        noteButtonsDisplay.appendChild(btn);
    });
}

// Start the app
init();