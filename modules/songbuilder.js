// modules/songbuilder.js
export class SongBuilder {
    constructor(containerId, sequencer) {
        this.container = document.getElementById(containerId);
        this.sequencer = sequencer;
        
        // Song Data
        this.playlist = []; 
        this.savedSongs = JSON.parse(localStorage.getItem('songbuilder_saved_songs')) || {};
        
        // Playback State
        this.isActive = false;
        this.currentBlockIndex = 0;
        this.currentRepeatCount = 0;

        this.render();
    }

    onStep(stepNumber) {
        if (!this.isActive || this.playlist.length === 0) return;

        // Check at the END of the bar (Step 15) to prep for next bar
        if (stepNumber === 15) {
            this.handleBarEnd();
        }
    }

    handleBarEnd() {
        this.currentRepeatCount++;
        const currentBlock = this.playlist[this.currentBlockIndex];
        
        if (this.currentRepeatCount >= currentBlock.repeats) {
            this.advanceToNextBlock();
        }
    }

    advanceToNextBlock() {
        const nextIndex = this.currentBlockIndex + 1;

        if (nextIndex < this.playlist.length) {
            this.currentBlockIndex = nextIndex;
            this.currentRepeatCount = 0; 
            
            const nextPresetName = this.playlist[nextIndex].presetName;
            this.highlightActiveBlock(nextIndex);
            
            if (this.sequencer.savedPresets[nextPresetName]) {
                console.log(`SongBuilder: Switching to ${nextPresetName}`);
                this.sequencer.loadPreset(nextPresetName);
                this.sequencer.resetProgressionIndex(); 
            }
        } else {
            console.log("SongBuilder: Song Finished");
            this.stopSong();
        }
    }

    playSong() {
        if (this.playlist.length === 0) return alert("Add some blocks to your song first!");
        
        this.isActive = true;
        this.currentBlockIndex = 0;
        this.currentRepeatCount = 0;
        
        const firstPreset = this.playlist[0].presetName;
        if (this.sequencer.savedPresets[firstPreset]) {
            this.sequencer.loadPreset(firstPreset);
            this.sequencer.resetProgressionIndex();
        }

        this.highlightActiveBlock(0);
        
        if (!this.sequencer.isPlaying) {
            this.sequencer.togglePlay();
        }
        
        this.updatePlayButtonUI();
    }

    stopSong() {
        this.isActive = false;
        this.currentBlockIndex = 0;
        this.currentRepeatCount = 0;
        this.clearHighlights();
        
        if (this.sequencer.isPlaying) {
            this.sequencer.togglePlay(); 
        }
        this.updatePlayButtonUI();
    }

    // --- DATA PERSISTENCE ---

    saveSong() {
        const name = prompt("Enter a name for this song:");
        if (!name) return;

        this.savedSongs[name] = this.playlist;
        localStorage.setItem('songbuilder_saved_songs', JSON.stringify(this.savedSongs));
        this.refreshSongList();
        
        // Select the newly saved song
        this.container.querySelector('#sel-song-load').value = name;
        this.toggleDeleteButton();
    }

    loadSong(name) {
        if (!name || !this.savedSongs[name]) return;
        
        // Deep copy to prevent reference issues
        this.playlist = JSON.parse(JSON.stringify(this.savedSongs[name]));
        this.renderList();
        this.toggleDeleteButton();
    }

    deleteSong() {
        const sel = this.container.querySelector('#sel-song-load');
        const name = sel.value;
        
        if (name && confirm(`Delete song "${name}"?`)) {
            delete this.savedSongs[name];
            localStorage.setItem('songbuilder_saved_songs', JSON.stringify(this.savedSongs));
            this.refreshSongList();
            this.toggleDeleteButton();
        }
    }

    refreshSongList() {
        const sel = this.container.querySelector('#sel-song-load');
        const currentVal = sel.value;
        
        sel.innerHTML = '<option value="">Load Song...</option>';
        Object.keys(this.savedSongs).sort().forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            sel.appendChild(opt);
        });

        // Restore selection if it still exists
        if (this.savedSongs[currentVal]) sel.value = currentVal;
    }

    toggleDeleteButton() {
        const sel = this.container.querySelector('#sel-song-load');
        const btnDel = this.container.querySelector('#btn-song-del');
        btnDel.style.display = sel.value ? 'inline-block' : 'none';
    }

    // --- UI METHODS ---

    addBlock() {
        const presets = Object.keys(this.sequencer.savedPresets);
        if (presets.length === 0) return alert("Save some presets in the Sequencer first!");

        this.playlist.push({
            presetName: presets[0],
            repeats: 4 
        });
        this.renderList();
    }

    removeBlock(index) {
        this.playlist.splice(index, 1);
        this.renderList();
    }

    moveBlock(index, direction) {
        if (direction === -1 && index > 0) {
            [this.playlist[index], this.playlist[index-1]] = [this.playlist[index-1], this.playlist[index]];
        } else if (direction === 1 && index < this.playlist.length - 1) {
            [this.playlist[index], this.playlist[index+1]] = [this.playlist[index+1], this.playlist[index]];
        }
        this.renderList();
    }

    updateBlockData(index, field, value) {
        this.playlist[index][field] = value;
    }

    highlightActiveBlock(index) {
        this.clearHighlights();
        const rows = this.container.querySelectorAll('.song-block-row');
        if (rows[index]) rows[index].classList.add('active-playing-block');
    }

    clearHighlights() {
        this.container.querySelectorAll('.song-block-row').forEach(r => r.classList.remove('active-playing-block'));
    }

    updatePlayButtonUI() {
        const btn = this.container.querySelector('#btn-song-play');
        if (this.isActive) {
            btn.textContent = "⏹ STOP SONG";
            btn.classList.add('active');
        } else {
            btn.textContent = "▶ PLAY SONG";
            btn.classList.remove('active');
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="song-builder-header">
                <h3>SONG MODE</h3>
                
                <div class="song-file-controls">
                    <select id="sel-song-load" class="song-select"></select>
                    <button id="btn-song-save" class="btn-new" style="background:#444;">SAVE</button>
                    <button id="btn-song-del" class="btn-delete-custom" style="display:none;">X</button>
                </div>

                <div class="song-controls">
                    <button id="btn-add-block" class="btn-new">+ ADD SECTION</button>
                    <button id="btn-song-play" class="btn-song-play">▶ PLAY SONG</button>
                </div>
            </div>
            <div id="song-blocks-list" class="song-blocks-list">
                <div style="padding:20px; color:#666; text-align:center; font-style:italic;">
                    No blocks yet. Save presets in the Sequencer, then add them here.
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.innerHTML = `
            .song-builder-header { 
                display: flex; justify-content: space-between; align-items: center; 
                margin-bottom: 15px; border-bottom: 1px solid #444; padding-bottom: 10px; flex-wrap: wrap; gap: 10px;
            }
            .song-builder-header h3 { margin: 0; color: #fff; letter-spacing: 1px; min-width: 100px; }
            
            .song-file-controls { display: flex; gap: 5px; align-items: center; flex: 1; justify-content: center; }
            .song-select { background: #111; color: #ccc; border: 1px solid #444; padding: 4px; font-size: 0.8rem; border-radius: 4px; width: 150px; }

            .song-controls { display: flex; gap: 10px; }
            
            .btn-song-play { 
                background: #444; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; 
            }
            .btn-song-play.active { background: var(--primary-cyan); color: #000; box-shadow: 0 0 10px var(--primary-cyan); }

            .song-blocks-list { display: flex; flex-direction: column; gap: 8px; }
            
            .song-block-row { 
                display: flex; align-items: center; gap: 10px; background: #222; padding: 8px; border-radius: 4px; border-left: 4px solid #444; 
                transition: all 0.2s;
            }
            .song-block-row.active-playing-block { border-left-color: var(--primary-cyan); background: #2a2a2a; box-shadow: 0 0 10px rgba(0,229,255,0.1); }

            .block-index { font-weight: bold; color: #555; width: 20px; text-align: center; }
            
            .block-select { flex: 1; background: #111; color: #fff; border: 1px solid #444; padding: 5px; border-radius: 4px; }
            
            .block-repeats-group { display: flex; align-items: center; gap: 5px; background: #111; padding: 2px 8px; border-radius: 15px; border: 1px solid #333; }
            .block-repeats-group label { font-size: 0.7rem; color: #888; }
            .block-repeats-input { width: 40px; background: transparent; border: none; color: var(--primary-cyan); font-weight: bold; text-align: center; }

            .block-actions { display: flex; gap: 2px; }
            .btn-icon { background: none; border: none; color: #666; cursor: pointer; font-size: 0.9rem; padding: 2px 5px; }
            .btn-icon:hover { color: #fff; }
            .btn-icon.del:hover { color: #ff5555; }
        `;
        this.container.appendChild(style);

        // Bind Events
        this.container.querySelector('#btn-add-block').addEventListener('click', () => this.addBlock());
        this.container.querySelector('#btn-song-play').addEventListener('click', () => {
            if(this.isActive) this.stopSong(); else this.playSong();
        });
        
        // Load/Save Events
        this.container.querySelector('#btn-song-save').addEventListener('click', () => this.saveSong());
        this.container.querySelector('#btn-song-del').addEventListener('click', () => this.deleteSong());
        this.container.querySelector('#sel-song-load').addEventListener('change', (e) => this.loadSong(e.target.value));

        // Initial Populate
        this.refreshSongList();
    }

    renderList() {
        const list = this.container.querySelector('#song-blocks-list');
        list.innerHTML = '';

        if (this.playlist.length === 0) {
            list.innerHTML = `<div style="padding:20px; color:#666; text-align:center; font-style:italic;">Add sections to build a song structure.</div>`;
            return;
        }

        const presets = Object.keys(this.sequencer.savedPresets);

        this.playlist.forEach((block, i) => {
            const row = document.createElement('div');
            row.className = 'song-block-row';
            
            const idx = document.createElement('div');
            idx.className = 'block-index';
            idx.textContent = i + 1;

            const sel = document.createElement('select');
            sel.className = 'block-select';
            presets.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                if (p === block.presetName) opt.selected = true;
                sel.appendChild(opt);
            });
            sel.addEventListener('change', (e) => this.updateBlockData(i, 'presetName', e.target.value));

            const repGroup = document.createElement('div');
            repGroup.className = 'block-repeats-group';
            repGroup.innerHTML = `<label>x</label><input type="number" class="block-repeats-input" value="${block.repeats}" min="1" max="64"> <label>BARS</label>`;
            repGroup.querySelector('input').addEventListener('change', (e) => this.updateBlockData(i, 'repeats', parseInt(e.target.value)));

            const actions = document.createElement('div');
            actions.className = 'block-actions';
            actions.innerHTML = `
                <button class="btn-icon" title="Move Up">▲</button>
                <button class="btn-icon" title="Move Down">▼</button>
                <button class="btn-icon del" title="Remove">×</button>
            `;
            const [btnUp, btnDown, btnDel] = actions.querySelectorAll('button');
            btnUp.addEventListener('click', () => this.moveBlock(i, -1));
            btnDown.addEventListener('click', () => this.moveBlock(i, 1));
            btnDel.addEventListener('click', () => this.removeBlock(i));

            row.appendChild(idx);
            row.appendChild(sel);
            row.appendChild(repGroup);
            row.appendChild(actions);
            list.appendChild(row);
        });
    }
}