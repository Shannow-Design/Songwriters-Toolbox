// modules/keyboard.js
import { getNoteIndex, getNotes } from './theory.js';
import { startNote, stopNote, INSTRUMENTS, setGlobalPitchBend, setGlobalModulation } from './audio.js'; 

const SHARPS = getNotes(); // ['C', 'C#', ...]

export class Keyboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.display = document.getElementById('keyboard-info'); 
        this.select = document.getElementById('keyboard-instrument-select'); 

        // Visual State
        this.displayMode = 'chord'; // 'chord' or 'lead'
        
        // Data Stores
        this.chordData = { notes: new Set(), root: -1, label: "Ready" };
        this.leadData = { notes: new Set(), root: -1, label: "" };
        
        this.pressedNotes = new Set(); 
        
        // Performance State
        this.instrument = 'Lead Synth'; 
        this.octaveOffset = 0; // Acts as VIEW OFFSET (Scroll), not Pitch Transpose
        this.lastProgramChange = -1; 
        this.lastPCInputTime = 0; 
        this.pitchBend = 0; 
        this.modValue = 0; 

        // Layout State: 'compact', 'full', 'mini'
        this.sizeMode = 'compact'; 

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
        
        let baseStart, numKeys, sizeLabel;

        // 1. Determine Size Params
        switch(this.sizeMode) {
            case 'full':
                baseStart = 21; // A0
                numKeys = 88;
                sizeLabel = "Full (88)";
                break;
            case 'mini':
                baseStart = 48; // C3
                numKeys = 25;   // 2 Octaves + C
                sizeLabel = "Mini (25)";
                break;
            case 'compact':
            default:
                baseStart = 36; // C2
                numKeys = 49;   // 4 Octaves
                sizeLabel = "Compact (49)";
                break;
        }
        
        // FIX: Shift the visible start note based on Octave Offset
        // This effectively "Scrolls" the keyboard view
        const startMidi = baseStart + (this.octaveOffset * 12);
        
        const keyWidth = 30;
        const keyHeight = 120;
        const blackKeyHeight = 75;
        const blackKeyWidth = keyWidth * 0.6;

        let whiteKeyCount = 0;
        for(let i=0; i<numKeys; i++) {
            if (!this.getNoteNameFromMidi(startMidi + i).includes('#')) whiteKeyCount++;
        }
        const svgWidth = whiteKeyCount * keyWidth;

        const modeBtnColor = this.displayMode === 'lead' ? '#ff0055' : '#444';
        const modeBtnText = this.displayMode === 'lead' ? 'View: Lead' : 'View: Chord';

        let html = `
            <div class="kb-controls" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; padding:0 10px;">
                <div style="display:flex; align-items:center; gap:5px;">
                    <button class="kb-btn" id="btn-oct-down" style="font-weight:bold;">&lt;</button>
                    <span style="font-size:0.8rem; color:#888; font-family:monospace; min-width:60px; text-align:center;">
                        View: <span style="color:${this.octaveOffset !== 0 ? '#00e5ff' : '#fff'}">${this.octaveOffset > 0 ? '+' : ''}${this.octaveOffset}</span>
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
                    <button id="btn-mode-toggle" style="background:${modeBtnColor}; border:1px solid #555; color:#fff; font-size:0.7rem; padding:2px 8px; border-radius:3px; cursor:pointer; min-width:80px;">
                        ${modeBtnText}
                    </button>
                    <button id="btn-size-toggle" style="background:#333; border:1px solid #555; color:#ccc; font-size:0.7rem; padding:2px 8px; border-radius:3px; cursor:pointer; min-width:80px;">
                        ${sizeLabel}
                    </button>
                </div>
            </div>
        `;

        html += `<div style="position:relative; display:inline-block; min-width:${svgWidth}px; overflow-x:auto;">`;
        let svg = `<svg width="${svgWidth}" height="${keyHeight}" viewBox="0 0 ${svgWidth} ${keyHeight}">`;
        
        let currentX = 0;
        const whiteKeyPositions = {}; 

        // Draw White Keys
        for (let i = 0; i < numKeys; i++) {
            const midiNote = startMidi + i;
            const noteName = this.getNoteNameFromMidi(midiNote);
            
            if (!noteName.includes('#')) {
                const { color, labelColor } = this.getKeyColor(midiNote);
                svg += `<rect id="key-${midiNote}" x="${currentX}" y="0" width="${keyWidth}" height="${keyHeight}" 
                        fill="${color}" stroke="black" stroke-width="1" class="piano-key white-key" 
                        data-note="${midiNote}" />`;
                
                if (noteName === 'C' || this.isNoteHighlighted(midiNote)) {
                     const label = this.getNoteLabel(midiNote);
                     svg += `<text x="${currentX + keyWidth/2}" y="${keyHeight - 10}" text-anchor="middle" font-size="9" pointer-events="none" fill="${labelColor}" font-weight="bold">${label}</text>`;
                }
                
                whiteKeyPositions[midiNote] = currentX;
                currentX += keyWidth;
            }
        }

        // Draw Black Keys
        for (let i = 0; i < numKeys; i++) {
            const midiNote = startMidi + i;
            const noteName = this.getNoteNameFromMidi(midiNote);
            
            if (noteName.includes('#')) {
                const prevWhiteX = whiteKeyPositions[midiNote - 1];
                if (prevWhiteX !== undefined) {
                    const bx = prevWhiteX + (keyWidth * 0.65); 
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
        
        // Listeners
        this.container.querySelector('#btn-oct-down').addEventListener('click', () => this.shiftOctave(-1));
        this.container.querySelector('#btn-oct-up').addEventListener('click', () => this.shiftOctave(1));
        
        this.container.querySelector('#btn-size-toggle').addEventListener('click', () => {
            if (this.sizeMode === 'compact') this.sizeMode = 'full';
            else if (this.sizeMode === 'full') this.sizeMode = 'mini';
            else this.sizeMode = 'compact';
            this.render();
        });
        
        this.container.querySelector('#btn-mode-toggle').addEventListener('click', () => {
            this.displayMode = (this.displayMode === 'chord') ? 'lead' : 'chord';
            if (this.displayMode === 'chord') this.updateDisplay(this.chordData.label);
            else this.updateDisplay(this.leadData.label || "Lead Ready");
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
            bar.style.left = '0%'; bar.style.width = `${this.modValue * 100}%`; bar.style.background = '#00ff55'; 
        } else {
            const width = Math.abs(this.pitchBend) * 50; const left = 50 + (this.pitchBend < 0 ? -width : 0);
            bar.style.left = `${left}%`; bar.style.width = `${width}%`; bar.style.background = '#ff0055'; 
        }
    }

    getKeyColor(midiNote) {
        const isHighlighted = this.isNoteHighlighted(midiNote);
        const noteIndex = midiNote % 12;
        const noteName = this.getNoteNameFromMidi(midiNote);
        const isBlack = noteName.includes('#');

        let color = isBlack ? '#333' : 'white';
        let labelColor = '#333';

        let isRoot = false;
        if (this.displayMode === 'chord') {
            isRoot = (noteIndex === this.chordData.root);
        } else {
            isRoot = this.leadData.notes.has(midiNote);
        }

        if (isHighlighted) {
            if (isRoot) {
                color = 'var(--root-color)'; // Gold
                labelColor = '#000';
            } else {
                color = (this.displayMode === 'lead') ? '#ff0055' : 'var(--primary-cyan)'; 
                labelColor = '#000';
            }
        }
        return { color, labelColor };
    }

    highlightNotes(noteNames, label = null, rootNote = null) {
        this.chordData.notes.clear();
        noteNames.forEach(name => this.chordData.notes.add(getNoteIndex(name)));
        this.chordData.root = rootNote ? getNoteIndex(rootNote) : -1;
        this.chordData.label = label || "";

        if (this.displayMode === 'chord') {
            this.updateDisplay(label || noteNames.join(' '));
            this.render();
        }
    }

    highlightLeadNote(midiNumber, label = null) {
        this.leadData.notes.clear();
        if (midiNumber !== null && midiNumber !== undefined) {
            this.leadData.notes.add(midiNumber);
            const noteName = this.getNoteLabel(midiNumber);
            this.leadData.label = label || `Lead: ${noteName}`;
        } else {
            this.leadData.label = "";
        }

        if (this.displayMode === 'lead') {
            this.updateDisplay(this.leadData.label);
            this.render();
        }
    }
    
    updateDisplay(text) {
        if (!this.display) return;
        this.display.textContent = text || "Ready";
        this.display.style.color = text ? (this.displayMode === 'lead' ? '#ff0055' : "var(--primary-cyan)") : "#444";
    }

    updatePressedDisplay() {
        if (this.pressedNotes.size === 0) {
            if (this.displayMode === 'chord') this.updateDisplay(this.chordData.label);
            else this.updateDisplay(this.leadData.label);
            return;
        }
        const sortedMidi = Array.from(this.pressedNotes).sort((a,b) => a - b);
        const noteNames = sortedMidi.map(m => this.getNoteLabel(m));
        this.updateDisplay(noteNames.join(', '));
    }

    isNoteHighlighted(midiNumber) {
        if (this.displayMode === 'chord') {
            return this.chordData.notes.has(midiNumber % 12);
        } else {
            return this.leadData.notes.has(midiNumber);
        }
    }
    
    clearHighlights() {
        this.chordData.notes.clear();
        this.chordData.label = "";
        this.leadData.notes.clear();
        this.leadData.label = "";
        this.render();
        this.updateDisplay("Ready");
    }

    getNoteNameFromMidi(midiNumber) { return SHARPS[midiNumber % 12]; }
    
    getNoteLabel(midiNumber) {
        const noteIndex = midiNumber % 12;
        const octave = Math.floor(midiNumber / 12) - 1;
        // FIX: Do not add offset here; visual keys are already shifted
        return SHARPS[noteIndex] + octave;
    }
    
    getFrequency(midiNumber) {
        // FIX: Do not add offset here; visual keys already represent true MIDI
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
                (midi) => { this.attachInputs(midi); midi.onstatechange = (e) => { this.attachInputs(midi); }; },
                (err) => console.log('MIDI Init Failed:', err)
            );
        }
    }

    attachInputs(midi) {
        const status = document.getElementById('midi-status-light');
        let found = false;
        midi.inputs.forEach(input => { input.onmidimessage = (msg) => this.onMIDIMessage(msg); found = true; });
        if(status) {
            status.style.background = found ? '#00ff00' : '#333';
            status.style.boxShadow = found ? '0 0 10px #00ff00' : 'none';
        }
    }

    onMIDIMessage(message) {
        const [status, data1, data2] = message.data;
        const command = status & 0xF0; 
        if (command === 144 && data2 > 0) { this.handleNoteOn(data1, data2); } 
        else if (command === 128 || (command === 144 && data2 === 0)) { this.handleNoteOff(data1); }
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
            // Allow MIDI controller to scroll the visual keyboard
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