// modules/fretboard.js
import { getNoteIndex, getNotes } from './theory.js';

const SHARPS = getNotes(); // ['C', 'C#', ...]

export class Fretboard {
    constructor(containerId, tuningNotes, stringCount = 6) {
        this.container = document.getElementById(containerId);
        this.tuning = tuningNotes; 
        this.stringCount = stringCount;
        this.numFrets = 12; // Reverted to 12
        this.capo = 0;
        
        // State for re-rendering
        this.lastScaleNotes = [];
        this.lastChordNotes = []; 
        this.lastChordRoot = null; 
        this.displayMode = 'scale'; 
    }

    setTuning(newTuning) {
        this.tuning = newTuning;
    }

    setCapo(fret) {
        this.capo = parseInt(fret);
    }
    
    setDisplayMode(mode) {
        this.displayMode = mode;
        if (this.lastScaleNotes.length > 0) {
            this.render(this.lastScaleNotes, this.lastChordNotes, this.lastChordRoot);
        }
    }

    render(scaleNotes, activeChordNotes = [], activeChordRoot = null) {
        this.lastScaleNotes = scaleNotes;
        this.lastChordNotes = activeChordNotes;
        this.lastChordRoot = activeChordRoot;

        if (!this.container) return;
        this.container.innerHTML = '';
        
        // Dynamic width based on fret count (prevents empty space)
        const fretWidth = 55;
        const fretboardWidth = 60 + (this.numFrets * fretWidth);
        const fretboardHeight = this.stringCount * 30 + 40;
        
        let svg = `<svg viewBox="0 0 ${fretboardWidth} ${fretboardHeight}" preserveAspectRatio="xMidYMid slice">`;

        // 1. Draw Nut and Frets
        svg += `<rect x="30" y="20" width="5" height="${this.stringCount * 30}" fill="#444" />`; 
        
        for (let i = 0; i <= this.numFrets; i++) {
            let x = 30 + (i * fretWidth); 
            if ([3, 5, 7, 9, 12, 15].includes(i)) {
                svg += `<circle cx="${x - (fretWidth/2)}" cy="${fretboardHeight/2}" r="5" fill="#222" />`;
                if (i === 12) svg += `<circle cx="${x - (fretWidth/2)}" cy="${fretboardHeight/2 + 15}" r="5" fill="#222" />`;
            }
            svg += `<line x1="${x}" y1="20" x2="${x}" y2="${this.stringCount * 30 + 20}" stroke="#333" stroke-width="2" />`;
            if (i > 0) svg += `<text x="${x - (fretWidth/2)}" y="${fretboardHeight - 5}" font-size="10" fill="#444" text-anchor="middle">${i}</text>`;
        }
        
        if (this.capo > 0) {
            let capoX = 30 + (this.capo * fretWidth) - (fretWidth/2);
            svg += `<rect x="${capoX-4}" y="15" width="8" height="${this.stringCount * 30 + 10}" fill="var(--primary-cyan)" opacity="0.5" rx="4" />`;
        }

        // 2. Draw Strings (Low E at Bottom)
        for (let s = 0; s < this.stringCount; s++) {
            let y = 30 + ((this.stringCount - 1 - s) * 30);
            let thickness = 1 + (this.stringCount - s) * 0.3; 
            svg += `<line x1="30" y1="${y}" x2="${30 + this.numFrets * fretWidth}" y2="${y}" stroke="#666" stroke-width="${thickness}" />`;
            svg += `<text x="10" y="${y + 4}" font-size="12" fill="#888" text-anchor="middle">${this.tuning[s]}</text>`;
        }

        // 3. Draw Notes
        for (let stringIndex = 0; stringIndex < this.stringCount; stringIndex++) {
            const openNote = this.tuning[stringIndex];
            const openNoteIndex = getNoteIndex(openNote);

            for (let fret = 0; fret <= this.numFrets; fret++) {
                const currentNoteIndex = (openNoteIndex + fret) % 12;
                const noteName = SHARPS[currentNoteIndex];

                const inScale = scaleNotes.includes(noteName);
                const inChord = activeChordNotes.includes(noteName);
                
                let isVisible = false;
                let isHighlighted = false;

                if (this.displayMode === 'scale') {
                    if (inScale) isVisible = true;
                    if (inChord) isHighlighted = true;
                } else {
                    if (inChord) {
                        isVisible = true;
                        isHighlighted = true;
                    }
                }

                if (isVisible) {
                    const x = 30 + (fret * fretWidth) - (fret === 0 ? 15 : (fretWidth/2));
                    const y = 30 + ((this.stringCount - 1 - stringIndex) * 30);
                    
                    let targetRoot = activeChordRoot ? activeChordRoot : scaleNotes[0];
                    const isTargetRoot = (noteName === targetRoot);
                    
                    let circleColor = '#444'; 
                    let textColor = '#aaa';

                    if (isHighlighted) {
                        circleColor = isTargetRoot ? 'var(--root-color)' : '#00e5ff'; 
                        textColor = '#000';
                    } else if (isTargetRoot) {
                         circleColor = 'var(--root-color)';
                         textColor = '#000';
                    } else {
                        circleColor = '#333';
                        textColor = '#666';
                    }

                    let opacity = 1.0;
                    if (this.displayMode === 'scale' && activeChordNotes.length > 0 && !inChord) {
                        opacity = 0.4;
                    }

                    svg += `<g opacity="${opacity}">`;
                    svg += `<circle cx="${x}" cy="${y}" r="11" fill="${circleColor}" stroke="none" />`;
                    svg += `<text x="${x}" y="${y+4}" font-size="10" fill="${textColor}" text-anchor="middle" font-weight="bold">${noteName}</text>`;
                    svg += `</g>`;
                }
            }
        }

        svg += `</svg>`;
        this.container.innerHTML = svg;
    }
}