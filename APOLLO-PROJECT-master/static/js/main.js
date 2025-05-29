/**
 * Apollo Project - Main Application Controller
 * 
 * Questo file coordina i moduli della applicazione, gestisce gli eventi dell'interfaccia utente
 * e l'inizializzazione dei componenti per la visualizzazione del COVID-19.
 */

// Variables globali
let dataHandler;
let globe;
let chart;

// Funzione centralizzata per aggiornare dashboard
function updateDashboard({updateChart = false} = {}) {
    // Aggiorna dati correnti
    dataHandler.updateCurrentData();
    const currentData = dataHandler.currentData || [];
    // Se non ci sono dati, mostra messaggio e svuota visualizzazioni
    if (!currentData.length) {
        showNoDataMessage('Nessun dato disponibile per la selezione corrente!');
        updateGlobeData([]);
        if (updateChart) updateForecastChart({ labels: [], datasets: [] });
        updateStatistics(null);
        disableUIControls();
        return;
    } else {
        hideNoDataMessage();
        enableUIControls();
    }
    updateGlobeData(currentData);
    if (updateChart) updateForecastChart();
    updateStatistics();
    updateDashboardMapeMetric();
}

// Gestione del caricamento con progressione reale
let loadingTasks = {
    globeData: { completed: false, weight: 25 },
    historicalData: { completed: false, weight: 25 },
    forecastData: { completed: false, weight: 20 },
    modelStats: { completed: false, weight: 15 },
    regions: { completed: false, weight: 15 }
};

// Funzione per calcolare il progresso totale
function calculateTotalProgress() {
    let completedWeight = 0;
    let totalWeight = 0;
    
    for (const task in loadingTasks) {
        totalWeight += loadingTasks[task].weight;
        if (loadingTasks[task].completed) {
            completedWeight += loadingTasks[task].weight;
        }
    }
    
    return Math.round((completedWeight / totalWeight) * 100);
}

// Funzione per aggiornare lo stato di un task
function completeTask(taskName) {
    if (loadingTasks[taskName]) {
        loadingTasks[taskName].completed = true;
        const progress = calculateTotalProgress();
        window.virusLoader.updateProgress(progress);
        
        // Quando tutti i task sono completati, nascondi il loader
        if (progress >= 100) {
            // Aspetta un momento per mostrare il 100% completato
            setTimeout(() => {
                hideLoader();
            }, 500);
        }
    }
}

// Loader con effetto virale
function showLoader() {
    // Reset dei task
    for (const task in loadingTasks) {
        loadingTasks[task].completed = false;
    }
    
    // Utilizza il nuovo loader virale
    window.virusLoader.show();
    window.virusLoader.updateProgress(0);
}

function hideLoader() {
    // Interrompi l'intervallo di aggiornamento
    if (window.loaderInterval) {
        clearInterval(window.loaderInterval);
        window.loaderInterval = null;
    }
    
    // Nascondi il loader virale
    window.virusLoader.hide();
}

function disableUIControls() {
    const slider = document.getElementById('date-slider');
    if (slider) slider.disabled = true;
    document.querySelectorAll('.dashboard-control').forEach(el => el.disabled = true);
}
function enableUIControls() {
    const slider = document.getElementById('date-slider');
    if (slider) slider.disabled = false;
    document.querySelectorAll('.dashboard-control').forEach(el => el.disabled = false);
}
// Imposta range slider in base alle date disponibili
function setDateSliderRange() {
    const slider = document.getElementById('date-slider');
    if (!slider) return;
    const dates = dataHandler.getAvailableDates();
    if (dates.length) {
        slider.min = 0;
        slider.max = 100;
        slider.value = 100;
    }
}


// Attendi che il DOM sia completamente caricato
document.addEventListener('DOMContentLoaded', async function() {
    // Mostra loader LED
    showLoader();

    try {
        console.log('Inizializzazione Apollo Project...');
        
        // Inizializza il gestore dati
        dataHandler = new DataHandler();
        
        // Carica dati storici
        try {
            console.log('Caricamento dati storici...');
            await dataHandler.loadHistoricalData();
        } catch (error) {
            console.error('Errore nel caricamento dei dati storici:', error);
            showError('Errore nel caricamento dei dati storici. Verranno usati dati simulati.');
        }
        
        // Carica i dati storici
        await dataHandler.loadHistoricalData()
            .then(() => {
                completeTask('historicalData');
                console.log('Dati storici caricati');
            })
            .catch(err => console.error('Errore caricamento dati storici:', err));
        
        // Carica i dati previsionali
        await dataHandler.loadForecastData()
            .then(() => {
                completeTask('forecastData');
                console.log('Dati previsionali caricati');
            })
            .catch(err => console.error('Errore caricamento previsioni:', err));
        
        // Carica i dati del globo
        await dataHandler.loadGlobeData()
            .then(() => {
                completeTask('globeData');
                console.log('Dati globo caricati');
            })
            .catch(err => console.error('Errore caricamento dati globo:', err));
        
        // Carica le statistiche del modello
        await dataHandler.loadModelStats()
            .then(() => {
                completeTask('modelStats');
                console.log('Statistiche modello caricate');
            })
            .catch(err => console.error('Errore caricamento statistiche:', err));
        
        // Carica l'elenco delle regioni disponibili
        await dataHandler.loadAvailableRegions()
            .then(() => {
                completeTask('regions');
                console.log('Elenco regioni caricato');
            })
            .catch(err => console.error('Errore caricamento regioni:', err));
        
        // Configura la timeline
        setDateSliderRange();
        
        // Aggiorna dashboard
        updateDashboard({updateChart: true});
        
        // Crea globo 3D
        setTimeout(() => {
            try {
                console.log('Creazione del globo...');
                globe = new Globe('globe-visualization', 'globe-tooltip');
                console.log('Globo 3D inizializzato, caricamento dati sul globo...');
                updateGlobeData();
            } catch (globeError) {
                console.error('Errore nell\'inizializzazione del globo:', globeError);
            }
        }, 500);
        
        // Crea il grafico previsione
        setTimeout(() => {
            try {
                console.log('Inizializzazione grafico previsioni...');
                initForecastChart();
            } catch (chartError) {
                console.error('Errore nell\'inizializzazione del grafico previsioni:', chartError);
            }
        }, 700);
        
        // Event listeners per controlli UI
        setupEventListeners();
        
    } catch (error) {
        console.error('Errore critico nell\'inizializzazione:', error);
        hideLoader(); // Nascondi loader in caso di errore
        alert('Si \u00e8 verificato un errore durante il caricamento dei dati. Riprova pi\u00f9 tardi.');
    }
});

// Mostra un messaggio elegante se non ci sono dati disponibili
// Miglioria accessibilità: il messaggio viene annunciato anche tramite aria-live
function showNoDataMessage(message) {
    let el = document.getElementById('no-data-message');
    if (!el) {
        el = document.createElement('div');
        el.id = 'no-data-message';
        el.setAttribute('role', 'alert');
        el.setAttribute('aria-live', 'assertive');
        el.className = 'no-data-message';
        document.body.appendChild(el);
        msgBox.className = 'no-data-message';
        document.body.appendChild(msgBox);
    }
    msgBox.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
    msgBox.style.display = 'block';
    setTimeout(() => {
        if (msgBox) msgBox.style.display = 'none';
    }, 4000);
}

function hideNoDataMessage() {
    const msgBox = document.getElementById('no-data-message');
    if (msgBox) msgBox.style.display = 'none';
}

// Configura gli eventi dell'interfaccia utente
function setupEventListeners() {
    // Tooltip accessibile su stat-value
    document.querySelectorAll('.stat-value').forEach(el => {
        el.addEventListener('mouseenter', function() {
            const tip = el.getAttribute('data-tooltip');
            if (tip) el.setAttribute('aria-label', tip);
        });
        el.addEventListener('mouseleave', function() {
            el.removeAttribute('aria-label');
        });
    });
    // Migliora feedback toggle-btn
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.toggle-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
            btn.setAttribute('aria-pressed', 'true');
        });
        btn.addEventListener('focus', function() {
            btn.classList.add('focus-visible');
        });
        btn.addEventListener('blur', function() {
            btn.classList.remove('focus-visible');
        });
    });
    // Slider data
    const dateSlider = document.getElementById('date-slider');
    dateSlider.addEventListener('input', handleDateSelection);
    
    // Toggle modalità visualizzazione
    document.getElementById('real-data').addEventListener('click', () => toggleVisualizationMode(false));
    document.getElementById('predicted-data').addEventListener('click', () => toggleVisualizationMode(true));
    
    // Selezione indicatore
    document.getElementById('data-indicator').addEventListener('change', handleIndicatorChange);
    
    // Mouse down per ruotare globo
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    document.getElementById('globe-visualization').addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = {
            x: e.clientX,
            y: e.clientY
        };
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaMove = {
                x: e.clientX - previousMousePosition.x,
                y: e.clientY - previousMousePosition.y
            };
            
            // Ruota il globo
            if (globe) {
                globe.rotateGlobe(deltaMove.x * 0.15, deltaMove.y * 0.15); // Aumentato a 0.15 per sensibilità molto maggiore
            }
            
            previousMousePosition = {
                x: e.clientX,
                y: e.clientY
            };
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

// Gestisce la selezione della data tramite lo slider
function handleDateSelection(event) {
    if (!dataHandler.dataLoaded) return;
    const dates = getDatesForCurrentMode();
    if (!dates.length) {
        showNoDataMessage('Nessun dato disponibile!');
        return;
    }
    const sliderValue = parseInt(event.target.value);
    const dateIndex = Math.round((sliderValue / 100) * (dates.length - 1));
    const selectedDate = dates[dateIndex]?.date;
    if (!selectedDate) {
        document.getElementById('current-date').textContent = '---';
        document.getElementById('date-slider').classList.add('slider-error');
        showNoDataMessage('Nessun dato disponibile per la data selezionata!');
        return;
    }
    document.getElementById('current-date').textContent = new Date(selectedDate).toLocaleDateString('it-IT');
    document.getElementById('date-slider').classList.remove('slider-error');
    dataHandler.setSelectedDate(selectedDate);
    updateDashboard(); // NON aggiorna il grafico
}



// Gestisce il cambio di indicatore (nuovi positivi, deceduti, ecc.)
function handleIndicatorChange(event) {
    const indicator = event.target.value;
    dataHandler.setSelectedIndicator(indicator);
    updateDashboard({updateChart: true}); // SOLO qui aggiorna anche il grafico
}

// Attiva/disattiva modalità previsione
function toggleVisualizationMode(showPrediction) {
    document.getElementById('real-data').classList.toggle('active', !showPrediction);
    document.getElementById('predicted-data').classList.toggle('active', showPrediction);
    dataHandler.togglePredictionMode(showPrediction);
    updateUIControls();
    updateDashboard(); // NON aggiorna il grafico
}

// Aggiorna i controlli UI in base ai dati disponibili
function getDatesForCurrentMode() {
    // Restituisce solo le date della modalità attiva
    if (dataHandler.showingPrediction) {
        return dataHandler.forecastData.map(item => ({ date: item.data || item.ds }));
    } else {
        return dataHandler.historicalData.map(item => ({ date: item.data }));
    }
}

function updateUIControls() {
    const dates = getDatesForCurrentMode();
    const dateSlider = document.getElementById('date-slider');
    const currentDateElement = document.getElementById('current-date');
    if (!dates.length) {
        // Nessuna data disponibile: disabilita slider e mostra "---"
        if (dateSlider) dateSlider.disabled = true;
        if (currentDateElement) currentDateElement.textContent = '---';
        return;
    }
    // Abilita slider
    if (dateSlider) dateSlider.disabled = false;
    // Imposta il valore iniziale della data visualizzata
    const latestDate = dates[dates.length - 1].date;
    if (currentDateElement) currentDateElement.textContent = new Date(latestDate).toLocaleDateString('it-IT');
    // Reset dello slider al valore massimo (data più recente)
    if (dateSlider) dateSlider.value = 100;
    // Aggiorna min/max/step e salva le date disponibili per uso rapido
    dateSlider.min = 0;
    dateSlider.max = 100;
    dateSlider.step = 1;
    window._availableDates = dates.map(d => d.date); // Per debug o uso rapido
    // Aggiorna la data selezionata se non più valida
    if (!dates.find(d => d.date === dataHandler.selectedDate)) {
        dataHandler.selectedDate = latestDate;
    }
}



// Aggiorna i dati sul globo (accetta dati opzionali)
async function updateGlobeData(data) {
    try {
        if (!globe) {
            console.error('Impossibile aggiornare il globo: l\'oggetto globe non è inizializzato');
            return;
        }
        
        // Determina quali dati mostrare in base al livello geografico selezionato
        const indicator = dataHandler.selectedIndicator || 'nuovi_positivi';
        const currentData = data || dataHandler.currentData || [];
        
        // Controlla il livello geografico e aggiorna il globo di conseguenza
        if (dataHandler.geographicLevel === 'regional' && dataHandler.selectedRegion) {
            // Carica e mostra i dati regionali
            const regionalData = await dataHandler.loadRegionalData(dataHandler.selectedRegion);
            if (regionalData && regionalData.length > 0) {
                const points = dataHandler.createPointsForRegion(regionalData);
                globe.addCovidPoints(points, 'regional');
                console.log(`[Timeline] Punti COVID aggiornati per la regione ${dataHandler.selectedRegion}`);
            } else {
                console.warn(`[Timeline] Nessun dato trovato per la regione ${dataHandler.selectedRegion}`);
            }
        } else if (dataHandler.geographicLevel === 'provincial' && dataHandler.selectedProvince) {
            // Carica e mostra i dati provinciali
            const provincialData = await dataHandler.loadProvincialData(dataHandler.selectedProvince);
            if (provincialData && provincialData.length > 0) {
                const points = dataHandler.createPointsForProvince(provincialData);
                globe.addCovidPoints(points, 'provincial');
                console.log(`[Timeline] Punti COVID aggiornati per la provincia ${dataHandler.selectedProvince}`);
            } else {
                console.warn(`[Timeline] Nessun dato trovato per la provincia ${dataHandler.selectedProvince}`);
            }
        } else {
            // Mostra i dati nazionali (default)
            let value = 0;
            let total = 0;
            if (Array.isArray(currentData) && currentData.length > 0) {
                value = currentData[0][indicator] || 0;
                total = currentData[0].totale_casi || value;
            }
            const italyPoint = [{
                country: 'Italia',
                lat: 41.9,
                long: 12.5,
                cases: value,
                totalCases: total
            }];
            // Specifichiamo esplicitamente il livello come 'national'
            globe.addCovidPoints(italyPoint, 'national');
            if (value > 0) {
                console.log(`[Timeline] Punto COVID aggiornato sull'Italia (${indicator}: ${value}) per la data ${dataHandler.selectedDate}`);
            } else {
                console.warn(`[Timeline] Nessun valore COVID trovato per l'Italia (${indicator}) alla data ${dataHandler.selectedDate}`);
            }
        }
    } catch (error) {
        console.error('[Timeline] Errore generale in updateGlobeData:', error);
    }
}

// Aggiorna la metrica MAPE nella dashboard
function updateDashboardMapeMetric() {
    const indicatorSelect = document.getElementById('data-indicator');
    let indicator = 'nuovi_positivi';
    if (indicatorSelect && indicatorSelect.value) indicator = indicatorSelect.value;
    fetch('/api/model/mape?indicator=' + encodeURIComponent(indicator))
        .then(r => r.json())
        .then(res => {
            const el = document.getElementById('model-accuracy');
            console.log('[MAPE DEBUG] Risposta API:', res, 'Indicatore:', indicator);
            if (el) {
                if (res.mape !== null && res.mape !== undefined) {
                    el.textContent = (100 - res.mape).toFixed(1) + '%';
                    console.log('[MAPE DEBUG] Valore scritto nel DOM:', el.textContent);
                } else {
                    el.textContent = '--';
                    console.log('[MAPE DEBUG] Valore scritto nel DOM: --');
                }
            }
        })
        .catch(() => {
            const el = document.getElementById('model-accuracy');
            if (el) el.textContent = '--';
            console.log('[MAPE DEBUG] Errore nella fetch, scritto --');
        });
}

// Aggiorna le statistiche visualizzate (accetta dati opzionali)
function updateStatistics(record) {
    // Aggiorna le statistiche visualizzate (accetta dati opzionali)
    const stats = record || dataHandler.getCurrentRecord();
    if (!stats) return;
    const statMap = [
        {id: 'nuovi-positivi', val: stats.nuovi_positivi, tip: 'Nuovi casi positivi rilevati nella data selezionata'},
        {id: 'totale-casi', val: stats.totale_casi, tip: 'Totale casi confermati cumulativi'},
        {id: 'deceduti', val: stats.deceduti, tip: 'Totale deceduti cumulativi'},
        {id: 'guariti', val: stats.dimessi_guariti, tip: 'Totale guariti cumulativi'}
    ];
    statMap.forEach(item => {
        const el = document.getElementById(item.id);
        if (!el) return;
        // Aggiorna valore
        const oldVal = el.textContent;
        el.textContent = item.val ?? '---';
        // Tooltip
        el.setAttribute('data-tooltip', item.tip);
        // Pulse se cambia valore
        if (oldVal !== String(item.val)) {
            el.classList.remove('pulse');
            void el.offsetWidth; // trigger reflow per riattivare animazione
            el.classList.add('pulse');
        }
    });
}
// Inizializza il grafico delle previsioni
function initForecastChart() {
    try {
        console.log('Inizializzazione grafico previsioni...');
        
        const canvas = document.getElementById('forecast-chart');
        if (!canvas) {
            console.error('Canvas forecast-chart non trovato');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Impossibile ottenere il contesto 2D dal canvas');
            return;
        }
        
        // Se esiste già un grafico, distruggilo prima di crearne uno nuovo
        if (chart instanceof Chart) {
            chart.destroy();
        }
        
        chart = new Chart(ctx, {
            type: 'line',
            data: { 
                labels: [], 
                datasets: [] 
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#e6edf3',
                            font: {
                                family: "'Poppins', sans-serif"
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(33, 38, 45, 0.9)',
                        borderColor: '#30363d',
                        borderWidth: 1,
                        titleColor: '#e6edf3',
                        bodyColor: '#e6edf3',
                        padding: 10,
                        bodyFont: {
                            family: "'Poppins', sans-serif"
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(48, 54, 61, 0.5)'
                        },
                        ticks: {
                            color: '#8b949e',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(48, 54, 61, 0.5)'
                        },
                        ticks: {
                            color: '#8b949e'
                        },
                        beginAtZero: true
                    }
                },
                animations: {
                    tension: {
                        duration: 1000,
                        easing: 'linear'
                    }
                }
            }
        });
        
        console.log('Grafico previsioni inizializzato con successo');
        
        // Popola il grafico con i dati
        updateForecastChart();
    } catch (error) {
        console.error('Errore nell\'inizializzazione del grafico previsioni:', error);
    }
}

// Aggiorna il grafico con i dati attuali (accetta dati opzionali)
function updateForecastChart(chartData) {
    try {
        if (!chart) {
            console.error('Grafico non inizializzato');
            initForecastChart();
            return;
        }
        const data = chartData || dataHandler.getChartData();
        if (!data || !data.labels || !data.datasets) {
            console.error('Dati del grafico non validi');
            chart.data.labels = [];
            chart.data.datasets = [];
            chart.update();
            return;
        }
        chart.data.labels = data.labels;
        chart.data.datasets = data.datasets;
        chart.update();
        // Aggiorna anche le metriche di valutazione modello
        const accuracyElement = document.getElementById('model-accuracy');
        const lastForecastElement = document.getElementById('last-forecast-date');
        if (accuracyElement) {
            updateDashboardMapeMetric(); // Aggiorna il valore reale dopo il grafico
        }
        if (lastForecastElement) {
            lastForecastElement.textContent = new Date().toLocaleDateString('it-IT');
        }
    } catch (error) {
        console.error('Errore nell\'aggiornamento del grafico previsioni:', error);
    }
}
