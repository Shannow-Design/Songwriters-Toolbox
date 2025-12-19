// modules/chords.js
import { getNoteIndex, getNotes } from './theory.js';
import { playStrum } from './audio.js';

// --- CHORD DICTIONARY ---
// -1 = Mute (x), 0 = Open, 1-4 = Fret
const CHORD_SHAPES = {
    // Major
    'C':  [-1, 3, 2, 0, 1, 0],
    'C#': [-1, 4, 3, 1, 2, 1], 
    'Db': [-1, 4, 3, 1, 2, 1], 
    'D':  [-1, -1, 0, 2, 3, 2],
    'D#': [-1, -1, 1, 3, 4, 3],
    'Eb': [-1, -1, 1, 3, 4, 3], 
    'E':  [0, 2, 2, 1, 0, 0],
    'F':  [1, 3, 3, 2, 1, 1], 
    'F#': [2, 4, 4, 3, 2, 2],
    'Gb': [2, 4, 4, 3, 2, 2], 
    'G':  [3, 2, 0, 0, 0, 3],
    'G#': [4, 6, 6, 5, 4, 4],
    'Ab': [4, 6, 6, 5, 4, 4], 
    'A':  [-1, 0, 2, 2, 2, 0],
    'A#': [-1, 1, 3, 3, 3, 1],
    'Bb': [-1, 1, 3, 3, 3, 1], 
    'B':  [-1, 2, 4, 4, 4, 2],

    // Minor
    'Cm': [-1, 3, 5, 5, 4, 3],
    'C#m':[-1, 4, 6, 6, 5, 4],
    'Dbm':[-1, 4, 6, 6, 5, 4],
    'Dm': [-1, -1, 0, 2, 3, 1],
    'D#m':[-1, -1, 1, 3, 4, 2],
    'Ebm':[-1, -1, 1, 3, 4, 2],
    'Em': [0, 2, 2, 0, 0, 0],
    'Fm': [1, 3, 3, 1, 1, 1],
    'F#m':[2, 4, 4, 2, 2, 2],
    'Gbm':[2, 4, 4, 2, 2, 2],
    'Gm': [3, 5, 5, 3, 3, 3],
    'G#m':[4, 6, 6, 4, 4, 4],
    'Abm':[4, 6, 6, 4, 4, 4],
    'Am': [-1, 0, 2, 2, 1, 0],
    'A#m':[-1, 1, 3, 3, 2, 1],
    'Bbm':[-1, 1, 3, 3, 2, 1],
    'Bm': [-1, 2, 4, 4, 3, 2],

    // Diminished
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

// Base Roman Numerals (1-7)
const ROMAN_BASE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export class ChordRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    render(chords, capo, tuning, onChordClick, keyRoot) {
        this.container.innerHTML = '';
        
        chords.forEach((chord, index) => {
            const card = document.createElement('div');
            card.className = 'chord-card';
            card.dataset.index = index;

            // 1. Roman Numeral Header
            const roman = this.getRomanNumeral(index, chord.name);
            const romanEl = document.createElement('div');
            romanEl.className = 'chord-roman';
            romanEl.textContent = roman;

            // 2. Chord Title
            const title = document.createElement('div');
            title.className = 'chord-title';
            title.textContent = chord.name;
            
            // 3. Diagram
            const diagram = this.createSVG(chord.name, capo);
            
            // Append Order: Roman -> Title -> Diagram
            card.appendChild(romanEl);
            card.appendChild(title);
            card.appendChild(diagram);
            
            card.addEventListener('click', () => {
                const frequencies = this.getFrequencies(chord, keyRoot, tuning);
                playStrum(frequencies); 
                if (onChordClick) onChordClick(chord.notes);
            });
            
            this.container.appendChild(card);
        });
    }

    // NEW: Smart Roman Numeral Generator
    getRomanNumeral(index, chordName) {
        let base = ROMAN_BASE[index];
        
        if (chordName.includes('dim')) {
            // Diminished: lowercase + degree symbol
            return base.toLowerCase() + '°';
        } else if (chordName.includes('m') && !chordName.includes('maj')) {
            // Minor: lowercase
            return base.toLowerCase();
        } else {
            // Major: keep uppercase
            return base;
        }
    }
    
    getFrequencies(chord, keyRoot, tuning) {
        const chordRootName = chord.root;
        const keyIndex = getNoteIndex(keyRoot);
        const chordRootIndex = getNoteIndex(chordRootName);

        let chordBaseOctave = 3;
        if (chordRootIndex < keyIndex) {
            chordBaseOctave = 4;
        }

        return chord.notes.map(noteName => {
            const noteIndex = getNoteIndex(noteName);
            let noteOctave = chordBaseOctave;
            if (noteIndex < chordRootIndex) {
                noteOctave += 1;
            }
            const semitones = (noteIndex - 9) + ((noteOctave - 4) * 12);
            return 440 * Math.pow(2, semitones / 12);
        });
    }

    createSVG(chordName, capo) {
        const width = 80;
        const height = 90; 
        
        let shape = CHORD_SHAPES[chordName];
        if (!shape) {
            const rootMatch = chordName.match(/^[A-G][#b]?/);
            if (rootMatch) {
                const root = rootMatch[0];
                const isMinor = chordName.includes('m') && !chordName.includes('maj');
                const genericName = root + (isMinor ? 'm' : '');
                shape = CHORD_SHAPES[genericName];
            }
        }
        if (!shape) shape = [-1, -1, -1, -1, -1, -1]; 

        let svgContent = '';
        if (capo > 0) {
            svgContent += `<text x="40" y="10" text-anchor="middle" fill="#888" font-size="10">Capo ${capo}</text>`;
        }

        const topY = 15;
        svgContent += `<line x1="10" y1="${topY}" x2="70" y2="${topY}" stroke="${capo > 0 ? '#888' : 'white'}" stroke-width="${capo > 0 ? 1 : 2}" />`;
        
        for(let i=1; i<=5; i++) {
            let y = topY + (i * 12); 
            svgContent += `<line x1="10" y1="${y}" x2="70" y2="${y}" stroke="#444" stroke-width="1" />`;
        }
        
        for(let i=0; i<6; i++) {
            let x = 10 + (i * 12); 
            svgContent += `<line x1="${x}" y1="${topY}" x2="${x}" y2="${topY + 60}" stroke="#555" stroke-width="1" />`;
        }

        let rootStringIndex = -1;
        for(let i=0; i<6; i++) {
            if (shape[i] !== -1) {
                rootStringIndex = i;
                break;
            }
        }

        shape.forEach((fret, stringIndex) => {
            const x = 10 + (stringIndex * 12);
            
            if (fret === -1) {
                svgContent += `<text x="${x}" y="${topY - 4}" text-anchor="middle" fill="#666" font-size="9" font-family="sans-serif">×</text>`;
            } else if (fret === 0) {
                svgContent += `<circle cx="${x}" cy="${topY - 6}" r="2.5" stroke="#888" stroke-width="1.5" fill="none" />`;
            } else {
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
        if (cards[index]) {
            cards[index].classList.add('active-playing');
        }
    }
    
    clearHighlights() {
        const cards = this.container.querySelectorAll('.chord-card');
        cards.forEach(c => c.classList.remove('active-playing'));
    }
}