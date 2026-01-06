// modules/theory.js

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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

export function getNotes() { return NOTES; }

export function getNoteIndex(note) {
    const enharmonics = { 'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#' };
    let n = note;
    if (enharmonics[n]) n = enharmonics[n];
    return NOTES.indexOf(n);
}

export function generateScale(root, scaleKey) {
    const rootIdx = getNoteIndex(root);
    const scale = SCALES[scaleKey];
    if (!scale) return [];
    
    return scale.intervals.map(interval => {
        return NOTES[(rootIdx + interval) % 12];
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
    // Parent Scale Mapping for Diatonic Generation
    let effectiveScaleKey = scaleKey;
    if (scaleKey === 'pentatonic_major') effectiveScaleKey = 'major';
    else if (scaleKey === 'pentatonic_minor' || scaleKey === 'blues') effectiveScaleKey = 'natural_minor';

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

    const buildChord = (interval, type, roman) => {
        const chordRoot = NOTES[(rootIdx + interval) % 12];
        let thirdInterval = (type === 'maj') ? 4 : 3;
        let fifthInterval = 7;
        if (type === 'dim') { fifthInterval = 6; }
        
        const third = NOTES[(getNoteIndex(chordRoot) + thirdInterval) % 12];
        const fifth = NOTES[(getNoteIndex(chordRoot) + fifthInterval) % 12];
        
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
        chords.push(buildChord(4, 'maj', 'III (V/vi)')); // Secondary Dom
        chords.push(buildChord(9, 'maj', 'VI (V/ii)')); // Secondary Dom
        chords.push(buildChord(2, 'maj', 'II (V/V)'));  // Secondary Dom
        chords.push(buildChord(11, 'maj', 'VII (V/iii)')); // Secondary Dom

        chords.push(buildChord(3, 'maj', 'bIII')); // Mode Mixture
        chords.push(buildChord(5, 'min', 'iv'));   // Mode Mixture
        chords.push(buildChord(7, 'min', 'v'));    // Mixolydian feel
        chords.push(buildChord(8, 'maj', 'bVI'));  // Mode Mixture
        chords.push(buildChord(10, 'maj', 'bVII'));// Mode Mixture
        
        chords.push(buildChord(1, 'maj', 'bII'));  // Neapolitan

    } else {
        // --- MINOR FAMILY BORROWED ---
        chords.push(buildChord(7, 'maj', 'V'));    // Harmonic Minor V
        chords.push(buildChord(0, 'maj', 'I'));    // Picardy Third
        chords.push(buildChord(5, 'maj', 'IV'));   // Dorian IV
        chords.push(buildChord(1, 'maj', 'bII'));  // Neapolitan
        // Optional: V/V works in minor too (II major)
        chords.push(buildChord(2, 'maj', 'II (V/V)')); 
    }

    return chords;
}

export function getAllChords(root, scaleKey) {
    const diatonic = getDiatonicChords(root, scaleKey);
    const borrowed = getBorrowedChords(root, scaleKey);
    
    // Filter duplicates (e.g. if Mixolydian already has bVII, don't add it again)
    // We check chord NAME uniqueness
    const seen = new Set(diatonic.map(c => c.name));
    const uniqueBorrowed = borrowed.filter(c => {
        if (seen.has(c.name)) return false;
        seen.add(c.name);
        return true;
    });

    return [...diatonic, ...uniqueBorrowed];
}