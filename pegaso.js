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
        INITIAL_SCAN_DELAY: 1500, // nuovo delay iniziale prima della scansione
        VIDEO_MONITOR_INTERVAL: 2000, // Intervallo monitoraggio video (ms) - aumentato per risparmiare risorse
        HIDE_VIDEO_PLAYER: true  // Se true, nasconde il player quando non serve per risparmiare CPU
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
        alreadyDone: 0,
        stopRequested: false,   // Flag per fermare l'elaborazione
        startTime: null,        // Timestamp inizio elaborazione
        estimatedEndTime: null  // Stima fine in millisecondi
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
    function parseDuration(text) {
        if (!text) return Infinity;
        const parts = text.split(':').map(Number);
        if (parts.some(n => Number.isNaN(n))) return Infinity;
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return Infinity;
    }

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
            const durationEl = row.querySelector('.text-sm.text-platform-gray');
            const durationText = durationEl ? durationEl.textContent.trim() : '';
            const durationSeconds = parseDuration(durationText);

            // Rileva obiettivi usando l'icona bullseye-arrow o il badge verde chiaro
            const hasBullseyeIcon = row.querySelector('path[id="bullseye-arrow"]') !== null;
            const isObjective = hasBullseyeIcon || row.querySelector('.bg-platform-green\\/20') !== null || titleLower === 'obiettivi';
            const hasGreenIcon = row.querySelector('path[fill="#00C49A"]') !== null || row.querySelector('path[fill="#2FA33D"]') !== null;
            const progressFull = !!row.querySelector('[style*="width: 100%"][class*="bg-platform-green"]');
            const isCompleted = hasGreenIcon || progressFull;

            // Rileva Test di fine lezione
            const isTest = titleLower.includes('test di fine lezione');
            // Rileva se il test ha il pulsante "Esegui" (non completato)
            const hasEseguiButton = row.querySelector('button') && 
                                    row.querySelector('button').textContent.trim().toLowerCase().includes('esegui');
            
            const isDispensa = titleLower.includes('dispensa');

            if (isTest && hasEseguiButton && !isCompleted) {
                // Test non completato - aggiungilo alla coda
                log(`📝 TEST TROVATO: "${title}" - Pulsante Esegui presente`, 'info');
                state.queue.push({
                    element: row,
                    title,
                    type: 'test',
                    id: index,
                    durationSeconds: 0
                });
            } else if (!isCompleted && !isTest && !isDispensa) {
                state.queue.push({
                    element: row,
                    title,
                    type: isObjective ? 'objective' : 'video',
                    id: index,
                    durationSeconds: isObjective ? 0 : durationSeconds
                });
            } else {
                state.alreadyDone++;
            }
        });

        const objectives = state.queue.filter(i => i.type === 'objective');
        const tests = state.queue.filter(i => i.type === 'test');
        const videos = state.queue.filter(i => i.type === 'video').sort((a, b) => a.durationSeconds - b.durationSeconds);
        state.queue = [...objectives, ...tests, ...videos]; // Test dopo obiettivi, prima dei video

        log(`Analisi: Trovate ${state.totalFound}. Già fatte: ${state.alreadyDone}. Mancanti: ${state.queue.length}`, 'info');
        log(`📍 OBIETTIVI DA COMPLETARE: ${objectives.length}`, 'warn');
        objectives.forEach((obj, idx) => log(`  ${idx + 1}. ${obj.title}`, 'info'));
        log(`🎬 VIDEO DA COMPLETARE: ${videos.length} (ordinati per durata)`, 'warn');
        log(`📝 TEST DA COMPLETARE: ${tests.length}`, 'warn');
        tests.forEach((t, idx) => log(`  ${idx + 1}. ${t.title}`, 'info'));
        if (state.queue.length > 0) {
            log(`⏭️  PROSSIMO: ${state.queue[0].title} [${state.queue[0].type}]`, 'step');
        }
        localStorage.setItem('pegaso_missing_queue', JSON.stringify(state.queue.map(i => i.title)));
        updateUI();
        return state.queue.length > 0;
    }

    // ============ AUTOMAZIONE ============

    async function processItems(items) {
        state.queue = items;
        state.currentIndex = 0;
        updateUI();

        for (let i = 0; i < items.length; i++) {
            // Controlla se è stato richiesto uno stop
            if (state.stopRequested) {
                log(`⏹️  Elaborazione fermata dall'utente.`, 'warn');
                state.status = 'idle';
                state.stopRequested = false;
                updateUI();
                return;
            }

            state.currentIndex = i;
            const item = items[i];

            log(`Elaborazione ${i + 1}/${items.length}: ${item.title} [${item.type}]`, 'step');

            item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(500);

            const clickTarget = item.element.closest('.cursor-pointer') || item.element;
            clickTarget.click();

            if (item.type === 'objective') {
                await sleep(3500);
                markLocalAsDone(item.title);
            } else if (item.type === 'video') {
                await handleVideo();
                markLocalAsDone(item.title);
                await sleep(2000);
            } else if (item.type === 'test') {
                await handleTest(item);
                markLocalAsDone(item.title);
                await sleep(2000);
            }
        }
    }

    // ============ GESTIONE TEST DI FINE LEZIONE ============
    
    async function handleTest(item) {
        log(`📝 [TEST] Inizio gestione test: ${item.title}`, 'step');

        function syntheticClick(el) {
            if (!el) return;
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }

        // Step 1: Trova e clicca il pulsante "Esegui"
        const eseguiBtn = item.element.querySelector('button');
        if (eseguiBtn && eseguiBtn.textContent.trim().toLowerCase().includes('esegui')) {
            log(`📝 [TEST] Trovato pulsante "Esegui", click...`, 'info');
            syntheticClick(eseguiBtn);
            await sleep(800);
        } else {
            log(`📝 [TEST] Pulsante "Esegui" non trovato nella riga, cerco altrove...`, 'warn');
            // Fallback: cerca il pulsante Esegui nella pagina
            const allButtons = document.querySelectorAll('button');
            for (const btn of allButtons) {
                if (btn.textContent.trim().toLowerCase().includes('esegui')) {
                    log(`📝 [TEST] Trovato pulsante "Esegui" alternativo, click...`, 'info');
                    syntheticClick(btn);
                    await sleep(800);
                    break;
                }
            }
        }

        // Step 2: Attendi che la pagina del test si carichi
        await sleep(600);

        // Step 3: Controlla se è un test vuoto
        const pageText = document.body.innerText;
        if (pageText.includes('Non è presente nessun test per questa lezione')) {
            log(`📝 [TEST] Test vuoto rilevato - nessuna domanda presente`, 'success');
            await sleep(300);
            return;
        }

        // Step 4: Cerca le domande nel contenitore del test
        log(`📝 [TEST] Cerco domande...`, 'info');

        // Trova tutte le domande (hanno la classe bg-platform-primary-light con il testo della domanda)
        const questionContainers = document.querySelectorAll('.mt-8.px-4');
        log(`📝 [TEST] Trovati ${questionContainers.length} contenitori domande`, 'info');

        if (questionContainers.length === 0) {
            // Fallback: cerca le domande con un altro selettore
            const questionHeaders = document.querySelectorAll('.bg-platform-primary-light.text-platform-primary');
            log(`📝 [TEST] Fallback: trovate ${questionHeaders.length} intestazioni domande`, 'info');

            if (questionHeaders.length === 0) {
                log(`📝 [TEST] Nessuna domanda trovata - forse test vuoto o già completato`, 'warn');
                return;
            }
        }

        // Step 5: Selezione in blocco - scegli una risposta per ogni domanda
        // Le opzioni sono dentro div con id="0", "1", "2", "3" (A, B, C, D)
        const answerOptions = document.querySelectorAll('.divide-y-2.bg-white .cursor-pointer[id]');
        log(`📝 [TEST] Trovate ${answerOptions.length} opzioni di risposta totali`, 'info');

        const bulkSelect = async (grouped, delayMs) => {
            const letterMap = ['A', 'B', 'C', 'D'];
            for (let q = 0; q < grouped.length; q++) {
                const opts = grouped[q];
                const choiceIdx = 0; // scegliamo sempre A per velocità/stabilità
                const el = opts[choiceIdx] || opts[Math.floor(Math.random() * opts.length)];
                log(`📝 [TEST] Domanda ${q + 1}: seleziono risposta ${letterMap[choiceIdx]}`, 'info');
                syntheticClick(el);
                await sleep(delayMs);
            }
        };

        // Raggruppa le opzioni per domanda (ogni domanda ha 4 opzioni)
        const questionsCount = Math.floor(answerOptions.length / 4);
        log(`📝 [TEST] Stima domande: ${questionsCount}`, 'info');

        const grouped = [];
        if (questionsCount > 0) {
            for (let q = 0; q < questionsCount; q++) {
                const startIdx = q * 4;
                const opts = Array.from(answerOptions).slice(startIdx, startIdx + 4);
                if (opts.length) grouped.push(opts);
            }
            await bulkSelect(grouped, 20);
        } else {
            log(`📝 [TEST] Nessuna opzione trovata per le domande - salto selezione bulk`, 'warn');
        }

        // Step 6: Attendi che appaia il pulsante "Invia"
        await sleep(200);

        // Step 7: Cerca e clicca il pulsante "Invia"
        const findInviaBtn = () => {
            const allBtns = document.querySelectorAll('button');
            for (const btn of allBtns) {
                const btnText = btn.textContent.trim().toLowerCase();
                if (btnText === 'invia' || btnText.includes('invia')) return btn;
            }
            return null;
        };

        async function submitOnce(label) {
            const inviaBtn = findInviaBtn();
            if (!inviaBtn) return false;
            log(`📝 [TEST] ${label} pulsante "Invia", click...`, 'success');
            inviaBtn.scrollIntoView({ behavior: 'auto', block: 'center' });
            await sleep(120);
            syntheticClick(inviaBtn);
            return true;
        }

        const didSubmit = await submitOnce('Trovato');
        await sleep(800);

        const stillInTest = !!findInviaBtn();
        if (stillInTest) {
            log(`📝 [TEST] Invio non confermato (possibile 400). Riprovo più lentamente...`, 'warn');
            // Reseleziona con ritmi più lenti per evitare rifiuti lato server
            if (grouped.length) await bulkSelect(grouped, 150);
            await sleep(600);
            await submitOnce('Retry: trovato');
            await sleep(800);
        }

        // Verifica finale
        if (findInviaBtn()) {
            log(`📝 [TEST] Pulsante "Invia" ancora presente dopo retry - potrebbe servire un nuovo tentativo manuale`, 'warn');
            const selectedAnswers = document.querySelectorAll('.divide-y-2.bg-white .cursor-pointer.bg-platform-primary-light');
            log(`📝 [TEST] Risposte selezionate visibili: ${selectedAnswers.length}`, 'info');
        } else if (didSubmit) {
            log(`📝 [TEST] Test completato!`, 'success');
        }

        // Step 8: Attendi e torna alla lista
        await sleep(300);
        log(`📝 [TEST] Fine gestione test`, 'step');
    }

    function formatTimeEstimate(minutes) {
        // Converte minuti in formato ore:minuti se > 60 minuti
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    function estimateItemSeconds(item) {
        // Stimiamo la durata residua per il singolo item
        const itemOverhead = 2.5; // scroll, click, sleep post-item
        const speed = Math.max(CONFIG.PLAYBACK_SPEED || 1, 0.1);

        if (item.type === 'objective') return 3.5 + itemOverhead;
        if (item.type === 'test') return 15 + itemOverhead; // media osservata

        // Video: limitiamo a 3x durata o 180s, ridotto dalla velocità
        const dur = Number.isFinite(item.durationSeconds) ? item.durationSeconds : 90;
        const base = Math.min(dur * 3, 180);
        return base / speed + itemOverhead;
    }

    function calculateEstimatedTime() {
        // Calcola il tempo stimato in base agli item in coda
        const estimatedSeconds = state.queue.reduce((acc, item) => acc + estimateItemSeconds(item), 0);
        // Aggiungi overhead per riscansioni (3 fasi * 2s per rescan)
        return Math.ceil(estimatedSeconds + 6);
    }

    async function processQueue() {
        if (state.queue.length === 0) {
            log('Nessuna lezione mancante trovata! Corso completato?', 'success');
            showCompletionModal();
            return;
        }

        state.status = 'playing';
        state.stopRequested = false;
        state.startTime = Date.now();
        const estimatedTotalSecs = calculateEstimatedTime();
        state.estimatedEndTime = state.startTime + (estimatedTotalSecs * 1000);
        log(`⏱️  Tempo stimato: ~${Math.ceil(estimatedTotalSecs / 60)} minuti`, 'info');
        updateUI();

        // Prima tutti gli obiettivi
        const objectives = state.queue.filter(i => i.type === 'objective');
        if (objectives.length) {
            log(`🎯 FASE 1: Completamento di ${objectives.length} OBIETTIVI`, 'success');
            await processItems(objectives);
            log(`✅ FASE 1 COMPLETATA: Tutti gli obiettivi sono stati visitati`, 'success');
        }

        // Riscansione ed esegui i test di fine lezione (subito dopo gli obiettivi)
        log(`🔄 Riscansione per aggiornare la lista test...`, 'step');
        await expandAllSections();
        analyzeLessons();
        const tests = state.queue.filter(i => i.type === 'test');
        if (tests.length) {
            log(`📝 FASE 2: Completamento di ${tests.length} TEST DI FINE LEZIONE`, 'success');
            await processItems(tests);
            log(`✅ FASE 2 COMPLETATA: Tutti i test sono stati completati`, 'success');
        }

        // Riesegui la scansione ed esegui i video (ordinati per durata)
        log(`🔄 Riscansione per aggiornare la lista video...`, 'step');
        await expandAllSections();
        analyzeLessons();
        const videos = state.queue.filter(i => i.type === 'video');
        if (videos.length) {
            log(`🎬 FASE 3: Completamento di ${videos.length} VIDEO (dal più corto)`, 'success');
            await processItems(videos);
            log(`✅ FASE 3 COMPLETATA: Tutti i video sono stati completati`, 'success');
        }

        log('Coda terminata!', 'success');
        showCompletionModal();
        state.status = 'completed';
        updateUI();
    }

    // Controlla il colore dell'icona del video per verificare il completamento
    function isVideoCompletedByIcon(rowElement) {
        // Cerca l'icona play con sfondo verde (bg-platform-green/20)
        const greenContainer = rowElement.querySelector('.bg-platform-green\\/20');
        if (greenContainer) {
            const svg = greenContainer.querySelector('svg path');
            if (svg && svg.getAttribute('fill') === '#2FA33D') {
                return true;
            }
        }
        return false;
    }

    // Gestore specifico del Video Player
    function handleVideo() {
        return new Promise((resolve) => {
            let attempts = 0;
            let wasPlayingBeforePause = false;
            const currentVideoRow = state.queue[state.currentIndex] ? state.queue[state.currentIndex].element : null;

            const checkVideo = setInterval(async () => {
                const video = document.querySelector('video#video');
                if (video) {
                    clearInterval(checkVideo);
                    state.currentVideo = video;

                    video.playbackRate = CONFIG.PLAYBACK_SPEED;
                    video.muted = true;

                    // Nascondi il player se configurato
                    if (CONFIG.HIDE_VIDEO_PLAYER) {
                        const playerContainer = video.closest('.video-player, [class*="player"], [class*="video"]') || video.parentElement;
                        if (playerContainer) {
                            playerContainer.style.visibility = 'hidden';
                            playerContainer.style.height = '1px';
                            playerContainer.style.overflow = 'hidden';
                        }
                    }

                    try { await video.play(); state.isPlaying = true; }
                    catch { video.muted = true; video.play(); }

                    updateUI();

                    // Listener per visibilità scheda
                    const handleVisibilityChange = () => {
                        if (document.hidden) {
                            log('Scheda nascosta, pauso video per risparmiare risorse...', 'info');
                            wasPlayingBeforePause = !video.paused;
                            video.pause();
                        } else {
                            log('Scheda visibile, riprendo video...', 'info');
                            if (wasPlayingBeforePause) {
                                video.play().catch(() => {});
                            }
                        }
                    };

                    document.addEventListener('visibilitychange', handleVisibilityChange);

                    let stallCount = 0;
                    let lastTime = video.currentTime;
                    const onEnd = () => { cleanup(); resolve(); };
                    video.addEventListener('ended', onEnd, { once: true });

                    const monitor = setInterval(() => {
                        if (!video || !video.duration) return;

                        const perc = (video.currentTime / video.duration) * 100;
                        // Aggiorna UI solo ogni 2 controlli per risparmiare risorse
                        if (stallCount % 2 === 0) updateProgressUI(perc, video.currentTime, video.duration);

                        // Controlla il colore dell'icona video per il completamento
                        if (currentVideoRow && isVideoCompletedByIcon(currentVideoRow)) {
                            log('Video completato (icona verde rilevata)', 'success');
                            cleanup(); resolve(); return;
                        }

                        // Stall guard: se il tempo non avanza per 24s (2s * 12), chiudi popup e forza play
                        if (video.currentTime - lastTime < 0.1) {
                            stallCount++;
                            if (stallCount >= 12) {
                                log('Video bloccato - cerco popup da chiudere...', 'warn');
                                // Cerca il pulsante di chiusura del modal (X)
                                const closeBtn = document.querySelector('button[data-modal-hide="popup-modal"]');
                                if (closeBtn) {
                                    log('Popup trovato, chiudo...', 'info');
                                    closeBtn.click();
                                    setTimeout(() => {
                                        log('Forzo play del video...', 'info');
                                        video.play().catch(e => log('Errore play: ' + e.message, 'error'));
                                        stallCount = 0; // Reset dello stall count
                                    }, 300);
                                } else {
                                    log('Nessun popup trovato, skip video.', 'warn');
                                    cleanup(); resolve();
                                }
                            }
                        } else {
                            stallCount = 0;
                        }
                        lastTime = video.currentTime;
                    }, CONFIG.VIDEO_MONITOR_INTERVAL);

                    // Fallback tempo massimo: 3x durata o 180s se la durata manca
                    const maxMs = video.duration ? video.duration * 3000 : 180000;
                    const maxTimer = setTimeout(() => { log('Timeout video, skip.', 'warn'); cleanup(); resolve(); }, maxMs);

                    function cleanup() {
                        clearInterval(monitor);
                        clearTimeout(maxTimer);
                        video.removeEventListener('ended', onEnd);
                        document.removeEventListener('visibilitychange', handleVisibilityChange);
                        // Ripristina il player se era nascosto
                        if (CONFIG.HIDE_VIDEO_PLAYER) {
                            const playerContainer = video.closest('.video-player, [class*="player"], [class*="video"]') || video.parentElement;
                            if (playerContainer) {
                                playerContainer.style.visibility = '';
                                playerContainer.style.height = '';
                                playerContainer.style.overflow = '';
                            }
                        }
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
        const currentItem = state.queue[state.currentIndex];
        const currentTitle = currentItem ? currentItem.title : 'In attesa...';
        
        // Calcola tempo rimanente stimato
        let timeRemaining = '';
        if (state.status === 'playing' && state.estimatedEndTime) {
            const now = Date.now();
            const secRemaining = Math.max(0, Math.ceil((state.estimatedEndTime - now) / 1000));
            const minRemaining = Math.ceil(secRemaining / 60);
            timeRemaining = `⏱️ ${minRemaining}m`;
        }

        // Stima del singolo episodio corrente
        let currentEta = '';
        if (currentItem) {
            const etaSecs = Math.ceil(estimateItemSeconds(currentItem));
            currentEta = etaSecs >= 60 ? `~${Math.ceil(etaSecs / 60)}m` : `~${etaSecs}s`;
        }

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

            ${currentEta ? `<div style="margin-bottom:8px;text-align:center;color:#a5b4fc;font-weight:bold;">ETA episodio: ${currentEta}</div>` : ''}

            ${state.estimatedEndTime ? `<div style="margin-bottom:8px;text-align:center;color:#fbbf24;font-weight:bold;">⏱️ ${formatTimeEstimate(Math.ceil(Math.max(0, state.estimatedEndTime - Date.now()) / 60000))}</div>` : ''}

            <div style="height:6px;background:#334155;border-radius:3px;overflow:hidden;margin-bottom:15px;">
                <div id="p-bar" style="width:0%;height:100%;background:linear-gradient(90deg, #3b82f6, #8b5cf6);transition:width 0.5s;"></div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button id="btn-run" style="padding:8px;background:${state.status === 'playing' ? '#ef4444' : '#0ea5e9'};border:none;border-radius:6px;color:white;cursor:pointer;font-weight:bold;">
                    ${state.status === 'playing' ? '⏹️ STOP' : '🚀 AVVIA'}
                </button>
                <button id="btn-rescan" style="padding:8px;background:#64748b;border:none;border-radius:6px;color:white;cursor:pointer;">
                    🔄 Rescan
                </button>
            </div>
        `;

        document.getElementById('btn-run').onclick = () => {
            if (state.status === 'playing') {
                // STOP
                state.stopRequested = true;
            } else {
                // AVVIA
                if (state.queue.length === 0) {
                    expandAllSections().then(() => {
                        analyzeLessons();
                        processQueue();
                    });
                } else {
                    processQueue();
                }
            }
        };

        document.getElementById('btn-rescan').onclick = async () => {
            if (state.status !== 'playing') {
                await expandAllSections();
                analyzeLessons();
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
        await sleep(8000);
        // Auto-scan iniziale (senza click, solo per popolare la UI)
        await expandAllSections(); // Fondamentale: apre tutto per vedere cosa manca
        analyzeLessons(); // Popola la variabile "Da Fare" e salva in locale

        // Se configurato auto-start
        if (CONFIG.AUTO_START && state.queue.length > 0) {
            processQueue();
        }
    }

    init();

})();
