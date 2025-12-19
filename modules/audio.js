// modules/audio.js

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ENHARMONIC_MAP = { 'Cb': 'B', 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

const AudioContext = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioContext();

// Track active oscillators for MIDI (so we can stop them individually)
const activeOscillators = {};

function getFrequency(noteName, octave) {
    let cleanNote = noteName;
    if (!SHARPS.includes(cleanNote)) {
        cleanNote = ENHARMONIC_MAP[cleanNote] || cleanNote;
    }
    const noteIndex = SHARPS.indexOf(cleanNote);
    const semitonesFromA4 = (noteIndex - 9) + ((octave - 4) * 12);
    return 440 * Math.pow(2, semitonesFromA4 / 12);
}

// --- 1. GUITAR/PLUCK SOUND (For Chords & Buttons) ---
export function playTone(freq, startTime, duration) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle'; // Triangle is softer, closer to a string than Sawtooth
    osc.frequency.value = freq;

    // Guitar Envelope: Fast Attack -> Exponential Decay (Ring out)
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.4, startTime + 0.02); // Pluck (Attack)
    
    // Exponential decay sounds natural (like a string fading)
    // We ramp down to near-zero (0.001) because exponential can't hit pure 0
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration); 

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
}

// --- 2. KEYBOARD/SYNTH SOUND (For MIDI Sustain) ---
export function startNote(freq, midiNoteNumber) {
    if (ctx.state === 'suspended') ctx.resume();
    
    if (activeOscillators[midiNoteNumber]) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth'; // Sawtooth cuts through better for keys
    osc.frequency.value = freq;
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05); // Smooth attack

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    activeOscillators[midiNoteNumber] = { osc, gain };
}

// --- STOP MIDI NOTE ---
export function stopNote(midiNoteNumber) {
    const active = activeOscillators[midiNoteNumber];
    if (active) {
        const now = ctx.currentTime;
        // Smooth release to avoid clicking
        active.gain.gain.cancelScheduledValues(now);
        active.gain.gain.setValueAtTime(active.gain.gain.value, now);
        active.gain.gain.linearRampToValueAtTime(0, now + 0.1);
        
        active.osc.stop(now + 0.1);
        delete activeOscillators[midiNoteNumber];
    }
}

// --- HELPERS ---
export function playSingleNote(noteName, octave) {
    const freq = getFrequency(noteName, octave);
    playTone(freq, ctx.currentTime, 1.5); // Longer duration for ring
}

export function playStrum(frequencies) {
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    frequencies.forEach((freq, index) => {
        // Stagger notes slightly (strumming effect)
        // Duration 2.5s gives it a nice long ring
        playTone(freq, now + (index * 0.05), 2.5);
    });
}

export function playScaleSequence(notes) {
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    let currentOctave = 3;
    let lastNoteIndex = -1;
    
    notes.forEach((note, index) => {
        let cleanNote = note;
        if (!SHARPS.includes(cleanNote)) cleanNote = ENHARMONIC_MAP[cleanNote] || cleanNote;
        const noteIndex = SHARPS.indexOf(cleanNote);
        if (noteIndex < lastNoteIndex) currentOctave++;
        lastNoteIndex = noteIndex;
        
        const freq = getFrequency(note, currentOctave);
        playTone(freq, now + (index * 0.4), 1.0);
    });
}