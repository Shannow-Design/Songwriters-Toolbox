// modules/fretboard.js

import { playSingleNote } from './audio.js';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const ENHARMONIC_MAP = {
    'Cb': 'B', 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
};

export class Fretboard {
    constructor(containerId, initialTuning, baseOctave = 2) {
        this.container = document.getElementById(containerId);
        this.fretCount = 12;
        this.tuning = initialTuning || ['E', 'A', 'D', 'G', 'B', 'E']; 
        this.capo = 0; 
        this.baseOctave = baseOctave; 
    }

    setTuning(newTuningNotes) {
        this.tuning = newTuningNotes;
    }

    setCapo(fretNumber) {
        this.capo = parseInt(fretNumber);
    }

    render(activeNotes = []) {
        if(!this.container) return;
        this.container.innerHTML = ''; 

        const board = document.createElement('div');
        board.className = 'fretboard';

        const normalize = (note) => {
            if (SHARPS.includes(note)) return note;
            return ENHARMONIC_MAP[note] || note;
        };

        const activeNotesNormalized = activeNotes.map(normalize);

        // 1. Calculate String Pitch Offsets (Semitones from String 0)
        // This handles "Drop D" or uneven tunings correctly.
        const stringOffsets = [0]; // String 0 always has 0 offset
        let runningOffset = 0;
        
        for(let i = 0; i < this.tuning.length - 1; i++) {
            const currentStringNote = normalize(this.tuning[i]);
            const nextStringNote = normalize(this.tuning[i+1]);
            
            const idxCurrent = SHARPS.indexOf(currentStringNote);
            const idxNext = SHARPS.indexOf(nextStringNote);
            
            // Calculate distance to next string (e.g. E->A is 5, D->A is 7)
            const dist = (idxNext - idxCurrent + 12) % 12;
            runningOffset += dist;
            stringOffsets.push(runningOffset);
        }

        // Get the absolute starting index of the lowest string (e.g., 'E' is 4)
        const rootStringNote = normalize(this.tuning[0]);
        const rootStringIndex = SHARPS.indexOf(rootStringNote);


        // 2. Loop Strings (High visual to Low visual)
        for (let s = this.tuning.length - 1; s >= 0; s--) {
            const stringRow = document.createElement('div');
            stringRow.className = 'string';
            
            let tuningNote = this.tuning[s];
            let stringNoteIndex = SHARPS.indexOf(normalize(tuningNote));

            for (let f = 0; f <= this.fretCount; f++) {
                const fretDiv = document.createElement('div');
                fretDiv.className = f === 0 ? 'nut' : 'fret';
                
                // Capo Logic
                if (f < this.capo) fretDiv.classList.add('fret-muted');
                if (f === this.capo && this.capo > 0) fretDiv.classList.add('capo-active');

                const currentNoteIndex = (stringNoteIndex + f) % 12;
                const currentNoteSharp = SHARPS[currentNoteIndex];

                if (f >= this.capo && activeNotesNormalized.includes(currentNoteSharp)) {
                    
                    const displayNote = activeNotes.find(n => normalize(n) === currentNoteSharp) || currentNoteSharp;

                    const noteMarker = document.createElement('div');
                    noteMarker.className = 'note-marker';
                    noteMarker.textContent = displayNote;
                    
                    // --- NEW OCTAVE CALCULATION ---
                    // 1. Start with the index of the open low string (e.g. 4 for E)
                    // 2. Add the semitone distance of current string from low string
                    // 3. Add the fret number
                    // 4. Divide by 12 to see how many C-boundaries we crossed
                    const totalSemitonesFromC = rootStringIndex + stringOffsets[s] + f;
                    const estimatedOctave = this.baseOctave + Math.floor(totalSemitonesFromC / 12);

                    noteMarker.addEventListener('click', (e) => {
                        e.stopPropagation(); 
                        
                        noteMarker.style.transform = "scale(1.3)";
                        noteMarker.style.background = "#fff";
                        noteMarker.style.color = "#000";
                        setTimeout(() => {
                            noteMarker.style.transform = "";
                            noteMarker.style.background = ""; 
                            noteMarker.style.color = ""; 
                        }, 200);

                        playSingleNote(displayNote, estimatedOctave);
                    });

                    if(normalize(displayNote) === normalize(activeNotes[0])) {
                        noteMarker.classList.add('root-note');
                    }
                    
                    fretDiv.appendChild(noteMarker);
                }
                stringRow.appendChild(fretDiv);
            }
            board.appendChild(stringRow);
        }
        this.container.appendChild(board);
    }
}