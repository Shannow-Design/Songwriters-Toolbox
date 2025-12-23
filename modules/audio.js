// modules/audio.js
import { SampleStorage } from './storage.js';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ENHARMONIC_MAP = { 'Cb': 'B', 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

const AudioContext = window.AudioContext || window.webkitAudioContext;
export const ctx = new AudioContext();

// --- MASTER MIXER ---
const masterCompressor = ctx.createDynamicsCompressor();
masterCompressor.threshold.setValueAtTime(-8, ctx.currentTime);
masterCompressor.knee.setValueAtTime(30, ctx.currentTime);
masterCompressor.ratio.setValueAtTime(12, ctx.currentTime);
masterCompressor.attack.setValueAtTime(0.003, ctx.currentTime);
masterCompressor.release.setValueAtTime(0.25, ctx.currentTime);

const masterGain = ctx.createGain();
masterGain.gain.value = 0.5; 

// Reverb Bus
const reverbNode = ctx.createConvolver();
const reverbGain = ctx.createGain();
reverbGain.gain.value = 1.0; 

function createImpulse(duration, decay) {
    const len = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let i = 0; i < len; i++) {
        let val = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        buf.getChannelData(0)[i] = val;
        buf.getChannelData(1)[i] = val;
    }
    return buf;
}
reverbNode.buffer = createImpulse(2.0, 2.0);

masterCompressor.connect(masterGain);
reverbNode.connect(reverbGain);
reverbGain.connect(masterGain);
masterGain.connect(ctx.destination);

// --- MICROPHONE INPUT SYSTEM ---
export const Microphone = {
    stream: null,
    sourceNode: null,
    gainNode: null,
    analyserNode: null,
    destinationNode: null,
    isInitialized: false,

    async init() {
        if (this.isInitialized) return;

        try {
            const constraints = {
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    latency: 0,
                    channelCount: 1 
                }
            };

            const rawStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            this.sourceNode = ctx.createMediaStreamSource(rawStream);
            this.gainNode = ctx.createGain();
            this.gainNode.gain.value = 1.0; 
            
            this.analyserNode = ctx.createAnalyser();
            this.analyserNode.fftSize = 256;
            
            this.destinationNode = ctx.createMediaStreamDestination();

            this.sourceNode.connect(this.gainNode);
            this.gainNode.connect(this.analyserNode);
            this.analyserNode.connect(this.destinationNode); 

            this.stream = this.destinationNode.stream; 
            this.isInitialized = true;
            console.log("Microphone Initialized with HQ constraints");

        } catch (err) {
            console.error("Microphone Init Failed:", err);
            throw err;
        }
    },

    setGain(val) {
        if(this.gainNode) {
            this.gainNode.gain.setTargetAtTime(val, ctx.currentTime, 0.02);
        }
    },

    getLevel() {
        if(!this.analyserNode) return 0;
        const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
        this.analyserNode.getByteTimeDomainData(dataArray);
        
        let sum = 0;
        for(let i = 0; i < dataArray.length; i++) {
            const x = (dataArray[i] - 128) / 128.0;
            sum += x * x;
        }
        return Math.sqrt(sum / dataArray.length);
    }
};

// --- TRACK MIXER ---
const tracks = ['chords', 'bass', 'lead', 'drums', 'samples', 'looper'];
const mixer = {};

tracks.forEach(name => {
    const input = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const volume = ctx.createGain();
    const reverbSend = ctx.createGain();

    input.gain.value = 1.0;
    filter.frequency.value = 20000; 
    volume.gain.value = 0.8;
    reverbSend.gain.value = 0.1;

    input.connect(filter);
    filter.connect(volume);
    volume.connect(masterCompressor);
    input.connect(reverbSend);
    reverbSend.connect(reverbNode);

    mixer[name] = { input, filter, volume, reverbSend };
});

export function setTrackVolume(t, v) { if(mixer[t]) mixer[t].volume.gain.setTargetAtTime(v, ctx.currentTime, 0.02); }
export function setTrackFilter(t, v) { 
    if(mixer[t]) {
        const freq = Math.exp(Math.log(100) + v * (Math.log(20000) - Math.log(100)));
        mixer[t].filter.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
    }
}
export function setTrackReverb(t, v) { if(mixer[t]) mixer[t].reverbSend.gain.setTargetAtTime(v * 0.8, ctx.currentTime, 0.02); }

// --- SAMPLER ENGINE ---
export const SAMPLE_BANKS = new Array(8).fill(null);

export async function loadSavedSamples() {
    for(let i=0; i<8; i++) {
        const entry = await SampleStorage.loadSample(i, ctx);
        if(entry && entry.buffer) SAMPLE_BANKS[i] = entry;
    }
}

// 1. RECORDING
export function recordSample(stream, maxLen = 10.0) {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || "";
    const options = mimeType ? { mimeType } : {};
    
    const mediaRecorder = new MediaRecorder(stream, options);
    const chunks = [];

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    const result = new Promise(resolve => {
        mediaRecorder.onstop = async () => {
            try {
                if (chunks.length === 0) { resolve(null); return; }
                const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
                const arrayBuffer = await blob.arrayBuffer();
                try {
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                    resolve(audioBuffer);
                } catch(e) { console.error(e); resolve(null); }
            } catch (err) { console.error(err); resolve(null); }
        };
    });

    mediaRecorder.start();

    const timeoutId = setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    }, maxLen * 1000);

    return {
        result,
        stop: () => {
            clearTimeout(timeoutId);
            if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        }
    };
}

// 2. TRIM & NORMALIZE
export function autoTrimBuffer(buffer) {
    if (!buffer) return null;
    const data = buffer.getChannelData(0);
    const threshold = 0.02; 
    let start = 0, end = data.length;

    for (let i = 0; i < data.length; i++) {
        if (Math.abs(data[i]) > threshold) { start = i; break; }
    }
    for (let i = data.length - 1; i >= start; i--) {
        if (Math.abs(data[i]) > threshold) { end = i + 1; break; }
    }
    start = Math.max(0, start - 200);
    end = Math.min(data.length, end + 2000); 
    const length = end - start;
    if (length <= 0) return buffer;

    const trimmed = ctx.createBuffer(1, length, buffer.sampleRate);
    const trimmedData = trimmed.getChannelData(0);
    
    let maxAmp = 0;
    for (let i = start; i < end; i++) {
        const abs = Math.abs(data[i]);
        if (abs > maxAmp) maxAmp = abs;
    }
    const gainMult = 0.95 / (maxAmp || 1); 

    for (let i = 0; i < length; i++) {
        trimmedData[i] = data[start + i] * gainMult;
    }
    return trimmed;
}

// 3. FADE IN/OUT (DE-CLICKER)
export function applyFades(buffer, fadeTime = 0.01) { 
    if (!buffer) return null;
    
    const fadeSamples = Math.floor(fadeTime * buffer.sampleRate);
    const len = buffer.length;
    
    if(len < fadeSamples * 2) return buffer;

    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < fadeSamples; i++) {
            data[i] *= (i / fadeSamples);
        }
        for (let i = 0; i < fadeSamples; i++) {
            const index = len - 1 - i;
            data[index] *= (i / fadeSamples);
        }
    }
    return buffer;
}

// 4. NEW: SHIFT BUFFER (LATENCY COMPENSATION)
export function shiftBuffer(buffer, shiftMs) {
    if (!buffer || shiftMs <= 0) return buffer;
    
    // Calculate samples to skip
    const shiftSamples = Math.floor((shiftMs / 1000) * buffer.sampleRate);
    const newLen = buffer.length - shiftSamples;
    
    if (newLen <= 0) return buffer; // Too short to shift

    const newBuf = ctx.createBuffer(buffer.numberOfChannels, newLen, buffer.sampleRate);

    for(let c=0; c<buffer.numberOfChannels; c++) {
        const oldData = buffer.getChannelData(c);
        const newData = newBuf.getChannelData(c);
        for(let i=0; i<newLen; i++) {
            // Copy data shifted by N samples
            newData[i] = oldData[i + shiftSamples];
        }
    }
    return newBuf;
}

// 5. PLAYBACK
export function playSample(slotIndex, time, freq = null, track = 'lead', bufferOverride = null) {
    let buffer;
    
    if (bufferOverride) {
        buffer = bufferOverride; 
    } else {
        const entry = SAMPLE_BANKS[slotIndex];
        if (!entry || !entry.buffer) return null;
        buffer = entry.buffer;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    if (freq) {
        let baseFreq = (track === 'bass') ? 65.41 : 130.81; 
        let rate = freq / baseFreq;
        if(rate < 0.1) rate = 0.1;
        if(rate > 4.0) rate = 4.0;
        source.playbackRate.value = rate;
    }

    const dest = mixer[track] ? mixer[track].input : mixer.lead.input;
    source.connect(dest);
    source.start(time);
    
    return { osc: source, gain: null, type: 'sampler' }; 
}

// 6. LOAD FILE
export async function decodeAudioFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        return await ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.error("File Decode Error", e);
        return null;
    }
}

// 7. SAVE FILE
export function bufferToWav(buffer) {
    const numChannels = 1; 
    const sampleRate = buffer.sampleRate;
    const format = 1; 
    const bitDepth = 16;
    
    const data = buffer.getChannelData(0);
    const byteRate = sampleRate * numChannels * bitDepth / 8;
    const blockAlign = numChannels * bitDepth / 8;
    const dataSize = data.length * numChannels * bitDepth / 8;
    const bufferLen = 44 + dataSize;
    const wav = new ArrayBuffer(bufferLen);
    const view = new DataView(wav);

    const writeString = (view, offset, string) => {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < data.length; i++) {
        let sample = Math.max(-1, Math.min(1, data[i]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, sample, true);
        offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
}

// --- SYNTH ENGINE ---
export const INSTRUMENTS = {
    'Acoustic Guitar': { type: 'triangle', attack: 0.02, decay: 0.4, sustain: 0, release: 0.1 }, 
    'Piano':           { type: 'sine', attack: 0.01, decay: 0.8, sustain: 0.2, release: 0.5, type2: 'triangle', mix: 0.3 }, 
    'Lead Synth':      { type: 'sawtooth', attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.2 },
    'Synth Pad':       { type: 'triangle', attack: 0.8, decay: 1.0, sustain: 0.8, release: 2.0 }, 
    'Bass Guitar':     { type: 'square', attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.1, filter: 600 },
    'Strings':         { type: 'sawtooth', attack: 0.4, decay: 0.5, sustain: 0.7, release: 1.2, filter: 2000 },
    'Marimba':         { type: 'sine', attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    '8-Bit / NES':     { type: 'square', attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 }
};

for(let i=1; i<=8; i++) INSTRUMENTS[`Sampler ${i}`] = { type: 'sampler', slot: i-1 };

const MAX_VOICES = 30; 
const activeOscillators = {}; 
const allRunningVoices = []; 

export function startNote(freq, midiNote, instName = 'Lead Synth', start = null, dur = null, track = 'lead') {
    if (ctx.state === 'suspended') ctx.resume();
    
    if (midiNote > 0 && activeOscillators[midiNote]) {
        stopNote(midiNote);
    }

    if (allRunningVoices.length >= MAX_VOICES) {
        const oldest = allRunningVoices.shift();
        try {
            oldest.gain.disconnect();
            oldest.osc.stop();
        } catch(e) { }
    }

    if (instName.startsWith('Sampler')) {
        const slot = parseInt(instName.split(' ')[1]) - 1;
        const voice = playSample(slot, start || ctx.currentTime, freq, track);
        if (midiNote > 0 && voice) activeOscillators[midiNote] = voice;
        return voice;
    }

    const t = start || ctx.currentTime;
    const recipe = INSTRUMENTS[instName] || INSTRUMENTS['Lead Synth'];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = recipe.type;
    osc.frequency.value = freq;

    let outputNode = gain;
    if (recipe.filter) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = recipe.filter;
        gain.connect(f); outputNode = f;
    }
    outputNode.connect(mixer[track] ? mixer[track].input : mixer.lead.input);
    osc.connect(gain);

    const peakGain = 0.15; 

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + recipe.attack); 
    gain.gain.setTargetAtTime(peakGain * (recipe.sustain !== undefined ? recipe.sustain : 0.6), t + recipe.attack, recipe.decay / 3);

    if (dur) {
        const releaseTail = recipe.release || 0.2;
        if (recipe.sustain === 0) {
             osc.start(t);
             osc.stop(t + recipe.decay + releaseTail + 1.0); 
        } else {
             gain.gain.setTargetAtTime(0, t + dur, 0.1);
             osc.start(t);
             osc.stop(t + dur + releaseTail);
        }
    } else {
        osc.start(t);
    }
    
    const voice = { osc, gain, type: 'synth' };
    allRunningVoices.push(voice);
    
    osc.onended = () => {
        const idx = allRunningVoices.indexOf(voice);
        if (idx > -1) allRunningVoices.splice(idx, 1);
    };

    if (midiNote > 0) activeOscillators[midiNote] = voice;
    return voice;
}

export function stopNote(midiNote) {
    const voice = activeOscillators[midiNote];
    if (voice) {
        if (voice.type === 'synth') {
            const now = ctx.currentTime;
            voice.gain.gain.cancelScheduledValues(now);
            voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
            voice.gain.gain.linearRampToValueAtTime(0, now + 0.1);
            voice.osc.stop(now + 0.1);
        } else if (voice.type === 'sampler') {
            try { voice.osc.stop(); } catch(e){}
        }
        delete activeOscillators[midiNote];
    }
}

export function playStrum(freqs, time, instName, step = 0) {
    if (instName && instName.startsWith('Sampler')) {
        const slot = parseInt(instName.split(' ')[1]) - 1;
        freqs.forEach((f, i) => playSample(slot, time + (i*0.03), f, 'chords'));
        return;
    }
    
    const t = time || ctx.currentTime;
    const isG = instName && instName.includes('Guitar');
    let d = isG ? 0.03 : 0.0;
    
    let notesToPlay = [...freqs];
    if (isG && step % 2 !== 0) {
        notesToPlay.reverse(); 
    }

    notesToPlay.forEach((f, i) => startNote(f, -1, instName, t + (i*d), 0.5, 'chords'));
}

export function playDrum(type, time) {
    // ... (Keep drum play code - no changes) ...
    const t = time || ctx.currentTime;
    const dest = mixer.drums.input; 
    
    if (type === 'kick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.connect(gain); gain.connect(dest);
        osc.start(t); osc.stop(t + 0.5);
    } 
    else if (type === 'snare') {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, t);
        oscGain.gain.setValueAtTime(0, t);
        oscGain.gain.linearRampToValueAtTime(0.6, t + 0.01);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(oscGain); oscGain.connect(dest);
        osc.start(t); osc.stop(t + 0.2);
        
        const buf = ctx.createBuffer(1, ctx.sampleRate*0.2, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.5, t);
        nGain.gain.exponentialRampToValueAtTime(0.01, t+0.2);
        noise.connect(nGain); nGain.connect(dest);
        noise.start(t);
    }
    else if (type === 'hihat') {
        const buf = ctx.createBuffer(1, ctx.sampleRate*0.05, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=8000;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.01, t+0.05);
        noise.connect(f).connect(g).connect(dest);
        noise.start(t);
    }
    else if (type === 'metronome') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 1200;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.005);
        gain.gain.linearRampToValueAtTime(0, t + 0.05);
        osc.connect(gain); gain.connect(dest);
        osc.start(t); osc.stop(t + 0.05);
    }
}

export function stopAllSounds() {
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    setTimeout(() => masterGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime+0.1), 100);
}

function getFrequency(noteName, octave) {
    let cleanNote = noteName;
    if (!SHARPS.includes(cleanNote)) cleanNote = ENHARMONIC_MAP[cleanNote] || cleanNote;
    const noteIndex = SHARPS.indexOf(cleanNote);
    const semitonesFromA4 = (noteIndex - 9) + ((octave - 4) * 12);
    return 440 * Math.pow(2, semitonesFromA4 / 12);
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
        startNote(freq, -1, 'Lead Synth', now + (index * 0.4), 0.5, 'lead');
    });
}

export function playSingleNote(note, oct, time, inst) { 
    const t = time||ctx.currentTime;
    startNote(getFrequency(note, oct), -1, inst || 'Piano', t, 1.5, 'lead');
}