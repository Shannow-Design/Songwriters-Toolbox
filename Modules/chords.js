// modules/chords.js
import { getNoteIndex, getNotes } from './theory.js';
import { playStrum } from './audio.js';

// Standard Tuning Reference (E2, A2, D3, G3, B3, E4) - approximated indices for calculation
const STANDARD_TUNING_INDICES = [4, 9, 14, 19, 23, 28]; // E A D G B E (using continuous index logic)
const SHARPS = getNotes(); 

// Standard Frequencies for Audio calculation
const STANDARD_FREQUENCIES = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];

const OPEN_CHORDS = {
    'C': [-1, 3, 2, 0, 1, 0],
    'A': [-1, 0, 2, 2, 2, 0],
    'G': [3, 2, 0, 0, 0, 3],
    'E': [0, 2, 2, 1, 0, 0],
    'D': [-1, -1, 0, 2, 3, 2],
    'Am': [-1, 0, 2, 2, 1, 0],
    'Em': [0, 2, 2, 0, 0, 0],
    'Dm': [-1, -1, 0, 2, 3, 1]
};

const BARRE_SHAPES = {
    'Major': { 'E': [0, 2, 2, 1, 0, 0], 'A': [-1, 0, 2, 2, 2, 0] },
    'Minor': { 'E': [0, 2, 2, 0, 0, 0], 'A': [-1, 0, 2, 2, 1, 0] }
};

export class ChordRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    // UPDATED: Now accepts currentTuning (array of notes)
    render(chordsList, capo = 0, currentTuning = ['E','A','D','G','B','E']) {
        if (!this.container) return;
        this.container.innerHTML = ''; 
        capo = parseInt(capo);

        chordsList.forEach(chord => {
            const card = document.createElement('div');
            card.className = 'chord-card';
            
            // 1. Calculate Standard Shape (Relative to Capo)
            const rootIndex = getNoteIndex(chord.root);
            const relativeRootIndex = (rootIndex - capo + 12) % 12;
            const relativeRootName = SHARPS[relativeRootIndex];

            // Get the "Standard Tuning" fingering first
            const standardFrets = this.getFingering(relativeRootName, relativeRootName, chord.quality);
            
            // 2. ADJUST FOR TUNING (The New Magic Step)
            // If we are in Drop D, we need to shift the low string's finger UP by 2 frets.
            const adjustedFrets = this.adjustFretsForTuning(standardFrets, currentTuning);

            // 3. Draw SVG using the adjusted frets
            const svg = this.createChordSVG(adjustedFrets, capo);
            
            let subtext = "";
            if (capo > 0) subtext += `<span style="font-size:0.8rem; color:#888;">(${relativeRootName} Shape)</span>`;
            
            // Check if tuning change made the chord weird (impossible negative frets)
            if (adjustedFrets.includes(-999)) {
                subtext += `<br><span style="font-size:0.7rem; color:#d32f2f;">Shape unavailable in this tuning</span>`;
            }

            card.innerHTML = `<div class="chord-title">${chord.name}</div>${subtext}${svg}`;
            
            // 4. Audio Playback
            // We must calculate pitch based on the ACTUAL strings now
            card.addEventListener('click', () => {
                if (!adjustedFrets.includes(-999)) {
                    this.playChordAudio(adjustedFrets, capo, currentTuning);
                    
                    card.style.borderColor = "#00e5ff";
                    card.style.transform = "scale(1.05)";
                    setTimeout(() => {
                        card.style.borderColor = "";
                        card.style.transform = "";
                    }, 200);
                }
            });

            this.container.appendChild(card);
        });
    }

    // --- NEW: ALGORITHM TO SHIFT FINGERS ---
    adjustForTuning(standardFrets, currentTuning) {
        const standardNotes = ['E','A','D','G','B','E'];
        
        return standardFrets.map((fret, i) => {
            if (fret === -1) return -1; // Muted string stays muted

            // Calculate semitone difference: Standard - Current
            // Example: Drop D (Low E becomes D). Standard(E)=4, Current(D)=2. 
            // Diff = 4 - 2 = +2.
            // This means the string is LOWER, so we must fret HIGHER to get the same pitch.
            
            const stdIndex = getNoteIndex(standardNotes[i]);
            const curIndex = getNoteIndex(currentTuning[i]);
            
            // Handle wrapping (e.g. B to C) logic crudely but effectively for standard tunings
            // We assume tuning variations are usually within +/- 3 semitones
            let diff = stdIndex - curIndex;
            if (diff > 6) diff -= 12; // e.g. B(11) to C(0) -> 11-0=11... should be -1
            if (diff < -6) diff += 12;

            const newFret = fret + diff;

            // If the adjustment pushes the note below fret 0 (impossible), mark it
            if (newFret < 0) return -999; 
            
            return newFret;
        });
    }
    
    // Alias for the method called in render
    adjustFretsForTuning(standardFrets, currentTuning) {
        return this.adjustForTuning(standardFrets, currentTuning);
    }

    playChordAudio(frets, capo, currentTuningNotes) {
        const frequencies = [];
        
        // Calculate base frequencies of the CURRENT tuning
        // We start with the Standard Hz and adjust them based on the tuning diff
        const currentBaseFreqs = STANDARD_FREQUENCIES.map((freq, i) => {
            const standardNotes = ['E','A','D','G','B','E'];
            const stdIndex = getNoteIndex(standardNotes[i]);
            const curIndex = getNoteIndex(currentTuningNotes[i]);
            let diff = curIndex - stdIndex;
            if (diff > 6) diff -= 12;
            if (diff < -6) diff += 12;
            
            // New Base Freq = Standard * 2^(diff/12)
            return freq * Math.pow(2, diff / 12);
        });

        frets.forEach((fret, stringIndex) => {
            if (fret !== -1 && fret !== -999) {
                const baseFreq = currentBaseFreqs[stringIndex];
                const absoluteFret = fret + capo;
                const pitch = baseFreq * Math.pow(2, absoluteFret / 12);
                frequencies.push(pitch);
            }
        });
        playStrum(frequencies);
    }

    createChordSVG(frets, capo) {
        const width = 100, height = 120, margin = 15, fretSpacing = 18, stringSpacing = 14;
        let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
        
        // Handle "Impossible" shapes
        if (frets.includes(-999)) {
            return `<svg width="${width}" height="${height}"><text x="50%" y="50%" text-anchor="middle" fill="#666" font-size="10">Impossible in Tuning</text></svg>`;
        }

        const minFret = Math.min(...frets.filter(f => f > 0));
        const baseFret = (minFret > 4) ? minFret - 1 : 0; // Scroll down if high up

        if (baseFret === 0) {
            if (capo > 0) {
                svg += `<rect x="${margin}" y="${margin}" width="${5 * stringSpacing}" height="6" fill="#00e5ff" />`;
                svg += `<text x="${width/2}" y="${margin-4}" font-size="9" fill="#00e5ff" text-anchor="middle">CAPO ${capo}</text>`;
            } else {
                svg += `<rect x="${margin}" y="${margin}" width="${5 * stringSpacing}" height="4" fill="#666" />`;
            }
        } else {
            svg += `<text x="0" y="${margin + fretSpacing}" font-size="10" fill="#888">${baseFret + 1}</text>`;
        }

        for (let i = 0; i <= 5; i++) {
            let y = margin + (i * fretSpacing);
            if (baseFret === 0 && i === 0) continue;
            svg += `<line x1="${margin}" y1="${y}" x2="${margin + 5 * stringSpacing}" y2="${y}" stroke="#444" stroke-width="2" />`;
        }
        for (let i = 0; i < 6; i++) {
            let x = margin + (i * stringSpacing);
            svg += `<line x1="${x}" y1="${margin}" x2="${x}" y2="${margin + 5 * fretSpacing}" stroke="#666" stroke-width="1" />`;
        }

        frets.forEach((fret, stringIndex) => {
            let x = margin + (stringIndex * stringSpacing);
            if (fret === -1) {
                svg += `<text x="${x}" y="${margin - 5}" text-anchor="middle" font-size="10" fill="#666">×</text>`;
            } else if (fret === 0) {
                // Open string
                let color = (capo > 0) ? "#00e5ff" : "#888";
                svg += `<circle cx="${x}" cy="${margin - 4}" r="3" stroke="${color}" fill="none" />`;
            } else {
                let relativeFret = fret - baseFret;
                let y = margin + (relativeFret * fretSpacing) - (fretSpacing / 2);
                svg += `<circle cx="${x}" cy="${y}" r="5" fill="#00e5ff" />`;
            }
        });
        svg += `</svg>`;
        return svg;
    }

    getFingering(chordName, root, quality) {
        // ... (Keep the exact same logic from previous chords.js) ...
        // Need to duplicate logic here or keep it from previous file
        
        let lookup = root;
        // Basic lookup for open chords logic
        // This part remains unchanged from your previous version
        
        // --- COPIED FOR COMPLETENESS ---
        const OPEN_CHORDS_REF = {
            'C': [-1, 3, 2, 0, 1, 0], 'A': [-1, 0, 2, 2, 2, 0], 'G': [3, 2, 0, 0, 0, 3],
            'E': [0, 2, 2, 1, 0, 0], 'D': [-1, -1, 0, 2, 3, 2], 'Am': [-1, 0, 2, 2, 1, 0],
            'Em': [0, 2, 2, 0, 0, 0], 'Dm': [-1, -1, 0, 2, 3, 1]
        };

        let searchKey = root;
        if (quality === 'Minor') searchKey += 'm';

        if (OPEN_CHORDS_REF[searchKey]) return OPEN_CHORDS_REF[searchKey];

        // Barre Logic
        const rootIndex = getNoteIndex(root);
        let distE = (rootIndex - 4 + 12) % 12;
        let distA = (rootIndex - 9 + 12) % 12;
        let baseFret, baseShape;

        if (rootIndex >= 5 && rootIndex <= 8) {
            baseShape = (quality === 'Minor') ? BARRE_SHAPES.Minor.E : BARRE_SHAPES.Major.E;
            baseFret = distE;
        } else {
            baseShape = (quality === 'Minor') ? BARRE_SHAPES.Minor.A : BARRE_SHAPES.Major.A;
            baseFret = distA;
        }
        return baseShape.map(f => (f === -1 ? -1 : f + baseFret));
    }
}