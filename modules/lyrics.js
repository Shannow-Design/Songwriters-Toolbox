// modules/lyrics.js

export class LyricPad {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.render();
        this.loadLyrics();
        this.bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div style="display:flex; height: 400px; gap: 20px;">
                <div style="flex:2; display:flex; flex-direction:column;">
                    <div style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:1rem; color:#888;">LYRICS</h3>
                        <span id="save-status" style="font-size:0.7rem; color:#555;">Saved</span>
                    </div>
                    <textarea id="lyric-editor" 
                        style="flex:1; background:#1a1a1a; color:#eee; border:1px solid #333; border-radius:6px; padding:15px; font-family:sans-serif; font-size:1rem; line-height:1.5; resize:none;"
                        placeholder="Write your masterpiece here... (Double click a word to find rhymes)"></textarea>
                </div>

                <div style="flex:1; display:flex; flex-direction:column; background:#1a1a1a; border:1px solid #333; border-radius:6px; overflow:hidden;">
                    <div style="padding:10px; border-bottom:1px solid #333; background:#222;">
                        <input type="text" id="rhyme-search" placeholder="Find rhymes for..." style="width:100%; background:#111; border:1px solid #444; color:white; padding:5px; border-radius:3px;">
                        <div style="display:flex; gap:5px; margin-top:5px;">
                            <button id="btn-perfect" style="flex:1; background:#333; color:#ccc; border:none; padding:4px; font-size:0.7rem; cursor:pointer; border-radius:3px;">PERFECT</button>
                            <button id="btn-near" style="flex:1; background:#333; color:#ccc; border:none; padding:4px; font-size:0.7rem; cursor:pointer; border-radius:3px;">NEAR</button>
                        </div>
                    </div>
                    <div id="rhyme-results" style="flex:1; overflow-y:auto; padding:10px;">
                        <div style="text-align:center; color:#555; font-size:0.8rem; margin-top:20px;">
                            Select a word in the editor or type above.
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        const editor = this.container.querySelector('#lyric-editor');
        const searchInput = this.container.querySelector('#rhyme-search');
        const status = this.container.querySelector('#save-status');

        // Auto Save
        editor.addEventListener('input', () => {
            localStorage.setItem('song_lyrics', editor.value);
            status.textContent = "Saving...";
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => status.textContent = "Saved", 1000);
        });

        // Double Click to Rhyme
        editor.addEventListener('dblclick', () => {
            const word = this.getSelectionText();
            if (word) {
                searchInput.value = word;
                this.fetchRhymes(word, 'rhy'); // Default to Perfect
            }
        });

        // Manual Search
        this.container.querySelector('#btn-perfect').addEventListener('click', () => {
            if(searchInput.value) this.fetchRhymes(searchInput.value, 'rhy');
        });
        
        this.container.querySelector('#btn-near').addEventListener('click', () => {
            if(searchInput.value) this.fetchRhymes(searchInput.value, 'nry');
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.fetchRhymes(searchInput.value, 'rhy');
        });
    }

    loadLyrics() {
        const saved = localStorage.getItem('song_lyrics');
        if (saved) {
            this.container.querySelector('#lyric-editor').value = saved;
        }
    }

    getSelectionText() {
        const textarea = this.container.querySelector('#lyric-editor');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        return textarea.value.substring(start, end).trim();
    }

    async fetchRhymes(word, type) {
        const resultsDiv = this.container.querySelector('#rhyme-results');
        resultsDiv.innerHTML = `<div style="text-align:center; color:#888;">Searching...</div>`;

        try {
            // Datamuse API: rel_rhy (Perfect), rel_nry (Near)
            const response = await fetch(`https://api.datamuse.com/words?rel_${type}=${word}&max=50`);
            const data = await response.json();

            resultsDiv.innerHTML = '';
            
            if (data.length === 0) {
                resultsDiv.innerHTML = `<div style="text-align:center; color:#555;">No rhymes found.</div>`;
                return;
            }

            // Group by syllables
            const bySyllables = {};
            data.forEach(item => {
                const s = item.numSyllables;
                if(!bySyllables[s]) bySyllables[s] = [];
                bySyllables[s].push(item.word);
            });

            Object.keys(bySyllables).sort().forEach(syl => {
                const group = document.createElement('div');
                group.style.marginBottom = "10px";
                group.innerHTML = `<div style="font-size:0.7rem; color:#00e5ff; font-weight:bold; margin-bottom:4px;">${syl} SYLLABLE${syl > 1 ? 'S' : ''}</div>`;
                
                const list = document.createElement('div');
                list.style.display = 'flex';
                list.style.flexWrap = 'wrap';
                list.style.gap = '5px';
                
                bySyllables[syl].forEach(w => {
                    const tag = document.createElement('span');
                    tag.textContent = w;
                    tag.style.background = '#333';
                    tag.style.padding = '2px 6px';
                    tag.style.borderRadius = '3px';
                    tag.style.fontSize = '0.8rem';
                    tag.style.cursor = 'pointer';
                    tag.style.color = '#ccc';
                    tag.onclick = () => this.insertWord(w); // Click to insert? Optional.
                    list.appendChild(tag);
                });
                
                group.appendChild(list);
                resultsDiv.appendChild(group);
            });

        } catch (err) {
            resultsDiv.innerHTML = `<div style="text-align:center; color:red;">Error fetching rhymes.</div>`;
        }
    }
    
    // Optional: Click a rhyme to copy it to clipboard
    insertWord(word) {
        navigator.clipboard.writeText(word);
        // Visual feedback
        const el = document.activeElement; // The clicked span
        /* You could flash it green here */
    }
}