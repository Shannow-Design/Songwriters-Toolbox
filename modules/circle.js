// modules/circle.js

export class CircleOfFifths {
    constructor(containerId, onKeyChangeCallback) {
        this.container = document.getElementById(containerId);
        this.onKeyChange = onKeyChangeCallback;
        
        // Order of Fifth (Clockwise)
        this.slices = [
            { major: 'C',  minor: 'Am', idx: 0 },
            { major: 'G',  minor: 'Em', idx: 1 },
            { major: 'D',  minor: 'Bm', idx: 2 },
            { major: 'A',  minor: 'F#m', idx: 3 },
            { major: 'E',  minor: 'C#m', idx: 4 },
            { major: 'B',  minor: 'G#m', idx: 5 },
            { major: 'F#', minor: 'D#m', idx: 6, alt: 'Gb' },
            { major: 'Db', minor: 'Bbm', idx: 7, alt: 'C#' },
            { major: 'Ab', minor: 'Fm',  idx: 8, alt: 'G#' },
            { major: 'Eb', minor: 'Cm',  idx: 9, alt: 'D#' },
            { major: 'Bb', minor: 'Gm',  idx: 10, alt: 'A#' },
            { major: 'F',  minor: 'Dm',  idx: 11 }
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
        
        // Create SVG
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 200 200");
        svg.style.width = "100%";
        svg.style.maxWidth = "350px";
        this.svg = svg;

        // Container for rotating group
        // Note: transition is applied here for the wheel rotation
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform-origin", "100 100");
        group.style.transition = "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)";
        this.rotatingGroup = group;
        svg.appendChild(group);

        // Draw Slices
        const radius = 98;
        const center = 100;
        
        this.slices.forEach((slice, i) => {
            const angleDeg = i * 30; // 360 / 12
            const angleRad = (angleDeg - 90) * (Math.PI / 180);
            const nextAngleRad = ((angleDeg + 30) - 90) * (Math.PI / 180);

            // Calculate coordinates for wedge
            const x1 = center + radius * Math.cos(angleRad);
            const y1 = center + radius * Math.sin(angleRad);
            const x2 = center + radius * Math.cos(nextAngleRad);
            const y2 = center + radius * Math.sin(nextAngleRad);

            // Path for Outer Ring (Major)
            const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;
            
            const wedge = document.createElementNS("http://www.w3.org/2000/svg", "path");
            wedge.setAttribute("d", pathData);
            wedge.setAttribute("fill", i % 2 === 0 ? "#333" : "#2a2a2a");
            wedge.setAttribute("stroke", "#1a1a1a");
            wedge.setAttribute("stroke-width", "1");
            wedge.classList.add("circle-wedge");
            wedge.dataset.index = i;
            
            // Interaction
            wedge.style.cursor = "pointer";
            wedge.addEventListener('click', () => {
                if(this.onKeyChange) this.onKeyChange(slice.major);
            });

            group.appendChild(wedge);

            // Text Labels (Major)
            const textRadius = 82;
            const textAngle = (angleDeg + 15 - 90) * (Math.PI / 180);
            const tx = center + textRadius * Math.cos(textAngle);
            const ty = center + textRadius * Math.sin(textAngle);

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", tx);
            text.setAttribute("y", ty);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("dominant-baseline", "middle");
            text.setAttribute("fill", "#bbb");
            text.setAttribute("font-size", "10");
            text.setAttribute("font-weight", "bold");
            text.setAttribute("pointer-events", "none");
            text.style.transition = "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), fill 0.2s"; 
            text.textContent = slice.major;
            
            // SAVE COORDINATES FOR ROTATION
            slice.textEl = text;
            slice.tx = tx;
            slice.ty = ty;

            group.appendChild(text);

            // Text Labels (Minor)
            const minRadius = 50;
            const mx = center + minRadius * Math.cos(textAngle);
            const my = center + minRadius * Math.sin(textAngle);

            const minText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            minText.setAttribute("x", mx);
            minText.setAttribute("y", my);
            minText.setAttribute("text-anchor", "middle");
            minText.setAttribute("dominant-baseline", "middle");
            minText.setAttribute("fill", "#666");
            minText.setAttribute("font-size", "8");
            minText.setAttribute("pointer-events", "none");
            minText.style.transition = "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)";
            minText.textContent = slice.minor;

            // SAVE COORDINATES FOR ROTATION
            slice.minTextEl = minText;
            slice.mx = mx;
            slice.my = my;

            group.appendChild(minText);
        });

        // Center Overlay (Donut Hole)
        const centerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        centerCircle.setAttribute("cx", center);
        centerCircle.setAttribute("cy", center);
        centerCircle.setAttribute("r", 35);
        centerCircle.setAttribute("fill", "#111"); 
        centerCircle.setAttribute("stroke", "#333");
        centerCircle.setAttribute("stroke-width", "2");
        svg.appendChild(centerCircle);
        
        // Static Indicator Triangle at top
        const indicator = document.createElementNS("http://www.w3.org/2000/svg", "path");
        indicator.setAttribute("d", "M 94 5 L 106 5 L 100 15 Z");
        indicator.setAttribute("fill", "var(--primary-cyan, #00e5ff)");
        svg.appendChild(indicator);

        this.container.appendChild(svg);
    }

    update(currentKey) {
        // 1. Normalize Key
        let index = this.keyMap[currentKey];
        if (index === undefined) index = 0; 

        // 2. Calculate Wheel Rotation (Negative to move selected index to top)
        const wheelRotation = -(index * 30);
        this.rotatingGroup.style.transform = `rotate(${wheelRotation}deg)`;
        
        // 3. Counter-Rotate Text so it stays horizontal
        // The wheel rotates -X deg, so text must rotate +X deg relative to the wheel
        const textRotation = -wheelRotation; // e.g., if wheel is -90, text is +90

        this.slices.forEach(slice => {
            // Update Major Text
            slice.textEl.style.transformOrigin = `${slice.tx}px ${slice.ty}px`;
            slice.textEl.style.transform = `rotate(${textRotation}deg)`;

            // Update Minor Text
            slice.minTextEl.style.transformOrigin = `${slice.mx}px ${slice.my}px`;
            slice.minTextEl.style.transform = `rotate(${textRotation}deg)`;

            // Highlight Active
            if(slice.idx === index) {
                slice.textEl.setAttribute("fill", "#fff");
                slice.textEl.setAttribute("font-size", "14");
                slice.minTextEl.setAttribute("fill", "#aaa");
            } else {
                slice.textEl.setAttribute("fill", "#888");
                slice.textEl.setAttribute("font-size", "10");
                slice.minTextEl.setAttribute("fill", "#555");
            }
        });
    }
}