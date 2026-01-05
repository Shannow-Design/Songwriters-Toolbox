// modules/keyboard.js
import { getNoteIndex, getNotes } from './theory.js';
import { startNote, stopNote, INSTRUMENTS, setGlobalPitchBend, setGlobalModulation } from './audio.js'; 

const SHARPS = getNotes(); // ['C', 'C#', ...]

export class Keyboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.display = document.getElementById('keyboard-info'); 
        this.select = document.getElementById('keyboard-instrument-select'); 

        this.highlightedIndices = []; 
        this.rootNoteIndex = -1; 
        this.pressedNotes = new Set(); 
        
        // Performance State
        this.instrument = 'Lead Synth'; 
        this.octaveOffset = 0; 
        this.lastProgramChange = -1; 
        this.lastPCInputTime = 0; 
        this.pitchBend = 0; 
        this.modValue = 0; 

        // Layout State
        this.isFullSize = false; // Default to Compact (Rockband style)

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
        
        // Define Layout Parameters
        const startMidi = this.isFullSize ? 21 : 48; // A0 (21) vs C3 (48)
        const numKeys = this.isFullSize ? 88 : 25;
        
        const keyWidth = 40;
        const keyHeight = 120;
        const blackKeyHeight = 75;
        const blackKeyWidth = keyWidth * 0.6;

        // Calculate total width based on white keys
        let whiteKeyCount = 0;
        for(let i=0; i<numKeys; i++) {
            if (!this.getNoteNameFromMidi(startMidi + i).includes('#')) whiteKeyCount++;
        }
        const svgWidth = whiteKeyCount * keyWidth;

        let html = `
            <div class="kb-controls" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; padding:0 10px;">
                <div style="display:flex; align-items:center; gap:5px;">
                    <button class="kb-btn" id="btn-oct-down" style="font-weight:bold;">&lt;</button>
                    <span style="font-size:0.8rem; color:#888; font-family:monospace; min-width:60px; text-align:center;">
                        OCT: <span style="color:${this.octaveOffset !== 0 ? '#00e5ff' : '#fff'}">${this.octaveOffset > 0 ? '+' : ''}${this.octaveOffset}</span>
                    </span>
                    <button class="kb-btn" id="btn-oct-up" style="font-weight:bold;">&gt;</button>
                </div>

                <div style="flex:1; margin:0 15px; background:#222; height:6px; border-radius:3px; position:relative; overflow:hidden;">
                    <div id="touch-strip-bar" style="
                        position:absolute; top:0; bottom:0; left:50%; width:0%; 
                        background:linear-gradient(90deg, #ff0055, #00e5ff); 
                        transition: width 0.05s, left 0.05s;
                        opacity: 0.8;">
                    </div>
                </div>
                
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:0.6rem; color:#666;">TOUCH STRIP</span>
                    <button id="btn-size-toggle" style="background:#333; border:1px solid #555; color:#ccc; font-size:0.7rem; padding:2px 8px; border-radius:3px; cursor:pointer;">
                        ${this.isFullSize ? 'View Compact' : 'View Full (88)'}
                    </button>
                </div>
            </div>
        `;

        html += `<div style="position:relative; display:inline-block; min-width:${svgWidth}px;">`;
        let svg = `<svg width="${svgWidth}" height="${keyHeight}" viewBox="0 0 ${svgWidth} ${keyHeight}">`;
        
        // Pass 1: Draw White Keys
        let currentX = 0;
        const whiteKeyPositions = {}; // Map MIDI -> X position for black key placement

        for (let i = 0; i < numKeys; i++) {
            const midiNote = startMidi + i;
            const noteName = this.getNoteNameFromMidi(midiNote);
            
            if (!noteName.includes('#')) {
                const { color, labelColor } = this.getKeyColor(midiNote);
                svg += `<rect id="key-${midiNote}" x="${currentX}" y="0" width="${keyWidth}" height="${keyHeight}" 
                        fill="${color}" stroke="black" stroke-width="1" class="piano-key white-key" 
                        data-note="${midiNote}" />`;
                
                // Labels on Cs or Highlights
                if (this.isNoteHighlighted(midiNote) || noteName === 'C') {
                     const label = this.getNoteLabel(midiNote);
                     svg += `<text x="${currentX + keyWidth/2}" y="${keyHeight - 10}" text-anchor="middle" font-size="10" pointer-events="none" fill="${labelColor}" font-weight="bold">${label}</text>`;
                }
                
                whiteKeyPositions[midiNote] = currentX;
                currentX += keyWidth;
            }
        }

        // Pass 2: Draw Black Keys
        for (let i = 0; i < numKeys; i++) {
            const midiNote = startMidi + i;
            const noteName = this.getNoteNameFromMidi(midiNote);
            
            if (noteName.includes('#')) {
                // Position based on the PREVIOUS white key (midiNote - 1)
                const prevWhiteX = whiteKeyPositions[midiNote - 1];
                if (prevWhiteX !== undefined) {
                    const bx = prevWhiteX + (keyWidth * 0.65); // Offset to sit between keys
                    const { color } = this.getKeyColor(midiNote);
                    svg += `<rect id="key-${midiNote}" x="${bx}" y="0" width="${blackKeyWidth}" height="${blackKeyHeight}" 
                            fill="${color}" stroke="black" class="piano-key black-key" 
                            data-note="${midiNote}" />`;
                }
            }
        }

        svg += `</svg>`;
        html += svg + `</div>`;

        this.container.innerHTML = html;
        
        // Event Listeners
        this.container.querySelector('#btn-oct-down').addEventListener('click', () => this.shiftOctave(-1));
        this.container.querySelector('#btn-oct-up').addEventListener('click', () => this.shiftOctave(1));
        this.container.querySelector('#btn-size-toggle').addEventListener('click', () => {
            this.isFullSize = !this.isFullSize;
            this.render();
        });
        
        this.addMouseListeners();
        this.updateTouchStrip(); 
    }

    shiftOctave(delta) {
        this.octaveOffset += delta;
        if(this.octaveOffset < -3) this.octaveOffset = -3;
        if(this.octaveOffset > 3) this.octaveOffset = 3;
        this.render(); 
    }

    updateTouchStrip() {
        const bar = this.container.querySelector('#touch-strip-bar');
        if(!bar) return;
        
        if (this.modValue > 0.05) {
            bar.style.left = '0%';
            bar.style.width = `${this.modValue * 100}%`;
            bar.style.background = '#00ff55'; 
        } else {
            const width = Math.abs(this.pitchBend) * 50; 
            const left = 50 + (this.pitchBend < 0 ? -width : 0);
            bar.style.left = `${left}%`;
            bar.style.width = `${width}%`;
            bar.style.background = '#ff0055'; 
        }
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
        const noteNames = sortedMidi.map(m => this.getNoteLabel(m));
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

    getNoteNameFromMidi(midiNumber) { return SHARPS[midiNumber % 12]; }
    
    getNoteLabel(midiNumber) {
        const noteIndex = midiNumber % 12;
        const baseOctave = Math.floor(midiNumber / 12) - 1;
        const displayOctave = baseOctave + this.octaveOffset;
        return SHARPS[noteIndex] + displayOctave;
    }
    
    getFrequency(midiNumber) {
        const offsetMidi = midiNumber + (this.octaveOffset * 12);
        return 440 * Math.pow(2, (offsetMidi - 69) / 12);
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
                    this.attachInputs(midi);
                    midi.onstatechange = (e) => {
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
            input.onmidimessage = (msg) => this.onMIDIMessage(msg);
            found = true;
        });
        if(status) {
            status.style.background = found ? '#00ff00' : '#333';
            status.style.boxShadow = found ? '0 0 10px #00ff00' : 'none';
        }
    }

    onMIDIMessage(message) {
        const [status, data1, data2] = message.data;
        const command = status & 0xF0; 

        if (command === 144 && data2 > 0) {
            this.handleNoteOn(data1, data2); 
        } 
        else if (command === 128 || (command === 144 && data2 === 0)) {
            this.handleNoteOff(data1);
        }
        else if (command === 224) { 
            const value = (data2 << 7) + data1;
            this.pitchBend = (value - 8192) / 8192;
            setGlobalPitchBend(this.pitchBend); 
            this.updateTouchStrip();
        }
        else if (command === 176 && data1 === 1) {
            this.modValue = data2 / 127;
            setGlobalModulation(this.modValue);
            this.updateTouchStrip();
        }
        else if (command === 192) {
            const now = Date.now();
            if (now - this.lastPCInputTime > 50) {
                if (this.lastProgramChange !== -1) {
                    if (data1 > this.lastProgramChange) this.shiftOctave(1);
                    else if (data1 < this.lastProgramChange) this.shiftOctave(-1);
                }
                this.lastProgramChange = data1;
                this.lastPCInputTime = now;
            }
        }
    }

    handleNoteOn(midiNumber, velocity = 127) {
        // Visuals: Check if key is currently rendered
        const key = this.container.querySelector(`#key-${midiNumber}`);
        if (key) {
            const opacity = 0.5 + (velocity / 255); 
            key.style.fill = `rgba(255, 0, 85, ${opacity})`;
        }
        
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