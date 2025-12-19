// modules/audio.js

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ENHARMONIC_MAP = {
    'Cb': 'B', 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
};

const AudioContext = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioContext();

// --- FREQUENCY CALCULATION ---
function getFrequency(noteName, octave) {
    let cleanNote = noteName;
    if (!SHARPS.includes(cleanNote)) {
        cleanNote = ENHARMONIC_MAP[cleanNote] || cleanNote;
    }
    const noteIndex = SHARPS.indexOf(cleanNote);
    const semitonesFromA4 = (noteIndex - 9) + ((octave - 4) * 12);
    return 440 * Math.pow(2, semitonesFromA4 / 12);
}

// --- BASIC TONE GENERATOR ---
export function playTone(freq, startTime, duration) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = freq;

    // Envelope
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05); // Attack
    gain.gain.linearRampToValueAtTime(0, startTime + duration); // Decay

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
}

// --- NEW: STRUM CHORD ---
// Accepts an array of frequencies (e.g., [130.8, 164.8, 196.0])
export function playStrum(frequencies) {
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const strumSpeed = 0.03; // Delay between strings (ms) for realism

    frequencies.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        const startTime = now + (index * strumSpeed);
        const duration = 2.0; // Chords ring out longer

        // Strum Envelope (Lower volume to prevent distortion)
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05); 
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
    });
}

// --- EXISTING SINGLE NOTE & SCALE FUNCTIONS ---
export function playSingleNote(noteName, octave) {
    if (ctx.state === 'suspended') ctx.resume();
    const freq = getFrequency(noteName, octave);
    playTone(freq, ctx.currentTime, 0.5);
}

export function playScaleSequence(notes) {
    if (ctx.state === 'suspended') ctx.resume();
    
    const now = ctx.currentTime;
    let currentOctave = 3;
    let lastNoteIndex = -1;
    const duration = 0.5;
    const interval = 0.4;
    
    const noteButtons = document.querySelectorAll('.note-btn');

    notes.forEach((note, index) => {
        let cleanNote = note;
        if (!SHARPS.includes(cleanNote)) cleanNote = ENHARMONIC_MAP[cleanNote] || cleanNote;
        const noteIndex = SHARPS.indexOf(cleanNote);

        if (noteIndex < lastNoteIndex) currentOctave++;
        lastNoteIndex = noteIndex;

        const freq = getFrequency(note, currentOctave);
        const startTime = now + (index * interval);

        playTone(freq, startTime, duration);

        const targetBtn = Array.from(noteButtons).find(btn => btn.dataset.note === note);
        if (targetBtn) {
            setTimeout(() => {
                targetBtn.classList.add('playing');
            }, (index * interval) * 1000);

            setTimeout(() => {
                targetBtn.classList.remove('playing');
            }, ((index * interval) + duration) * 1000);
        }
    });

    let rootClean = notes[0];
    if (!SHARPS.includes(rootClean)) rootClean = ENHARMONIC_MAP[rootClean] || rootClean;
    const rootIndex = SHARPS.indexOf(rootClean);
    if (rootIndex < lastNoteIndex) currentOctave++;
    
    const rootFreq = getFrequency(notes[0], currentOctave);
    playTone(rootFreq, now + (notes.length * interval), 0.8);
}
