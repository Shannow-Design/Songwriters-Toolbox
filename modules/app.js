// modules/app.js
import { getNotes, SCALES, TUNINGS, generateScale, getNoteIndex, getDiatonicChords, getBorrowedChords, getAllChords, TheoryEngine } from './theory.js';
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
import { KeyFinder } from './keyfinder.js';
import { ProjectManager } from './project.js';
import { playScaleSequence, playSingleNote, loadSavedSamples, stopAllSounds } from './audio.js';
import { CircleOfFifths } from './circle.js'; 

// --- Module-Scope Variables ---
let keySelect, scaleSelect, tuningSelect, bassTuningSelect, capoSelect;
let guitarModeSelect, bassModeSelect, playBtn, noteButtonsDisplay;
let layoutModeSelect, layoutColsSelect, moduleContainer, visualizerWrapper, btnSaveLayout;
let checkBoxes = {}; 

// Module Instances
let theory, guitar, bass, chordRenderer, extraChordRenderer, tuner, keyboard, sampler, drumSampler, looper, visualizer, lyricPad, keyFinder;
let sequencer, vocalGenerator, songBuilder, studio, projectManager, circle;

// State Variables
let currentActiveChordNotes = []; 
let currentActiveChordRoot = null; 
let currentActiveChordShape = null; 

// --- HELPER FUNCTIONS ---

function getActiveNotes() { 
    if(!keySelect || !scaleSelect) return [];
    return generateScale(keySelect.value, scaleSelect.value); 
}

function addSpanToggle(wrapperId) {
    const wrapper = document.getElementById(wrapperId);
    if(!wrapper) return;
    
    const header = wrapper.querySelector('h3');
    if(!header) return;

    if(header.querySelector('.btn-span-toggle')) return;

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
    
    if(guitar) guitar.render(scaleNotes, keySelect.value, gTuning, capo, currentActiveChordNotes, currentActiveChordRoot, currentActiveChordShape);
    if(bass) bass.render(scaleNotes, keySelect.value, bTuning, 0, currentActiveChordNotes, currentActiveChordRoot, null); 
}

function updateDisplay() {
    if(!keySelect || !scaleSelect) return;

    const activeNotes = getActiveNotes();
    updateFretboards(currentActiveChordNotes, currentActiveChordRoot, currentActiveChordShape);
    
    if(circle) circle.update(keySelect.value);
    if(keyboard) keyboard.render(activeNotes, keySelect.value); 
    renderNoteButtons(activeNotes);
    
    const diatonicChords = getDiatonicChords(keySelect.value, scaleSelect.value);
    const borrowedChords = getBorrowedChords(keySelect.value, scaleSelect.value);
    const allChords = getAllChords(keySelect.value, scaleSelect.value); 

    const capoValue = parseInt(capoSelect.value || 0); 
    let currentTuningNotes = ['E','A','D','G','B','E'];
    if(TUNINGS[tuningSelect.value]) currentTuningNotes = TUNINGS[tuningSelect.value].notes;
    
    const diatonicWithIndex = diatonicChords.map((c, i) => ({...c, index: i}));
    
    if(chordRenderer) {
        chordRenderer.render(
            diatonicWithIndex, 
            capoValue, 
            currentTuningNotes, 
            (notes, chordName, shape) => { 
                const root = notes[0];
                keyboard.highlightNotes(notes, chordName, root); 
                const globalIndex = allChords.findIndex(c => c.name === chordName);
                if (globalIndex !== -1) {
                    chordRenderer.highlightChord(globalIndex);
                    extraChordRenderer.highlightChord(globalIndex);
                }
                updateFretboards(notes, root, shape);
            },
            keySelect.value 
        );
    }

    const offset = diatonicChords.length; 
    const borrowedWithIndex = borrowedChords.map((c, i) => ({...c, index: offset + i}));

    if(extraChordRenderer) {
        extraChordRenderer.render(
            borrowedWithIndex, 
            capoValue, 
            currentTuningNotes, 
            (notes, chordName, shape) => { 
                const root = notes[0];
                keyboard.highlightNotes(notes, chordName, root); 
                const globalIndex = allChords.findIndex(c => c.name === chordName);
                if (globalIndex !== -1) {
                    chordRenderer.highlightChord(globalIndex);
                    extraChordRenderer.highlightChord(globalIndex);
                }
                updateFretboards(notes, root, shape);
            },
            keySelect.value 
        );
    }
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
            extraChordRenderer.clearHighlights();
            btn.style.transition = "transform 0.1s, border-color 0.1s";
            btn.style.borderColor = "#00e5ff";
            btn.style.transform = "scale(1.05)";
            setTimeout(() => { btn.style.borderColor = ""; btn.style.transform = ""; }, 200);
        });
        noteButtonsDisplay.appendChild(btn);
    });
}

function saveLayoutSettings() {
    if (!btnSaveLayout) return;

    const settings = {
        mode: layoutModeSelect.value,
        cols: layoutColsSelect.value,
        checkboxes: {}
    };
    
    for (const [id, cb] of Object.entries(checkBoxes)) {
        if(cb) settings.checkboxes[id] = cb.checked;
    }
    
    localStorage.setItem('songwriter_layout_settings', JSON.stringify(settings));
    
    const originalText = btnSaveLayout.textContent;
    btnSaveLayout.textContent = "✔ SAVED!";
    btnSaveLayout.style.color = "#00ff55";
    btnSaveLayout.style.borderColor = "#00ff55";
    setTimeout(() => {
        btnSaveLayout.textContent = originalText;
        btnSaveLayout.style.color = "";
        btnSaveLayout.style.borderColor = "";
    }, 1500);
}

function loadLayoutSettings() {
    const saved = localStorage.getItem('songwriter_layout_settings');
    if (!saved) return;
    
    try {
        const settings = JSON.parse(saved);
        
        if (settings.mode && layoutModeSelect) {
            layoutModeSelect.value = settings.mode;
            layoutModeSelect.dispatchEvent(new Event('change')); 
        }
        
        if (settings.cols && layoutColsSelect) {
            layoutColsSelect.value = settings.cols;
            if (settings.mode !== 'single') layoutColsSelect.disabled = false;
        }
        
        if (settings.checkboxes) {
            for (const [id, isChecked] of Object.entries(settings.checkboxes)) {
                const cb = checkBoxes[id];
                if (cb) {
                    cb.checked = isChecked;
                    cb.dispatchEvent(new Event('change')); 
                }
            }
        }
    } catch(e) {
        console.error("Failed to load layout settings", e);
    }
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
        if (requireSpeakers) { elSP.classList.remove('opacity-30'); elSP.classList.add('monitor-active-sp'); } 
        else if (requireHeadphones) { elHP.classList.remove('opacity-30'); elHP.classList.add('monitor-active-hp'); } 
        else { elAny.classList.remove('opacity-30'); elAny.classList.add('monitor-active-any'); }
    }, 100); 
}

// --- INITIALIZATION ---
function init() {
    // 1. Grab DOM Elements
    keySelect = document.getElementById('key-select');
    scaleSelect = document.getElementById('scale-select');
    tuningSelect = document.getElementById('tuning-select');
    bassTuningSelect = document.getElementById('bass-tuning-select'); 
    capoSelect = document.getElementById('capo-select');
    guitarModeSelect = document.getElementById('guitar-display-mode');
    bassModeSelect = document.getElementById('bass-display-mode');
    playBtn = document.getElementById('play-btn');
    noteButtonsDisplay = document.getElementById('note-buttons-display');
    
    layoutModeSelect = document.getElementById('sel-layout-mode');
    layoutColsSelect = document.getElementById('sel-layout-cols');
    moduleContainer = document.getElementById('module-layout-container');
    visualizerWrapper = document.getElementById('wrapper-visualizer');
    btnSaveLayout = document.getElementById('btn-save-layout');

    // 2. Map Checkboxes
    const ids = [
        'cb-keyfinder', 'cb-tuner', 'cb-buttons', 'cb-circle', 'cb-chords', 'cb-extra-chords',
        'cb-guitar', 'cb-bass', 'cb-keyboard', 'cb-sequencer', 'cb-vocal', 'cb-songbuilder',
        'cb-sampler', 'cb-drum-sampler', 'cb-looper', 'cb-studio', 'cb-lyrics', 'cb-visualizer'
    ];
    ids.forEach(id => checkBoxes[id] = document.getElementById(id));

    // 3. Initialize Modules
    theory = new TheoryEngine(); 
    guitar = new Fretboard('fretboard-container');
    bass = new Fretboard('bass-fretboard-container');
    chordRenderer = new ChordRenderer('chords-container');
    extraChordRenderer = new ChordRenderer('extra-chords-container');
    tuner = new Tuner('tuner-container');
    keyboard = new Keyboard('keyboard-container');
    sampler = new Sampler('sampler-container');
    drumSampler = new DrumSampler('drum-sampler-container');
    looper = new Looper('looper-module'); 
    visualizer = new Visualizer('visualizer-module');
    lyricPad = new LyricPad('lyrics-module');

    keyFinder = new KeyFinder('keyfinder-module', (root, scale) => {
        keySelect.value = root;
        scaleSelect.value = scale;
        keySelect.dispatchEvent(new Event('change'));
        scaleSelect.dispatchEvent(new Event('change'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Sequencer Initialization
    sequencer = new Sequencer('sequencer-container', 
        () => { return { key: keySelect.value, scale: scaleSelect.value }; },
        // Chord Change Callback
        (chordIndex) => {
            if (chordIndex === -1) {
                chordRenderer.clearHighlights();
                extraChordRenderer.clearHighlights();
                updateFretboards([], null); 
                keyboard.clearHighlights();
            } else {
                chordRenderer.highlightChord(chordIndex);
                extraChordRenderer.highlightChord(chordIndex); 
                const chordsList = getAllChords(keySelect.value, scaleSelect.value);
                if (chordsList && chordsList[chordIndex]) {
                    const chord = chordsList[chordIndex];
                    updateFretboards(chord.notes, chord.root);
                    keyboard.highlightNotes(chord.notes, chord.name, chord.root);
                }
            }
        },
        // Preset Load Callback
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
        // Step Callback
        (step, progIndex, progLength, cycleCount, time) => {
            looper.onStep(step, progIndex, progLength, cycleCount, time);
            if (songBuilder) songBuilder.onStep(step, time);
            if (vocalGenerator) vocalGenerator.onStep(step, progIndex, progLength, cycleCount, time);
        },
        // Stop Callback
        () => { looper.stopAll(); },
        // Get Looper Data
        () => { return looper.getSettings(); },
        // NEW: Lead Visual Callback
        (midiNumber) => {
            if (keyboard) keyboard.highlightLeadNote(midiNumber);
        }
    );

    vocalGenerator = new VocalGenerator('vocal-module', sequencer);
    songBuilder = new SongBuilder('songbuilder-module', sequencer);
    studio = new Studio('studio-module', sequencer, songBuilder);
    projectManager = new ProjectManager(sequencer, songBuilder, looper, studio, sampler);

    circle = new CircleOfFifths('circle-container', (newKey) => {
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

    // 4. Setup Options
    getNotes().forEach(note => { const option = document.createElement('option'); option.value = note; option.textContent = note; keySelect.appendChild(option); });
    keySelect.value = 'C'; 
    for (const [key, value] of Object.entries(SCALES)) { const option = document.createElement('option'); option.value = key; option.textContent = value.name; scaleSelect.appendChild(option); }
    scaleSelect.value = 'major';
    for (const [key, value] of Object.entries(TUNINGS)) { const option = document.createElement('option'); option.value = key; option.textContent = value.name; if (value.notes.length === 6) tuningSelect.appendChild(option); else if (value.notes.length === 4 || value.notes.length === 5) bassTuningSelect.appendChild(option); }
    tuningSelect.value = 'standard';
    bassTuningSelect.value = 'bass_standard';

    // 5. Global Listeners
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

    // 6. Setup Visibility Toggles
    const wrappers = {
        'cb-keyfinder': 'wrapper-keyfinder',
        'cb-tuner': 'wrapper-tuner',
        'cb-buttons': 'wrapper-buttons',
        'cb-circle': 'wrapper-circle',
        'cb-chords': 'wrapper-chords',
        'cb-extra-chords': 'wrapper-extra-chords',
        'cb-guitar': 'wrapper-guitar',
        'cb-bass': 'wrapper-bass',
        'cb-keyboard': 'wrapper-keyboard',
        'cb-sequencer': 'wrapper-sequencer',
        'cb-vocal': 'wrapper-vocal',
        'cb-songbuilder': 'wrapper-songbuilder',
        'cb-sampler': 'wrapper-sampler',
        'cb-drum-sampler': 'wrapper-drum-sampler',
        'cb-looper': 'wrapper-looper',
        'cb-studio': 'wrapper-studio',
        'cb-lyrics': 'wrapper-lyrics'
    };

    const toggleModule = (cb, wrapperId) => {
        const wrapper = document.getElementById(wrapperId);
        if(cb && wrapper) {
            cb.addEventListener('change', () => { wrapper.style.display = cb.checked ? 'block' : 'none'; });
        }
    };

    for (const [id, wrapperId] of Object.entries(wrappers)) {
        toggleModule(checkBoxes[id], wrapperId);
    }

    if(checkBoxes['cb-visualizer']) {
        checkBoxes['cb-visualizer'].addEventListener('change', () => {
            visualizerWrapper.style.display = checkBoxes['cb-visualizer'].checked ? 'flex' : 'none'; 
            if(checkBoxes['cb-visualizer'].checked) visualizer.resume(); else visualizer.stop();
        });
    }
    
    if(checkBoxes['cb-drum-sampler']) {
        checkBoxes['cb-drum-sampler'].addEventListener('change', () => {
            if(checkBoxes['cb-drum-sampler'].checked) drumSampler.updateStatus();
        });
    }
    
    if(checkBoxes['cb-tuner']) {
        checkBoxes['cb-tuner'].addEventListener('change', () => { 
            if (!checkBoxes['cb-tuner'].checked) tuner.stop(); 
        });
    }

    // 7. Layout Mode Logic
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
    
    // 8. Bind Save Layout Button
    if(btnSaveLayout) {
        btnSaveLayout.addEventListener('click', saveLayoutSettings);
    }

    // 9. Load Saved Audio & Settings
    loadSavedSamples().then(() => { sampler.updateStatus(); });
    loadLayoutSettings(); 

    // 10. Add Span Buttons
    addSpanToggle('wrapper-guitar');
    addSpanToggle('wrapper-bass');
    addSpanToggle('wrapper-keyfinder');
    addSpanToggle('wrapper-keyboard'); 
    addSpanToggle('wrapper-extra-chords');

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

    // 11. Final Global Bindings
    const btnExport = document.getElementById('btn-project-export');
    const btnImport = document.getElementById('btn-project-import');
    const inputImport = document.getElementById('input-project-import');
    if(btnExport) btnExport.addEventListener('click', () => projectManager.exportProject());
    if(btnImport && inputImport) { 
        btnImport.addEventListener('click', () => inputImport.click()); 
        inputImport.addEventListener('change', (e) => { 
            if(e.target.files.length > 0) projectManager.importProject(e.target.files[0]); 
        }); 
    }

    document.getElementById('btn-global-seq').addEventListener('click', () => { if(songBuilder && songBuilder.isPlaying) songBuilder.togglePlay(); if(sequencer) sequencer.togglePlay(); });
    document.getElementById('btn-global-song').addEventListener('click', () => { if(sequencer && sequencer.isPlaying) sequencer.togglePlay(); if(songBuilder) songBuilder.togglePlay(); });
    document.getElementById('btn-global-stop').addEventListener('click', () => { if(sequencer && sequencer.isPlaying) sequencer.togglePlay(); if(songBuilder && songBuilder.isPlaying) songBuilder.togglePlay(); if(looper) looper.stopAll(); if(vocalGenerator) vocalGenerator.isMuted = true; stopAllSounds(); });

    updateDisplay();
    initOutputMonitor(); 
}

init();