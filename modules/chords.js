// modules/chords.js
import { getNoteIndex, getNotes } from './theory.js';
import { playStrum } from './audio.js';

// --- CHORD DICTIONARY ---
// -1 = Mute (x), 0 = Open, 1-4 = Fret
const CHORD_SHAPES = {
    // --- MAJOR ---
    'C':  [-1, 3, 2, 0, 1, 0],
    'C#': [-1, 4, 3, 1, 2, 1], 'Db': [-1, 4, 3, 1, 2, 1], 
    'D':  [-1, -1, 0, 2, 3, 2],
    'D#': [-1, -1, 1, 3, 4, 3], 'Eb': [-1, -1, 1, 3, 4, 3], 
    'E':  [0, 2, 2, 1, 0, 0],
    'F':  [1, 3, 3, 2, 1, 1], 'F#': [2, 4, 4, 3, 2, 2], 'Gb': [2, 4, 4, 3, 2, 2], 
    'G':  [3, 2, 0, 0, 0, 3],
    'G#': [4, 6, 6, 5, 4, 4], 'Ab': [4, 6, 6, 5, 4, 4], 
    'A':  [-1, 0, 2, 2, 2, 0],
    'A#': [-1, 1, 3, 3, 3, 1], 'Bb': [-1, 1, 3, 3, 3, 1], 
    'B':  [-1, 2, 4, 4, 4, 2],

    // --- MINOR ---
    'Cm': [-1, 3, 5, 5, 4, 3],
    'C#m':[-1, 4, 6, 6, 5, 4], 'Dbm':[-1, 4, 6, 6, 5, 4],
    'Dm': [-1, -1, 0, 2, 3, 1],
    'D#m':[-1, -1, 1, 3, 4, 2], 'Ebm':[-1, -1, 1, 3, 4, 2],
    'Em': [0, 2, 2, 0, 0, 0],
    'Fm': [1, 3, 3, 1, 1, 1],
    'F#m':[2, 4, 4, 2, 2, 2], 'Gbm':[2, 4, 4, 2, 2, 2],
    'Gm': [3, 5, 5, 3, 3, 3],
    'G#m':[4, 6, 6, 4, 4, 4], 'Abm':[4, 6, 6, 4, 4, 4],
    'Am': [-1, 0, 2, 2, 1, 0],
    'A#m':[-1, 1, 3, 3, 2, 1], 'Bbm':[-1, 1, 3, 3, 2, 1],
    'Bm': [-1, 2, 4, 4, 3, 2],

    // --- DOMINANT 7th ---
    'C7': [-1, 3, 2, 3, 1, 0],
    'D7': [-1, -1, 0, 2, 1, 2],
    'E7': [0, 2, 0, 1, 0, 0],
    'F7': [1, 3, 1, 2, 1, 1],
    'G7': [3, 2, 0, 0, 0, 1],
    'A7': [-1, 0, 2, 0, 2, 0],
    'B7': [-1, 2, 1, 2, 0, 2],

    // --- SUS4 ---
    'Csus4': [-1, 3, 3, 0, 1, 1],
    'Dsus4': [-1, -1, 0, 2, 3, 3],
    'Esus4': [0, 2, 2, 2, 0, 0],
    'Fsus4': [1, 3, 3, 3, 1, 1],
    'Gsus4': [3, 3, 0, 0, 1, 3], 
    'Asus4': [-1, 0, 2, 2, 3, 0],
    'Bsus4': [-1, 2, 4, 4, 5, 2],

    // --- SUS2 ---
    'Csus2': [-1, 3, 0, 0, 1, -1],
    'Dsus2': [-1, -1, 0, 2, 3, 0],
    'Esus2': [0, 2, 4, 4, 0, 0],
    'Fsus2': [-1, -1, 3, 0, 1, 1],
    'Gsus2': [3, 0, 0, 0, 3, 3],
    'Asus2': [-1, 0, 2, 2, 0, 0],
    'Bsus2': [-1, 2, 4, 4, 2, 2],

    // --- DIMINISHED ---
    'Cdim': [-1, 3, 4, 2, 4, -1], 
    'Ddim': [-1, -1, 0, 1, 0, 1],
    'Edim': [0, 1, 2, 0, 2, 0], 
    'Fdim': [1, 2, 3, 1, 3, 1],
    'Gdim': [3, 4, 5, 3, 5, 3],
    'Adim': [-1, 0, 1, 2, 1, 2], 
    'Bdim': [-1, 2, 3, 4, 3, -1],
    'F#dim': [-1, -1, 4, 5, 4, 5],
    'G#dim': [4, -1, 3, 4, 3, -1]
};

const ROMAN_BASE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export class ChordRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    render(chords, capo, tuning, onChordClick, keyRoot) {
        this.container.innerHTML = '';
        const allNotes = getNotes(); // ['C', 'C#', ...]
        
        chords.forEach((chord, index) => {
            const card = document.createElement('div');
            card.className = 'chord-card';
            card.dataset.index = index;

            const roman = this.getRomanNumeral(index, chord.name);
            const romanEl = document.createElement('div');
            romanEl.className = 'chord-roman';
            romanEl.textContent = roman;

            const title = document.createElement('div');
            title.className = 'chord-title';
            title.textContent = chord.name;
            
            // --- CAPO LOGIC: CALCULATE RELATIVE SHAPE ---
            // 1. Identify the chord Suffix (m, 7, sus4, etc)
            const rootLen = chord.root.length;
            const suffix = chord.name.slice(rootLen);
            
            // 2. Transpose the Root DOWN by the Capo amount
            const rootIndex = getNoteIndex(chord.root);
            const relativeIndex = (rootIndex - capo + 12) % 12;
            const relativeRoot = allNotes[relativeIndex];
            
            // 3. Construct the "Shape Name" (e.g. Bb + m = Bbm)
            const relativeChordName = relativeRoot + suffix;
            
            // 4. Get that shape
            const shape = this.getChordShape(relativeChordName);
            
            // 5. Add helpful subtitle if transposed
            if (capo > 0) {
                const sub = document.createElement('div');
                sub.style.fontSize = '0.65rem';
                sub.style.color = '#666';
                sub.textContent = `(Shape: ${relativeChordName})`;
                card.appendChild(sub);
            }

            const diagram = this.createSVG(chord.name, capo, shape);
            
            card.appendChild(romanEl);
            card.appendChild(title);
            card.appendChild(diagram);
            
            card.addEventListener('click', () => {
                // Audio: Pass the RELATIVE shape (e.g. Bb) + CAPO (2) -> Result C Sound
                const frequencies = this.getFrequenciesFromShape(shape, tuning, capo);
                playStrum(frequencies, null, 'Acoustic Guitar'); 
                
                // Visuals: Pass the RELATIVE shape to the Fretboard
                if (onChordClick) onChordClick(chord.notes, chord.name, shape); 
            });
            
            this.container.appendChild(card);
        });
    }

    getRomanNumeral(index, chordName) {
        let base = ROMAN_BASE[index];
        if (chordName.includes('dim')) return base.toLowerCase() + '°';
        if (chordName.includes('m') && !chordName.includes('maj') && !chordName.includes('dim')) return base.toLowerCase();
        return base;
    }
    
    // Updated: Calculate pitch based on physical fret (Shape + Capo)
    getFrequenciesFromShape(shape, tuning, capo) {
        const frequencies = [];
        const allNotes = getNotes();
        
        // Loop through the 6 strings
        for(let s=0; s<6; s++) {
            const fret = shape[s];
            if (fret === -1) continue; // Muted string
            
            // Tuning array is usually Low E -> High E
            // shape array corresponds to strings 0-5
            const openNoteName = tuning[s];
            const openNoteIndex = getNoteIndex(openNoteName);
            
            // Calculate octave. Low E is E2 (index ~40 in MIDI)
            // This is a rough estimation for standard tuning octaves
            let baseOctave = 2;
            if (s >= 2) baseOctave = 3; // D, G
            if (s >= 4) baseOctave = 4; // B, E
            
            // Calculate absolute pitch index (0 = C0)
            const chromaticIndex = (baseOctave * 12) + openNoteIndex + fret + capo;
            
            // Convert to Hz
            // MIDI 69 = A4 (440Hz). 
            // Our chromaticIndex needs to map to MIDI. C0 is MIDI 12.
            const midiNote = chromaticIndex + 12; // Approximation
            const hz = 440 * Math.pow(2, (midiNote - 69) / 12);
            
            frequencies.push(hz);
        }
        return frequencies;
    }

    getChordShape(chordName) {
        let shape = CHORD_SHAPES[chordName];
        if (!shape) {
            const rootMatch = chordName.match(/^[A-G][#b]?/);
            if (rootMatch) {
                const root = rootMatch[0];
                let suffix = '';
                if (chordName.includes('sus4')) suffix = 'sus4';
                else if (chordName.includes('sus2')) suffix = 'sus2';
                else if (chordName.includes('m') && !chordName.includes('maj')) suffix = 'm';
                else if (chordName.includes('7')) suffix = '7';
                
                shape = CHORD_SHAPES[root + suffix] || CHORD_SHAPES[root + (chordName.includes('m') ? 'm' : '')];
            }
        }
        return shape || [-1, -1, -1, -1, -1, -1];
    }

    createSVG(chordName, capo, shape) {
        const width = 80; const height = 90; 
        let svgContent = '';
        if (capo > 0) svgContent += `<text x="40" y="10" text-anchor="middle" fill="#888" font-size="10">Capo ${capo}</text>`;

        const topY = 15;
        svgContent += `<line x1="10" y1="${topY}" x2="70" y2="${topY}" stroke="${capo > 0 ? '#888' : 'white'}" stroke-width="${capo > 0 ? 1 : 2}" />`;
        
        for(let i=1; i<=5; i++) { let y = topY + (i * 12); svgContent += `<line x1="10" y1="${y}" x2="70" y2="${y}" stroke="#444" stroke-width="1" />`; }
        for(let i=0; i<6; i++) { let x = 10 + (i * 12); svgContent += `<line x1="${x}" y1="${topY}" x2="${x}" y2="${topY + 60}" stroke="#555" stroke-width="1" />`; }

        let rootStringIndex = -1;
        for(let i=0; i<6; i++) { if (shape[i] !== -1) { rootStringIndex = i; break; } }

        shape.forEach((fret, stringIndex) => {
            const x = 10 + (stringIndex * 12);
            if (fret === -1) { svgContent += `<text x="${x}" y="${topY - 4}" text-anchor="middle" fill="#666" font-size="9">×</text>`; } 
            else if (fret === 0) { svgContent += `<circle cx="${x}" cy="${topY - 6}" r="2.5" stroke="#888" stroke-width="1.5" fill="none" />`; } 
            else {
                const y = topY + (fret * 12) - 6;
                const color = (stringIndex === rootStringIndex) ? '#ffb300' : '#00e5ff';
                svgContent += `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}"></circle>`;
            }
        });
        
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 80 100">${svgContent}</svg>`;
        return wrapper.firstElementChild;
    }
    
    highlightChord(index) {
        this.clearHighlights();
        const cards = this.container.querySelectorAll('.chord-card');
        if (cards[index]) cards[index].classList.add('active-playing');
    }
    
    clearHighlights() {
        const cards = this.container.querySelectorAll('.chord-card');
        cards.forEach(c => c.classList.remove('active-playing'));
    }
}