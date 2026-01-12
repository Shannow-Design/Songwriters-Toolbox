// modules/theory.js

// Canonical Chromatic Index: 0=C, 1=C#/Db, ...
const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const SCALES = {
    major: { name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
    natural_minor: { name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
    harmonic_minor: { name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
    melodic_minor: { name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
    dorian: { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
    phrygian: { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
    lydian: { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
    mixolydian: { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
    locrian: { name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
    pentatonic_major: { name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9] },
    pentatonic_minor: { name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10] },
    blues: { name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] }
};

export const TUNINGS = {
    standard: { name: 'Standard (E)', notes: ['E', 'A', 'D', 'G', 'B', 'E'] },
    drop_d: { name: 'Drop D', notes: ['D', 'A', 'D', 'G', 'B', 'E'] },
    dadgad: { name: 'DADGAD', notes: ['D', 'A', 'D', 'G', 'A', 'D'] },
    open_g: { name: 'Open G', notes: ['D', 'G', 'D', 'G', 'B', 'D'] },
    bass_standard: { name: 'Standard (E)', notes: ['E', 'A', 'D', 'G'] },
    bass_drop_d: { name: 'Drop D', notes: ['D', 'A', 'D', 'G'] }
};

export class TheoryEngine {
    constructor() {}
}

// Default to Sharps for generic lists (like dropdowns)
export function getNotes() { return NOTES_SHARP; }

// Robust Index Finder (Handles both C# and Db)
export function getNoteIndex(note) {
    const enharmonics = { 
        'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#',
        'C#':'Db', 'D#':'Eb', 'F#':'Gb', 'G#':'Ab', 'A#':'Bb' 
    };
    
    // Try Sharp Array First
    let idx = NOTES_SHARP.indexOf(note);
    if (idx !== -1) return idx;
    
    // Try Flat Array
    idx = NOTES_FLAT.indexOf(note);
    if (idx !== -1) return idx;

    // Try Enharmonic Map
    if (enharmonics[note]) {
        return getNoteIndex(enharmonics[note]);
    }
    return -1;
}

// --- INTELLIGENT KEY SIGNATURE LOGIC ---
function shouldUseFlats(root, scaleKey) {
    // 1. Always use Flats for these Roots (regardless of scale)
    // F Major (1b), Bb (2b), Eb (3b), Ab (4b), Db (5b), Gb (6b)
    // Note: We check against sharp aliases too in case they come from the UI (e.g., A#)
    const alwaysFlatRoots = ['F', 'Bb', 'A#', 'Eb', 'D#', 'Ab', 'G#', 'Db', 'C#', 'Gb', 'F#'];
    if (alwaysFlatRoots.includes(root)) {
        // Exception: F# usually implies Sharps (6#) vs Gb (6b). 
        // But for code simplicity, users often prefer Gb over F# in tools.
        // Let's stick to standard theory:
        if (root === 'F#') return false; // F# Major uses Sharps
        if (root === 'C#') return false; // C# Major uses Sharps (7#), but Db is usually preferred. Let's toggle:
        return true; 
    }

    // 2. Use Flats for Minor-ish scales on natural roots C, G, D
    // C Minor (3b), G Minor (2b), D Minor (1b)
    const minorModes = [
        'natural_minor', 'harmonic_minor', 'melodic_minor', 
        'dorian', 'phrygian', 'locrian', 
        'pentatonic_minor', 'blues'
    ];
    
    if (minorModes.includes(scaleKey)) {
        if (['C', 'G', 'D'].includes(root)) return true;
    }
    
    // Mixolydian also adds a flat (b7). 
    // F Mixolydian (Bb, Eb, Ab, Db + Eb??). 
    // F Mixo is relative to Bb Major. Uses Flats. Covered by rule #1 (F root).

    return false;
}

export function generateScale(root, scaleKey) {
    const rootIdx = getNoteIndex(root);
    const scale = SCALES[scaleKey];
    if (!scale) return [];
    
    const useFlats = shouldUseFlats(root, scaleKey);
    const sourceNotes = useFlats ? NOTES_FLAT : NOTES_SHARP;

    return scale.intervals.map(interval => {
        return sourceNotes[(rootIdx + interval) % 12];
    });
}

function getChordType(root, third, fifth) {
    const r = getNoteIndex(root);
    const t = getNoteIndex(third);
    const f = getNoteIndex(fifth);
    
    let thirdInt = (t - r + 12) % 12;
    let fifthInt = (f - r + 12) % 12;
    
    if (thirdInt === 4 && fifthInt === 7) return 'maj';
    if (thirdInt === 3 && fifthInt === 7) return 'min';
    if (thirdInt === 3 && fifthInt === 6) return 'dim';
    if (thirdInt === 4 && fifthInt === 8) return 'aug';
    return 'unk';
}

export function getDiatonicChords(root, scaleKey) {
    // Map subset scales to parent 7-note scales for chord generation
    let effectiveScaleKey = scaleKey;
    if (scaleKey === 'pentatonic_major') effectiveScaleKey = 'major';
    else if (scaleKey === 'pentatonic_minor' || scaleKey === 'blues') effectiveScaleKey = 'natural_minor';

    // generateScale now handles Flat/Sharp logic automatically!
    const notes = generateScale(root, effectiveScaleKey); 
    
    if (notes.length < 7) return []; 

    return notes.map((note, i) => {
        const rootNote = notes[i];
        const thirdNote = notes[(i + 2) % notes.length];
        const fifthNote = notes[(i + 4) % notes.length];
        
        const type = getChordType(rootNote, thirdNote, fifthNote);
        let suffix = '';
        let roman = '';
        
        const numerals = ['I','II','III','IV','V','VI','VII'];
        let num = numerals[i];
        
        if (type === 'min') { suffix = 'm'; roman = num.toLowerCase(); }
        else if (type === 'dim') { suffix = '°'; roman = num.toLowerCase() + '°'; }
        else if (type === 'maj') { suffix = ''; roman = num; }
        else if (type === 'aug') { suffix = '+'; roman = num + '+'; }
        
        return {
            root: rootNote,
            name: rootNote + suffix,
            type: type,
            roman: roman,
            notes: [rootNote, thirdNote, fifthNote]
        };
    });
}

export function getBorrowedChords(root, scaleKey) {
    const rootIdx = getNoteIndex(root);
    const chords = [];

    // --- 1. Determine Tonal Family ---
    let family = 'minor';
    const majorFamily = ['major', 'lydian', 'mixolydian', 'pentatonic_major'];
    if (majorFamily.includes(scaleKey)) {
        family = 'major';
    }

    // Determine scale preference, but allow overriding for "Flat" degrees
    const scaleUsesFlats = shouldUseFlats(root, scaleKey);

    const buildChord = (interval, type, roman, forceFlatRoot = false) => {
        const absIndex = (rootIdx + interval) % 12;
        
        // Use Flat spelling if forced (like bIII) OR if scale uses flats
        // Otherwise use Sharp spelling
        const useFlatForChord = forceFlatRoot || scaleUsesFlats;
        const chordRoot = useFlatForChord ? NOTES_FLAT[absIndex] : NOTES_SHARP[absIndex];

        let thirdInterval = (type === 'maj') ? 4 : 3;
        let fifthInterval = 7;
        if (type === 'dim') { fifthInterval = 6; }
        
        // Notes inside the chord should generally match the chord root's preference
        // e.g. Eb Major -> Eb, G, Bb (Flat array)
        const innerSource = useFlatForChord ? NOTES_FLAT : NOTES_SHARP;
        const third = innerSource[(getNoteIndex(chordRoot) + thirdInterval) % 12];
        const fifth = innerSource[(getNoteIndex(chordRoot) + fifthInterval) % 12];
        
        let suffix = '';
        if (type === 'min') suffix = 'm';
        else if (type === 'dim') suffix = '°';
        
        return {
            root: chordRoot,
            name: chordRoot + suffix,
            type: type,
            roman: roman,
            notes: [chordRoot, third, fifth],
            isBorrowed: true
        };
    };

    if (family === 'major') {
        // --- MAJOR FAMILY BORROWED ---
        
        // Secondary Dominants (usually act like Major keys, use Sharps unless root is flat)
        chords.push(buildChord(4, 'maj', 'III (V/vi)')); 
        chords.push(buildChord(9, 'maj', 'VI (V/ii)')); 
        chords.push(buildChord(2, 'maj', 'II (V/V)'));  
        chords.push(buildChord(11, 'maj', 'VII (V/iii)')); 

        // Mode Mixture (Borrowed from Minor = FLATTENED DEGREES)
        // We force Flats for bIII, bVI, bVII, bII to ensure "Eb" not "D#"
        chords.push(buildChord(3, 'maj', 'bIII', true)); 
        chords.push(buildChord(5, 'min', 'iv'));   
        chords.push(buildChord(7, 'min', 'v'));    
        chords.push(buildChord(8, 'maj', 'bVI', true));  
        chords.push(buildChord(10, 'maj', 'bVII', true));
        chords.push(buildChord(1, 'maj', 'bII', true));  // Neapolitan

    } else {
        // --- MINOR FAMILY BORROWED ---
        chords.push(buildChord(7, 'maj', 'V'));    
        chords.push(buildChord(0, 'maj', 'I'));    
        chords.push(buildChord(5, 'maj', 'IV'));   
        chords.push(buildChord(1, 'maj', 'bII', true));  
        chords.push(buildChord(2, 'maj', 'II (V/V)')); 
    }

    return chords;
}

export function getAllChords(root, scaleKey) {
    const diatonic = getDiatonicChords(root, scaleKey);
    const borrowed = getBorrowedChords(root, scaleKey);
    
    // Filter duplicates by name
    const seen = new Set(diatonic.map(c => c.name));
    const uniqueBorrowed = borrowed.filter(c => {
        if (seen.has(c.name)) return false;
        seen.add(c.name);
        return true;
    });

    return [...diatonic, ...uniqueBorrowed];
}