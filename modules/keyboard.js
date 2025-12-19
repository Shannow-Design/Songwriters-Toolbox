// modules/keyboard.js
import { getNoteIndex, getNotes } from './theory.js';
import { startNote, stopNote, INSTRUMENTS } from './audio.js'; // Import INSTRUMENTS

const START_MIDI_NOTE = 48; // C3
const NUM_KEYS = 25;        // C3 to C5
const SHARPS = getNotes();

export class Keyboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.display = document.getElementById('keyboard-info'); 
        this.select = document.getElementById('keyboard-instrument-select'); // Grab Dropdown

        this.highlightedIndices = []; 
        this.rootNoteIndex = -1; 
        this.pressedNotes = new Set(); 
        
        this.instrument = 'Lead Synth'; // Default

        this.initUI();
        this.render(); 
        this.initMIDI();
    }

    initUI() {
        // Populate Instrument Select
        if (this.select) {
            Object.keys(INSTRUMENTS).forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                this.select.appendChild(opt);
            });
            this.select.value = this.instrument;

            // Listener
            this.select.addEventListener('change', (e) => {
                this.instrument = e.target.value;
                // Focus container to prevent spacebar triggering dropdown
                if(this.container) this.container.focus();
            });
        }
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
                const { color, labelColor } = this.getKeyColor(midiNote);
                
                svg += `<rect id="key-${midiNote}" x="${x}" y="0" width="${keyWidth}" height="${keyHeight}" 
                        fill="${color}" stroke="black" stroke-width="1" class="piano-key white-key" 
                        data-note="${midiNote}" />`;
                
                if (this.isNoteHighlighted(midiNote)) {
                     svg += `<text x="${x + keyWidth/2}" y="${keyHeight - 10}" text-anchor="middle" font-size="10" pointer-events="none" fill="${labelColor}" font-weight="bold">${noteName}</text>`;
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
                    const { color } = this.getKeyColor(nextMidi);
                    
                    svg += `<rect id="key-${nextMidi}" x="${bx}" y="0" width="${keyWidth * 0.6}" height="${blackKeyHeight}" 
                            fill="${color}" stroke="black" class="piano-key black-key" 
                            data-note="${nextMidi}" />`;
                }
                whiteKeyX += keyWidth;
            }
        }

        svg += `</svg>`;
        this.container.innerHTML = svg;
        this.addMouseListeners();
    }

    getKeyColor(midiNote) {
        const isHighlighted = this.isNoteHighlighted(midiNote);
        const noteIndex = midiNote % 12;
        const isRoot = (noteIndex === this.rootNoteIndex);
        const noteName = this.getNoteNameFromMidi(midiNote);
        const isBlack = noteName.includes('#');

        let color = isBlack ? '#333' : 'white';
        let labelColor = '#333';

        if (isHighlighted) {
            if (isRoot) {
                color = 'var(--root-color)'; 
                labelColor = '#000';
            } else {
                color = 'var(--primary-cyan)'; 
                labelColor = '#000';
            }
        }
        return { color, labelColor };
    }

    highlightNotes(noteNames, label = null, rootNote = null) {
        this.highlightedIndices = noteNames.map(name => getNoteIndex(name));
        this.rootNoteIndex = rootNote ? getNoteIndex(rootNote) : -1;
        
        if (label) {
            this.updateDisplay(label);
        } else {
            this.updateDisplay(noteNames.join(' '));
        }
        this.render();
    }
    
    updateDisplay(text) {
        if (!this.display) return;
        this.display.textContent = text || "Ready";
        this.display.style.color = text ? "var(--primary-cyan)" : "#444";
    }

    updatePressedDisplay() {
        if (this.pressedNotes.size === 0) {
            // Keep the Scale/Chord name visible if nothing is pressed
            // or revert to Ready? Let's keep existing display unless empty.
            // If we want to show keys being pressed, we can override.
            // For now, let's just use it to show what keys are down.
            if(this.display.textContent.includes(",")) { 
                // Only reset if we were showing specific keys
                this.updateDisplay("Ready");
            }
            return;
        }
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
        this.rootNoteIndex = -1;
        this.render();
        this.updateDisplay("Ready");
    }

    getNoteNameFromMidi(midiNumber) {
        const noteIndex = midiNumber % 12;
        return SHARPS[noteIndex];
    }
    
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
        if (key) key.style.fill = "var(--accent-pink)"; 
        
        // Pass selected instrument to Audio Engine
        startNote(this.getFrequency(midiNumber), midiNumber, this.instrument);
        
        this.pressedNotes.add(midiNumber);
        this.updatePressedDisplay();
    }

    handleNoteOff(midiNumber) {
        const key = this.container.querySelector(`#key-${midiNumber}`);
        if (key) {
            const { color } = this.getKeyColor(midiNumber);
            key.style.fill = color;
        }
        stopNote(midiNumber);
        
        this.pressedNotes.delete(midiNumber);
        this.updatePressedDisplay();
    }
}