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
import { DrumSampler } from './drumsampler.js'; 
import { VocalGenerator } from './vocal.js';    
import { Visualizer } from './visualizer.js';   
import { LyricPad } from './lyrics.js';         
import { KeyFinder } from './keyfinder.js'; // IMPORT KEYFINDER
import { playScaleSequence, playSingleNote, loadSavedSamples } from './audio.js';
import { CircleOfFifths } from './circle.js'; 

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
const cbKeyFinder = document.getElementById('cb-keyfinder'); // NEW
const cbButtons = document.getElementById('cb-buttons');
const cbCircle = document.getElementById('cb-circle'); 
const cbChords = document.getElementById('cb-chords');
const cbGuitar = document.getElementById('cb-guitar');
const cbBass = document.getElementById('cb-bass');
const cbTuner = document.getElementById('cb-tuner');
const cbKeyboard = document.getElementById('cb-keyboard');
const cbSequencer = document.getElementById('cb-sequencer');
const cbVocal = document.getElementById('cb-vocal');
const cbVisualizer = document.getElementById('cb-visualizer');
const cbLyrics = document.getElementById('cb-lyrics');
const cbSampler = document.getElementById('cb-sampler');
const cbSongBuilder = document.getElementById('cb-songbuilder'); 
const cbLooper = document.getElementById('cb-looper');
const cbStudio = document.getElementById('cb-studio');
const cbDrumSampler = document.getElementById('cb-drum-sampler');

// Layout Controls
const layoutModeSelect = document.getElementById('sel-layout-mode');
const layoutColsSelect = document.getElementById('sel-layout-cols');
const moduleContainer = document.getElementById('module-layout-container');
const visualizerWrapper = document.getElementById('wrapper-visualizer');

// Wrappers
const wrapperKeyFinder = document.getElementById('wrapper-keyfinder'); // NEW
const wrapperButtons = document.getElementById('wrapper-buttons');
const wrapperCircle = document.getElementById('wrapper-circle'); 
const wrapperChords = document.getElementById('wrapper-chords');
const wrapperGuitar = document.getElementById('wrapper-guitar');
const wrapperBass = document.getElementById('wrapper-bass');
const wrapperTuner = document.getElementById('wrapper-tuner');
const wrapperKeyboard = document.getElementById('wrapper-keyboard');
const wrapperSequencer = document.getElementById('wrapper-sequencer');
const wrapperVocal = document.getElementById('wrapper-vocal'); 
const wrapperVisualizer = document.getElementById('wrapper-visualizer'); 
const wrapperLyrics = document.getElementById('wrapper-lyrics'); 
const wrapperSampler = document.getElementById('wrapper-sampler');
const wrapperSongBuilder = document.getElementById('wrapper-songbuilder');
const wrapperLooper = document.getElementById('wrapper-looper');
const wrapperStudio = document.getElementById('wrapper-studio');
const wrapperDrumSampler = document.getElementById('wrapper-drum-sampler');

// --- Initialize Modules ---
const theory = new TheoryEngine(); 
const guitar = new Fretboard('fretboard-container');
const bass = new Fretboard('bass-fretboard-container');

const chordRenderer = new ChordRenderer('chords-container');
const tuner = new Tuner('tuner-container');
const keyboard = new Keyboard('keyboard-container');
const sampler = new Sampler('sampler-container');
const drumSampler = new DrumSampler('drum-sampler-container');
const looper = new Looper('looper-module'); 

// NEW MODULES
const visualizer = new Visualizer('visualizer-module');
const lyricPad = new LyricPad('lyrics-module');

// INIT KEYFINDER with Callback
const keyFinder = new KeyFinder('keyfinder-module', (root, scale) => {
    // 1. Set values
    keySelect.value = root;
    scaleSelect.value = scale;
    // 2. Trigger updates
    keySelect.dispatchEvent(new Event('change'));
    scaleSelect.dispatchEvent(new Event('change'));
    // 3. Optional: Scroll to top to see change
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// 1. Initialize Sequencer
const sequencer = new Sequencer('sequencer-container', 
    () => { return { key: keySelect.value, scale: scaleSelect.value }; },
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
    (presetData) => {
        keySelect.value = presetData.key;
        scaleSelect.value = presetData.scale;
        keyboard.clearHighlights(); 
        updateFretboards([], null);
        updateDisplay();
        if (presetData.looper) { looper.applySettings(presetData.looper); }
        document.body.style.transition = "background 0.1s";
        document.body.style.background = "#222";
        setTimeout(() => document.body.style.background = "", 100);
    },
    (step, progIndex, progLength, cycleCount, time) => {
        looper.onStep(step, progIndex, progLength, cycleCount, time);
        if (songBuilder) songBuilder.onStep(step, time);
        if (vocalGenerator) vocalGenerator.onStep(step, progIndex, progLength, cycleCount, time);
    },
    () => { looper.stopAll(); },
    () => { return looper.getSettings(); }
);

const vocalGenerator = new VocalGenerator('vocal-module', sequencer);
const songBuilder = new SongBuilder('songbuilder-module', sequencer);
const studio = new Studio('studio-module', sequencer, songBuilder);

const circle = new CircleOfFifths('circle-container', (newKey) => {
    let optionFound = false;
    for(let i=0; i<keySelect.options.length; i++) {
        if(keySelect.options[i].value === newKey) { keySelect.selectedIndex = i; optionFound = true; break; }
    }
    if(!optionFound) {
        const enharmonics = {'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#', 'C#':'Db', 'D#':'Eb', 'F#':'Gb', 'G#':'Ab', 'A#':'Bb'};
        if(enharmonics[newKey]) { for(let i=0; i<keySelect.options.length; i++) { if(keySelect.options[i].value === enharmonics[newKey]) { keySelect.selectedIndex = i; break; } } }
    }
    keySelect.dispatchEvent(new Event('change'));
});

// --- STATE ---
let currentActiveChordNotes = []; 
let currentActiveChordRoot = null; 
let currentActiveChordShape = null; 

const originalOnStep = looper.onStep.bind(looper);
looper.onStep = (step, progIndex, progLength, cycleCount, time) => {
    looper.setBpm(sequencer.bpm);
    originalOnStep(step, progIndex, progLength, cycleCount, time);
};

function getActiveNotes() { return generateScale(keySelect.value, scaleSelect.value); }

function updateFretboards(chordNotes, chordRoot = null, chordShape = null) {
    currentActiveChordNotes = chordNotes; 
    currentActiveChordRoot = chordRoot;
    currentActiveChordShape = chordShape; 

    const scaleNotes = getActiveNotes();
    let gTuning = ['E','A','D','G','B','E'];
    if (TUNINGS[tuningSelect.value]) gTuning = TUNINGS[tuningSelect.value].notes;
    let bTuning = ['E','A','D','G'];
    if (TUNINGS[bassTuningSelect.value]) { bTuning = TUNINGS[bassTuningSelect.value].notes; }
    
    const capo = parseInt(capoSelect.value || 0);
    
    guitar.render(scaleNotes, keySelect.value, gTuning, capo, currentActiveChordNotes, currentActiveChordRoot, currentActiveChordShape);
    bass.render(scaleNotes, keySelect.value, bTuning, 0, currentActiveChordNotes, currentActiveChordRoot, null); 
}

// --- NEW: Add "Span" Button to Module Headers ---
function addSpanToggle(wrapperId) {
    const wrapper = document.getElementById(wrapperId);
    if(!wrapper) return;
    
    const header = wrapper.querySelector('h3');
    if(!header) return;

    const btn = document.createElement('button');
    btn.textContent = "↔ Span";
    btn.className = "btn-span-toggle";
    btn.title = "Toggle Full Width in Grid Mode";
    btn.style.cssText = `
        float: right; font-size: 0.6rem; background: #333; border: 1px solid #555; 
        color: #888; padding: 2px 6px; border-radius: 3px; cursor: pointer; margin-left: 10px;
        text-transform: none; letter-spacing: 0; font-weight: normal;
    `;
    
    btn.onclick = (e) => {
        e.stopPropagation();
        const isSpanned = wrapper.classList.toggle('col-span-full');
        btn.style.color = isSpanned ? '#00e5ff' : '#888';
        btn.style.borderColor = isSpanned ? '#00e5ff' : '#555';
    };

    header.appendChild(btn);
}

function init() {
    getNotes().forEach(note => { const option = document.createElement('option'); option.value = note; option.textContent = note; keySelect.appendChild(option); });
    keySelect.value = 'C'; 
    for (const [key, value] of Object.entries(SCALES)) { const option = document.createElement('option'); option.value = key; option.textContent = value.name; scaleSelect.appendChild(option); }
    scaleSelect.value = 'major';
    for (const [key, value] of Object.entries(TUNINGS)) {
        const option = document.createElement('option'); option.value = key; option.textContent = value.name;
        if (value.notes.length === 6) tuningSelect.appendChild(option);
        else if (value.notes.length === 4 || value.notes.length === 5) bassTuningSelect.appendChild(option);
    }
    tuningSelect.value = 'standard';
    bassTuningSelect.value = 'bass_standard';

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
    const toggleModule = (cb, wrapper) => {
        if(cb && wrapper) {
            cb.addEventListener('change', () => { wrapper.style.display = cb.checked ? 'block' : 'none'; });
        }
    };

    toggleModule(cbKeyFinder, wrapperKeyFinder); // NEW
    toggleModule(cbButtons, wrapperButtons);
    if(cbCircle) toggleModule(cbCircle, wrapperCircle);
    toggleModule(cbChords, wrapperChords);
    toggleModule(cbGuitar, wrapperGuitar);
    toggleModule(cbBass, wrapperBass);
    toggleModule(cbKeyboard, wrapperKeyboard);
    toggleModule(cbSequencer, wrapperSequencer);
    toggleModule(cbVocal, wrapperVocal);
    toggleModule(cbLyrics, wrapperLyrics);
    toggleModule(cbSampler, wrapperSampler);
    if(cbSongBuilder) toggleModule(cbSongBuilder, wrapperSongBuilder);
    if(cbLooper) toggleModule(cbLooper, wrapperLooper);
    if(cbStudio) toggleModule(cbStudio, wrapperStudio);
    
    if(cbVisualizer) {
        cbVisualizer.addEventListener('change', () => {
            visualizerWrapper.style.display = cbVisualizer.checked ? 'flex' : 'none'; 
            if(cbVisualizer.checked) visualizer.resume(); else visualizer.stop();
        });
    }
    
    if(cbDrumSampler) {
        cbDrumSampler.addEventListener('change', () => {
            wrapperDrumSampler.style.display = cbDrumSampler.checked ? 'block' : 'none';
            if(cbDrumSampler.checked) drumSampler.updateStatus();
        });
    }
    
    cbTuner.addEventListener('change', () => { 
        if (cbTuner.checked) { wrapperTuner.style.display = 'block'; } else { wrapperTuner.style.display = 'none'; tuner.stop(); } 
    });

    const updateLayout = () => {
        const mode = layoutModeSelect.value; 
        const cols = layoutColsSelect.value; 

        let containerClasses = "w-full gap-6 transition-all duration-300 ";
        let visualizerClasses = "sticky top-4 z-50 bg-gray-900/95 backdrop-blur-md border border-gray-800 p-2 rounded-xl transition-all duration-300 shadow-xl flex gap-4 items-center ";

        const spanBtns = document.querySelectorAll('.btn-span-toggle');
        
        if (mode === 'single') {
            containerClasses += "max-w-5xl flex flex-col";
            visualizerClasses += "w-full max-w-5xl";
            layoutColsSelect.disabled = true;
            layoutColsSelect.style.opacity = 0.5;
            spanBtns.forEach(b => b.style.display = 'none');
        } else {
            containerClasses += "max-w-[98%] ";
            visualizerClasses += "w-full max-w-[98%]";
            layoutColsSelect.disabled = false;
            layoutColsSelect.style.opacity = 1;
            spanBtns.forEach(b => b.style.display = 'inline-block');

            if (mode === 'masonry') {
                containerClasses += `columns-${cols}`; 
            } else {
                containerClasses += `grid grid-cols-${cols} items-start`; 
            }
        }

        moduleContainer.className = containerClasses;
        visualizerWrapper.className = visualizerClasses;
    };

    layoutModeSelect.addEventListener('change', updateLayout);
    layoutColsSelect.addEventListener('change', updateLayout);

    loadSavedSamples().then(() => { sampler.updateStatus(); });

    // --- ADD SPAN BUTTONS ---
    addSpanToggle('wrapper-guitar');
    addSpanToggle('wrapper-bass');
    addSpanToggle('wrapper-keyfinder'); // NEW: KeyFinder benefits from spanning

    setTimeout(() => {
        const vocalHeader = document.querySelector('.vocal-header');
        if(vocalHeader) {
            const btn = document.createElement('button');
            btn.textContent = "↔ Span";
            btn.className = "btn-span-toggle";
            btn.style.cssText = "font-size:0.6rem; background:#333; border:1px solid #555; color:#888; padding:2px 6px; border-radius:3px; cursor:pointer; margin-left:10px;";
            btn.onclick = () => {
                const wrapper = document.getElementById('wrapper-vocal');
                const isSpanned = wrapper.classList.toggle('col-span-full');
                btn.style.color = isSpanned ? '#00e5ff' : '#888';
                btn.style.borderColor = isSpanned ? '#00e5ff' : '#555';
            };
            vocalHeader.insertBefore(btn, vocalHeader.lastElementChild);
        }
    }, 500);

    updateDisplay();
    initOutputMonitor(); 
}

function updateDisplay() {
    const activeNotes = getActiveNotes();
    updateFretboards(currentActiveChordNotes, currentActiveChordRoot, currentActiveChordShape);
    
    if(circle) circle.update(keySelect.value);
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
        (notes, chordName, shape) => { 
            const root = notes[0];
            keyboard.highlightNotes(notes, chordName, root); 
            const chordIndex = chordsList.findIndex(c => c.name === chordName);
            if (chordIndex !== -1) chordRenderer.highlightChord(chordIndex);
            updateFretboards(notes, root, shape);
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
            keyboard.highlightNotes(scaleNotes, note, note); 
            updateFretboards([note], note);
            chordRenderer.clearHighlights();
            btn.style.transition = "transform 0.1s, border-color 0.1s";
            btn.style.borderColor = "#00e5ff";
            btn.style.transform = "scale(1.05)";
            setTimeout(() => { btn.style.borderColor = ""; btn.style.transform = ""; }, 200);
        });
        noteButtonsDisplay.appendChild(btn);
    });
}

function initOutputMonitor() {
    const elHP = document.getElementById('ind-headphones');
    const elSP = document.getElementById('ind-speakers');
    const elAny = document.getElementById('ind-any');

    setInterval(() => {
        let requireHeadphones = false;
        let requireSpeakers = false;

        if (looper && looper.isRecordingOrArmed()) requireHeadphones = true;
        if (vocalGenerator && vocalGenerator.isPracticeMode) requireHeadphones = true;
        if (studio && studio.isRecording) requireHeadphones = true;

        if (looper && looper.isLatencyTesting) requireSpeakers = true;

        if(elHP) elHP.className = "monitor-item opacity-30 transition-all duration-300";
        if(elSP) elSP.className = "monitor-item opacity-30 transition-all duration-300";
        if(elAny) elAny.className = "monitor-item opacity-30 transition-all duration-300";

        if (requireSpeakers) {
            elSP.classList.remove('opacity-30');
            elSP.classList.add('monitor-active-sp'); 
        } 
        else if (requireHeadphones) {
            elHP.classList.remove('opacity-30');
            elHP.classList.add('monitor-active-hp'); 
        } 
        else {
            elAny.classList.remove('opacity-30');
            elAny.classList.add('monitor-active-any'); 
        }

    }, 100); 
}

init();