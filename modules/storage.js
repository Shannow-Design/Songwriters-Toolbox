// modules/storage.js

const DB_NAME = 'SequencerAppDB';
const STORE_NAME = 'samples';
const DB_VERSION = 1;

export const SampleStorage = {
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e);
        });
    },

    // Updated: Accepts 'prefix' to distinguish 'slot' (Sampler) from 'loop' (Looper)
    async saveSample(index, audioBuffer, name, prefix = 'slot') {
        const db = await this.openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const serializable = {
            name: name || `${prefix === 'loop' ? 'Loop' : 'Sample'} ${index + 1}`,
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            length: audioBuffer.length,
            channelData: []
        };

        for(let i=0; i<audioBuffer.numberOfChannels; i++) {
            serializable.channelData.push(audioBuffer.getChannelData(i));
        }

        store.put(serializable, `${prefix}_${index}`);
        return tx.complete;
    },

    async loadSample(index, ctx, prefix = 'slot') {
        const db = await this.openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(`${prefix}_${index}`);
            
            req.onsuccess = () => {
                const data = req.result;
                if (!data) return resolve(null);

                const buffer = ctx.createBuffer(data.numberOfChannels, data.length, data.sampleRate);
                for(let i=0; i<data.numberOfChannels; i++) {
                    buffer.copyToChannel(data.channelData[i], i);
                }
                resolve({ buffer, name: data.name });
            };
            req.onerror = () => resolve(null);
        });
    }
};