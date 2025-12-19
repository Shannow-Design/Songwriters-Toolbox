// modules/app.js
import { getNotes, SCALES, TUNINGS, generateScale, getNoteIndex, getDiatonicChords } from './theory.js';
import { Fretboard } from './fretboard.js';
import { ChordRenderer } from './chords.js';
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

// Wrappers (Areas to hide/show)
const wrapperButtons = document.getElementById('wrapper-buttons');
const wrapperChords = document.getElementById('wrapper-chords');
const wrapperGuitar = document.getElementById('wrapper-guitar');
const wrapperBass = document.getElementById('wrapper-bass');


// --- Initialize Instruments ---
// Guitar: Standard Tuning, Base Octave 2
const guitar = new Fretboard('fretboard-container', TUNINGS.standard.notes, 2);

// Bass: Standard Tuning, Base Octave 1 (Deeper sound)
const bass = new Fretboard('bass-fretboard-container', TUNINGS.bass_standard.notes, 1);

// Chords: Renderer for the SVG charts
const chordRenderer = new ChordRenderer('chords-container');


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

    // Tunings (Split between Guitar and Bass dropdowns)
    for (const [key, value] of Object.entries(TUNINGS)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = value.name;
        
        // Simple logic: 6 strings = Guitar, 4 strings = Bass
        if (value.notes.length === 6) {
            tuningSelect.appendChild(option);
        } else if (value.notes.length === 4) {
            bassTuningSelect.appendChild(option);
        }
    }

    // 2. Logic Event Listeners
    keySelect.addEventListener('change', updateDisplay);
    scaleSelect.addEventListener('change', updateDisplay);
    
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
        });
    }

    // 3. Display Option Listeners (Hide/Show Sections)
    cbButtons.addEventListener('change', () => { wrapperButtons.style.display = cbButtons.checked ? 'block' : 'none'; });
    cbChords.addEventListener('change', () => { wrapperChords.style.display = cbChords.checked ? 'block' : 'none'; });
    cbGuitar.addEventListener('change', () => { wrapperGuitar.style.display = cbGuitar.checked ? 'block' : 'none'; });
    cbBass.addEventListener('change', () => { wrapperBass.style.display = cbBass.checked ? 'block' : 'none'; });

    // 4. Initial Render
    updateDisplay();
}

// In modules/app.js

function updateDisplay() {
    const activeNotes = getActiveNotes();
    
    guitar.render(activeNotes);
    bass.render(activeNotes);
    renderNoteButtons(activeNotes);

    // --- UPDATED CHORD RENDER LOGIC ---
    const chordsList = getDiatonicChords(keySelect.value, scaleSelect.value);
    const capoValue = capoSelect.value; 
    
    // NEW: Get the actual notes of the current guitar tuning
    // We look up the tuning object from the dictionary using the select value
    const currentTuningNotes = TUNINGS[tuningSelect.value].notes;

    chordRenderer.render(chordsList, capoValue, currentTuningNotes);
}

// Function to render the big square note buttons
function renderNoteButtons(scaleNotes) {
    if(!noteButtonsDisplay) return;
    
    noteButtonsDisplay.innerHTML = '';
    const intervals = ['R', '2', '3', '4', '5', '6', '7'];
    
    // Start tracking octave at 3 for button audio
    let currentOctave = 3; 
    let lastNoteIndex = -1;

    scaleNotes.forEach((note, index) => {
        const noteIndex = getNoteIndex(note);
        
        // If note index drops (e.g. B -> C), we wrapped to next octave
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
        });
        
        noteButtonsDisplay.appendChild(btn);
    });
}

// Start the app
init();