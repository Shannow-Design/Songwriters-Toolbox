// modules/keyboard.js
import { getNoteIndex, getNotes } from './theory.js';
import { startNote, stopNote, INSTRUMENTS } from './audio.js'; 

const START_MIDI_NOTE = 48; // C3
const NUM_KEYS = 25;        // C3 to C5
const SHARPS = getNotes();

export class Keyboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.display = document.getElementById('keyboard-info'); 
        this.select = document.getElementById('keyboard-instrument-select'); 

        this.highlightedIndices = []; 
        this.rootNoteIndex = -1; 
        this.pressedNotes = new Set(); 
        
        this.instrument = 'Lead Synth'; 

        this.initUI();
        this.render(); 
        this.initMIDI();
    }

    initUI() {
        if (this.select) {
            Object.keys(INSTRUMENTS).forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                this.select.appendChild(opt);
            });
            this.select.value = this.instrument;

            this.select.addEventListener('change', (e) => {
                this.instrument = e.target.value;
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
        
        if (label) this.updateDisplay(label);
        else this.updateDisplay(noteNames.join(' '));
        this.render();
    }
    
    updateDisplay(text) {
        if (!this.display) return;
        this.display.textContent = text || "Ready";
        this.display.style.color = text ? "var(--primary-cyan)" : "#444";
    }

    updatePressedDisplay() {
        if (this.pressedNotes.size === 0) {
            if(this.display.textContent.includes(",")) this.updateDisplay("Ready");
            return;
        }
        const sortedMidi = Array.from(this.pressedNotes).sort((a,b) => a - b);
        const noteNames = sortedMidi.map(m => this.getNoteNameWithOctave(m));
        this.updateDisplay(noteNames.join(', '));
    }

    isNoteHighlighted(midiNumber) {
        return this.highlightedIndices.includes(midiNumber % 12);
    }
    
    clearHighlights() {
        this.highlightedIndices = [];
        this.rootNoteIndex = -1;
        this.render();
        this.updateDisplay("Ready");
    }

    getNoteNameFromMidi(midiNumber) {
        return SHARPS[midiNumber % 12];
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

    // --- MIDI LOGIC UPDATED ---
    initMIDI() {
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess().then(
                (midi) => {
                    // 1. Attach Initial Inputs
                    this.attachInputs(midi);

                    // 2. Listen for "Hot Swapping" (Turning on device after load)
                    midi.onstatechange = (e) => {
                        console.log('MIDI State Change:', e.port.name, e.port.state);
                        this.attachInputs(midi);
                    };
                },
                (err) => console.log('MIDI Init Failed:', err)
            );
        }
    }

    attachInputs(midi) {
        const status = document.getElementById('midi-status-light');
        let found = false;
        
        midi.inputs.forEach(input => {
            // Re-bind message handler to ensure we catch it
            input.onmidimessage = (msg) => this.onMIDIMessage(msg);
            found = true;
            console.log("MIDI Device Attached:", input.name);
        });

        if(status) {
            status.style.background = found ? '#00ff00' : '#333';
            status.style.boxShadow = found ? '0 0 10px #00ff00' : 'none';
        }
    }

    onMIDIMessage(message) {
        const [status, note, velocity] = message.data;
        
        // MASK CHANNEL: 0xF0 ignores the channel number (0-15)
        // Note On is 0x90-0x9F (144-159)
        // Note Off is 0x80-0x8F (128-143)
        const command = status & 0xF0; 

        if (command === 144 && velocity > 0) {
            this.handleNoteOn(note);
        } else if (command === 128 || (command === 144 && velocity === 0)) {
            this.handleNoteOff(note);
        }
    }

    handleNoteOn(midiNumber) {
        const key = this.container.querySelector(`#key-${midiNumber}`);
        if (key) key.style.fill = "var(--accent-pink)"; 
        
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