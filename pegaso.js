// ==UserScript==
// @name         Pegaso Auto Video Viewer - Ultimate v3.0
// @version      3.0
// @description  Apre sezioni, identifica lezioni mancanti, salva stato in locale e completa il corso.
// @match        https://lms.pegaso.multiversity.click/videolezioni/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ============ CONFIGURAZIONE & STORAGE ============
    const DEFAULT_CONFIG = {
        REQUIRED_PERCENTAGE: 92, // Leggermente aumentato per sicurezza
        PLAYBACK_SPEED: 1.0,     // Velocità video
        AUTO_START: false,       // Se true, parte subito senza aspettare il click
        CHECK_INTERVAL: 1000,
        SCROLL_DELAY: 800,
        INITIAL_SCAN_DELAY: 1500 // nuovo delay iniziale prima della scansione
    };

    // Carica config da LocalStorage o usa default
    const STORAGE_KEY = 'pegaso_automator_v3_config';
    let savedConfig = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const CONFIG = { ...DEFAULT_CONFIG, ...savedConfig };

    function saveConfig() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(CONFIG));
    }

    // ============ STATO GLOBALE ============
    let state = {
        queue: [],              // La coda delle lezioni DA FARE
        currentIndex: 0,        // Indice nella coda
        currentVideo: null,
        progressInterval: null,
        isPlaying: false,
        status: 'idle',         // idle, scanning, playing, completed
        totalFound: 0,
        alreadyDone: 0
    };

    // ============ LOGGER ============
    function log(msg, type = 'info') {
        const styles = {
            info: 'color: #3b82f6',
            success: 'color: #22c55e; font-weight: bold',
            warn: 'color: #f59e0b',
            error: 'color: #ef4444; font-weight: bold',
            step: 'color: #8b5cf6; font-style: italic'
        };
        console.log(`%c[PegasoBot] ${msg}`, styles[type] || styles.info);
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ============ ANALISI DOM & SEZIONI ============

    // Funzione robusta per aprire tutte le sezioni
    async function expandAllSections() {
        await sleep(CONFIG.INITIAL_SCAN_DELAY || 0);
        log('Apertura e scansione sezioni...', 'step');

        const headers = document.querySelectorAll('.cursor-pointer.relative.align-middle');
        for (const header of headers) {
            const wrapper = header.closest('.relative.text-platform-sub-text');
            if (!wrapper) continue;

            const content = () => wrapper.querySelector('.border-t.text-platform-text');
            const isClosed = () => {
                const c = content();
                return !c || c.offsetHeight === 0 || getComputedStyle(c).display === 'none';
            };

            if (isClosed()) {
                header.click();
                await sleep(300);
                // Fallback: prova il chevron interno se ancora chiuso
                if (isClosed()) {
                    const chevron = header.querySelector('svg, path');
                    chevron && chevron.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    await sleep(300);
                }
            }
        }

        log('Tutte le sezioni dovrebbero essere aperte.', 'success');
        await sleep(600);
    }

    // ============ LOGICA "COSA MANCA" ============

    function analyzeLessons() {
        state.queue = [];
        state.totalFound = 0;
        state.alreadyDone = 0;
        const rows = document.querySelectorAll('.pr-3.py-2');

        rows.forEach((row, index) => {
            state.totalFound++;

            const titleEl = row.querySelector('.text-base.flex.justify-between .mb-2');
            const title = titleEl ? titleEl.textContent.trim() : `Lezione ${index}`;
            const titleLower = title.toLowerCase();

            const isObjective = row.querySelector('.bg-platform-green\\/20') !== null;
            const hasGreenIcon = row.querySelector('path[fill="#00C49A"]') !== null || row.querySelector('path[fill="#2FA33D"]') !== null;
            const progressFull = !!row.querySelector('[style*="width: 100%"][class*="bg-platform-green"]');
            const isCompleted = hasGreenIcon || progressFull;

            const isSpecial = titleLower.includes('test di fine lezione') || titleLower.includes('dispensa');

            if (!isCompleted && !isSpecial) {
                state.queue.push({
                    element: row,
                    title,
                    type: isObjective ? 'objective' : 'video',
                    id: index
                });
            } else {
                state.alreadyDone++;
            }
        });

        log(`Analisi: Trovate ${state.totalFound}. Già fatte: ${state.alreadyDone}. Mancanti: ${state.queue.length}`, 'info');
        localStorage.setItem('pegaso_missing_queue', JSON.stringify(state.queue.map(i => i.title)));
        updateUI();
        return state.queue.length > 0;
    }

    // ============ AUTOMAZIONE ============

    async function processQueue() {
        if (state.queue.length === 0) {
            log('Nessuna lezione mancante trovata! Corso completato?', 'success');
            showCompletionModal();
            return;
        }

        state.status = 'playing';
        updateUI();

        // Processa la coda
        for (let i = 0; i < state.queue.length; i++) {
            state.currentIndex = i;
            const item = state.queue[i];

            log(`Elaborazione ${i + 1}/${state.queue.length}: ${item.title} [${item.type}]`, 'step');

            // Scroll e Click
            item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(500);

            // Simuliamo il click sull'elemento cliccabile interno
            const clickTarget = item.element.closest('.cursor-pointer') || item.element;
            clickTarget.click();

            if (item.type === 'objective') {
                // Gli obiettivi si completano "visitandoli".
                // Aspettiamo un po' e verifichiamo se appare la spunta verde (opzionale)
                await sleep(3500);
                // Si passa al prossimo
                markLocalAsDone(item.title);
            }
            else if (item.type === 'video') {
                // Gestione Video
                await handleVideo();
                markLocalAsDone(item.title);
                await sleep(2000); // Pausa tra video
            }
        }

        log('Coda terminata!', 'success');
        showCompletionModal();
        state.status = 'completed';
        updateUI();
    }

    // Gestore specifico del Video Player
    function handleVideo() {
        return new Promise((resolve) => {
            let attempts = 0;

            const checkVideo = setInterval(async () => {
                const video = document.querySelector('video#video');
                if (video) {
                    clearInterval(checkVideo);
                    state.currentVideo = video;

                    video.playbackRate = CONFIG.PLAYBACK_SPEED;
                    video.muted = true;

                    try { await video.play(); state.isPlaying = true; }
                    catch { video.muted = true; video.play(); }

                    updateUI();

                    let stallCount = 0;
                    let lastTime = video.currentTime;
                    const onEnd = () => { cleanup(); resolve(); };
                    video.addEventListener('ended', onEnd, { once: true });

                    const monitor = setInterval(() => {
                        if (!video || !video.duration) return;

                        const perc = (video.currentTime / video.duration) * 100;
                        updateProgressUI(perc, video.currentTime, video.duration);

                        // Avanza se raggiunta la soglia
                        if (perc >= CONFIG.REQUIRED_PERCENTAGE) { cleanup(); resolve(); return; }

                        // Stall guard: se il tempo non avanza per 12s, passa oltre
                        if (video.currentTime - lastTime < 0.1) {
                            stallCount++;
                            if (stallCount >= 12) { log('Video bloccato, skip.', 'warn'); cleanup(); resolve(); }
                        } else {
                            stallCount = 0;
                        }
                        lastTime = video.currentTime;
                    }, 1000);

                    // Fallback tempo massimo: 3x durata o 180s se la durata manca
                    const maxMs = video.duration ? video.duration * 3000 : 180000;
                    const maxTimer = setTimeout(() => { log('Timeout video, skip.', 'warn'); cleanup(); resolve(); }, maxMs);

                    function cleanup() {
                        clearInterval(monitor);
                        clearTimeout(maxTimer);
                        video.removeEventListener('ended', onEnd);
                    }
                }

                attempts++;
                if (attempts > 20) { // ~20s di attesa
                    clearInterval(checkVideo);
                    log('Video non trovato dopo attesa, skip.', 'warn');
                    resolve();
                }
            }, 1000);
        });
    }

    function markLocalAsDone(title) {
        // Opzionale: salva log progresso locale
        let done = JSON.parse(localStorage.getItem('pegaso_completed_log') || '[]');
        if (!done.includes(title)) {
            done.push(title);
            localStorage.setItem('pegaso_completed_log', JSON.stringify(done));
        }
    }

    // ============ INTERFACCIA UTENTE (UI) ============

    function createUI() {
        const div = document.createElement('div');
        div.id = 'pegaso-bot-panel';
        div.style.cssText = `
            position: fixed; top: 20px; right: 20px; width: 320px;
            background: rgba(15, 23, 42, 0.95); color: white;
            border-radius: 12px; padding: 16px; z-index: 999999;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5); font-family: sans-serif;
            border: 1px solid #334155; backdrop-filter: blur(5px);
            font-size: 13px;
        `;
        document.body.appendChild(div);
        updateUI();
    }

    function updateUI() {
        const p = document.getElementById('pegaso-bot-panel');
        if (!p) return;

        const remaining = state.queue.length - state.currentIndex;
        const currentTitle = state.queue[state.currentIndex] ? state.queue[state.currentIndex].title : 'In attesa...';

        p.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <strong style="color:#38bdf8;font-size:15px;">🤖 Pegaso Auto v3.0</strong>
                <span style="background:${state.status === 'playing' ? '#22c55e' : '#64748b'};padding:2px 6px;border-radius:4px;font-size:10px;">${state.status.toUpperCase()}</span>
            </div>

            <div style="background:#1e293b;padding:10px;border-radius:6px;margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-bottom:5px;">
                    <span>Totale Lezioni:</span> <span style="color:white">${state.totalFound}</span>
                </div>
                <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-bottom:5px;">
                    <span>Già Completate:</span> <span style="color:#4ade80">${state.alreadyDone}</span>
                </div>
                <div style="display:flex;justify-content:space-between;color:#94a3b8;border-top:1px solid #334155;padding-top:5px;">
                    <span>Da Fare (Coda):</span> <span style="color:#f472b6;font-weight:bold">${remaining}</span>
                </div>
            </div>

            <div style="margin-bottom:5px;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                👉 <b>Corrente:</b> ${currentTitle}
            </div>

            <div style="height:6px;background:#334155;border-radius:3px;overflow:hidden;margin-bottom:15px;">
                <div id="p-bar" style="width:0%;height:100%;background:linear-gradient(90deg, #3b82f6, #8b5cf6);transition:width 0.5s;"></div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button id="btn-scan" style="padding:8px;background:#475569;border:none;border-radius:6px;color:white;cursor:pointer;">
                    🔍 Scansiona
                </button>
                <button id="btn-run" style="padding:8px;background:#0ea5e9;border:none;border-radius:6px;color:white;cursor:pointer;font-weight:bold;">
                    🚀 AVVIA
                </button>
            </div>
            <div style="margin-top:10px;text-align:center;font-size:10px;color:#64748b;">
                Velocità: ${CONFIG.PLAYBACK_SPEED}x | Soglia: ${CONFIG.REQUIRED_PERCENTAGE}%
            </div>
        `;

        document.getElementById('btn-scan').onclick = async () => {
            await expandAllSections();
            analyzeLessons();
        };

        document.getElementById('btn-run').onclick = () => {
             if (state.queue.length === 0) {
                 expandAllSections().then(() => {
                     analyzeLessons();
                     processQueue();
                 });
             } else {
                 processQueue();
             }
        };
    }

    function updateProgressUI(percent, curr, total) {
        const bar = document.getElementById('p-bar');
        if (bar) bar.style.width = `${percent}%`;
    }

    function showCompletionModal() {
        alert("🎉 TUTTE LE LEZIONI MANCANTI COMPLETATE! 🎉");
    }

    // ============ MAIN ============
    async function init() {
        createUI();

        // Auto-scan iniziale (senza click, solo per popolare la UI)
        await sleep(1500);
        await expandAllSections(); // Fondamentale: apre tutto per vedere cosa manca
        analyzeLessons(); // Popola la variabile "Da Fare" e salva in locale

        // Se configurato auto-start
        if (CONFIG.AUTO_START && state.queue.length > 0) {
            processQueue();
        }
    }

    init();

})();
