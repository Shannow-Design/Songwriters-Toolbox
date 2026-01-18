// modules/circle.js

export class CircleOfFifths {
    constructor(containerId, onKeyChangeCallback) {
        this.container = document.getElementById(containerId);
        this.onKeyChange = onKeyChangeCallback;
        
        // Order of Fifths (Clockwise)
        // Added 'dim' property for 3rd ring
        this.slices = [
            { major: 'C',  minor: 'Am',  dim: 'B°',   idx: 0 },
            { major: 'G',  minor: 'Em',  dim: 'F#°',  idx: 1 },
            { major: 'D',  minor: 'Bm',  dim: 'C#°',  idx: 2 },
            { major: 'A',  minor: 'F#m', dim: 'G#°',  idx: 3 },
            { major: 'E',  minor: 'C#m', dim: 'D#°',  idx: 4 },
            { major: 'B',  minor: 'G#m', dim: 'A#°',  idx: 5 },
            { major: 'F#', minor: 'D#m', dim: 'E#°',  idx: 6, alt: 'Gb' },
            { major: 'Db', minor: 'Bbm', dim: 'C°',   idx: 7, alt: 'C#' },
            { major: 'Ab', minor: 'Fm',  dim: 'G°',   idx: 8, alt: 'G#' },
            { major: 'Eb', minor: 'Cm',  dim: 'D°',   idx: 9, alt: 'D#' },
            { major: 'Bb', minor: 'Gm',  dim: 'A°',   idx: 10, alt: 'A#' },
            { major: 'F',  minor: 'Dm',  dim: 'E°',   idx: 11 }
        ];

        // Map standard chromatic keys to circle indices
        this.keyMap = {
            'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5,
            'F#': 6, 'Gb': 6, 
            'C#': 7, 'Db': 7,
            'G#': 8, 'Ab': 8,
            'D#': 9, 'Eb': 9,
            'A#': 10, 'Bb': 10,
            'F': 11
        };

        this.render();
    }

    render() {
        this.container.innerHTML = '';
        
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 200 200");
        svg.style.width = "100%";
        svg.style.maxWidth = "350px";
        this.svg = svg;

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform-origin", "100 100");
        group.style.transition = "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)";
        this.rotatingGroup = group;
        svg.appendChild(group);

        const center = 100;
        
        // Radii Configuration
        const radMajorOuter = 98;
        const radMajorInner = 68; // Boundary between Maj/Min
        const radMinorInner = 42; // Boundary between Min/Dim
        const radDimInner   = 20; // Center hole

        // Text Position Radii
        const radTextMajor = 83;
        const radTextMinor = 55;
        const radTextDim   = 31;

        this.slices.forEach((slice, i) => {
            const angleDeg = i * 30; // 360 / 12
            const angleRad = (angleDeg - 90) * (Math.PI / 180);
            const nextAngleRad = ((angleDeg + 30) - 90) * (Math.PI / 180);
            
            // Text Rotation Angle
            const textAngle = (angleDeg + 15 - 90) * (Math.PI / 180);

            // --- HELPER TO DRAW WEDGES ---
            const createWedge = (rOuter, rInner, fill, type) => {
                const x1 = center + rOuter * Math.cos(angleRad);
                const y1 = center + rOuter * Math.sin(angleRad);
                const x2 = center + rOuter * Math.cos(nextAngleRad);
                const y2 = center + rOuter * Math.sin(nextAngleRad);
                
                const x3 = center + rInner * Math.cos(nextAngleRad);
                const y3 = center + rInner * Math.sin(nextAngleRad);
                const x4 = center + rInner * Math.cos(angleRad);
                const y4 = center + rInner * Math.sin(angleRad);

                const pathData = `
                    M ${x1} ${y1} 
                    A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} 
                    L ${x3} ${y3} 
                    A ${rInner} ${rInner} 0 0 0 ${x4} ${y4} 
                    Z
                `;
                
                const wedge = document.createElementNS("http://www.w3.org/2000/svg", "path");
                wedge.setAttribute("d", pathData);
                wedge.setAttribute("fill", fill);
                wedge.setAttribute("stroke", "#1a1a1a");
                wedge.setAttribute("stroke-width", "1");
                wedge.classList.add("circle-wedge");
                
                // Store reference for highlighting
                if(!slice.wedges) slice.wedges = {};
                slice.wedges[type] = wedge;

                if (type === 'major') {
                    wedge.style.cursor = "pointer";
                    wedge.addEventListener('click', () => { if(this.onKeyChange) this.onKeyChange(slice.major); });
                }
                
                group.appendChild(wedge);
            };

            // 1. Major Ring
            createWedge(radMajorOuter, radMajorInner, i % 2 === 0 ? "#333" : "#2a2a2a", 'major');
            
            // 2. Minor Ring
            createWedge(radMajorInner, radMinorInner, i % 2 === 0 ? "#2a2a2a" : "#333", 'minor');

            // 3. Diminished Ring
            createWedge(radMinorInner, radDimInner, i % 2 === 0 ? "#222" : "#282828", 'dim');

            // --- HELPER TO DRAW TEXT ---
            const createText = (radius, textContent, type) => {
                const tx = center + radius * Math.cos(textAngle);
                const ty = center + radius * Math.sin(textAngle);
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                
                text.setAttribute("x", tx);
                text.setAttribute("y", ty);
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("dominant-baseline", "middle");
                text.setAttribute("fill", type === 'major' ? "#bbb" : (type==='dim' ? "#555" : "#777"));
                text.setAttribute("font-size", type === 'dim' ? "7" : (type === 'minor' ? "8" : "10"));
                text.setAttribute("font-weight", "bold");
                text.setAttribute("pointer-events", "none");
                text.style.transition = "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), fill 0.2s"; 
                text.textContent = textContent;
                
                // Store for rotation
                if(!slice.texts) slice.texts = {};
                slice.texts[type] = { el: text, x: tx, y: ty };
                
                group.appendChild(text);
            };

            createText(radTextMajor, slice.major, 'major');
            createText(radTextMinor, slice.minor, 'minor');
            createText(radTextDim, slice.dim, 'dim');
        });

        // Center Hole
        const centerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        centerCircle.setAttribute("cx", center);
        centerCircle.setAttribute("cy", center);
        centerCircle.setAttribute("r", radDimInner);
        centerCircle.setAttribute("fill", "#111"); 
        centerCircle.setAttribute("stroke", "#333");
        centerCircle.setAttribute("stroke-width", "1");
        svg.appendChild(centerCircle);
        
        // Static Indicator Triangle
        const indicator = document.createElementNS("http://www.w3.org/2000/svg", "path");
        indicator.setAttribute("d", "M 94 2 L 106 2 L 100 12 Z");
        indicator.setAttribute("fill", "var(--primary-cyan, #00e5ff)");
        svg.appendChild(indicator);

        this.container.appendChild(svg);
    }

    update(currentKey) {
        let index = this.keyMap[currentKey];
        if (index === undefined) index = 0; 

        // 1. Rotate Wheel
        const wheelRotation = -(index * 30);
        this.rotatingGroup.style.transform = `rotate(${wheelRotation}deg)`;
        
        // 2. Determine Neighbors (The "Pie Slice" of diatonic chords)
        // In Circle of Fifths, a key's diatonic chords are:
        // Center (I), Left (IV), Right (V)
        // Plus their relative minors (Inner ring directly below them)
        // Plus the diminished (usually near the V or iii)
        
        const normalize = (i) => (i + 12) % 12;
        const left = normalize(index - 1);
        const right = normalize(index + 1);
        
        // Highlight Set: Center, Left, Right
        const activeIndices = [left, index, right];

        this.slices.forEach(slice => {
            // A. Counter-Rotate Text
            const textRotation = -wheelRotation;
            ['major', 'minor', 'dim'].forEach(type => {
                const t = slice.texts[type];
                t.el.style.transformOrigin = `${t.x}px ${t.y}px`;
                t.el.style.transform = `rotate(${textRotation}deg)`;
            });

            // B. Apply Highlights
            const isActive = activeIndices.includes(slice.idx);
            const isCenter = (slice.idx === index);

            // Major Ring Colors
            if (isCenter) {
                slice.wedges.major.setAttribute("fill", "var(--primary-cyan)"); 
                slice.texts.major.el.setAttribute("fill", "#000");
            } else if (isActive) {
                slice.wedges.major.setAttribute("fill", "#444"); // Neighbors (IV, V)
                slice.texts.major.el.setAttribute("fill", "#fff");
            } else {
                slice.wedges.major.setAttribute("fill", slice.idx % 2 === 0 ? "#333" : "#2a2a2a");
                slice.texts.major.el.setAttribute("fill", "#888");
            }

            // Minor Ring Colors
            if (isActive) {
                // Determine functionality
                if (isCenter) { // vi chord (relative minor)
                    slice.wedges.minor.setAttribute("fill", "#555");
                    slice.texts.minor.el.setAttribute("fill", "#fff");
                } else { // ii and iii chords
                    slice.wedges.minor.setAttribute("fill", "#444");
                    slice.texts.minor.el.setAttribute("fill", "#ccc");
                }
            } else {
                slice.wedges.minor.setAttribute("fill", slice.idx % 2 === 0 ? "#2a2a2a" : "#333");
                slice.texts.minor.el.setAttribute("fill", "#666");
            }

            // Diminished Ring Highlight (Only the vii° - usually at index + 1 position's inner ring?)
            // Actually, in the standard visual mapping:
            // Key C -> Dim is B° (Right neighbor's dim ring? No, B is right of E..)
            // Let's look at the data: C Major (idx 0) has 'dim' = B°.
            // In C Major, B° is vii°.
            // So we just highlight the DIM ring of the CENTER slice? 
            // Wait, slice 0 is C, Am, B°. So yes, we highlight the dim ring of the ACTIVE slice.
            if (isCenter) {
                slice.wedges.dim.setAttribute("fill", "#552222"); // Subtle red/pink for dim
                slice.texts.dim.el.setAttribute("fill", "#ffaaaa");
            } else {
                slice.wedges.dim.setAttribute("fill", slice.idx % 2 === 0 ? "#222" : "#282828");
                slice.texts.dim.el.setAttribute("fill", "#444");
            }
        });
    }
}