// modules/keyfinder.js
import { getNotes, SCALES, generateScale, getDiatonicChords } from './theory.js';

export class KeyFinder {
    constructor(containerId, onApplyKey) {
        this.container = document.getElementById(containerId);
        this.onApplyKey = onApplyKey; // Callback to update global app settings
        this.selectedNotes = new Set();
        this.notes = getNotes(); // ['C', 'C#', ...]
        
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="keyfinder-ui">
                <div class="instruction">Select notes to identify the Key & Scale:</div>
                
                <div class="note-selector-grid">
                    ${this.notes.map(note => `
                        <button class="kf-note-btn" data-note="${note}">${note}</button>
                    `).join('')}
                </div>

                <div class="kf-actions">
                    <button id="btn-kf-clear" class="kf-action-btn">Clear</button>
                    <button id="btn-kf-find" class="kf-action-btn primary">🔍 Find Matches</button>
                </div>

                <div id="kf-results" class="kf-results-list"></div>
            </div>
        `;

        const style = document.createElement('style');
        style.innerHTML = `
            .keyfinder-ui { display: flex; flex-direction: column; gap: 15px; }
            .instruction { font-size: 0.8rem; color: #888; font-style: italic; }
            
            .note-selector-grid { 
                display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; 
            }
            @media (min-width: 600px) { .note-selector-grid { grid-template-columns: repeat(12, 1fr); } }

            .kf-note-btn {
                background: #222; border: 1px solid #444; color: #888;
                padding: 10px 0; border-radius: 4px; cursor: pointer; font-weight: bold;
                transition: all 0.1s;
            }
            .kf-note-btn:hover { background: #333; }
            .kf-note-btn.selected {
                background: var(--primary-cyan); color: #000; border-color: var(--primary-cyan);
                box-shadow: 0 0 10px rgba(0, 229, 255, 0.3);
            }

            .kf-actions { display: flex; gap: 10px; }
            .kf-action-btn {
                flex: 1; padding: 8px; border-radius: 4px; border: none; font-weight: bold; cursor: pointer;
                background: #333; color: #fff;
            }
            .kf-action-btn:hover { background: #444; }
            .kf-action-btn.primary { background: var(--accent-gold); color: #000; }
            .kf-action-btn.primary:hover { background: #e5a000; }

            .kf-results-list {
                display: flex; flex-direction: column; gap: 5px;
                max-height: 300px; overflow-y: auto;
                background: #111; padding: 10px; border-radius: 4px; border: 1px inset #222;
            }
            
            .kf-result-item {
                display: flex; justify-content: space-between; align-items: center;
                background: #222; padding: 8px 12px; border-radius: 4px;
                border-left: 3px solid #444; gap: 10px;
            }
            .kf-result-item:hover { background: #2a2a2a; }
            
            .kf-result-info { flex-grow: 1; display: flex; flex-direction: column; gap: 2px; }
            
            .kf-result-title { font-size: 0.9rem; color: #eee; }
            .kf-result-chords { font-size: 0.7rem; color: #888; font-family: monospace; }
            
            .kf-apply-btn {
                font-size: 0.7rem; background: transparent; border: 1px solid #555;
                color: var(--primary-cyan); padding: 4px 8px; border-radius: 3px; cursor: pointer;
                white-space: nowrap;
            }
            .kf-apply-btn:hover { background: var(--primary-cyan); color: #000; }
            .no-match { color: #ff5555; text-align: center; font-size: 0.8rem; padding: 10px; }
        `;
        this.container.appendChild(style);

        this.bindEvents();
    }

    bindEvents() {
        const noteBtns = this.container.querySelectorAll('.kf-note-btn');
        noteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const note = e.target.dataset.note;
                if (this.selectedNotes.has(note)) {
                    this.selectedNotes.delete(note);
                    e.target.classList.remove('selected');
                } else {
                    this.selectedNotes.add(note);
                    e.target.classList.add('selected');
                }
            });
        });

        this.container.querySelector('#btn-kf-clear').addEventListener('click', () => {
            this.selectedNotes.clear();
            this.container.querySelectorAll('.kf-note-btn').forEach(b => b.classList.remove('selected'));
            this.container.querySelector('#kf-results').innerHTML = '';
        });

        this.container.querySelector('#btn-kf-find').addEventListener('click', () => this.findKeys());
    }

    findKeys() {
        const resultsContainer = this.container.querySelector('#kf-results');
        resultsContainer.innerHTML = '';

        if (this.selectedNotes.size === 0) {
            resultsContainer.innerHTML = '<div class="no-match">Select at least one note.</div>';
            return;
        }

        const matches = [];
        const userNotes = Array.from(this.selectedNotes);

        // 1. Iterate ALL Roots
        this.notes.forEach(root => {
            // 2. Iterate ALL Scales
            for (const [scaleKey, scaleData] of Object.entries(SCALES)) {
                // 3. Generate notes for this Root + Scale
                const scaleNotes = generateScale(root, scaleKey);
                
                // 4. Check match
                const isMatch = userNotes.every(note => scaleNotes.includes(note));

                if (isMatch) {
                    matches.push({ root, scaleKey, scaleName: scaleData.name });
                }
            }
        });

        // 5. Render Matches
        if (matches.length === 0) {
            resultsContainer.innerHTML = '<div class="no-match">No Diatonic Scale contains all these notes.<br>Try removing non-essential notes.</div>';
        } else {
            // Sort (Major/Minor first)
            matches.sort((a, b) => {
                const priority = ['major', 'natural_minor'];
                const aP = priority.includes(a.scaleKey) ? 0 : 1;
                const bP = priority.includes(b.scaleKey) ? 0 : 1;
                return aP - bP;
            });

            matches.forEach(m => {
                // Calculate Chords for display
                const chords = getDiatonicChords(m.root, m.scaleKey);
                const chordStr = chords.map(c => c.name).join(', ');

                const div = document.createElement('div');
                div.className = 'kf-result-item';
                div.innerHTML = `
                    <div class="kf-result-info">
                        <div class="kf-result-title">
                            <span style="color:var(--accent-gold); font-weight:bold;">${m.root}</span> ${m.scaleName}
                        </div>
                        <div class="kf-result-chords">${chordStr}</div>
                    </div>
                    <button class="kf-apply-btn">Set Global</button>
                `;
                div.querySelector('.kf-apply-btn').addEventListener('click', () => {
                    if(this.onApplyKey) this.onApplyKey(m.root, m.scaleKey);
                });
                resultsContainer.appendChild(div);
            });
        }
    }
}