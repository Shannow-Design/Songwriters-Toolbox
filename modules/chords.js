// modules/chords.js
import { getNoteIndex, getNotes } from './theory.js';
import { playStrum } from './audio.js';

const CHORD_SHAPES = {
    'C':[-1,3,2,0,1,0], 'C#':[-1,4,3,1,2,1], 'Db':[-1,4,3,1,2,1], 'D':[-1,-1,0,2,3,2], 'D#':[-1,-1,1,3,4,3], 'Eb':[-1,-1,1,3,4,3], 'E':[0,2,2,1,0,0], 'F':[1,3,3,2,1,1], 'F#':[2,4,4,3,2,2], 'Gb':[2,4,4,3,2,2], 'G':[3,2,0,0,0,3], 'G#':[4,6,6,5,4,4], 'Ab':[4,6,6,5,4,4], 'A':[-1,0,2,2,2,0], 'A#':[-1,1,3,3,3,1], 'Bb':[-1,1,3,3,3,1], 'B':[-1,2,4,4,4,2],
    'Cm':[-1,3,5,5,4,3], 'C#m':[-1,4,6,6,5,4], 'Dbm':[-1,4,6,6,5,4], 'Dm':[-1,-1,0,2,3,1], 'D#m':[-1,-1,1,3,4,2], 'Ebm':[-1,-1,1,3,4,2], 'Em':[0,2,2,0,0,0], 'Fm':[1,3,3,1,1,1], 'F#m':[2,4,4,2,2,2], 'Gbm':[2,4,4,2,2,2], 'Gm':[3,5,5,3,3,3], 'G#m':[4,6,6,4,4,4], 'Abm':[4,6,6,4,4,4], 'Am':[-1,0,2,2,1,0], 'A#m':[-1,1,3,3,2,1], 'Bbm':[-1,1,3,3,2,1], 'Bm':[-1,2,4,4,3,2],
    'C7':[-1,3,2,3,1,0], 'D7':[-1,-1,0,2,1,2], 'E7':[0,2,0,1,0,0], 'F7':[1,3,1,2,1,1], 'G7':[3,2,0,0,0,1], 'A7':[-1,0,2,0,2,0], 'B7':[-1,2,1,2,0,2],
    'Csus4':[-1,3,3,0,1,1], 'Dsus4':[-1,-1,0,2,3,3], 'Esus4':[0,2,2,2,0,0], 'Fsus4':[1,3,3,3,1,1], 'Gsus4':[3,3,0,0,1,3], 'Asus4':[-1,0,2,2,3,0], 'Bsus4':[-1,2,4,4,5,2],
    'Csus2':[-1,3,0,0,1,-1], 'Dsus2':[-1,-1,0,2,3,0], 'Esus2':[0,2,4,4,0,0], 'Fsus2':[-1,-1,3,0,1,1], 'Gsus2':[3,0,0,0,3,3], 'Asus2':[-1,0,2,2,0,0], 'Bsus2':[-1,2,4,4,2,2],
    'Cdim':[-1,3,4,2,4,-1], 'Ddim':[-1,-1,0,1,0,1], 'Edim':[0,1,2,0,2,0], 'Fdim':[1,2,3,1,3,1], 'Gdim':[3,4,5,3,5,3], 'Adim':[-1,0,1,2,1,2], 'Bdim':[-1,2,3,4,3,-1], 'F#dim':[-1,-1,4,5,4,5], 'G#dim':[4,-1,3,4,3,-1]
};

const ROMAN_BASE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export class ChordRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.highlightedIndex = -1;
    }

    render(chords, capo, tuning, onChordClick, keyRoot) {
        this.container.innerHTML = '';
        if (!chords || chords.length === 0) return;

        chords.forEach((chord, index) => {
            const card = document.createElement('div');
            card.className = 'chord-card';
            const uiIndex = (chord.index !== undefined) ? chord.index : index;
            card.dataset.index = uiIndex;

            if (uiIndex === this.highlightedIndex) card.classList.add('active-playing');

            if (chord.isBorrowed) {
                card.style.borderColor = "#442233";
                card.style.background = "#221111";
            }

            let roman = chord.roman;
            if (!roman) roman = this.getRomanNumeral(index % 7, chord.name);

            const romanEl = document.createElement('div');
            romanEl.className = 'chord-roman';
            romanEl.style.color = chord.isBorrowed ? '#ff5555' : '#888';
            romanEl.textContent = roman;

            const title = document.createElement('div');
            title.className = 'chord-title';
            title.textContent = chord.name;
            
            const isStandard = tuning.join(',') === 'E,A,D,G,B,E' && capo === 0;
            let shape;
            
            if (isStandard) {
                shape = this.getChordShape(chord.name);
            } else {
                shape = this.generateDynamicShape(chord.notes, chord.root, tuning, capo);
            }

            const diagram = this.createSVG(chord.name, capo, shape);
            
            card.appendChild(romanEl);
            card.appendChild(title);
            card.appendChild(diagram);
            
            card.addEventListener('click', () => {
                const frequencies = this.getFrequenciesFromShape(shape, tuning, capo);
                playStrum(frequencies, null, 'Acoustic Guitar'); 
                if (onChordClick) onChordClick(chord.notes, chord.name, shape); 
            });
            
            this.container.appendChild(card);
        });
    }

    generateDynamicShape(chordNotes, rootNote, tuning, capo) {
        const shape = [-1, -1, -1, -1, -1, -1];
        const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        const normalize = n => {
            const ENHARMONIC_MAP = { 'Cb': 'B', 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
            return ENHARMONIC_MAP[n] || n;
        };

        const tuningIdx = tuning.map(n => SHARPS.indexOf(normalize(n)));
        const rootIdx = SHARPS.indexOf(normalize(rootNote));
        const chordIdxs = chordNotes.map(n => SHARPS.indexOf(normalize(n)));

        let rootString = -1;
        let rootFret = -1;

        // 1. Anchor the Root Note
        for (let s = 0; s < tuning.length - 2; s++) {
            const openIdx = tuningIdx[s];
            for (let f = capo; f <= capo + 4; f++) {
                if ((openIdx + f) % 12 === rootIdx) {
                    rootString = s;
                    rootFret = f;
                    break;
                }
            }
            if (rootString !== -1) break;
        }

        if (rootString === -1) {
            rootString = 0;
            let diff = (rootIdx - tuningIdx[0] + 12) % 12;
            while (diff < capo) diff += 12;
            rootFret = diff;
        }

        shape[rootString] = rootFret;

        const minFret = Math.max(capo, rootFret - 2);
        const maxFret = Math.max(capo + 4, rootFret + 2); 

        let unplayedNotes = [...chordIdxs];
        unplayedNotes = unplayedNotes.filter(n => n !== rootIdx);

        // 2. Map out the remaining strings
        for (let s = rootString + 1; s < tuning.length; s++) {
            const openIdx = tuningIdx[s];
            let bestFret = -1;

            if (chordIdxs.includes((openIdx + capo) % 12)) {
                bestFret = capo;
                const noteAtFret = (openIdx + capo) % 12;
                unplayedNotes = unplayedNotes.filter(n => n !== noteAtFret);
            } else {
                for (let f = minFret; f <= maxFret; f++) {
                    if (f === capo) continue; 
                    const noteAtFret = (openIdx + f) % 12;
                    if (unplayedNotes.includes(noteAtFret)) {
                        bestFret = f;
                        unplayedNotes = unplayedNotes.filter(n => n !== noteAtFret);
                        break;
                    }
                }
                
                if (bestFret === -1) {
                    for (let f = minFret; f <= maxFret; f++) {
                        if (f === capo) continue;
                        const noteAtFret = (openIdx + f) % 12;
                        if (chordIdxs.includes(noteAtFret)) {
                            bestFret = f;
                            break;
                        }
                    }
                }
            }
            shape[s] = bestFret;
        }

        return shape;
    }

    getRomanNumeral(index, chordName) {
        if(index >= ROMAN_BASE.length) return '?';
        let base = ROMAN_BASE[index];
        if (chordName.includes('dim')) return base.toLowerCase() + '°';
        if (chordName.includes('m') && !chordName.includes('maj') && !chordName.includes('dim')) return base.toLowerCase();
        return base;
    }
    
    getFrequenciesFromShape(shape, tuning, capo) {
        const frequencies = [];
        const allNotes = getNotes();
        for(let s=0; s<6; s++) {
            const fret = shape[s];
            if (fret === -1) continue; 
            const openNoteName = tuning[s];
            const openNoteIndex = getNoteIndex(openNoteName);
            let baseOctave = 2;
            if (s >= 2) baseOctave = 3; 
            if (s >= 4) baseOctave = 4; 
            
            const absoluteFret = fret;
            
            const chromaticIndex = (baseOctave * 12) + openNoteIndex + absoluteFret;
            const midiNote = chromaticIndex + 12; 
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
        const width = 80; const height = 100; 
        let svgContent = '';
        
        let minFret = 99;
        let maxFret = 0;
        shape.forEach(f => {
            if (f !== -1 && f !== 0 && f !== capo) {
                if (f < minFret) minFret = f;
                if (f > maxFret) maxFret = f;
            }
        });

        // FIXED: Shift the logical window so Space 0 maps to Capo + 1
        let startFret = capo > 0 ? capo + 1 : 1;
        if (maxFret - startFret > 3 && minFret > (capo > 0 ? capo : 0)) { 
            startFret = minFret;
        }

        let label = '';
        if (capo > 0 && startFret === capo + 1) label = `Capo ${capo}`;
        else if (startFret > 1) label = `${startFret}fr`;
        
        // Render Text safely away from string indicators
        if (label) {
            svgContent += `<text x="40" y="8" text-anchor="middle" fill="#888" font-size="9">${label}</text>`;
        }

        const topY = 18; 
        const isNut = (startFret === 1 && capo === 0);
        svgContent += `<line x1="10" y1="${topY}" x2="70" y2="${topY}" stroke="${!isNut ? '#888' : 'white'}" stroke-width="${!isNut ? 1 : 2}" />`;
        
        for(let i=1; i<=4; i++) { 
            let y = topY + (i * 15); 
            svgContent += `<line x1="10" y1="${y}" x2="70" y2="${y}" stroke="#444" stroke-width="1" />`; 
        }
        for(let i=0; i<6; i++) { 
            let x = 10 + (i * 12); 
            svgContent += `<line x1="${x}" y1="${topY}" x2="${x}" y2="${topY + 60}" stroke="#555" stroke-width="1" />`; 
        }
        
        let rootStringIndex = -1;
        for(let i=0; i<6; i++) { if (shape[i] !== -1) { rootStringIndex = i; break; } }
        
        shape.forEach((fret, stringIndex) => {
            const x = 10 + (stringIndex * 12);
            if (fret === -1) { 
                svgContent += `<text x="${x}" y="${topY - 4}" text-anchor="middle" fill="#666" font-size="9">×</text>`; 
            } 
            else if (fret === 0 || fret === capo) { 
                svgContent += `<circle cx="${x}" cy="${topY - 5}" r="2.5" stroke="#888" stroke-width="1.5" fill="none" />`; 
            } 
            else {
                const relativePos = fret - startFret;
                const y = topY + (relativePos * 15) + 7.5;
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
        const card = this.container.querySelector(`.chord-card[data-index="${index}"]`);
        if (card) {
            this.highlightedIndex = index;
            card.classList.add('active-playing');
        }
    }
    
    clearHighlights() {
        this.highlightedIndex = -1;
        this.container.querySelectorAll('.chord-card').forEach(c => c.classList.remove('active-playing'));
    }
}