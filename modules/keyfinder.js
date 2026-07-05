// modules/keyfinder.js
import { SCALES, generateScale } from './theory.js';

export class KeyFinder {
    constructor(containerId, onKeySelect) {
        this.container = document.getElementById(containerId);
        this.onKeySelect = onKeySelect;
        if (this.container) this.render();
    }

    render() {
        this.container.innerHTML = `
            <div style="margin-bottom: 15px;">
                <label style="font-size:0.75rem; color:#888; font-weight:bold; letter-spacing:1px;">ENTER CHORDS OR NOTES</label>
                
                <div style="display:flex; gap:10px; margin-top:5px;">
                    <input type="text" id="kf-input" placeholder="e.g. Dm G7 Cmaj7" style="flex:1; background:#111; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; font-size:0.9rem;">
                    <button id="kf-btn" style="background:#00e5ff; color:#000; border:none; padding:0 15px; border-radius:4px; font-weight:bold; cursor:pointer; transition: all 0.2s;">FIND KEY</button>
                </div>

                <div style="display:flex; gap:15px; margin-top:8px; font-size:0.75rem; color:#ccc;">
                    <label style="cursor:pointer; display:flex; align-items:center; gap:5px;">
                        <input type="radio" name="kf-mode" value="chords" checked style="accent-color:var(--primary-cyan); width:14px; height:14px;"> 
                        Parse as Chords
                    </label>
                    <label style="cursor:pointer; display:flex; align-items:center; gap:5px;">
                        <input type="radio" name="kf-mode" value="notes" style="accent-color:var(--primary-cyan); width:14px; height:14px;"> 
                        Parse as Single Notes
                    </label>
                </div>
            </div>
            
            <div id="kf-results" style="display:flex; flex-direction:column; gap:8px;"></div>
        `;
        
        const btn = this.container.querySelector('#kf-btn');
        btn.addEventListener('click', () => this.search());
        btn.addEventListener('mouseenter', () => btn.style.background = '#00ffaa');
        btn.addEventListener('mouseleave', () => btn.style.background = '#00e5ff');

        this.container.querySelector('#kf-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.search();
        });
    }

    normalizeNote(noteStr) {
        const SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        const ENHARMONIC_MAP = { 'Cb': 'B', 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
        
        let cleanToken = noteStr.trim();
        if (!cleanToken) return null;
        
        cleanToken = cleanToken.charAt(0).toUpperCase() + cleanToken.slice(1).toLowerCase();
        let normalized = ENHARMONIC_MAP[cleanToken] || cleanToken;
        
        return SHARPS.includes(normalized) ? normalized : null;
    }

    getNotesFromChord(chordStr) {
        const SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        
        let cleanToken = chordStr.trim();
        if (!cleanToken) return [];
        
        const match = cleanToken.match(/^([a-gA-G][#b]?)(.*)$/);
        if (!match) return [];
        
        let root = this.normalizeNote(match[1]);
        if (!root) return [];
        
        let rootIdx = SHARPS.indexOf(root);
        let quality = match[2].toLowerCase();

        let intervals = [0, 4, 7]; // Default to Major triad
        
        // Quality overrides
        if (quality.includes('dim7')) intervals = [0, 3, 6, 9];
        else if (quality.includes('dim')) intervals = [0, 3, 6];
        else if (quality.includes('aug')) intervals = [0, 4, 8];
        else if (quality.includes('m7b5') || quality.includes('half-dim')) intervals = [0, 3, 6, 10];
        else if (quality.includes('m') && !quality.includes('maj')) {
            intervals = [0, 3, 7];
            if (quality.includes('7')) intervals.push(10); // m7
        }
        else if (quality.includes('sus4')) intervals = [0, 5, 7];
        else if (quality.includes('sus2')) intervals = [0, 2, 7];
        else {
            // Major variations
            if (quality.includes('maj7')) intervals.push(11);
            else if (quality.includes('7')) intervals.push(10); // dom7
        }

        return intervals.map(i => SHARPS[(rootIdx + i) % 12]);
    }

    search() {
        const input = this.container.querySelector('#kf-input').value;
        const mode = this.container.querySelector('input[name="kf-mode"]:checked').value;
        
        const tokens = input.split(/[,\s]+/).filter(t => t);
        if (tokens.length === 0) return;

        let allNotes = new Set();
        
        tokens.forEach(t => {
            if (mode === 'chords') {
                this.getNotesFromChord(t).forEach(n => allNotes.add(n));
            } else {
                const note = this.normalizeNote(t);
                if (note) allNotes.add(note);
            }
        });

        const uniqueNotes = Array.from(allNotes);
        const resultsDiv = this.container.querySelector('#kf-results');

        if (uniqueNotes.length === 0) {
            resultsDiv.innerHTML = '<div style="color:#ff5555; font-size:0.8rem; background:#3a1111; padding:8px; border-radius:4px; border:1px solid #ff0000;">Could not parse input. Check your formatting.</div>';
            return;
        }

        const parsedHtml = `<div style="font-size:0.7rem; color:#888; margin-bottom:5px;">Calculated Target Notes: <strong style="color:#00e5ff;">${uniqueNotes.join(', ')}</strong></div>`;

        const SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        let matches = [];

        const primaryScales = ['major', 'minor', 'minor_harmonic', 'dorian', 'mixolydian', 'minor_pentatonic', 'major_pentatonic'];

        SHARPS.forEach(key => {
            Object.keys(SCALES).forEach(scaleKey => {
                const scaleNotes = generateScale(key, scaleKey);
                const isMatch = uniqueNotes.every(n => scaleNotes.includes(n));
                if (isMatch) {
                    matches.push({ key, scale: scaleKey, name: SCALES[scaleKey].name, isPrimary: primaryScales.includes(scaleKey) });
                }
            });
        });

        matches.sort((a, b) => {
            if (a.isPrimary && !b.isPrimary) return -1;
            if (!a.isPrimary && b.isPrimary) return 1;
            return 0;
        });

        if (matches.length === 0) {
            resultsDiv.innerHTML = parsedHtml + '<div style="color:#ffaa00; font-size:0.8rem; background:#332200; padding:8px; border-radius:4px; border:1px solid #ffaa00;">No standard scales contain all of these notes. You may be using borrowed chords or accidentals outside a single key!</div>';
            return;
        }

        let html = parsedHtml + '<div style="display:flex; flex-wrap:wrap; gap:8px;">';
        matches.forEach(m => {
            const isPrimary = m.isPrimary;
            const bg = isPrimary ? '#1a2b2b' : '#1a1a1a';
            const border = isPrimary ? '#00e5ff' : '#444';
            const color = isPrimary ? '#fff' : '#aaa';
            const shadow = isPrimary ? 'box-shadow: 0 0 8px rgba(0, 229, 255, 0.15);' : '';
            
            html += `<button class="kf-match-btn" data-key="${m.key}" data-scale="${m.scale}" style="background:${bg}; border:1px solid ${border}; color:${color}; padding:6px 12px; border-radius:4px; font-size:0.75rem; font-weight:bold; cursor:pointer; transition:all 0.2s; ${shadow}">${m.key} ${m.name}</button>`;
        });
        html += '</div>';

        resultsDiv.innerHTML = html;

        resultsDiv.querySelectorAll('.kf-match-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.05)'; btn.style.borderColor = '#00ffaa'; btn.style.color = '#fff'; });
            btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; btn.style.borderColor = ''; btn.style.color = ''; });
            
            btn.addEventListener('click', (e) => {
                if(this.onKeySelect) {
                    this.onKeySelect(e.target.dataset.key, e.target.dataset.scale);
                    // Flash effect to show it loaded
                    btn.style.background = '#00e5ff';
                    btn.style.color = '#000';
                    setTimeout(() => { btn.style.background = ''; btn.style.color = ''; }, 200);
                }
            });
        });
    }
}