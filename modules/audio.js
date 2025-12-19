// modules/audio.js

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ENHARMONIC_MAP = { 'Cb': 'B', 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

const AudioContext = window.AudioContext || window.webkitAudioContext;
export const ctx = new AudioContext();

// --- MASTER OUTPUT ---
const masterCompressor = ctx.createDynamicsCompressor();
masterCompressor.threshold.setValueAtTime(-24, ctx.currentTime);
masterCompressor.knee.setValueAtTime(30, ctx.currentTime);
masterCompressor.ratio.setValueAtTime(12, ctx.currentTime);
masterCompressor.attack.setValueAtTime(0.003, ctx.currentTime);
masterCompressor.release.setValueAtTime(0.25, ctx.currentTime);

const masterGain = ctx.createGain();
masterGain.gain.value = 0.5; 

masterCompressor.connect(masterGain);
masterGain.connect(ctx.destination);

// --- ACTIVE VOICE TRACKING ---
const activeSources = new Set();

function registerSource(source) {
    activeSources.add(source);
    source.onended = () => {
        activeSources.delete(source);
    };
}

export function stopAllSounds() {
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(0, ctx.currentTime);

    activeSources.forEach(source => {
        try { source.stop(); } catch(e) {}
        try { source.disconnect(); } catch(e) {}
    });
    activeSources.clear();

    setTimeout(() => {
        masterGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);
    }, 100);
}

// --- INSTRUMENT LIBRARY ---
export const INSTRUMENTS = {
    'Acoustic Guitar': { type: 'triangle', attack: 0.02, decay: 1.5, sustain: 0.1, release: 0.2 }, 
    'Piano':           { type: 'sine', attack: 0.01, decay: 0.8, sustain: 0.2, release: 0.5, type2: 'triangle', mix: 0.3 }, 
    'Lead Synth':      { type: 'sawtooth', attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.2 },
    'Synth Pad':       { type: 'triangle', attack: 0.8, decay: 1.0, sustain: 0.8, release: 2.0 }, 
    'Bass Guitar':     { type: 'square', attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.1, filter: 600 },
    'Strings':         { type: 'sawtooth', attack: 0.4, decay: 0.5, sustain: 0.7, release: 1.2, filter: 2000 },
    'Marimba':         { type: 'sine', attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    '8-Bit / NES':     { type: 'square', attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 }
};

// --- DRUM SYNTHESIS ---
export function playDrum(type, time) {
    const t = time || ctx.currentTime;
    
    if (type === 'kick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.connect(gain);
        gain.connect(masterCompressor);
        osc.start(t);
        osc.stop(t + 0.5);
        registerSource(osc); 
    } 
    else if (type === 'snare') {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, t);
        oscGain.gain.setValueAtTime(0, t);
        oscGain.gain.linearRampToValueAtTime(0.6, t + 0.01);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(oscGain);
        oscGain.connect(masterCompressor);
        osc.start(t);
        osc.stop(t + 0.2);
        registerSource(osc); 
        
        const bufferSize = ctx.sampleRate * 0.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        noise.connect(noiseGain);
        noiseGain.connect(masterCompressor);
        noise.start(t);
        registerSource(noise);
    }
    else if (type === 'hihat') {
        const bufferSize = ctx.sampleRate * 0.05;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 8000;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        noise.connect(filter).connect(gain).connect(masterCompressor);
        noise.start(t);
        registerSource(noise);
    }
    else if (type === 'metronome') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 1200;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.005);
        gain.gain.linearRampToValueAtTime(0, t + 0.05);
        osc.connect(gain);
        gain.connect(masterCompressor);
        osc.start(t);
        osc.stop(t + 0.05);
        registerSource(osc);
    }
}

// --- UTILS ---
function getFrequency(noteName, octave) {
    let cleanNote = noteName;
    if (!SHARPS.includes(cleanNote)) cleanNote = ENHARMONIC_MAP[cleanNote] || cleanNote;
    const noteIndex = SHARPS.indexOf(cleanNote);
    const semitonesFromA4 = (noteIndex - 9) + ((octave - 4) * 12);
    return 440 * Math.pow(2, semitonesFromA4 / 12);
}

// --- INSTRUMENT ENGINE ---
const activeOscillators = {}; 

export function startNote(freq, midiNoteNumber, instrumentName = 'Lead Synth', startTime = null, duration = null) {
    if (ctx.state === 'suspended') ctx.resume();
    
    if (midiNoteNumber > 0 && activeOscillators[midiNoteNumber]) return;

    const t = startTime || ctx.currentTime;
    const recipe = INSTRUMENTS[instrumentName] || INSTRUMENTS['Lead Synth'];
    
    // Safety check for release time
    const release = recipe.release || 0.1;
    const sustainLevel = (recipe.sustain !== undefined ? recipe.sustain : 0.5) * 0.5; // Max 0.5 gain

    // 1. Setup Oscillators
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = recipe.type;
    osc.frequency.value = freq;

    let outputNode = gain;
    if (recipe.filter) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = recipe.filter;
        gain.connect(filter);
        outputNode = filter;
    }
    outputNode.connect(masterCompressor);
    osc.connect(gain);

    // 2. Schedule Envelopes
    // Start at 0
    gain.gain.setValueAtTime(0, t);
    
    // Attack
    gain.gain.linearRampToValueAtTime(0.5, t + recipe.attack); 
    
    // Decay to Sustain
    gain.gain.setTargetAtTime(sustainLevel, t + recipe.attack, recipe.decay / 3);

    // 3. Handle Stop Logic
    // If DURATION is provided (Chords/Sequencer), we schedule the release NOW.
    // This prevents the "future read" bug.
    if (duration) {
        const releaseStart = t + duration;
        gain.gain.setTargetAtTime(0, releaseStart, release / 3);
        osc.start(t);
        osc.stop(releaseStart + release + 1.0); // Stop after release
        registerSource(osc);
    } else {
        // Infinite Sustain (Keyboard/MIDI) - wait for stopNote()
        osc.start(t);
        registerSource(osc);
    }

    // 4. Secondary Layer (Piano/Rich sounds)
    let osc2, gain2;
    if (recipe.type2) {
        osc2 = ctx.createOscillator();
        gain2 = ctx.createGain();
        osc2.type = recipe.type2;
        osc2.frequency.value = freq;
        osc2.detune.value = 5;

        const mix = recipe.mix || 0.5;
        gain2.gain.setValueAtTime(0, t);
        gain2.gain.linearRampToValueAtTime(0.5 * mix, t + recipe.attack);
        gain2.gain.setTargetAtTime(sustainLevel * mix, t + recipe.attack, recipe.decay / 3);

        osc2.connect(gain2);
        gain2.connect(masterCompressor);
        osc2.start(t);
        registerSource(osc2);

        if (duration) {
            const releaseStart = t + duration;
            gain2.gain.setTargetAtTime(0, releaseStart, release / 3);
            osc2.stop(releaseStart + release + 1.0);
        }
    }

    // 5. Save reference ONLY if it's a MIDI note (infinite hold)
    if (midiNoteNumber > 0) {
        activeOscillators[midiNoteNumber] = { osc, gain, osc2, gain2, recipe };
    }
}

// Interactive Stop (Keyboard Key Up)
export function stopNote(midiNoteNumber) {
    const voice = activeOscillators[midiNoteNumber];
    if (voice) {
        const now = ctx.currentTime;
        const release = voice.recipe.release || 0.1;

        // Cancel any future sustain logic
        voice.gain.gain.cancelScheduledValues(now);
        // Ramp down from CURRENT value (safe because we are stopping NOW)
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.setTargetAtTime(0, now, release / 3);
        
        voice.osc.stop(now + release + 1.0);

        if (voice.osc2) {
            voice.gain2.gain.cancelScheduledValues(now);
            voice.gain2.gain.setValueAtTime(voice.gain2.gain.value, now);
            voice.gain2.gain.setTargetAtTime(0, now, release / 3);
            voice.osc2.stop(now + release + 1.0);
        }

        delete activeOscillators[midiNoteNumber];
    }
}

// --- EXPORTS ---
export function playSingleNote(noteName, octave, time = null, instrument = 'Lead Synth') {
    const t = time || ctx.currentTime;
    const freq = getFrequency(noteName, octave);
    startNote(freq, -1, instrument, t, 1.5);
}

export function playTone(freq, startTime, duration, instrumentName = 'Acoustic Guitar') {
    startNote(freq, -1, instrumentName, startTime, duration);
}

export function playStrum(frequencies, time = null, instrument = 'Acoustic Guitar') {
    if (ctx.state === 'suspended') ctx.resume();
    const t = time || ctx.currentTime;
    
    const isGuitar = instrument.includes('Guitar');
    const delay = isGuitar ? 0.03 : 0.0;
    // Shortened pad duration slightly to prevent too much overlap mud
    const duration = instrument === 'Synth Pad' ? 2.5 : 2.0; 

    frequencies.forEach((freq, index) => {
        startNote(freq, -1, instrument, t + (index * delay), duration);
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
        startNote(freq, -1, 'Lead Synth', now + (index * 0.4), 0.5);
    });
}