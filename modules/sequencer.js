// modules/sequencer.js
import { ctx, playDrum, playStrum, startNote, stopAllSounds, INSTRUMENTS, setTrackVolume, setTrackFilter, setTrackReverb, setTrackPan } from './audio.js';
import { getAllChords, generateScale } from './theory.js'; 

const DRUM_PATTERNS = {
    'Basic Rock': { kick:[1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat:[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Four on Floor': { kick:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat:[0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Indie Disco': { kick:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat:[0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Hard Rock': { kick:[1,0,0,1, 0,0,1,0, 1,0,0,0, 0,0,1,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat:[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Punk': { kick:[1,0,0,1, 0,1,0,0, 1,0,0,1, 0,1,0,0], snare:[0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0], hihat:[1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0] },
    'Half-Time Shuffle': { kick:[1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,1,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat:[1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Hip Hop': { kick:[1,0,0,0, 0,0,1,0, 0,0,0,0, 0,1,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat:[1,0,1,0, 1,1,1,0, 1,0,1,0, 1,0,1,1], tom:[0,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0], crash:[1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Funk Break': { kick:[1,0,0,1, 0,0,1,0, 0,0,0,1, 0,1,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,0,0], hihat:[1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0], crash:[1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Trap': { kick:[1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat:[1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Bossa Nova': { kick:[1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0], snare:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], hihat:[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Samba': { kick:[1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,0,1], snare:[0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0], hihat:[1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Cha Cha': { kick:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare:[0,0,0,0, 0,0,0,0, 0,0,1,0, 1,0,0,0], hihat:[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Tango': { kick:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare:[1,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0], hihat:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Reggae': { kick:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat:[0,1,1,1, 0,1,1,1, 0,1,1,1, 0,1,1,1], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Empty': { kick:Array(16).fill(0), snare:Array(16).fill(0), hihat:Array(16).fill(0), tom:Array(16).fill(0), crash:Array(16).fill(0) }
};

const FILL_PATTERNS = {
    'Snare Roll 16ths': { kick:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare:[0,0,0,0, 0,0,0,0, 1,1,1,1, 1,1,1,1], hihat:[1,0,1,0, 1,0,1,0, 0,0,0,0, 0,0,0,0], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Tom Rundown': { kick:[1,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0], snare:[0,0,0,0, 0,0,0,0, 1,1,0,0, 0,0,0,0], hihat:[1,0,1,0, 1,0,1,0, 0,0,0,0, 0,0,0,0], tom:[0,0,0,0, 0,0,0,0, 0,0,1,1, 1,1,1,1], crash:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Disco Fill': { kick:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare:[0,0,0,0, 1,0,0,0, 0,0,1,0, 1,1,1,1], hihat:[0,0,1,0, 0,0,1,0, 0,0,0,0, 0,0,0,0], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Rock Fill': { kick:[1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], snare:[0,0,1,0, 1,0,1,0, 0,0,1,1, 1,1,1,1], hihat:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], tom:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], crash:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    'Empty': { kick:Array(16).fill(0), snare:Array(16).fill(0), hihat:Array(16).fill(0), tom:Array(16).fill(0), crash:Array(16).fill(0) }
};

const BASS_PATTERNS = { 'Root Notes':['1',null,null,null, '1',null,null,null, '1',null,null,null, '1',null,null,null], 'Root & Fifth':['1',null,null,null, '5',null,null,null, '1',null,null,null, '5',null,null,null], 'Walking':['1',null,'3',null, '5',null,'8',null, '1',null,'3',null, '5',null,'8',null], 'Disco Octaves':['1',null,'8',null, '1',null,'8',null, '1',null,'8',null, '1',null,'8',null], 'Offbeat Pump':[null,'1',null,'1', null,'1',null,'1', null,'1',null,'1', null,'1',null,'1'], 'Running 8ths':['1',null,'1',null, '1',null,'1',null, '1',null,'1',null, '1',null,'1',null], 'Empty':Array(16).fill(null) };
const MELODY_PATTERNS = { 'Arp Up (8ths)':['1',null,'3',null, '5',null,'8',null, '1',null,'3',null, '5',null,'8',null], 'Arp Down (8ths)':['8',null,'5',null, '3',null,'1',null, '8',null,'5',null, '3',null,'1',null], 'Fast Arp (16ths)':['1','3','5','8', '5','3','1','3', '5','8','1','3', '5','8','5','3'], 'Alberti':['1',null,'5',null, '3',null,'5',null, '1',null,'5',null, '3',null,'5',null], 'Staircase':['1',null,'3',null, '1',null,'5',null, '1',null,'8',null, '1',null,'5',null], 'Pedal Point':['8',null,'3',null, '8',null,'5',null, '8',null,'1',null, '8',null,'5',null], 'Empty':Array(16).fill(null) };
const SAMPLES_PATTERNS = { 'Whole Note (Drone)':['1',null,null,null, null,null,null,null, null,null,null,null, null,null,null,null], 'Half Notes (1 & 3)':['1',null,null,null, null,null,null,null, '1',null,null,null, null,null,null,null], 'Backbeat Stab':[null,null,null,null, '1',null,null,null, null,null,null,null, '1',null,null,null], 'Dotted Quarter':['1',null,null,null, null,null,'1',null, null,null,null,null, '1',null,null,null], 'Offbeat 8ths':[null,null,'1',null, null,null,'1',null, null,null,'1',null, null,null,'1',null], 'Slow Arp (Halves)':['1',null,null,null, null,null,null,null, '5',null,null,null, null,null,null,null], 'Charleston':['1',null,null,null, null,null,'1',null, null,null,null,null, null,null,null,null], 'Empty':Array(16).fill(null) };
const RHYTHM_PATTERNS = { 'Whole Notes':[1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], 'Quarter Strum':[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], 'Driving 8ths':[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], 'Syncopated':[1,0,0,1, 0,0,1,0, 0,0,1,0, 0,0,0,0], 'Reggae Skank':[0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0], 'Gallop':[1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,0,1], 'Charleston':[1,0,0,1, 0,0,0,0, 0,0,0,0, 0,0,0,0] };

const DEFAULT_PROGRESSIONS = {
    'Pop Hit (I-V-vi-IV)': [0, 4, 5, 3],
    'Doo Wop (I-vi-IV-V)': [0, 5, 3, 4],
    'Blues (I-IV-I-V)':    [0, 3, 0, 4],
    'Jazz ii-V-I':         [1, 4, 0, 0],
    'Minor Sad (vi-IV-I-V)': [5, 3, 0, 4],
    'Canon (Pachelbel)':   [0, 4, 5, 2, 3, 0, 3, 4],
    'Andalusian':          [5, 4, 3, 2],
    'Royal Road':          [3, 4, 2, 5],
    'Circle of 5ths':      [0, 3, 6, 2, 5, 1, 4, 0]
};

const ROMAN_NUMERALS = [
    'I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°',
    'III (V/vi)', 'VI (V/ii)', 'II (V/V)', 'VII (V/iii)',
    'bIII', 'iv', 'v', 'bVI', 'bVII',
    'bII'
];

const SCALE_OPTIONS = [null, '1', '2', '3', '4', '5', '6', '7', '8'];

export class Sequencer {
    constructor(containerId, getScaleDataCallback, onChordChangeCallback, onPresetLoadCallback, onStepCallback, onStopCallback, getLooperDataCallback, onLeadStepCallback) {
        this.container = document.getElementById(containerId);
        this.getScaleData = getScaleDataCallback; 
        this.onChordChange = onChordChangeCallback; 
        this.onPresetLoad = onPresetLoadCallback;
        this.onStepCallback = onStepCallback; 
        this.onStopCallback = onStopCallback; 
        this.getLooperData = getLooperDataCallback; 
        this.onLeadStep = onLeadStepCallback; 

        this.isPlaying = false;
        this.isPreviewing = false; 
        this.previewStep = 0;      
        this.bpm = 100;
        this.currentStep = 0;
        this.nextNoteTime = 0;
        this.timerID = null;
        this.lookahead = 25.0; 
        this.scheduleAheadTime = 0.1; 
        this.progressionCycles = 0; 

        this.customData = {
            progressions: JSON.parse(localStorage.getItem('custom_progressions')) || {},
            rhythm:       JSON.parse(localStorage.getItem('custom_rhythms')) || {}, 
            bass:         JSON.parse(localStorage.getItem('custom_bass')) || {},
            lead:         JSON.parse(localStorage.getItem('custom_lead')) || {},
            samples:      JSON.parse(localStorage.getItem('custom_samples')) || {},
            drums:        JSON.parse(localStorage.getItem('custom_drums')) || {},
            fills:        JSON.parse(localStorage.getItem('custom_fills')) || {} 
        };

        this.libraries = {
            progression: { ...DEFAULT_PROGRESSIONS, ...this.customData.progressions },
            rhythm:      { ...RHYTHM_PATTERNS, ...this.customData.rhythm }, 
            bass:        { ...BASS_PATTERNS, ...this.customData.bass },
            lead:        { ...MELODY_PATTERNS, ...this.customData.lead },
            samples:     { ...SAMPLES_PATTERNS, ...this.customData.samples },
            drums:       { ...DRUM_PATTERNS, ...this.customData.drums },
            fills:       { ...FILL_PATTERNS, ...this.customData.fills } 
        };

        this.savedPresets = JSON.parse(localStorage.getItem('sequencer_presets')) || {};
        this.globalFavorites = JSON.parse(localStorage.getItem('sequencer_global_favorites')) || {};

        this.state = {
            progressionName: 'Pop Hit (I-V-vi-IV)',
            rhythmName: 'Whole Notes',
            drumName: 'Basic Rock',
            fillName: 'Tom Rundown',
            bassName: 'Root & Fifth',
            leadName: 'Empty',
            samplesName: 'Whole Note (Drone)'
        };
        
        this.settings = {
            metronome: false,
            metronomeSubdivision: 4, 
            shuffle: false,
            autoFill: false, 
            instrument: 'Acoustic Guitar',
            bassInstrument: 'Bass Guitar',
            leadInstrument: 'Piano',
            samplesInstrument: 'Sampler 1',
            volumes: { chords:0.8, bass:0.8, lead:0.8, samples:0.8, drums:0.8 },
            filters: { chords:1.0, bass:1.0, lead:1.0, samples:1.0, drums:1.0 },
            reverbs: { chords:0.1, bass:0.1, lead:0.1, samples:0.1 },
            pans: { chords:0, bass:0, lead:0, samples:0, drums:0 }, 
            octaves: { chords: 0, bass: 0, lead: 0, samples: 0 },
            drops: { chords: false, bass: false, lead: false, samples: false },
            upStrums: true,
            progressionIndex: 0 
        };

        this.renderUI();
        this.injectModals(); 
    }

    renderUI() {
        const style = document.createElement('style');
        style.innerHTML = `
            .track-row {
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
                background: #1c1c1c;
                padding: 12px 20px;
                border-radius: 8px;
                margin-bottom: 12px;
                align-items: center;
                border: 1px solid #2a2a2a;
            }
            .track-header-col {
                width: 115px; 
                flex-shrink: 0;
            }
            .track-header-col strong {
                color: #00e5ff; 
                font-size: 0.85rem; 
                letter-spacing: 1px;
            }
            .track-mixer-col {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                flex: 2;
                min-width: 240px;
                max-width: 400px;
            }
            .slider-group {
                display: flex;
                flex-direction: column;
                flex: 1;
                min-width: 60px;
            }
            .slider-group label {
                font-size: 0.65rem; 
                color: #888;
                margin-bottom: 4px;
            }
            .slider-group input {
                width: 100%; 
                accent-color: var(--primary-cyan);
            }
            .track-sound-col {
                flex: 1.5;
                min-width: 140px;
                max-width: 250px;
                display: flex;
                flex-direction: column;
            }
            .track-pattern-col {
                flex: 2.5;
                min-width: 200px;
                display: flex;
                flex-direction: column;
            }
            .track-octave-col {
                width: 60px;
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
            }
            .full-width-select {
                width: 100%;
                background: #111;
                color: #fff;
                border: 1px solid #444;
                padding: 6px 8px;
                border-radius: 4px;
                font-size: 0.8rem;
            }
            .bpm-btn {
                background: #444;
                border: none;
                color: #fff;
                cursor: pointer;
                padding: 0 6px;
                border-radius: 3px;
                font-size: 0.9rem;
                font-weight: bold;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .bpm-btn:hover {
                background: var(--primary-cyan);
                color: #000;
            }
        `;
        this.container.appendChild(style);

        const createSliderGroup = (idPrefix, label, val, min=0, max=1, step=0.1) => `
            <div class="slider-group">
                <label>${label}</label>
                <input type="range" class="vol-slider" id="${idPrefix}" min="${min}" max="${max}" step="${step}" value="${val}">
            </div>
        `;
        
        const createHeader = (title, type) => `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label style="font-size:0.75rem; color:#ccc;">${title}</label>
                <div>
                    <button class="btn-edit-pat" data-type="${type}" style="font-size:0.6rem; padding:2px 5px; margin-right:5px; background:#444; border:1px solid #555; color:#fff; border-radius:3px;">EDIT</button>
                    <button id="btn-del-${type}" class="btn-delete-custom" style="display:none; font-size:0.6rem; padding:2px 5px; margin-right:5px; background:#aa0033; color:white; border:none; border-radius:3px;">DEL</button>
                    <button class="btn-new" data-type="${type}" style="font-size:0.6rem; padding:2px 5px; background:#00e5ff; color:#000; border:none; border-radius:3px; font-weight:bold;">+ NEW</button>
                </div>
            </div>
        `;
        
        const createOctaveControl = (track) => `
            <div class="track-octave-col">
                <label style="font-size:0.75rem; color:#ccc; margin-bottom:5px;">Octave</label>
                <select id="sel-oct-${track}" class="full-width-select" style="margin-bottom:5px; padding: 4px;">
                    <option value="-2">-2</option>
                    <option value="-1">-1</option>
                    <option value="0" selected>0</option>
                    <option value="1">+1</option>
                    <option value="2">+2</option>
                </select>
                <div style="display:flex; align-items:center; cursor:pointer; justify-content:center;" title="Drop chords higher than root">
                    <input type="checkbox" id="cb-drop-${track}" style="width:10px; height:10px; accent-color:var(--primary-cyan);">
                    <label for="cb-drop-${track}" style="font-size:0.6rem; color:#888; margin-left:3px; cursor:pointer;">Drop</label>
                </div>
            </div>
        `;

        const html = `
            <div class="sequencer-controls">
                
                <div class="seq-row" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:20px; margin-bottom:20px; background:#1a1a1a; padding:15px 20px; border-radius:8px; border:1px solid #333;">
                    <div style="display:flex; gap:15px; align-items:center; flex-wrap:wrap;">
                        <button id="btn-seq-play" class="play-btn" style="min-width:140px;">▶ PLAY TRACK</button>
                        <div class="bpm-control" style="display:flex; align-items:center; gap:10px;">
                            <label style="white-space:nowrap; color:#fff; font-size:0.9rem;">BPM: <span id="bpm-val">100</span></label>
                            <div style="display:flex; align-items:center; gap:5px;">
                                <button id="btn-bpm-down" class="bpm-btn">-</button>
                                <input type="range" id="bpm-slider" min="40" max="200" value="100" style="width:100px; accent-color:var(--primary-cyan);">
                                <button id="btn-bpm-up" class="bpm-btn">+</button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 15px; align-items: center; border-left: 1px solid #444; padding-left: 15px; flex-wrap:wrap;">
                        <div style="display:flex; align-items:center; gap:5px;">
                            <input type="checkbox" id="cb-metronome" style="accent-color: #00e5ff; width:16px; height:16px; cursor:pointer;">
                            <label for="cb-metronome" style="cursor:pointer; font-size:0.85rem; color:#ccc;">Click</label>
                        </div>
                        <div style="display:flex; align-items:center; gap:5px;">
                            <input type="checkbox" id="cb-shuffle" style="accent-color: #00e5ff; width:16px; height:16px; cursor:pointer;"> 
                            <label id="lbl-shuffle" for="cb-shuffle" style="cursor:pointer; font-size:0.85rem; color:#ccc; transition: color 0.2s;">Shuffle</label>
                        </div>
                        <select id="sel-metronome-sub" class="full-width-select" style="width:auto; padding:2px 8px;">
                            <option value="4" selected>1/4</option>
                            <option value="2">1/8</option>
                        </select>
                    </div>
                    
                    <div style="display:flex; gap:8px; align-items:center; margin-left:auto;">
                        <select id="sel-presets" class="full-width-select" style="width:150px;"><option value="">Load Preset...</option></select>
                        <button id="btn-save-preset" class="btn-new" style="background:#00e5ff; color:#000; padding:6px 10px; font-weight:bold; border-radius:4px; border:none;" title="Save to Project">SAVE</button>
                        <button id="btn-fav-preset" class="btn-new" style="background:#ffbb00; color:#000; padding:6px 10px; font-weight:bold; border-radius:4px; border:none;" title="Save to Global Favorites">⭐ FAV</button>
                        <button id="btn-del-preset" class="btn-delete-custom" style="display:none; background:#aa0033; color:white; padding:6px 10px; border:none; border-radius:4px;">X</button>
                    </div>
                </div>

                <div class="track-row">
                    <div class="track-header-col">
                        <strong>CHORDS</strong>
                    </div>
                    <div class="track-mixer-col">
                        ${createSliderGroup('vol-chords', 'Vol', this.settings.volumes.chords)}
                        ${createSliderGroup('pan-chords', 'Pan', this.settings.pans.chords, -1, 1, 0.1)}
                        ${createSliderGroup('filt-chords', 'Bright', this.settings.filters.chords)}
                        ${createSliderGroup('verb-chords', 'Space', this.settings.reverbs.chords)}
                    </div>
                    <div class="track-sound-col">
                        <label style="font-size:0.75rem; color:#ccc; margin-bottom:5px;">Sound</label>
                        <select id="sel-instrument" class="full-width-select"></select>
                    </div>
                    <div class="track-pattern-col">
                        ${createHeader('Rhythm', 'rhythm')}
                        <select id="sel-rhythm" class="full-width-select"></select>
                        <div style="display:flex; align-items:center; margin-top:5px; cursor:pointer;" title="Alternating Up/Down strums">
                            <input type="checkbox" id="cb-alt-strum" style="width:12px; height:12px; accent-color:var(--primary-cyan);" checked>
                            <label for="cb-alt-strum" style="font-size:0.7rem; color:#888; margin-left:5px; cursor:pointer;">Alt Strum</label>
                        </div>
                    </div>
                    ${createOctaveControl('chords')}
                </div>

                <div class="track-row">
                    <div class="track-header-col">
                        <strong>BASS</strong>
                    </div>
                    <div class="track-mixer-col">
                        ${createSliderGroup('vol-bass', 'Vol', this.settings.volumes.bass)}
                        ${createSliderGroup('pan-bass', 'Pan', this.settings.pans.bass, -1, 1, 0.1)}
                        ${createSliderGroup('filt-bass', 'Bright', this.settings.filters.bass)}
                        ${createSliderGroup('verb-bass', 'Space', this.settings.reverbs.bass)}
                    </div>
                    <div class="track-sound-col">
                        <label style="font-size:0.75rem; color:#ccc; margin-bottom:5px;">Sound</label>
                        <select id="sel-bass-instrument" class="full-width-select"></select>
                    </div>
                    <div class="track-pattern-col">
                        ${createHeader('Pattern', 'bass')}
                        <select id="sel-bass-pattern" class="full-width-select"></select>
                    </div>
                    ${createOctaveControl('bass')}
                </div>

                <div class="track-row">
                    <div class="track-header-col">
                        <strong>LEAD</strong>
                    </div>
                    <div class="track-mixer-col">
                        ${createSliderGroup('vol-lead', 'Vol', this.settings.volumes.lead)}
                        ${createSliderGroup('pan-lead', 'Pan', this.settings.pans.lead, -1, 1, 0.1)}
                        ${createSliderGroup('filt-lead', 'Bright', this.settings.filters.lead)}
                        ${createSliderGroup('verb-lead', 'Space', this.settings.reverbs.lead)}
                    </div>
                    <div class="track-sound-col">
                        <label style="font-size:0.75rem; color:#ccc; margin-bottom:5px;">Sound</label>
                        <select id="sel-lead-instrument" class="full-width-select"></select>
                    </div>
                    <div class="track-pattern-col">
                        ${createHeader('Pattern', 'lead')}
                        <select id="sel-lead-pattern" class="full-width-select"></select>
                    </div>
                    ${createOctaveControl('lead')}
                </div>

                <div class="track-row">
                    <div class="track-header-col">
                        <strong>SAMPLES</strong>
                    </div>
                    <div class="track-mixer-col">
                        ${createSliderGroup('vol-samples', 'Vol', this.settings.volumes.samples)}
                        ${createSliderGroup('pan-samples', 'Pan', this.settings.pans.samples, -1, 1, 0.1)}
                        ${createSliderGroup('filt-samples', 'Bright', this.settings.filters.samples)}
                        ${createSliderGroup('verb-samples', 'Space', this.settings.reverbs.samples)}
                    </div>
                    <div class="track-sound-col">
                        <label style="font-size:0.75rem; color:#ccc; margin-bottom:5px;">Sampler</label>
                        <select id="sel-samples-instrument" class="full-width-select"></select>
                    </div>
                    <div class="track-pattern-col">
                        ${createHeader('Pattern', 'samples')}
                        <select id="sel-samples-pattern" class="full-width-select"></select>
                    </div>
                    ${createOctaveControl('samples')}
                </div>

                <div class="track-row">
                    <div class="track-header-col">
                        <strong>DRUMS</strong>
                    </div>
                    <div class="track-mixer-col">
                        ${createSliderGroup('vol-drums', 'Vol', this.settings.volumes.drums)}
                        ${createSliderGroup('pan-drums', 'Pan', this.settings.pans.drums, -1, 1, 0.1)}
                        ${createSliderGroup('filt-drums', 'Bright', this.settings.filters.drums)}
                        <div class="slider-group"></div> 
                    </div>
                    <div class="track-sound-col" style="visibility:hidden; flex: 0; min-width:0; max-width:0;"></div>
                    
                    <div class="track-pattern-col" style="flex: 4; max-width: none;"> 
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <label style="font-size:0.75rem; color:#ccc;">Pattern</label>
                            <div>
                                <button class="btn-edit-pat" data-type="drums" style="font-size:0.6rem; padding:2px 5px; margin-right:5px; background:#444; border:1px solid #555; color:#fff; border-radius:3px;">EDIT</button>
                                <button id="btn-del-drums" class="btn-delete-custom" style="display:none; font-size:0.6rem; padding:2px 5px; margin-right:5px; background:#aa0033; color:white; border:none; border-radius:3px;">DEL</button>
                                <button class="btn-new" data-type="drums" style="font-size:0.6rem; padding:2px 5px; background:#00e5ff; color:#000; border:none; border-radius:3px; font-weight:bold;">+ NEW</button>
                            </div>
                        </div>
                        <select id="sel-drums" class="full-width-select" style="margin-bottom:10px;"></select>

                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <div style="display:flex; align-items:center; gap:5px;" title="Play this fill on the last bar of the progression">
                                <input type="checkbox" id="cb-auto-fill" style="width:12px; height:12px; accent-color:var(--primary-cyan);">
                                <label for="cb-auto-fill" style="font-size:0.75rem; color:#00e5ff; cursor:pointer;">Auto-Fill (Last Bar)</label>
                            </div>
                            <div>
                                <button class="btn-edit-pat" data-type="fills" style="font-size:0.6rem; padding:2px 5px; margin-right:5px; background:#444; border:1px solid #555; color:#fff; border-radius:3px;">EDIT FILL</button>
                                <button id="btn-del-fills" class="btn-delete-custom" style="display:none; font-size:0.6rem; padding:2px 5px; margin-right:5px; background:#aa0033; color:white; border:none; border-radius:3px;">DEL</button>
                                <button class="btn-new" data-type="fills" style="font-size:0.6rem; padding:2px 5px; background:#00e5ff; color:#000; border:none; border-radius:3px; font-weight:bold;">+ NEW</button>
                            </div>
                        </div>
                        <select id="sel-fill" class="full-width-select"></select>
                    </div>
                    <div class="track-octave-col" style="visibility:hidden; width:0;"></div>
                </div>

                <div class="track-row" style="background: transparent; border: 1px solid #00e5ff33;">
                    <div class="track-header-col">
                        <strong style="color:#00e5ff;">PROGRESSION</strong>
                    </div>
                    <div class="track-pattern-col" style="flex: 1; max-width: none;">
                        ${createHeader('&nbsp;', 'progression')}
                        <select id="sel-progression" class="full-width-select"></select>
                    </div>
                </div>

                <div class="step-tracker">
                    ${Array(16).fill(0).map((_, i) => `<div class="step-dot" id="step-${i}"></div>`).join('')}
                </div>
            </div>
        `;
        
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        this.container.appendChild(wrapper);

        this.populateDropdowns();
        this.refreshPresetList();
        this.bindEvents();
    }

    bindEvents() {
        this.container.querySelector('#btn-seq-play').addEventListener('click', () => this.togglePlay());
        
        const bpmSlider = this.container.querySelector('#bpm-slider');
        const bpmVal = this.container.querySelector('#bpm-val');

        const updateBpm = (val) => {
            this.bpm = val;
            bpmSlider.value = val;
            bpmVal.textContent = val;
        };

        bpmSlider.addEventListener('input', (e) => {
            updateBpm(parseInt(e.target.value));
        });

        // BPM Up/Down Buttons
        this.container.querySelector('#btn-bpm-down').addEventListener('click', () => {
            if (this.bpm > 40) updateBpm(this.bpm - 1);
        });
        
        this.container.querySelector('#btn-bpm-up').addEventListener('click', () => {
            if (this.bpm < 200) updateBpm(this.bpm + 1);
        });

        // + NEW Buttons
        this.container.querySelectorAll('.btn-new').forEach(btn => {
            if(btn.id === 'btn-save-preset' || btn.id === 'btn-fav-preset') return;
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                if(type === 'progression') this.openProgressionModal(false);
                else this.openPatternEditor(type, false);
            });
        });

        // EDIT Buttons
        this.container.querySelectorAll('.btn-edit-pat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                if(type === 'progression') this.openProgressionModal(true);
                else this.openPatternEditor(type, true);
            });
        });

        const btnDelProg = this.container.querySelector('#btn-del-progression');
        if(btnDelProg) {
            btnDelProg.addEventListener('click', () => this.deleteCurrentProgression());
        }

        ['rhythm', 'bass', 'lead', 'samples', 'drums', 'fills'].forEach(type => {
            const btn = this.container.querySelector(`#btn-del-${type}`);
            if (btn) btn.addEventListener('click', () => this.deleteCustomPattern(type));
        });

        const bindSelect = (id, stateKey, typeKey) => {
            this.container.querySelector(id).addEventListener('change', (e) => {
                this.state[stateKey] = e.target.value;
                if(typeKey === 'progression') this.updateDeleteButtonVisibility(e.target.value);
                else this.updatePatternDeleteVisibility(typeKey, e.target.value);
            });
        };
        bindSelect('#sel-rhythm', 'rhythmName', 'rhythm');
        bindSelect('#sel-bass-pattern', 'bassName', 'bass');
        bindSelect('#sel-lead-pattern', 'leadName', 'lead');
        bindSelect('#sel-samples-pattern', 'samplesName', 'samples'); 
        bindSelect('#sel-drums', 'drumName', 'drums');
        bindSelect('#sel-fill', 'fillName', 'fills'); 
        bindSelect('#sel-progression', 'progressionName', 'progression');

        // Auto Fill Checkbox
        const cbAutoFill = this.container.querySelector('#cb-auto-fill');
        if(cbAutoFill) {
            cbAutoFill.checked = this.settings.autoFill;
            cbAutoFill.addEventListener('change', (e) => this.settings.autoFill = e.target.checked);
        }

        // Mixer Binding
        const bindMixer = (id, type, track) => {
            const el = this.container.querySelector(id);
            if(!el) return;
            el.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.settings[type][track] = val;
                if(type === 'volumes') setTrackVolume(track, val);
                if(type === 'filters') setTrackFilter(track, val);
                if(type === 'reverbs') setTrackReverb(track, val);
                if(type === 'pans') setTrackPan(track, val);
            });
        };
        ['chords','bass','lead','samples','drums'].forEach(t => {
            bindMixer(`#vol-${t}`, 'volumes', t);
            bindMixer(`#filt-${t}`, 'filters', t);
            bindMixer(`#pan-${t}`, 'pans', t);
            if(t!=='drums') bindMixer(`#verb-${t}`, 'reverbs', t);
        });

        ['chords','bass','lead','samples'].forEach(track => {
            const elOct = this.container.querySelector(`#sel-oct-${track}`);
            const elDrop = this.container.querySelector(`#cb-drop-${track}`);
            
            if(elOct) {
                elOct.value = this.settings.octaves[track];
                elOct.addEventListener('change', (e) => this.settings.octaves[track] = parseInt(e.target.value));
            }
            if(elDrop) {
                elDrop.checked = this.settings.drops[track];
                elDrop.addEventListener('change', (e) => this.settings.drops[track] = e.target.checked);
            }
        });

        const cbAltStrum = this.container.querySelector('#cb-alt-strum');
        if(cbAltStrum) {
            cbAltStrum.checked = this.settings.upStrums;
            cbAltStrum.addEventListener('change', (e) => this.settings.upStrums = e.target.checked);
        }

        const bindSound = (id, settingKey) => {
            this.container.querySelector(id).addEventListener('change', (e) => this.settings[settingKey] = e.target.value);
        };
        bindSound('#sel-instrument', 'instrument');
        bindSound('#sel-bass-instrument', 'bassInstrument');
        bindSound('#sel-lead-instrument', 'leadInstrument');
        bindSound('#sel-samples-instrument', 'samplesInstrument');

        this.container.querySelector('#btn-save-preset').addEventListener('click', () => this.savePreset());
        this.container.querySelector('#btn-fav-preset').addEventListener('click', () => this.saveFavorite());
        
        const presetSel = this.container.querySelector('#sel-presets');
        const presetDel = this.container.querySelector('#btn-del-preset');
        presetSel.addEventListener('change', (e) => { 
            if(e.target.value) { this.loadPreset(e.target.value); presetDel.style.display = 'inline-block'; } 
            else { presetDel.style.display = 'none'; }
        });
        presetDel.addEventListener('click', () => this.deletePreset());

        this.container.querySelector('#cb-metronome').addEventListener('change', (e) => this.settings.metronome = e.target.checked);
        const cbShuffle = this.container.querySelector('#cb-shuffle');
        const lblShuffle = this.container.querySelector('#lbl-shuffle');
        cbShuffle.addEventListener('change', (e) => {
            this.settings.shuffle = e.target.checked;
            lblShuffle.style.color = e.target.checked ? '#00e5ff' : 'inherit'; 
        });
        this.container.querySelector('#sel-metronome-sub').addEventListener('change', (e) => this.settings.metronomeSubdivision = parseInt(e.target.value));
    }

    populateDropdowns() {
        const populate = (id, lib) => { const sel = this.container.querySelector(id); sel.innerHTML = ''; Object.keys(lib).forEach(k => sel.add(new Option(k, k))); };
        const insts = Object.keys(INSTRUMENTS);
        ['#sel-instrument', '#sel-bass-instrument', '#sel-lead-instrument', '#sel-samples-instrument'].forEach(id => { const sel = this.container.querySelector(id); insts.forEach(k => sel.add(new Option(k, k))); });
        this.container.querySelector('#sel-instrument').value = this.settings.instrument;
        this.container.querySelector('#sel-bass-instrument').value = this.settings.bassInstrument;
        this.container.querySelector('#sel-lead-instrument').value = this.settings.leadInstrument;
        this.container.querySelector('#sel-samples-instrument').value = this.settings.samplesInstrument;
        
        populate('#sel-rhythm', this.libraries.rhythm);
        populate('#sel-bass-pattern', this.libraries.bass);
        populate('#sel-lead-pattern', this.libraries.lead);
        populate('#sel-samples-pattern', this.libraries.samples);
        populate('#sel-drums', this.libraries.drums);
        populate('#sel-fill', this.libraries.fills); 
        populate('#sel-progression', this.libraries.progression);
        
        this.container.querySelector('#sel-rhythm').value = this.state.rhythmName;
        this.container.querySelector('#sel-bass-pattern').value = this.state.bassName;
        this.container.querySelector('#sel-lead-pattern').value = this.state.leadName;
        this.container.querySelector('#sel-samples-pattern').value = this.state.samplesName;
        this.container.querySelector('#sel-drums').value = this.state.drumName;
        this.container.querySelector('#sel-fill').value = this.state.fillName; 
        this.container.querySelector('#sel-progression').value = this.state.progressionName;
        
        this.updateDeleteButtonVisibility(this.state.progressionName);
        this.updatePatternDeleteVisibility('rhythm', this.state.rhythmName);
        this.updatePatternDeleteVisibility('bass', this.state.bassName);
        this.updatePatternDeleteVisibility('lead', this.state.leadName);
        this.updatePatternDeleteVisibility('samples', this.state.samplesName);
        this.updatePatternDeleteVisibility('drums', this.state.drumName);
        this.updatePatternDeleteVisibility('fills', this.state.fillName); 
    }

    updateDeleteButtonVisibility(name) { 
        const btn = this.container.querySelector('#btn-del-progression'); 
        if (btn) btn.style.display = this.customData.progressions[name] ? 'inline-block' : 'none'; 
    }

    updatePatternDeleteVisibility(type, name) { 
        const btn = this.container.querySelector(`#btn-del-${type}`); 
        if (btn) btn.style.display = (this.customData[type] && this.customData[type][name]) ? 'inline-block' : 'none'; 
    }

    deleteCustomPattern(type) {
        let name;
        if(type==='rhythm') name=this.state.rhythmName; 
        else if(type==='bass') name=this.state.bassName; 
        else if(type==='lead') name=this.state.leadName; 
        else if(type==='samples') name=this.state.samplesName; 
        else if(type==='drums') name=this.state.drumName;
        else if(type==='fills') name=this.state.fillName;

        if (confirm(`Delete custom pattern "${name}"?`)) {
            delete this.customData[type][name]; delete this.libraries[type][name];
            let key = `custom_${type}`;
            if(type==='rhythm') key = 'custom_rhythms';
            localStorage.setItem(key, JSON.stringify(this.customData[type]));
            this.populateDropdowns();
        }
    }
    
    injectModals() {
        const modalHtml = `<div id="prog-modal" class="modal-overlay">
            <div class="modal-content" style="max-width:500px;">
                <h3 class="modal-title">Edit Progression</h3>
                <input type="text" id="new-prog-name" placeholder="Name" style="width:100%; margin-bottom:10px; padding:5px; background:#222; border:1px solid #555; color:white;">
                <div id="chord-selectors-container" style="display:flex; flex-wrap:wrap; justify-content:center; gap:5px; margin-bottom:15px;"></div>
                <div style="display:flex; justify-content:center; gap:10px; margin-bottom:15px;">
                    <button id="btn-remove-step" class="btn-delete-custom" style="padding:4px 12px; background:#aa0033; color:white; border:none; border-radius:3px; cursor:pointer;">- Step</button>
                    <button id="btn-add-step" class="btn-new" style="padding:4px 12px; cursor:pointer;">+ Step</button>
                </div>
                <div class="modal-actions">
                    <button onclick="document.getElementById('prog-modal').style.display='none'" class="btn-cancel">Cancel</button>
                    <button id="btn-save-prog" class="btn-save">Save</button>
                </div>
            </div>
        </div>
        <div id="pattern-modal" class="modal-overlay">
            <div class="modal-content" style="max-width:600px;">
                <h3 class="modal-title" id="pat-modal-title">Edit Pattern</h3>
                <input type="text" id="new-pat-name" placeholder="Pattern Name" style="width:100%; margin-bottom:15px; padding:8px; background:#222; border:1px solid #555; color:white;">
                <div id="pattern-editor-grid" class="pattern-editor-container"></div>
                <div class="modal-actions">
                    <div style="display:flex; gap:10px;">
                        <button id="btn-preview-pat" class="btn-new" style="background:#444; border:1px solid #666; font-size:0.8rem; padding:8px 12px;">▶ Preview</button>
                        <button onclick="document.getElementById('pattern-modal').style.display='none'" class="btn-cancel">Cancel</button>
                    </div>
                    <button id="btn-save-pat" class="btn-save">Save Pattern</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        document.getElementById('btn-add-step').addEventListener('click', () => this.addProgStep());
        document.getElementById('btn-remove-step').addEventListener('click', () => this.removeProgStep());
        document.getElementById('btn-save-prog').addEventListener('click', () => this.saveCustomProgression());
        document.getElementById('btn-save-pat').addEventListener('click', () => this.saveCustomPattern());
        document.getElementById('btn-preview-pat').addEventListener('click', () => this.togglePatternPreview());
    }
    
    openPatternEditor(type, isEdit = false) {
        const modal = document.getElementById('pattern-modal'); 
        const grid = document.getElementById('pattern-editor-grid'); 
        const title = document.getElementById('pat-modal-title'); 
        const nameInput = document.getElementById('new-pat-name');

        let currentName = '';
        let currentData = null;

        if (isEdit) {
            if (type === 'drums') currentName = this.state.drumName;
            else if (type === 'fills') currentName = this.state.fillName;
            else if (type === 'rhythm') currentName = this.state.rhythmName;
            else if (type === 'bass') currentName = this.state.bassName;
            else if (type === 'lead') currentName = this.state.leadName;
            else if (type === 'samples') currentName = this.state.samplesName;

            currentData = this.libraries[type][currentName];
        }

        modal.style.display = 'flex'; 
        title.textContent = (isEdit ? 'Edit ' : 'New ') + `${type.toUpperCase()} Pattern`; 
        title.dataset.type = type; 
        nameInput.value = isEdit ? currentName : ''; 
        grid.innerHTML = '';
        
        if(this.isPlaying) this.togglePlay();

        if (type === 'drums' || type === 'fills') this.renderDrumGrid(grid, currentData); 
        else if (type === 'rhythm') this.renderToggleGrid(grid, 'Strum', currentData); 
        else this.renderCycleGrid(grid, SCALE_OPTIONS, currentData); 
    }

    closeModal() { document.getElementById('pattern-modal').style.display = 'none'; document.getElementById('prog-modal').style.display = 'none'; if(this.isPreviewing) this.togglePatternPreview(); }
    
    togglePatternPreview() {
        this.isPreviewing = !this.isPreviewing; const btn = document.getElementById('btn-preview-pat');
        if(this.isPreviewing) { if (ctx.state === 'suspended') ctx.resume(); this.previewStep = 0; this.nextNoteTime = ctx.currentTime; btn.textContent = "⏹ Stop"; btn.style.background = "#ff0055"; this.previewScheduler(); } 
        else { clearTimeout(this.timerID); btn.textContent = "▶ Preview"; btn.style.background = "#444"; stopAllSounds(); document.querySelectorAll('.step-cell').forEach(c => c.style.borderColor = "#444"); }
    }
    
    previewScheduler() {
        if(!this.isPreviewing) return;
        if (this.nextNoteTime < ctx.currentTime - 0.2) this.nextNoteTime = ctx.currentTime;
        while (this.nextNoteTime < ctx.currentTime + this.scheduleAheadTime) {
            this.playPreviewStep(this.previewStep, this.nextNoteTime);
            const secondsPerBeat = 60.0 / this.bpm;
            let noteDuration = 0.25 * secondsPerBeat;
            if (this.settings.shuffle) { noteDuration = (this.previewStep % 2 === 0) ? noteDuration * 1.33 : noteDuration * 0.67; }
            this.nextNoteTime += noteDuration;
            this.previewStep = (this.previewStep + 1) % 16;
        }
        this.timerID = window.setTimeout(() => this.previewScheduler(), this.lookahead);
    }
    
    playPreviewStep(step, time) {
        const type = document.getElementById('pat-modal-title').dataset.type;
        const grid = document.getElementById('pattern-editor-grid');
        requestAnimationFrame(() => { grid.querySelectorAll('.step-cell').forEach(c => c.style.borderColor = "#444"); if(type === 'drums' || type === 'fills') grid.querySelectorAll(`.step-cell[data-step="${step}"]`).forEach(c => c.style.borderColor = "#fff"); else { const cell = grid.querySelector(`.step-cell[data-step="${step}"]`); if(cell) cell.style.borderColor = "#fff"; } });
        
        const C_MAJ_SCALE = ['C','D','E','F','G','A','B']; 
        
        if (type === 'drums' || type === 'fills') {
             const getVal = (part) => { const cell = grid.querySelector(`.step-cell[data-part="${part}"][data-step="${step}"]`); return cell && parseInt(cell.dataset.val) === 1; };
             if(getVal('kick')) playDrum('kick', time); 
             if(getVal('snare')) playDrum('snare', time); 
             if(getVal('hihat')) playDrum('hihat', time);
             if(getVal('tom')) playDrum('tom', time);
             if(getVal('crash')) playDrum('crash', time);
        } else if (type === 'rhythm') {
            const cell = grid.querySelector(`.step-cell[data-step="${step}"]`); 
            if(cell && parseInt(cell.dataset.val) === 1) playStrum([130.81, 164.81, 196.00], time, this.settings.instrument);
        } else { 
            const cell = grid.querySelector(`.step-cell[data-step="${step}"]`); const val = cell ? cell.textContent : '-';
            if(val !== '-' && val !== '') {
                let noteName = 'C'; let oct = 0;
                if (val === 'R' || val === '1') noteName = C_MAJ_SCALE[0];
                else if (val === '2') noteName = C_MAJ_SCALE[1];
                else if (val === '3') noteName = C_MAJ_SCALE[2];
                else if (val === '4') noteName = C_MAJ_SCALE[3];
                else if (val === '5') noteName = C_MAJ_SCALE[4];
                else if (val === '6') noteName = C_MAJ_SCALE[5];
                else if (val === '7') noteName = C_MAJ_SCALE[6];
                else if (val === '8' || val === 'O') { noteName = C_MAJ_SCALE[0]; oct = 1; }
                const freq = (type==='bass') ? this.getBassFrequency(noteName, oct, 0) : this.getMelodyFrequency(noteName, oct, 0);
                startNote(freq, -1, (type==='bass'?this.settings.bassInstrument:this.settings.leadInstrument), time, 0.2, type);
            }
        }
    }

    renderDrumGrid(container, initData = null) { 
        ['kick', 'snare', 'hihat', 'tom', 'crash'].forEach(part => { 
            const row = document.createElement('div'); 
            row.className = 'pattern-row'; 
            row.innerHTML = `<div class="row-label">${part.toUpperCase()}</div>`; 
            for(let i=0; i<16; i++) { 
                const cell = document.createElement('div'); 
                cell.className = 'step-cell'; 
                cell.dataset.part = part; 
                cell.dataset.step = i; 
                
                let val = 0;
                if(initData && initData[part] && initData[part][i]) val = 1;

                cell.dataset.val = val; 
                if(val === 1) cell.classList.add('active-drum');

                cell.addEventListener('click', () => { 
                    const newVal = cell.dataset.val == 1 ? 0 : 1; 
                    cell.dataset.val = newVal; 
                    cell.classList.toggle('active-drum', newVal == 1); 
                }); 
                row.appendChild(cell); 
            } 
            container.appendChild(row); 
        }); 
    }
    
    renderToggleGrid(container, label, initData = null) { 
        const row = document.createElement('div'); 
        row.className = 'pattern-row'; 
        row.innerHTML = `<div class="row-label">${label}</div>`; 
        for(let i=0; i<16; i++) { 
            const cell = document.createElement('div'); 
            cell.className = 'step-cell'; 
            cell.dataset.step = i; 
            
            let val = 0;
            if (initData && initData[i]) val = 1;

            cell.dataset.val = val; 
            if(val === 1) cell.classList.add('active-note');

            cell.addEventListener('click', () => { 
                const newVal = cell.dataset.val == 1 ? 0 : 1; 
                cell.dataset.val = newVal; 
                cell.classList.toggle('active-note', newVal == 1); 
            }); 
            row.appendChild(cell); 
        } 
        container.appendChild(row); 
    }
    
    renderCycleGrid(container, options, initData = null) { 
        const row = document.createElement('div'); 
        row.className = 'pattern-row'; 
        row.innerHTML = `<div class="row-label">Note</div>`; 
        const cycle = options; 
        for(let i=0; i<16; i++) { 
            const cell = document.createElement('div'); 
            cell.className = 'step-cell'; 
            
            let val = null;
            let idx = 0;
            if (initData && initData[i] !== undefined) {
                val = initData[i];
                idx = cycle.indexOf(val);
                if (idx === -1) idx = 0;
            }

            cell.textContent = val || '-'; 
            cell.dataset.idx = idx; 
            cell.dataset.step = i; 
            if(val !== null) cell.classList.add('active-note');

            cell.addEventListener('click', () => { 
                let curIdx = parseInt(cell.dataset.idx); 
                curIdx = (curIdx + 1) % cycle.length; 
                cell.dataset.idx = curIdx; 
                const v = cycle[curIdx]; 
                cell.textContent = v || '-'; 
                cell.classList.toggle('active-note', v !== null); 
            }); 
            row.appendChild(cell); 
        } 
        container.appendChild(row); 
    }
    
    saveCustomPattern() { 
        const modal = document.getElementById('pattern-modal'); 
        const type = document.getElementById('pat-modal-title').dataset.type; 
        const name = document.getElementById('new-pat-name').value.trim() || `My ${type}`; 
        const grid = document.getElementById('pattern-editor-grid'); 
        let data; 
        
        if (type === 'drums' || type === 'fills') { 
            data = { kick: [], snare: [], hihat: [], tom: [], crash: [] }; 
            grid.querySelectorAll('.step-cell').forEach(cell => { 
                data[cell.dataset.part][cell.dataset.step] = parseInt(cell.dataset.val); 
            }); 
        } else if (type === 'rhythm') { 
            data = []; grid.querySelectorAll('.step-cell').forEach(cell => data.push(parseInt(cell.dataset.val))); 
        } else { 
            const options = SCALE_OPTIONS; 
            data = []; 
            grid.querySelectorAll('.step-cell').forEach(cell => { 
                const idx = parseInt(cell.dataset.idx); 
                data.push(options[idx]); 
            }); 
        } 
        
        if (!this.customData[type]) this.customData[type] = {};
        if (!this.libraries[type]) this.libraries[type] = {};

        this.customData[type][name] = data; 
        this.libraries[type][name] = data; 
        let key = `custom_${type}`; 
        if(type==='rhythm') key = 'custom_rhythms';
        localStorage.setItem(key, JSON.stringify(this.customData[type])); 
        this.populateDropdowns(); 
        
        if(type==='drums') { this.state.drumName = name; this.container.querySelector('#sel-drums').value = name; } 
        else if(type==='fills') { this.state.fillName = name; this.container.querySelector('#sel-fill').value = name; } 
        else if(type==='rhythm') { this.state.rhythmName = name; this.container.querySelector('#sel-rhythm').value = name; } 
        else if(type==='bass') { this.state.bassName = name; this.container.querySelector('#sel-bass-pattern').value = name; } 
        else if(type==='lead') { this.state.leadName = name; this.container.querySelector('#sel-lead-pattern').value = name; } 
        else if(type==='samples') { this.state.samplesName = name; this.container.querySelector('#sel-samples-pattern').value = name; } 
        
        if (this.isPreviewing) {
            this.togglePatternPreview();
        }

        modal.style.display = 'none'; 
    }

    openProgressionModal(isEdit = false) { 
        const modal = document.getElementById('prog-modal');
        const nameInput = document.getElementById('new-prog-name');
        const cont = document.getElementById('chord-selectors-container');
        const title = document.querySelector('#prog-modal .modal-title');
        
        modal.style.display = 'flex'; 
        cont.innerHTML = ''; 
        if (title) title.textContent = isEdit ? "Edit Progression" : "New Progression";

        if (isEdit) {
            const currentName = this.state.progressionName;
            nameInput.value = currentName;
            const progData = this.libraries.progression[currentName] || [0,0,0,0];
            progData.forEach(chordIdx => {
                this.addProgStep(chordIdx);
            });
        } else {
            nameInput.value = ''; 
            for(let i=0; i<4; i++) this.addProgStep(); 
        }
    }
    
    addProgStep(defaultVal = 0) { 
        const cont = document.getElementById('chord-selectors-container'); 
        const sel = document.createElement('select'); 
        sel.className = 'prog-step-select'; 
        sel.style.width = '70px'; 
        sel.style.margin='2px'; 
        sel.style.fontSize='0.8rem';
        
        ROMAN_NUMERALS.forEach((r, i) => {
            const opt = new Option(r, i);
            if (i === defaultVal) opt.selected = true;
            sel.add(opt);
        }); 
        cont.appendChild(sel); 
    }

    removeProgStep() {
        const cont = document.getElementById('chord-selectors-container');
        if (cont.children.length > 1) {
            cont.removeChild(cont.lastChild);
        }
    }
    
    saveCustomProgression() { const name = document.getElementById('new-prog-name').value.trim() || "My Prog"; const sels = document.querySelectorAll('.prog-step-select'); const indices = Array.from(sels).map(s => parseInt(s.value)); this.customData.progressions[name] = indices; this.libraries.progression[name] = indices; localStorage.setItem('custom_progressions', JSON.stringify(this.customData.progressions)); this.populateDropdowns(); this.container.querySelector('#sel-progression').value = name; this.state.progressionName = name; document.getElementById('prog-modal').style.display = 'none'; }
    deleteCurrentProgression() { if(confirm(`Delete ${this.state.progressionName}?`)) { delete this.customData.progressions[this.state.progressionName]; delete this.libraries.progression[this.state.progressionName]; localStorage.setItem('custom_progressions', JSON.stringify(this.customData.progressions)); this.populateDropdowns(); } }
    
    savePreset() { 
        const sel = this.container.querySelector('#sel-presets');
        const currentSelection = sel.value;
        let name = "";

        if (currentSelection && this.savedPresets[currentSelection]) {
            const isOverwrite = confirm(`Do you want to update the existing block: "${currentSelection}" in your project?`);
            if (isOverwrite) name = currentSelection;
            else name = prompt("Save as new block name:", `${currentSelection} - Copy`);
        } else {
            name = prompt("Project Block Name:", "My Track"); 
        }
        if(!name) return; 

        const ks = this.getScaleData(); 
        const looperSettings = this.getLooperData ? this.getLooperData() : null;
        
        const preset = { 
            name, 
            bpm: this.bpm, 
            key: ks.key, 
            scale: ks.scale, 
            settings: JSON.parse(JSON.stringify(this.settings)), 
            state: JSON.parse(JSON.stringify(this.state)), 
            looper: looperSettings ? JSON.parse(JSON.stringify(looperSettings)) : null 
        }; 
        
        this.savedPresets[name] = preset; 
        localStorage.setItem('sequencer_presets', JSON.stringify(this.savedPresets)); 
        this.refreshPresetList(); 
        this.container.querySelector('#sel-presets').value = name; 
        this.container.querySelector('#btn-del-preset').style.display = 'inline-block'; 
    }

    saveFavorite() {
        const sel = this.container.querySelector('#sel-presets');
        const currentSelection = sel.value;
        let defaultName = currentSelection ? currentSelection : "My Favorite Block";
        
        let name = prompt("Save to Global Favorites as:", defaultName); 
        if(!name) return; 

        const ks = this.getScaleData(); 
        const looperSettings = this.getLooperData ? this.getLooperData() : null;
        
        const preset = { 
            name, 
            bpm: this.bpm, 
            key: ks.key, 
            scale: ks.scale, 
            settings: JSON.parse(JSON.stringify(this.settings)), 
            state: JSON.parse(JSON.stringify(this.state)), 
            looper: looperSettings ? JSON.parse(JSON.stringify(looperSettings)) : null 
        }; 
        
        this.globalFavorites[name] = preset; 
        localStorage.setItem('sequencer_global_favorites', JSON.stringify(this.globalFavorites)); 
        this.refreshPresetList(); 
        this.container.querySelector('#sel-presets').value = name; 
        this.container.querySelector('#btn-del-preset').style.display = 'inline-block'; 
    }
    
    loadPreset(name) { 
        const p = this.savedPresets[name] || this.globalFavorites[name]; 
        if(!p) return; 

        this.bpm = p.bpm; 
        
        this.settings = JSON.parse(JSON.stringify(p.settings)); 
        
        if (!this.settings.pans) this.settings.pans = { chords:0, bass:0, lead:0, samples:0, drums:0 };
        if (this.settings.autoFill === undefined) this.settings.autoFill = false;

        const defaultState = {
            progressionName: 'Pop Hit (I-V-vi-IV)',
            rhythmName: 'Whole Notes',
            drumName: 'Basic Rock',
            fillName: 'Tom Rundown',
            bassName: 'Root & Fifth',
            leadName: 'Empty',
            samplesName: 'Whole Note (Drone)'
        };
        
        this.state = { ...defaultState, ...JSON.parse(JSON.stringify(p.state)) }; 

        this.container.querySelector('#bpm-slider').value = this.bpm; 
        this.container.querySelector('#bpm-val').textContent = this.bpm; 
        this.container.querySelector('#cb-shuffle').checked = this.settings.shuffle; 
        
        const setVal = (id, val) => { const el = this.container.querySelector(id); if(el) el.value = val; }; 
        setVal('#sel-instrument', this.settings.instrument); 
        setVal('#sel-bass-instrument', this.settings.bassInstrument); 
        setVal('#sel-lead-instrument', this.settings.leadInstrument); 
        setVal('#sel-samples-instrument', this.settings.samplesInstrument); 
        setVal('#sel-rhythm', this.state.rhythmName); 
        setVal('#sel-bass-pattern', this.state.bassName); 
        setVal('#sel-lead-pattern', this.state.leadName); 
        setVal('#sel-samples-pattern', this.state.samplesName); 
        setVal('#sel-drums', this.state.drumName); 
        setVal('#sel-fill', this.state.fillName); 
        setVal('#sel-progression', this.state.progressionName); 
        
        const elAutoFill = this.container.querySelector('#cb-auto-fill');
        if (elAutoFill) elAutoFill.checked = this.settings.autoFill;

        if(this.settings.octaves) {
            ['chords','bass','lead','samples'].forEach(t => {
                const elOct = this.container.querySelector(`#sel-oct-${t}`);
                const elDrop = this.container.querySelector(`#cb-drop-${t}`);
                if(elOct) elOct.value = this.settings.octaves[t] || 0;
                if(elDrop) elDrop.checked = this.settings.drops[t] || false;
            });
        }
        const elAlt = this.container.querySelector('#cb-alt-strum'); if(elAlt) elAlt.checked = (this.settings.upStrums !== false);
        
        const applyMix = (t) => { 
            setVal(`#vol-${t}`, this.settings.volumes[t]); 
            setVal(`#filt-${t}`, this.settings.filters[t]); 
            setVal(`#pan-${t}`, this.settings.pans[t]); 
            if(t!=='drums') setVal(`#verb-${t}`, this.settings.reverbs[t]); 
            
            if(isFinite(this.settings.volumes[t])) setTrackVolume(t, this.settings.volumes[t]); 
            if(isFinite(this.settings.filters[t])) setTrackFilter(t, this.settings.filters[t]); 
            if(isFinite(this.settings.pans[t])) setTrackPan(t, this.settings.pans[t]); 
            if(t!=='drums' && isFinite(this.settings.reverbs[t])) setTrackReverb(t, this.settings.reverbs[t]); 
        }; 
        ['chords','bass','lead','samples','drums'].forEach(applyMix); 
        this.populateDropdowns(); 
        if(this.onPresetLoad) this.onPresetLoad({key: p.key, scale: p.scale, looper: p.looper}); 
    }

    refreshPresetList() { 
        const sel = this.container.querySelector('#sel-presets'); 
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">Load Block...</option>'; 

        if (Object.keys(this.savedPresets).length > 0) {
            const groupProj = document.createElement('optgroup');
            groupProj.label = "Project Blocks";
            Object.keys(this.savedPresets).forEach(k => groupProj.appendChild(new Option(k, k)));
            sel.appendChild(groupProj);
        }

        if (Object.keys(this.globalFavorites).length > 0) {
            const groupFav = document.createElement('optgroup');
            groupFav.label = "Global Favorites";
            Object.keys(this.globalFavorites).forEach(k => {
                if (!this.savedPresets[k]) {
                    groupFav.appendChild(new Option(k, k));
                }
            });
            sel.appendChild(groupFav);
        }

        if (currentVal && (this.savedPresets[currentVal] || this.globalFavorites[currentVal])) {
            sel.value = currentVal;
        }
    }

    deletePreset() { 
        const name = this.container.querySelector('#sel-presets').value; 
        if(!name) return;
        
        const inProj = !!this.savedPresets[name];
        const inFav = !!this.globalFavorites[name];

        if (inProj && inFav) {
            if (confirm(`"${name}" exists in both Project and Favorites.\nDelete from Project? (Click Cancel to delete from Favorites)`)) {
                delete this.savedPresets[name];
                localStorage.setItem('sequencer_presets', JSON.stringify(this.savedPresets));
            } else {
                if (confirm(`Delete "${name}" from Global Favorites?`)) {
                    delete this.globalFavorites[name];
                    localStorage.setItem('sequencer_global_favorites', JSON.stringify(this.globalFavorites));
                }
            }
        } else if (inProj) {
            if (confirm(`Delete "${name}" from Project?`)) {
                delete this.savedPresets[name];
                localStorage.setItem('sequencer_presets', JSON.stringify(this.savedPresets));
            }
        } else if (inFav) {
            if (confirm(`Delete "${name}" from Global Favorites?`)) {
                delete this.globalFavorites[name];
                localStorage.setItem('sequencer_global_favorites', JSON.stringify(this.globalFavorites));
            }
        }
        
        this.refreshPresetList(); 
        this.container.querySelector('#btn-del-preset').style.display = 'none'; 
    }

    resetProgressionIndex() {
        this.settings.progressionIndex = -1;
        this.progressionCycles = 0;
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        const btn = this.container.querySelector('#btn-seq-play');
        if (this.isPlaying) {
            if (ctx.state === 'suspended') ctx.resume();
            this.currentStep = 0;
            this.settings.progressionIndex = -1; 
            this.progressionCycles = 0; 
            this.nextNoteTime = ctx.currentTime;
            this.scheduler(); 
            btn.textContent = "⏹ STOP";
            btn.classList.add('playing');
        } else {
            clearTimeout(this.timerID);
            btn.textContent = "▶ PLAY TRACK";
            btn.classList.remove('playing');
            this.resetVisuals();
            stopAllSounds();
            if(this.onChordChange) this.onChordChange(-1); 
            if(this.onStopCallback) this.onStopCallback();
        }
    }

    scheduler() {
        if (this.nextNoteTime < ctx.currentTime - 0.2) this.nextNoteTime = ctx.currentTime;
        while (this.nextNoteTime < ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentStep, this.nextNoteTime);
            this.nextNote();
        }
        if (this.isPlaying) this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        let noteDuration = 0.25 * secondsPerBeat;
        if (this.settings.shuffle) {
            const swing = 0.08; 
            if ((this.currentStep % 4) < 2) noteDuration += (secondsPerBeat * swing);
            else noteDuration -= (secondsPerBeat * swing);
        }
        this.nextNoteTime += noteDuration;
        this.currentStep++;
        if (this.currentStep === 16) this.currentStep = 0;
    }

    scheduleNote(stepNumber, time) {
        let prog = this.libraries.progression[this.state.progressionName];
        if (!prog) {
            this.state.progressionName = 'Pop Hit (I-V-vi-IV)';
            prog = this.libraries.progression[this.state.progressionName];
        }

        if (stepNumber === 0) {
            const nextIndex = (this.settings.progressionIndex + 1) % prog.length;
            if (nextIndex === 0 && this.settings.progressionIndex !== -1) {
                this.progressionCycles++;
            }
            if (this.settings.progressionIndex === -1) {
                this.settings.progressionIndex = 0;
            } else {
                this.settings.progressionIndex = nextIndex;
            }
        }

        requestAnimationFrame(() => {
            this.updateVisualTracker(stepNumber);
            if (stepNumber === 0 && this.onChordChange && prog) {
                this.onChordChange(prog[this.settings.progressionIndex]);
            }

            if (this.onLeadStep) {
                const leadPat = this.libraries.lead[this.state.leadName];
                let visualMidi = null; 
                const chords = getAllChords(this.getScaleData().key, this.getScaleData().scale);
                const chord = chords[prog[this.settings.progressionIndex]];
                
                if (leadPat && leadPat[stepNumber] && chord) {
                    const fullScale = generateScale(this.getScaleData().key, this.getScaleData().scale);
                    const rootIndex = fullScale.indexOf(chord.root);
                    const instruction = leadPat[stepNumber];
                    const leadOct = this.settings.octaves.lead || 0;
                    const leadDrop = this.settings.drops.lead || false;
                    
                    if (rootIndex !== -1 && instruction) {
                        let interval = 0;
                        let isOctave = false;
                        if (instruction === 'R' || instruction === '1') interval = 0;
                        else if (instruction === '2') interval = 1;
                        else if (instruction === '3') interval = 2;
                        else if (instruction === '4') interval = 3;
                        else if (instruction === '5') interval = 4;
                        else if (instruction === '6') interval = 5;
                        else if (instruction === '7') interval = 6;
                        else if (instruction === '8' || instruction === 'O') { interval = 0; isOctave = true; }
                        
                        const noteIndex = (rootIndex + interval) % fullScale.length;
                        
                        const SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; 
                        const noteName = fullScale[noteIndex];
                        const ni = SHARPS.indexOf(noteName);
                        
                        let base = 4 + leadOct;
                        if (noteIndex < rootIndex) base += 1;
                        if (isOctave) base += 1;
                        
                        if (leadDrop) {
                            const ki = SHARPS.indexOf(this.getScaleData().key);
                            if (ni > ki) base--;
                        }

                        visualMidi = (base + 1) * 12 + ni;
                    }
                }
                this.onLeadStep(visualMidi);
            }
        });

        if (this.onStepCallback) {
            this.onStepCallback(stepNumber, this.settings.progressionIndex, prog.length, this.progressionCycles, time);
        }

        if (this.settings.metronome && (stepNumber % this.settings.metronomeSubdivision === 0)) playDrum('metronome', time);
        
        const isFillBar = this.settings.autoFill && prog && (this.settings.progressionIndex === prog.length - 1);
        let drumPat = this.libraries.drums[this.state.drumName];
        
        if (isFillBar) {
            const fillPat = this.libraries.fills[this.state.fillName];
            if (fillPat) drumPat = fillPat;
        }

        if (this.settings.autoFill && stepNumber === 0 && this.settings.progressionIndex === 0 && this.progressionCycles > 0) {
            playDrum('crash', time);
        }

        if (drumPat) {
            if (drumPat.kick && drumPat.kick[stepNumber]) playDrum('kick', time);
            if (drumPat.snare && drumPat.snare[stepNumber]) playDrum('snare', time);
            if (drumPat.hihat && drumPat.hihat[stepNumber]) playDrum('hihat', time);
            if (drumPat.tom && drumPat.tom[stepNumber]) playDrum('tom', time);
            if (drumPat.crash && drumPat.crash[stepNumber]) playDrum('crash', time);
        }

        const { key, scale } = this.getScaleData();
        const chords = getAllChords(key, scale); 
        const fullScale = generateScale(key, scale); 
        
        if (!prog || !chords) return;
        const chordIndex = prog[this.settings.progressionIndex];
        const chord = chords[chordIndex]; 

        if (chord) {
            const chordOct = this.settings.octaves.chords || 0;
            const bassOct = this.settings.octaves.bass || 0;
            const leadOct = this.settings.octaves.lead || 0;
            const sampOct = this.settings.octaves.samples || 0;

            const chordDrop = this.settings.drops.chords || false;
            const bassDrop = this.settings.drops.bass || false;
            const leadDrop = this.settings.drops.lead || false;
            const sampDrop = this.settings.drops.samples || false;

            const rhythmPat = this.libraries.rhythm[this.state.rhythmName];
            if (rhythmPat && rhythmPat[stepNumber]) {
                const isBassStr = this.settings.instrument === 'Bass Guitar';
                const octaveOffset = isBassStr ? -1 : 0; 
                if (chord.notes) {
                    const frequencies = chord.notes.map(note => 
                        this.getFrequencyForChord(note, key, chord.root, octaveOffset + chordOct, chordDrop)
                    );
                    const strumStep = this.settings.upStrums ? stepNumber : 0;
                    playStrum(frequencies, time, this.settings.instrument, strumStep);
                }
            }

            const playScaleNote = (instruction, instrument, octSetting, octDrop, trackType, defaultDur) => {
                if (!instruction) return;
                const rootIndex = fullScale.indexOf(chord.root); 
                if(rootIndex === -1) return; 

                let interval = 0; 
                let isOctave = false;

                if (instruction === 'R' || instruction === '1') interval = 0;
                else if (instruction === '2') interval = 1;
                else if (instruction === '3') interval = 2;
                else if (instruction === '4') interval = 3;
                else if (instruction === '5') interval = 4;
                else if (instruction === '6') interval = 5;
                else if (instruction === '7') interval = 6;
                else if (instruction === '8' || instruction === 'O') { interval = 0; isOctave = true; }
                
                const noteIndex = (rootIndex + interval) % fullScale.length;
                const noteToPlay = fullScale[noteIndex];
                
                let scaleWrapOctave = 0;
                if (noteIndex < rootIndex) scaleWrapOctave = 1;
                if (isOctave) scaleWrapOctave += 1; 

                const freq = (trackType === 'bass') 
                    ? this.getBassFrequency(noteToPlay, scaleWrapOctave, octSetting, key, chord.root, octDrop)
                    : this.getMelodyFrequency(noteToPlay, scaleWrapOctave, octSetting, key, chord.root, octDrop);
                
                startNote(freq, -1, instrument, time, defaultDur, trackType);
            };

            const bassPat = this.libraries.bass[this.state.bassName];
            if (bassPat) playScaleNote(bassPat[stepNumber], this.settings.bassInstrument, bassOct, bassDrop, 'bass', 0.4);

            const leadPat = this.libraries.lead[this.state.leadName];
            if (leadPat) playScaleNote(leadPat[stepNumber], this.settings.leadInstrument, leadOct, leadDrop, 'lead', 0.2);

            const samplesPat = this.libraries.samples[this.state.samplesName];
            if (samplesPat) playScaleNote(samplesPat[stepNumber], this.settings.samplesInstrument, sampOct, sampDrop, 'samples', 0.2);
        }
    }
    
    getFrequencyForChord(n, k, r, o=0, drop=false) { 
        const SHARPS=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; 
        const ni=SHARPS.indexOf(n); const ki=SHARPS.indexOf(k); const ri=SHARPS.indexOf(r); 
        let bo=3+o; 
        if(ri < ki) bo++; 
        if(drop && ni > ki) bo--;
        let no=bo; if(ni<ri) no++; 
        return 440*Math.pow(2,((ni-9)+(no-4)*12)/12); 
    }
    
    getBassFrequency(n, o=0, oTrack=0, k=null, r=null, drop=false) { 
        const SHARPS=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; 
        let base = 2 + o + oTrack;
        const ni = SHARPS.indexOf(n);
        if (drop && k) { const ki = SHARPS.indexOf(k); if (ni > ki) base--; }
        return 440*Math.pow(2,((ni-9)+(base-4)*12)/12); 
    }
    
    getMelodyFrequency(n, o=0, oTrack=0, k=null, r=null, drop=false) { 
        const SHARPS=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; 
        let base = 4 + o + oTrack;
        const ni = SHARPS.indexOf(n);
        if (drop && k) { const ki = SHARPS.indexOf(k); if (ni > ki) base--; }
        return 440*Math.pow(2,((ni-9)+(base-4)*12)/12); 
    }

    updateVisualTracker(s) { this.container.querySelectorAll('.step-dot').forEach((d,i) => { d.style.background=(i===s)?'#00e5ff':'#333'; d.style.boxShadow=(i===s)?'0 0 10px #00e5ff':'none'; }); }
    resetVisuals() { this.container.querySelectorAll('.step-dot').forEach(d => {d.style.background='#333'; d.style.boxShadow='none';}); }
}