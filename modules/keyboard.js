// modules/keyboard.js
import { getNoteIndex, getNotes } from './theory.js';
import { startNote, stopNote } from './audio.js';

const START_MIDI_NOTE = 48; // C3
const NUM_KEYS = 25;        // C3 to C5
const SHARPS = getNotes();

export class Keyboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.display = document.getElementById('keyboard-info'); // Grab the new display
        this.highlightedIndices = []; 
        this.pressedNotes = new Set(); // Track notes currently held down
        this.render(); 
        this.initMIDI();
    }

    render() {
        if (!this.container) return;
        
        const keyWidth = 40;
        const keyHeight = 120;
        const blackKeyHeight = 75;
        const whiteKeyCount = 15; 
        const svgWidth = whiteKeyCount * keyWidth;

        let svg = `<svg width="${svgWidth}" height="${keyHeight}" viewBox="0 0 ${svgWidth} ${keyHeight}">`;
        
        // --- DRAW WHITE KEYS ---
        let x = 0;
        for (let i = 0; i < NUM_KEYS; i++) {
            const midiNote = START_MIDI_NOTE + i;
            const noteName = this.getNoteNameFromMidi(midiNote);
            if (!noteName.includes('#')) {
                const isHighlighted = this.isNoteHighlighted(midiNote);
                const color = isHighlighted ? 'var(--primary-cyan)' : 'white';
                
                svg += `<rect id="key-${midiNote}" x="${x}" y="0" width="${keyWidth}" height="${keyHeight}" 
                        fill="${color}" stroke="black" stroke-width="1" class="piano-key white-key" 
                        data-note="${midiNote}" />`;
                
                if (isHighlighted) {
                     svg += `<text x="${x + keyWidth/2}" y="${keyHeight - 10}" text-anchor="middle" font-size="10" pointer-events="none" fill="#333">${noteName}</text>`;
                }
                x += keyWidth;
            }
        }

        // --- DRAW BLACK KEYS ---
        let whiteKeyX = 0;
        for (let i = 0; i < NUM_KEYS - 1; i++) {
            const midiNote = START_MIDI_NOTE + i;
            const noteName = this.getNoteNameFromMidi(midiNote);
            if (!noteName.includes('#')) {
                const nextMidi = midiNote + 1;
                const nextName = this.getNoteNameFromMidi(nextMidi);
                
                if (nextName.includes('#')) {
                    const bx = whiteKeyX + (keyWidth * 0.7);
                    const isHighlighted = this.isNoteHighlighted(nextMidi);
                    const fill = isHighlighted ? 'var(--primary-cyan)' : '#333';
                    
                    svg += `<rect id="key-${nextMidi}" x="${bx}" y="0" width="${keyWidth * 0.6}" height="${blackKeyHeight}" 
                            fill="${fill}" stroke="black" class="piano-key black-key" 
                            data-note="${nextMidi}" />`;
                }
                whiteKeyX += keyWidth;
            }
        }

        svg += `</svg>`;
        this.container.innerHTML = svg;
        this.addMouseListeners();
    }

    // --- UPDATED: Highlight with optional Label ---
    highlightNotes(noteNames, label = null) {
        this.highlightedIndices = noteNames.map(name => getNoteIndex(name));
        
        // If a specific label (e.g. "C Major") was passed, show it
        if (label) {
            this.updateDisplay(label);
        } else {
            // Otherwise just show the notes joined
            this.updateDisplay(noteNames.join(' '));
        }
        
        this.render();
    }
    
    // --- UPDATED: Display Logic ---
    updateDisplay(text) {
        if (!this.display) return;
        this.display.textContent = text || "Ready";
        this.display.style.color = text ? "#00e5ff" : "#444";
    }

    // Called when user MANUALLY presses keys (Mouse/MIDI)
    updatePressedDisplay() {
        if (this.pressedNotes.size === 0) {
            this.updateDisplay("Ready");
            return;
        }
        // Convert Set to Array, sort by MIDI number
        const sortedMidi = Array.from(this.pressedNotes).sort((a,b) => a - b);
        const noteNames = sortedMidi.map(m => this.getNoteNameWithOctave(m));
        this.updateDisplay(noteNames.join(', '));
    }

    isNoteHighlighted(midiNumber) {
        const noteIndex = midiNumber % 12;
        return this.highlightedIndices.includes(noteIndex);
    }
    
    clearHighlights() {
        this.highlightedIndices = [];
        this.render();
        this.updateDisplay("Ready");
    }

    getNoteNameFromMidi(midiNumber) {
        const noteIndex = midiNumber % 12;
        return SHARPS[noteIndex];
    }
    
    // NEW: Returns "C3", "F#4", etc.
    getNoteNameWithOctave(midiNumber) {
        const noteIndex = midiNumber % 12;
        const octave = Math.floor(midiNumber / 12) - 1;
        return SHARPS[noteIndex] + octave;
    }
    
    getFrequency(midiNumber) {
        return 440 * Math.pow(2, (midiNumber - 69) / 12);
    }

    addMouseListeners() {
        const keys = this.container.querySelectorAll('.piano-key');
        keys.forEach(key => {
            const note = parseInt(key.dataset.note);
            key.addEventListener('mousedown', () => this.handleNoteOn(note));
            key.addEventListener('mouseup', () => this.handleNoteOff(note));
            key.addEventListener('mouseleave', () => this.handleNoteOff(note));
            key.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleNoteOn(note); });
            key.addEventListener('touchend', (e) => { e.preventDefault(); this.handleNoteOff(note); });
        });
    }

    initMIDI() {
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess().then(
                (midi) => {
                    midi.inputs.forEach(input => {
                        input.onmidimessage = (msg) => this.onMIDIMessage(msg);
                    });
                    const status = document.getElementById('midi-status-light');
                    if(status && midi.inputs.size > 0) status.style.background = '#00ff00';
                },
                (err) => console.log('MIDI Failed', err)
            );
        }
    }

    onMIDIMessage(message) {
        const [command, note, velocity] = message.data;
        if (command === 144 && velocity > 0) {
            this.handleNoteOn(note);
        } else if (command === 128 || (command === 144 && velocity === 0)) {
            this.handleNoteOff(note);
        }
    }

    handleNoteOn(midiNumber) {
        const key = this.container.querySelector(`#key-${midiNumber}`);
        if (key) key.style.fill = "#ff0055"; 
        
        startNote(this.getFrequency(midiNumber), midiNumber);
        
        // Track Press
        this.pressedNotes.add(midiNumber);
        this.updatePressedDisplay();
    }

    handleNoteOff(midiNumber) {
        const key = this.container.querySelector(`#key-${midiNumber}`);
        if (key) {
            const isHighlighted = this.isNoteHighlighted(midiNumber);
            const noteName = this.getNoteNameFromMidi(midiNumber);
            const isBlack = noteName.includes('#');

            if (isHighlighted) {
                key.style.fill = "var(--primary-cyan)";
            } else {
                key.style.fill = isBlack ? "#333" : "white";
            }
        }
        stopNote(midiNumber);
        
        // Track Release
        this.pressedNotes.delete(midiNumber);
        this.updatePressedDisplay();
    }
}