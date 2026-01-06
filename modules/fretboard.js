// modules/fretboard.js
import { getNoteIndex, getNotes } from './theory.js';

export class Fretboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.displayMode = 'scale'; // 'scale' or 'chord'
    }

    setDisplayMode(mode) {
        this.displayMode = mode;
    }

    render(scaleNotes, key, tuning, capo, activeChordNotes, activeChordRoot, activeShape = null) {
        if (!this.container) return;
        
        const numFrets = 13;
        const stringCount = tuning.length;
        const width = 800;
        const height = stringCount * 30 + 30;
        
        // Define colors
        const colorRoot = 'var(--root-color)'; // Gold
        const colorNote = 'var(--primary-cyan)'; // Cyan
        const colorChord = 'var(--accent-pink)'; // Pink for chord notes
        const colorCapo = '#ff5555'; // Red for Capo

        let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">`;

        // 1. Draw Fretboard Base
        for (let i = 0; i <= numFrets; i++) {
            const x = (i / numFrets) * width;
            let stroke = '#555';
            let strokeWidth = 2;
            if (i === 0) { stroke = '#888'; strokeWidth = 4; } // Nut
            
            // Highlight Capo Fret
            if (capo > 0 && i === capo) {
                stroke = colorCapo;
                strokeWidth = 4;
            }

            svg += `<line x1="${x}" y1="15" x2="${x}" y2="${height - 15}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            
            // Fret Numbers
            if (i > 0 && i <= 12) {
                svg += `<text x="${x - (width/numFrets)/2}" y="${height - 2}" fill="#666" font-size="10" text-anchor="middle">${i}</text>`;
            }
        }

        // Strings
        // FIX: i=0 is Top (High Pitch) -> Thin. i=max is Bottom (Low Pitch) -> Thick.
        for (let i = 0; i < stringCount; i++) {
            const y = 30 + (i * 30);
            // Thickness increases as we go down visually
            const thickness = 1 + (i * 0.4); 
            svg += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#888" stroke-width="${thickness}" />`;
        }

        // Fret Dots
        const dotFrets = [3, 5, 7, 9, 12];
        const midY = (15 + (height - 15)) / 2;
        dotFrets.forEach(f => {
            const x = ((f - 0.5) / numFrets) * width;
            if (f === 12) {
                svg += `<circle cx="${x}" cy="${midY - 15}" r="4" fill="#333" />`;
                svg += `<circle cx="${x}" cy="${midY + 15}" r="4" fill="#333" />`;
            } else {
                svg += `<circle cx="${x}" cy="${midY}" r="4" fill="#333" />`;
            }
        });

        // 2. Draw Notes
        const allNotes = getNotes();
        
        for (let s = 0; s < stringCount; s++) {
            const stringIndex = stringCount - 1 - s; // High string at top visually
            const openNoteName = tuning[stringIndex]; 
            const openNoteIndex = getNoteIndex(openNoteName);
            const y = 30 + (s * 30);

            for (let f = 0; f <= numFrets; f++) {
                const currentNoteIndex = (openNoteIndex + f) % 12;
                const noteName = allNotes[currentNoteIndex];
                
                let isVisible = false;
                
                // --- Dynamic Root Logic ---
                let isRoot = false;
                if (activeChordRoot) {
                    isRoot = (noteName === activeChordRoot);
                } else {
                    isRoot = (noteName === key);
                }

                let isChordTone = false;
                
                // --- SHAPE LOGIC (Guitar Chords) ---
                if (activeShape) {
                    const shapeFret = activeShape[stringIndex]; 
                    if (shapeFret !== -1) {
                        const targetPhysicalFret = shapeFret + capo;
                        if (targetPhysicalFret === f) {
                            isVisible = true;
                        }
                    }
                } 
                // --- SCALE / GENERIC CHORD LOGIC (Bass / Sequencer) ---
                else {
                    if (f < capo) continue; 

                    if (this.displayMode === 'scale') {
                        if (scaleNotes.includes(noteName)) isVisible = true;
                    }
                    
                    if (activeChordNotes && activeChordNotes.includes(noteName)) {
                        isChordTone = true;
                        if (this.displayMode === 'chord') isVisible = true;
                    } else if (this.displayMode === 'chord') {
                        isVisible = false;
                    }
                }

                if (isVisible) {
                    const x = (f === 0) ? 10 : ((f - 0.5) / numFrets) * width;
                    
                    let fillColor = '#444'; 
                    let radius = 9;
                    let textColor = '#aaa';
                    
                    // Priority Coloring: Root > Chord Tone > Scale Note
                    if (isRoot) { 
                        fillColor = colorRoot; 
                        textColor = '#000'; 
                    }
                    else if (isChordTone || activeShape) { 
                        fillColor = colorChord; 
                        textColor = '#000'; 
                    }
                    else { 
                        fillColor = colorNote; 
                        textColor = '#000'; 
                        radius = 7; 
                    }

                    svg += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fillColor}" stroke="#111" stroke-width="1" />`;
                    
                    // Show Note Name
                    svg += `<text x="${x}" y="${y + 3}" text-anchor="middle" font-size="9" font-family="sans-serif" fill="${textColor}" font-weight="bold">${noteName}</text>`;
                }
            }
        }

        svg += `</svg>`;
        this.container.innerHTML = svg;
    }
}