// modules/theory.js

const RAW_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_TO_INDEX = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11
};

// --- RESTORED: Full Scale Library ---
export const SCALES = {
    major: { name: "Major (Ionian)", intervals: [0, 2, 4, 5, 7, 9, 11] },
    natural_minor: { name: "Natural Minor (Aeolian)", intervals: [0, 2, 3, 5, 7, 8, 10] },
    harmonic_minor: { name: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
    melodic_minor: { name: "Melodic Minor", intervals: [0, 2, 3, 5, 7, 9, 11] },
    dorian: { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
    phrygian: { name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
    lydian: { name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
    mixolydian: { name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
    locrian: { name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] },
    major_pentatonic: { name: "Major Pentatonic", intervals: [0, 2, 4, 7, 9] },
    minor_pentatonic: { name: "Minor Pentatonic", intervals: [0, 3, 5, 7, 10] },
    blues: { name: "Blues", intervals: [0, 3, 5, 6, 7, 10] }
};

// --- RESTORED: Tunings + 5-String Bass ---
export const TUNINGS = {
    standard: { name: "Guitar: Standard", notes: ['E', 'A', 'D', 'G', 'B', 'E'] },
    drop_d: { name: "Guitar: Drop D", notes: ['D', 'A', 'D', 'G', 'B', 'E'] },
    dadgad: { name: "Guitar: DADGAD", notes: ['D', 'A', 'D', 'G', 'A', 'D'] },
    open_g: { name: "Guitar: Open G", notes: ['D', 'G', 'D', 'G', 'B', 'D'] },
    bass_standard: { name: "Bass: Standard (4)", notes: ['E', 'A', 'D', 'G'] },
    bass_drop_d: { name: "Bass: Drop D (4)", notes: ['D', 'A', 'D', 'G'] },
    // 5-String Support
    bass_5_string: { name: 'Bass: Standard (5)', notes: ['B', 'E', 'A', 'D', 'G'] }
};

export function getNotes() { return RAW_NOTES; }
export function getNoteIndex(noteName) { return NOTE_TO_INDEX[noteName]; }

function shouldUseFlats(rootIndex, scaleType) {
    const flatRoots = [5, 10, 3, 8, 1]; 
    const flatMinorRoots = [0, 7, 2, 5, 10, 3]; 
    if (scaleType.includes('minor') || scaleType.includes('dorian') || scaleType.includes('phrygian') || scaleType.includes('locrian')) {
        return flatMinorRoots.includes(rootIndex);
    }
    return flatRoots.includes(rootIndex);
}

// --- UPDATED: Crash-Proof Scale Generation ---
export function generateScale(root, scaleType) {
    // 1. Safety Check: If old save file requests missing scale, default to Major
    let scaleObj = SCALES[scaleType];
    if (!scaleObj) {
        console.warn(`Scale '${scaleType}' not found. Defaulting to Major.`);
        scaleObj = SCALES['major'];
        scaleType = 'major'; // Update type so flat/sharp logic works
    }

    const rootIndex = RAW_NOTES.indexOf(root);
    const intervals = scaleObj.intervals;
    const useFlats = shouldUseFlats(rootIndex, scaleType);
    const sourceScale = useFlats ? FLATS : SHARPS;

    return intervals.map(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        return sourceScale[noteIndex];
    });
}

export function getDiatonicChords(root, scaleType) {
    const scaleNotes = generateScale(root, scaleType);
    const chords = [];

    // Safety: If scale generation failed (empty), return empty
    if (!scaleNotes || scaleNotes.length === 0) return [];

    for (let i = 0; i < scaleNotes.length; i++) {
        const rootNote = scaleNotes[i];
        // Diatonic stacking: 1, 3, 5
        const third = scaleNotes[(i + 2) % scaleNotes.length];
        const fifth = scaleNotes[(i + 4) % scaleNotes.length];
        
        const rootIndex = getNoteIndex(rootNote);
        const thirdIndex = getNoteIndex(third);
        
        let semitones = (thirdIndex - rootIndex + 12) % 12;
        
        let suffix = "";
        let quality = "Major";

        if (semitones === 4) {
            suffix = ""; 
            quality = "Major";
        } else if (semitones === 3) {
            const fifthIndex = getNoteIndex(fifth);
            const fifthInterval = (fifthIndex - rootIndex + 12) % 12;
            if (fifthInterval === 6) {
                suffix = "dim";
                quality = "Diminished";
            } else {
                suffix = "m";
                quality = "Minor";
            }
        } else {
            // Fallback for strange scales (e.g. Locrian/Blues)
            suffix = "?";
            quality = "Other";
        }

        chords.push({
            name: rootNote + suffix,
            root: rootNote,
            quality: quality,
            notes: [rootNote, third, fifth]
        });
    }
    return chords;
}

export class TheoryEngine {
    constructor() {
        this.cache = {};
    }
}