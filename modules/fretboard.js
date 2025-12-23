// modules/fretboard.js
import { getNoteIndex, getNotes } from './theory.js';

const SHARPS = getNotes();

export class Fretboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.displayMode = 'scale'; // 'scale' or 'chord'
    }

    setDisplayMode(mode) {
        this.displayMode = mode;
    }

    // MATCHING APP.JS SIGNATURE:
    // render(scaleNotes, keyRoot, tuning, capo, activeChordNotes, activeChordRoot)
    render(scaleNotes, keyRoot, tuning, capo, activeChordNotes = [], activeChordRoot = null) {
        if (!this.container) return;
        this.container.innerHTML = '';

        // Defensive Check
        if (!tuning || !Array.isArray(tuning) || tuning.length === 0) {
            tuning = ['E', 'A', 'D', 'G', 'B', 'E'];
        }

        const stringCount = tuning.length;
        const numFrets = 15;
        const fretboardWidth = 900;
        const fretboardHeight = stringCount * 30 + 40;
        
        let svg = `<svg viewBox="0 0 ${fretboardWidth} ${fretboardHeight}" preserveAspectRatio="xMidYMid slice">`;

        // 1. Draw Nut and Frets
        // Nut
        svg += `<rect x="30" y="20" width="5" height="${stringCount * 30}" fill="#444" />`; 
        
        // Frets
        for (let i = 0; i <= numFrets; i++) {
            let x = 30 + (i * 55); 
            // Fret Markers (Dots)
            if ([3, 5, 7, 9, 12, 15].includes(i)) {
                svg += `<circle cx="${x - 27.5}" cy="${fretboardHeight/2}" r="5" fill="#222" />`;
                if (i === 12) svg += `<circle cx="${x - 27.5}" cy="${fretboardHeight/2 + 15}" r="5" fill="#222" />`;
            }
            // Fret Line
            svg += `<line x1="${x}" y1="20" x2="${x}" y2="${stringCount * 30 + 20}" stroke="#333" stroke-width="2" />`;
            // Fret Number
            if (i > 0) svg += `<text x="${x - 27.5}" y="${fretboardHeight - 5}" font-size="10" fill="#444" text-anchor="middle">${i}</text>`;
        }
        
        // Capo Logic
        if (capo > 0) {
            let capoX = 30 + (capo * 55) - 27.5;
            // Draw a semi-transparent bar for the capo
            svg += `<rect x="${capoX-4}" y="15" width="8" height="${stringCount * 30 + 10}" fill="var(--primary-cyan)" opacity="0.5" rx="4" />`;
        }

        // 2. Draw Strings (Reverse order so High pitch is top visual, Low pitch is bottom visual if standard guitar)
        // Note: Tuning array usually [Low E, A, D...]
        // We draw from y=30 downwards.
        // If we want Low E at the bottom (visually), we iterate normally but map 's' to inverted Y?
        // Actually, standard tabs have High E at top.
        // Let's assume input 'tuning' is [E2, A2, D3, G3, B3, E4].
        // We want E4 at Top. So we reverse for drawing order.
        const drawStrings = [...tuning].reverse();

        for (let s = 0; s < stringCount; s++) {
            let y = 30 + (s * 30);
            let thickness = 1 + (s * 0.5); // Thicker for lower strings (higher index in reversed array)
            
            svg += `<line x1="30" y1="${y}" x2="${30 + numFrets * 55}" y2="${y}" stroke="#666" stroke-width="${thickness}" />`;
            
            // Open Note Name
            svg += `<text x="10" y="${y + 4}" font-size="12" fill="#888" text-anchor="middle">${drawStrings[s]}</text>`;
        }

        // 3. Draw Notes
        for (let stringIndex = 0; stringIndex < stringCount; stringIndex++) {
            const openNote = drawStrings[stringIndex];
            const openNoteIndex = getNoteIndex(openNote);

            for (let fret = 0; fret <= numFrets; fret++) {
                // If Capo is active, ignore notes behind it (except 0 if we treat 0 as open relative to nut, but physically they are muted)
                // Actually, physically: Capo at 2 means Fret 0,1 are muted. Fret 2 becomes the new "Open".
                // Simplification: Just don't draw dots behind capo.
                if (capo > 0 && fret < capo && fret !== 0) continue;

                const currentNoteIndex = (openNoteIndex + fret) % 12;
                const noteName = SHARPS[currentNoteIndex];

                // Check matches
                const scaleNoteMatch = scaleNotes.find(s => getNoteIndex(s) === currentNoteIndex);
                
                const chordNoteMatch = activeChordNotes && activeChordNotes.length > 0 
                    ? activeChordNotes.find(n => getNoteIndex(n) === currentNoteIndex)
                    : null;

                let isVisible = false;
                let isHighlighted = false; // Chord Tone
                let isRoot = false;        // Chord Root (or Scale Root if no chord)

                // LOGIC:
                if (this.displayMode === 'chord') {
                    // Only draw if part of the chord
                    if (chordNoteMatch) {
                        isVisible = true;
                        isHighlighted = true;
                    }
                } else {
                    // 'scale' mode: Draw all scale notes, highlight chord ones
                    if (scaleNoteMatch) isVisible = true;
                    if (chordNoteMatch) isHighlighted = true;
                }

                if (isVisible) {
                    const x = 30 + (fret * 55) - (fret === 0 ? 15 : 27.5);
                    const y = 30 + (stringIndex * 30); // Match string loop Y

                    // Determine Label (R, 3, 5 or NoteName)
                    let label = noteName;
                    
                    // Priority: Active Chord Root -> Key Root
                    const comparisonRoot = activeChordRoot || keyRoot;
                    
                    if (comparisonRoot) {
                        const rIndex = getNoteIndex(comparisonRoot);
                        
                        if (currentNoteIndex === rIndex) {
                            isRoot = true;
                            label = 'R';
                        } else if (isHighlighted && activeChordRoot) {
                            // Calculate Interval for Chord Tones
                            const dist = (currentNoteIndex - rIndex + 12) % 12;
                            if (dist === 3 || dist === 4) label = '3';
                            else if (dist === 7) label = '5';
                            else if (dist === 10 || dist === 11) label = '7';
                        }
                    }

                    // Colors
                    let circleColor = '#444'; // Slightly brighter base color
                    let textColor = '#ccc';
                    let opacity = 1.0;

                    if (isRoot) {
                        // Root (Gold)
                        circleColor = 'var(--accent-gold)';
                        textColor = '#000';
                    } else if (isHighlighted) {
                        // Chord Tone (Cyan/Blue)
                        circleColor = 'var(--primary-cyan)';
                        textColor = '#000';
                    } else {
                        // Scale Tone (Standard)
                        // Use a lighter grey for better visibility
                        circleColor = '#555';
                        textColor = '#fff';
                        
                        // If a chord is active, dim the other notes, but keep them visible
                        if (this.displayMode === 'scale' && activeChordNotes.length > 0) {
                            opacity = 0.6; // Increased from 0.3 for better visibility
                        }
                    }

                    // SVG Group for Note
                    svg += `<g opacity="${opacity}">`;
                    svg += `<circle cx="${x}" cy="${y}" r="11" fill="${circleColor}" />`;
                    svg += `<text x="${x}" y="${y+4}" font-size="10" fill="${textColor}" text-anchor="middle" font-weight="bold">${label}</text>`;
                    svg += `</g>`;
                }
            }
        }

        svg += `</svg>`;
        this.container.innerHTML = svg;
    }
}