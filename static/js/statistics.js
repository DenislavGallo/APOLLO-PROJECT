/**
 * statistics.js
 * Gestisce la visualizzazione e l'interazione con i dati statistici
 * per la pagina statistiche.html del progetto Apollo
 */

// Variabili globali per i grafici
let newCasesChart = null;
let activeCasesChart = null;
let hospitalizationChart = null;
let rValueChart = null;
let deathsChart = null;
let recoveredChart = null;

// Attendi che il DOM sia completamente caricato
document.addEventListener('DOMContentLoaded', function() {
    // Restyle date logic: auto-fix date range
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    function pad(n) { return n < 10 ? '0' + n : n; }
    function formatDate(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function fixDateRange() {
        if (startDateInput && endDateInput) {
            let start = new Date(startDateInput.value);
            let end = new Date(endDateInput.value);
            if (end < start) {
                // Imposta start una settimana prima di end
                let newStart = new Date(end);
                newStart.setDate(newStart.getDate() - 7);
                startDateInput.value = formatDate(newStart);
            }
        }
    }
    // Applica la correzione SOLO al click del bottone
    const filterBtn = document.getElementById('update-stats');
    if (filterBtn && startDateInput && endDateInput) {
        filterBtn.addEventListener('click', function(e) {
            fixDateRange();
            // (eventuali altre logiche di filtro dati già presenti saranno comunque eseguite)
        });
    }

    console.log('DOM caricato, inizializzazione statistiche...');
    
    // Verifica che Chart.js sia caricato correttamente
    if (typeof Chart === 'undefined') {
        console.error("Chart.js non è stato caricato correttamente");
        showErrorMessage('Errore di caricamento dei grafici. Ricarica la pagina o riprova più tardi.');
        return;
    }
    
    // Verifica e registra il plugin ChartAnnotation se disponibile
    try {
        if (typeof ChartAnnotation !== 'undefined') {
            Chart.register(ChartAnnotation);
            console.log("Plugin ChartAnnotation registrato con successo");
        } else {
            console.warn("Plugin ChartAnnotation non disponibile, alcune funzionalità potrebbero essere limitate");
            
            // Creiamo un plugin vuoto di fallback per evitare errori
            Chart.register({
                id: 'annotation',
                afterDraw: () => {} // Funzione vuota
            });
        }
    } catch (e) {
        console.warn("Errore registrazione plugin:", e);
        
        // Creiamo un plugin vuoto di fallback per evitare errori
        try {
            Chart.register({
                id: 'annotation',
                afterDraw: () => {} // Funzione vuota
            });
        } catch (err) {
            console.error("Impossibile registrare plugin di fallback:", err);
        }
    }
    
    // Verifica che tutti gli elementi canvas necessari esistano
    const requiredCanvases = [
        'new-cases-chart',
        'active-cases-chart',
        'hospitalization-chart',
                'r-value-chart',
        'deaths-chart',
        'recovered-chart'
    ];
    
    let allCanvasesExist = true;
    requiredCanvases.forEach(id => {
        if (!document.getElementById(id)) {
            console.error(`Canvas con ID "${id}" non trovato nel DOM`);
            allCanvasesExist = false;
        }
    });
    
    if (!allCanvasesExist) {
        console.warn("Alcuni canvas necessari non sono stati trovati nel DOM");
        // showErrorMessage('Alcuni elementi grafici non sono stati trovati. Ricarica la pagina o riprova più tardi.'); // Disabilitato su richiesta utente
    }
    
    // Inizializzazione della pagina solo se tutto è pronto
    setTimeout(() => {
        initStatisticsPage();
    }, 100); // Piccolo ritardo per assicurarsi che il DOM sia completamente pronto
    
    // Event listeners per i controlli
    const updateStatsButton = document.getElementById('update-stats');
    if (updateStatsButton) {
        updateStatsButton.addEventListener('click', function() {
            updateStatisticsData();
            updateMapeMetric();
        });
    } else {
        console.warn("Pulsante 'update-stats' non trovato nel DOM");
    }
});

/**
 * Inizializza la pagina delle statistiche con i dati e i grafici
 */
function initStatisticsPage() {
    console.log('Inizializzazione pagina statistiche...');
    
    // Imposta le date default (oggi e un anno fa)
    setupDefaultDates();
    
    // Carica i dati statistici
    fetchStatisticsData()
        .then(data => {
            if (!data) {
                console.error('Dati statistici non validi');
                showErrorMessage('I dati statistici non sono validi. Riprova più tardi.');
                return;
            }
            
            console.log('Dati statistici caricati:', data);
            
            // Salva i dati per uso successivo
            window.statisticsData = data;
            
            // Aggiorna l'interfaccia
            updateStatisticsUI(data);
        })
        .catch(error => {
            console.error('Errore nel caricamento dei dati statistici:', error);
            showErrorMessage('Non è stato possibile caricare i dati statistici. Riprova più tardi.');
        });
}

/**
 * Aggiorna l'interfaccia utente con i dati statistici
 * @param {Object} data Dati statistici
 */
function updateStatisticsUI(data) {
    updateMapeMetric();
    // Aggiornamento automatico delle card ogni 30 secondi
    if (!window._mainMetricsIntervalSet) {
        setInterval(() => {
            fetchStatisticsData().then(updateMainMetrics);
        }, 30000);
        window._mainMetricsIntervalSet = true;
    }
    try {
        if (!data) {
            console.error('Dati mancanti per l\'aggiornamento dell\'interfaccia');
            showErrorMessage('Dati non disponibili. Riprova più tardi.');
            return;
        }
        
        console.log('Updating statistics UI with data:', data);
        
        // Aggiorna le metriche principali
        updateMainMetrics(data);
        
        // Crea i grafici principali con gestione degli errori per ciascuno
        try {
            createNewCasesChart(data);
        } catch (e) {
            console.error('Errore nella creazione del grafico nuovi positivi:', e);
        }
        
        try {
            createActiveCasesChart(data);
        } catch (e) {
            console.error('Errore nella creazione del grafico casi attivi:', e);
        }
        
        try {
            createHospitalizationChart(data);
        } catch (e) {
            console.error('Errore nella creazione del grafico ospedalizzazioni:', e);
        }
        
        
        
        try {
            createRValueChart(data);
        } catch (e) {
            console.error('Errore nella creazione del grafico indice Rt:', e);
        }
        
        try {
            createDeathsChart(data);
        } catch (e) {
            console.error('Errore nella creazione del grafico decessi:', e);
        }
        
        try {
            createRecoveredChart(data);
        } catch (e) {
            console.error('Errore nella creazione del grafico guariti:', e);
        }
        
        // Mostra la pagina (nascondendo eventuali loader)
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
    } catch (error) {
        console.error('Errore durante l\'aggiornamento UI statistiche:', error);
        showErrorMessage('Si è verificato un errore nell\'aggiornamento dei grafici. Riprova più tardi.');
    }
}

/**
 * Crea il grafico dell'andamento dei nuovi positivi
 * @param {Object} data Dati statistici
 */
function createNewCasesChart(data) {
    if (!data || !data.dates || !data.newCases) {
        console.error('Dati mancanti per la creazione del grafico nuovi positivi');
        return;
    }
    
    console.log("Creating new cases chart");
    const canvas = document.getElementById('new-cases-chart');
    if (!canvas) {
        console.error('Canvas new-cases-chart non trovato');
        return;
    }
    
    // Distruggi il grafico esistente se presente
    if (newCasesChart instanceof Chart) {
        newCasesChart.destroy();
    }
    
    // Preparazione dati per il grafico
    const chartData = {
        labels: data.dates,
        datasets: [
            {
                label: 'Nuovi Positivi',
                data: data.newCases,
                borderColor: 'rgba(255, 99, 132, 0.15)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                borderWidth: 1,
                fill: false,
                tension: 0.2,
                pointRadius: showPointOnVisibleTick,
                pointHoverRadius: 6,
                showLine: false
            },
            {
                label: 'Media Mobile (7 giorni)',
                data: data.movingAverageNewCases,
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 3,
                fill: false,
                tension: 0.4,
                pointRadius: showPointOnVisibleTick,
                pointHoverRadius: 6
            }
        ]
    };
    
    // Configurazione del grafico
    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += context.raw.toLocaleString();
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 12
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        drawBorder: false
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    };
    
    // Creazione del grafico
    try {
        // Usa il contesto 2D del canvas
        const ctx = canvas.getContext('2d');
        newCasesChart = new Chart(ctx, config);
        console.log('Grafico nuovi positivi creato con successo');
    } catch (error) {
        console.error('Errore nella creazione del grafico nuovi positivi:', error);
    }
}

/**
 * Crea il grafico dell'andamento dei casi attivi
 * @param {Array} data Dati statistici
 */
function createActiveCasesChart(data) {
    if (!data || !data.dates || !data.activeCases) {
        console.error('Dati mancanti per la creazione del grafico casi attivi');
        return;
    }
    
    console.log("Creating active cases chart");
    const canvas = document.getElementById('active-cases-chart');
    if (!canvas) {
        console.error('Canvas active-cases-chart non trovato');
        return;
    }
    
    // Distruggi il grafico esistente se presente
    if (activeCasesChart instanceof Chart) {
        activeCasesChart.destroy();
    }
    
    // Preparazione dati per il grafico
    const chartData = {
        labels: data.dates,
        datasets: [{
            label: 'Casi Attivi',
            data: data.activeCases,
            borderColor: 'rgba(255, 128, 0, 1)',
            backgroundColor: 'rgba(255, 128, 0, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: showPointOnVisibleTick,
            pointHoverRadius: 6
        }]
    };
    
    // Configurazione del grafico
    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `Casi Attivi: ${context.raw.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        drawBorder: false
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    };
    
    // Creazione del grafico
    try {
        const ctx = canvas.getContext('2d');
        activeCasesChart = new Chart(ctx, config);
        console.log('Grafico casi attivi creato con successo');
    } catch (error) {
        console.error('Errore nella creazione del grafico casi attivi:', error);
    }
}

/**
 * Crea il grafico delle ospedalizzazioni
 * @param {Array} data Dati statistici
 */
function createHospitalizationChart(data) {
    if (!data || !data.dates || !data.hospitalized || !data.intensiveCare) {
        console.error('Dati mancanti per la creazione del grafico ospedalizzazioni');
        return;
    }
    
    console.log("Creating hospitalization chart");
    const canvas = document.getElementById('hospitalization-chart');
    if (!canvas) {
        console.error('Canvas hospitalization-chart non trovato');
        return;
    }
    
    // Distruggi il grafico esistente se presente
    if (hospitalizationChart instanceof Chart) {
        hospitalizationChart.destroy();
    }
    
    // Preparazione dati per il grafico
    const chartData = {
        labels: data.dates,
        datasets: [
            {
                label: 'Ricoverati',
                data: data.hospitalized,
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.6,
                pointRadius: showPointOnVisibleTick,
                pointHoverRadius: 6
            },
            {
                label: 'Terapia Intensiva',
                data: data.intensiveCare,
                backgroundColor: 'rgba(255, 99, 132, 0.7)',
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.6,
                pointRadius: showPointOnVisibleTick,
                pointHoverRadius: 6
            }
        ]
    };
    
    // Configurazione del grafico
    const config = {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            family: "'Poppins', sans-serif",
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        drawBorder: false
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    };
    
    // Creazione del grafico
    try {
        const ctx = canvas.getContext('2d');
        hospitalizationChart = new Chart(ctx, config);
        console.log('Grafico ospedalizzazioni creato con successo');
    } catch (error) {
        console.error('Errore nella creazione del grafico ospedalizzazioni:', error);
    }
}


/**
 * Imposta le date di default per il selettore intervallo
 */
function setupDefaultDates() {
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    
    // Formatta le date in formato ISO (YYYY-MM-DD) per gli input date
    const todayFormatted = today.toISOString().split('T')[0];
    const oneYearAgoFormatted = oneYearAgo.toISOString().split('T')[0];
    
    // Imposta i valori nei campi
    document.getElementById('end-date').value = todayFormatted;
    document.getElementById('start-date').value = oneYearAgoFormatted;
}

/**
 * Recupera i dati statistici dal server
 * @returns {Promise} Promise che risolve con i dati statistici
 */
async function fetchStatisticsData() {
    try {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        // Cambiato l'endpoint API per usare il nostro nuovo endpoint data/historical
        const response = await fetch('/api/data/historical');
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        let jsonData = null;
        try {
            jsonData = await response.clone().json();
            console.log('[fetchStatisticsData] JSON ricevuto:', jsonData);
        } catch (jsonErr) {
            const text = await response.clone().text();
            console.error('[fetchStatisticsData] Errore parsing JSON, body:', text, jsonErr);
            throw jsonErr;
        }
        console.log('Dati ricevuti dall\'API:', jsonData.data);
        
        if (!Array.isArray(jsonData.data) || jsonData.data.length === 0) {
            console.warn('Dati API vuoti o non validi, generazione dati simulati');
            return generateSimulatedStatisticsData();
        }
        
        // Filtra i dati in base all'intervallo di date selezionato
        const filteredData = jsonData.data.filter(item => {
            if (!item || !item.data) return false;
            const itemDate = new Date(item.data);
            return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
        });
        console.log('[fetchStatisticsData] Dati filtrati:', filteredData.length);
        
        // Se non ci sono dati dopo il filtraggio, genera dati simulati
        if (!filteredData || filteredData.length === 0) {
            console.warn('[fetchStatisticsData] Nessun dato dopo il filtraggio, generazione dati simulati');
            return generateSimulatedStatisticsData();
        }
        
        // Prepara e restituisci i dati nel formato atteso
        return prepareStatisticsData(filteredData);
    } catch (error) {
        console.error('[fetchStatisticsData] Errore API, utilizzo dati simulati', error);
        // Fallback a dati simulati se l'API non è disponibile
        return generateSimulatedStatisticsData();
    }
}

/**
 * Prepara i dati statistici nel formato richiesto per i grafici
 * @param {Array} apiData Dati grezzi dall'API
 * @returns {Object} Dati formattati per i grafici
 */
function prepareStatisticsData(apiData) {
    // Se apiData è vuoto o nullo, genera dati simulati
    if (!apiData || apiData.length === 0) {
        console.warn('Dati API vuoti o nulli, generazione dati simulati');
        return generateSimulatedStatisticsData();
    }
    
    try {
        console.log('Preparing statistics data:', apiData);
        
        // Ordina i dati per data crescente
        const sortedData = [...apiData].sort((a, b) => new Date(a.data) - new Date(b.data));
        
        // Estrai date formattate
        const dates = sortedData.map(item => {
            const date = new Date(item.data);
            return date.toLocaleDateString('it-IT', {day: 'numeric', month: 'short'});
        });
        
        // Funzione helper per convertire valori in numeri sicuri (evitando NaN)
        const safeNumber = (value) => {
            const num = Number(value);
            return isNaN(num) ? 0 : num; // Ritorna 0 invece di NaN
        };
        
        // Estrai e prepara le serie di dati (con gestione valori null/undefined/NaN)
        const newCases = sortedData.map(item => safeNumber(item.nuovi_positivi));
        const activeCases = sortedData.map(item => safeNumber(item.totale_positivi));
        const deaths = sortedData.map(item => safeNumber(item.deceduti));
        const recovered = sortedData.map(item => safeNumber(item.dimessi_guariti));
        const hospitalized = sortedData.map(item => safeNumber(item.ricoverati_con_sintomi));
        const intensiveCare = sortedData.map(item => safeNumber(item.terapia_intensiva));
        const totalCases = sortedData.map(item => safeNumber(item.totale_casi));

        // Log dettagliati per debugging
        console.log('[DEBUG] Serie deaths:', deaths);
        console.log('[DEBUG] Serie recovered:', recovered);

        // Se tutti i dati sono zero o vuoti, mostra warning
        function isAllZeroOrEmpty(arr) {
            return arr.length === 0 || arr.every(x => x === 0);
        }
        if (isAllZeroOrEmpty(deaths)) {
            console.warn('[WARNING] Tutti i valori deaths sono zero o vuoti!');
            showErrorMessage('Attenzione: dati decessi non disponibili o vuoti.');
        }
        if (isAllZeroOrEmpty(recovered)) {
            console.warn('[WARNING] Tutti i valori recovered sono zero o vuoti!');
            showErrorMessage('Attenzione: dati guariti non disponibili o vuoti.');
        }

        
        // Calcola le metriche derivate
        const movingAverageNewCases = calculateMovingAverage(newCases, 7);
        

        
        // Calcola indice Rt (approssimato)
        const rtValues = calculateRt(newCases).map(rt => isNaN(rt) ? 1 : rt); // Sostituisci NaN con 1
        
        // Recupera i dati dell'ultimo giorno
        const lastDayData = sortedData.length > 0 ? {
            date: sortedData[sortedData.length - 1].data,
            newCases: newCases[newCases.length - 1],
            activeCases: activeCases[activeCases.length - 1],
            deaths: deaths[deaths.length - 1],
            recovered: recovered[recovered.length - 1],
            hospitalized: hospitalized[hospitalized.length - 1],
            intensiveCare: intensiveCare[intensiveCare.length - 1],
            totalCases: totalCases[totalCases.length - 1],
            growthRate: growthRates[growthRates.length - 1],
            rtValue: rtValues[rtValues.length - 1]
        } : null;
        
        if (!lastDayData) {
            console.warn('Dati lastDayData mancanti o non validi');
        }
        
        console.log('Prepared data:', { dates, newCases, activeCases, lastDayData });
        
        return {
            dates,
            newCases,
            activeCases,
            deaths,
            recovered,
            hospitalized,
            intensiveCare,
            totalCases,
            movingAverageNewCases,
            rtValues,
            lastDayData
        };
    } catch (error) {
        console.error('Errore nella preparazione dei dati statistici:', error);
        return generateSimulatedStatisticsData();
    }
}

/**
 * Genera dati statistici simulati per testing
 * @returns {Object} Dati statistici simulati
 */
function generateSimulatedStatisticsData() {
    // Recupera le date selezionate
    const startDateStr = document.getElementById('start-date')?.value || '2024-01-01';
    const endDateStr = document.getElementById('end-date')?.value || new Date().toISOString().split('T')[0];
    
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    // Calcola il numero di giorni tra le date
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    // Genera i dati giornalieri
    const dates = [];
    const newCases = [];
    const activeCases = [];
    const deaths = [];
    const recovered = [];
    const hospitalized = [];
    const intensiveCare = [];
    const totalCases = [];
    const growthRates = [];
    const rtValues = [];
    
    let totalCasesValue = 26500000; // Valore iniziale
    let activeCasesValue = 5000; // Valore iniziale
    let recoveredValue = 26300000; // Valore iniziale
    let deathsValue = 195000; // Valore iniziale
    
    // Base per i nuovi casi, con fluttuazioni settimanali
    const baseNewCases = 2000;
    
    // Generiamo un andamento realistico con fluttuazioni e trend
    for (let i = 0; i < daysDiff; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        // Formatta la data in formato locale italiano (es. "3 feb")
        const dateFormatted = currentDate.toLocaleDateString('it-IT', {day: 'numeric', month: 'short'});
        dates.push(dateFormatted);
        
        // Simuliamo fluttuazioni settimanali (più casi nei giorni feriali)
        const dayOfWeek = currentDate.getDay();
        const weekendEffect = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.6 : 1.2;
        
        // Aggiungiamo un trend decrescente lento (meno casi col tempo)
        const trendEffect = Math.max(0.5, 1 - (i / daysDiff) * 0.5);
        
        // Aggiungiamo stagionalità (più casi in inverno, meno in estate)
        const month = currentDate.getMonth(); // 0-11: 0 è gennaio
        let seasonalEffect = 1.0;
        
        // Effetto stagionale (picco in inverno, meno in estate)
        if (month >= 0 && month <= 2) seasonalEffect = 1.3; // Inverno
        else if (month >= 3 && month <= 5) seasonalEffect = 0.9; // Primavera
        else if (month >= 6 && month <= 8) seasonalEffect = 0.7; // Estate
        else seasonalEffect = 1.1; // Autunno
        
        // Calcolo nuovi casi con tutti gli effetti + randomicità
        const randomFactor = 0.7 + Math.random() * 0.6; // Tra 0.7 e 1.3
        const newCasesValue = Math.round(baseNewCases * weekendEffect * seasonalEffect * trendEffect * randomFactor);
        newCases.push(newCasesValue);
        
        // Aggiorniamo i totali
        totalCasesValue += newCasesValue;
        totalCases.push(totalCasesValue);
        
        // Simuliamo guarigioni e decessi
        const newRecoveredValue = Math.round(newCasesValue * 0.95 + activeCasesValue * 0.2); // La maggior parte guarisce
        const newDeathsValue = Math.round(newCasesValue * 0.005); // Basso tasso di mortalità
        
        recoveredValue += newRecoveredValue;
        deathsValue += newDeathsValue;
        
        // Aggiorniamo i casi attivi
        activeCasesValue = activeCasesValue + newCasesValue - newRecoveredValue - newDeathsValue;
        activeCasesValue = Math.max(0, activeCasesValue); // Non può essere negativo
        
        activeCases.push(activeCasesValue);
        deaths.push(deathsValue);
        recovered.push(recoveredValue);
        
        // Dati ospedalieri
        const hospitalizedValue = Math.round(activeCasesValue * 0.15); // Percentuale ricoverati
        const icuValue = Math.round(activeCasesValue * 0.02); // Percentuale in terapia intensiva
        
        hospitalized.push(hospitalizedValue);
        intensiveCare.push(icuValue);
        
        // Calcoliamo Rt (indice di trasmissibilità) - varia intorno a 1
        const rtValue = 0.8 + (seasonalEffect * 0.3) + (Math.random() * 0.2 - 0.1);
        rtValues.push(parseFloat(rtValue.toFixed(2)));
        

    }
    
    // Calcoliamo media mobile per i nuovi casi
    const movingAverageNewCases = calculateMovingAverage(newCases, 7);
    
    // Crea un oggetto lastDayData con i dati dell'ultimo giorno
    const lastDayData = {
        date: new Date(endDate).toISOString().split('T')[0],
        newCases: newCases[newCases.length - 1],
        activeCases: activeCases[activeCases.length - 1],
        deaths: deaths[deaths.length - 1],
        recovered: recovered[recovered.length - 1],
        hospitalized: hospitalized[hospitalized.length - 1],
        intensiveCare: intensiveCare[intensiveCare.length - 1],
        totalCases: totalCases[totalCases.length - 1],
        growthRate: growthRates[growthRates.length - 1],
        rtValue: rtValues[rtValues.length - 1]
    };
    
    return {
        dates,
        newCases,
        activeCases,
        deaths,
        recovered,
        hospitalized,
        intensiveCare,
        totalCases,
        movingAverageNewCases,
        growthRates,
        rtValues,
        lastDayData
    };
}

/**
 * Aggiorna le metriche principali nelle card
 * @param {Object} data Dati statistici
 */
function updateMainMetrics(data) {
    try {
        if (!data) {
            console.error('Dati mancanti per l\'aggiornamento delle metriche');
            return;
        }
        // Verifica esistenza di lastDayData
        if (!data.lastDayData) {
            console.error('Dati lastDayData mancanti o non validi');
            // Crea un oggetto con valori di default per evitare errori
            data.lastDayData = {
                totalCases: 0,
                activeCases: 0,
                deaths: 0,
                recovered: 0,
                hospitalized: 0,
                intensiveCare: 0
            };
        }
        // --- CALCOLO DEL TREND AUTOMATICO SU 30 GIORNI REALI ---
        // Trova l'indice dell'ultimo giorno e di 30 giorni prima
        const lastIndex = (data.totalCases && data.totalCases.length) ? data.totalCases.length - 1 : null;
        const prevIndex = (lastIndex !== null && lastIndex >= 30) ? lastIndex - 30 : 0;

        function calcTrend(current, prev) {
            if (prev === 0 || prev === null || prev === undefined) return { value: 0, direction: 'neutral' };
            const diff = current - prev;
            const perc = ((diff) / prev) * 100;
            return {
                value: Math.abs(perc).toFixed(1),
                direction: perc > 0 ? 'up' : (perc < 0 ? 'down' : 'neutral'),
                raw: perc
            };
        }

        const trends = {
            totalCases: calcTrend(
                data.totalCases ? data.totalCases[lastIndex] : 0,
                data.totalCases ? data.totalCases[prevIndex] : 0
            ),
            activeCases: calcTrend(
                data.activeCases ? data.activeCases[lastIndex] : 0,
                data.activeCases ? data.activeCases[prevIndex] : 0
            ),
            recovered: calcTrend(
                data.recovered ? data.recovered[lastIndex] : 0,
                data.recovered ? data.recovered[prevIndex] : 0
            ),
            deaths: calcTrend(
                data.deaths ? data.deaths[lastIndex] : 0,
                data.deaths ? data.deaths[prevIndex] : 0
            )
        };
        // --- LOGICA COLORI/ICONE: ---
        // Per totalCases e activeCases: aumento = negativo (rosso), diminuzione = positivo (verde)
        // Per recovered: aumento = verde
        // Per deaths: neutro
        // --- AGGIORNAMENTO DOM ---
        // Totale Casi
        const totalCasesTrend = document.getElementById('total-cases-trend');
        if (totalCasesTrend) {
            if (trends.totalCases.direction === 'up') {
                totalCasesTrend.className = 'metric-trend negative';
                totalCasesTrend.innerHTML = '<i class="fas fa-arrow-up"></i> +' + trends.totalCases.value + '% nell\'ultimo mese';
            } else if (trends.totalCases.direction === 'down') {
                totalCasesTrend.className = 'metric-trend positive';
                totalCasesTrend.innerHTML = '<i class="fas fa-arrow-down"></i> -' + trends.totalCases.value + '% nell\'ultimo mese';
            } else {
                totalCasesTrend.className = 'metric-trend neutral';
                totalCasesTrend.innerHTML = '<i class="fas fa-equals"></i> 0% nell\'ultimo mese';
            }
        }
        // Casi Attivi
        const activeCasesTrend = document.getElementById('active-cases-trend');
        if (activeCasesTrend) {
            if (trends.activeCases.direction === 'up') {
                activeCasesTrend.className = 'metric-trend negative';
                activeCasesTrend.innerHTML = '<i class="fas fa-arrow-up"></i> +' + trends.activeCases.value + '% nell\'ultimo mese';
            } else if (trends.activeCases.direction === 'down') {
                activeCasesTrend.className = 'metric-trend positive';
                activeCasesTrend.innerHTML = '<i class="fas fa-arrow-down"></i> -' + trends.activeCases.value + '% nell\'ultimo mese';
            } else {
                activeCasesTrend.className = 'metric-trend neutral';
                activeCasesTrend.innerHTML = '<i class="fas fa-equals"></i> 0% nell\'ultimo mese';
            }
        }
        // Guariti
        const recoveredTrend = document.getElementById('recovered-trend');
        if (recoveredTrend) {
            if (trends.recovered.direction === 'up') {
                recoveredTrend.className = 'metric-trend positive';
                recoveredTrend.innerHTML = '<i class="fas fa-arrow-up"></i> +' + trends.recovered.value + '% nell\'ultimo mese';
            } else if (trends.recovered.direction === 'down') {
                recoveredTrend.className = 'metric-trend negative';
                recoveredTrend.innerHTML = '<i class="fas fa-arrow-down"></i> -' + trends.recovered.value + '% nell\'ultimo mese';
            } else {
                recoveredTrend.className = 'metric-trend neutral';
                recoveredTrend.innerHTML = '<i class="fas fa-equals"></i> 0% nell\'ultimo mese';
            }
        }
        // Deceduti
        const deathsTrend = document.getElementById('deaths-trend');
        if (deathsTrend) {
            if (trends.deaths.direction === 'up') {
                deathsTrend.className = 'metric-trend negative';
                deathsTrend.innerHTML = '<i class="fas fa-arrow-up"></i> +' + trends.deaths.value + '% nell\'ultimo mese';
            } else if (trends.deaths.direction === 'down') {
                deathsTrend.className = 'metric-trend positive';
                deathsTrend.innerHTML = '<i class="fas fa-arrow-down"></i> -' + trends.deaths.value + '% nell\'ultimo mese';
            } else {
                deathsTrend.className = 'metric-trend neutral';
                deathsTrend.innerHTML = '<i class="fas fa-equals"></i> 0% nell\'ultimo mese';
            }
        }
        // Aggiorna i valori numerici come prima
        const metricsToUpdate = [
            { id: 'total-cases-value', value: data.lastDayData.totalCases || 0 },
            { id: 'active-cases-value', value: data.lastDayData.activeCases || 0 },
            { id: 'deaths-value', value: data.lastDayData.deaths || 0 },
            { id: 'recovered-value', value: data.lastDayData.recovered || 0 }
        ];
        if (elementExists('hospitalized-value')) {
            metricsToUpdate.push({ id: 'hospitalized-value', value: data.lastDayData.hospitalized || 0 });
        }
        if (elementExists('icu-value')) {
            metricsToUpdate.push({ id: 'icu-value', value: data.lastDayData.intensiveCare || 0 });
        }
        metricsToUpdate.forEach(metric => {
            const element = document.getElementById(metric.id);
            if (element) {
                element.textContent = metric.value.toLocaleString();
            } else {
                console.debug(`Elemento con ID ${metric.id} non trovato`);
            }
        });
        // Aggiorna anche le percentuali, se gli elementi esistono
        const deathRate = document.getElementById('death-rate');
        if (deathRate && data.lastDayData.totalCases > 0) {
            const rate = (data.lastDayData.deaths * 100 / data.lastDayData.totalCases).toFixed(2);
            deathRate.textContent = `${rate}%`;
        }
        const recoveryRate = document.getElementById('recovery-rate');
        if (recoveryRate && data.lastDayData.totalCases > 0) {
            const rate = (data.lastDayData.recovered * 100 / data.lastDayData.totalCases).toFixed(2);
            recoveryRate.textContent = `${rate}%`;
        }
    } catch (error) {
        console.error('Errore nell\'aggiornamento delle metriche:', error);
    }
}

/**
 * Aggiungiamo una funzione per verificare l'esistenza di elementi DOM
 */
function elementExists(id) {
    return document.getElementById(id) !== null;
}

/**
 * Crea il grafico dell'indice Rt
 * @param {Array} data Dati statistici
 */
function createRValueChart(data) {
    try {
        // Verifica che i dati e il canvas esistano
        if (!data || !data.dates || !data.rtValues) {
            console.error('Dati mancanti per la creazione del grafico indice Rt');
            return;
        }
        
        const canvas = document.getElementById('r-value-chart');
        if (!canvas) {
            console.error('Canvas per grafico indice Rt non trovato');
            return;
        }
        
        // Distruggi il grafico precedente se esiste
        if (rValueChart) {
            rValueChart.destroy();
        }
        
        // Verifica che il plugin ChartAnnotation sia disponibile
        const hasAnnotation = typeof Chart.registry.getPlugin('annotation') !== 'undefined';
        
        // Configurazione del grafico
        const config = {
            type: 'line',
            data: {
                labels: data.dates.slice(-365), // Ultimi 12 mesi
                datasets: [{
                    label: 'Indice Rt',
                    data: data.rtValues.slice(-365), // Ultimi 12 mesi
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: showPointOnVisibleTick,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Data'
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            maxTicksLimit: 12
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Valore Rt'
                        },
                        min: 0,
                        max: 2,
                        ticks: {
                            stepSize: 0.2
                        }
                    }
                },
                plugins: {}
            }
        };
        
        // Aggiungi le annotation solo se il plugin è disponibile
        if (hasAnnotation) {
            config.options.plugins.annotation = {
                annotations: {
                    threshold: {
                        type: 'line',
                        yMin: 1,
                        yMax: 1,
                        borderColor: 'rgba(255, 0, 0, 0.7)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        label: {
                            display: true,
                            content: 'Soglia Rt = 1',
                            position: 'start'
                        }
                    }
                }
            };
        }
        
        // Crea il grafico
        rValueChart = new Chart(canvas, config);
        
        console.log("Grafico indice Rt creato con successo");
        
    } catch (error) {
        console.error('Errore nella creazione del grafico indice Rt:', error);
    }
}

/**
 * Calcola la media mobile su n giorni
 * @param {Array} data Array di valori numerici
 * @param {number} windowSize Dimensione della finestra per la media mobile
 * @returns {Array} Media mobile per ogni punto
 */
function calculateMovingAverage(data, windowSize) {
    const result = [];
    
    // Aggiungiamo null all'inizio perché non abbiamo abbastanza dati per le prime medie
    for (let i = 0; i < windowSize - 1; i++) {
        result.push(null);
    }
    
    // Calcola le medie mobili
    for (let i = windowSize - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < windowSize; j++) {
            sum += data[i - j];
        }
        result.push(sum / windowSize);
    }
    
    return result;
}

/**
 * Calcola Rt (indice di trasmissibilità) approssimato come rapporto tra nuovi casi consecutivi
 * @param {Array} newCases Array di nuovi casi
 * @returns {Array} Valori di Rt
 */
function calculateRt(newCases) {
    if (!newCases || !Array.isArray(newCases)) {
        console.error('Dati mancanti per il calcolo di Rt');
        return [1]; // Valore di default per evitare errori
    }
    
    const rtValues = [];
    rtValues.push(1); // Il primo valore è sempre 1 per definizione
    
    for (let i = 1; i < newCases.length; i++) {
        const today = newCases[i];
        const yesterday = newCases[i-1];
        
        if (yesterday === 0) {
            // Se ieri non ci sono stati casi, usa un valore sensato basato sull'oggi
            rtValues.push(today > 0 ? 1.5 : 1);
        } else {
            // Calcola il rapporto, ma limita i valori estremi
            let rt = today / yesterday;
            
            // Limita i valori di Rt tra 0 e 3 per evitare outlier estremi
            rt = Math.max(0, Math.min(3, rt));
            
            rtValues.push(rt);
        }
    }
    
    return rtValues;
}

/**
 * Aggiorna i dati statistici in base al periodo selezionato
 */
function updateStatisticsData() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    // Validazione date
    if (new Date(startDate) > new Date(endDate)) {
        showErrorMessage('La data di inizio deve essere precedente alla data di fine.');
        return;
    }
    
    console.log(`Aggiornamento statistiche dal ${startDate} al ${endDate}`);
    
    // Simula caricamento
    // In un'implementazione reale, qui verrebbe fatta una nuova chiamata API
    fetchStatisticsData()
        .then(data => {
            // Salva i dati per uso successivo
            window.statisticsData = data;
            // Aggiorna l'interfaccia
            updateStatisticsUI(data);
        })
        .catch(error => {
            console.error('Errore nell\'aggiornamento dei dati statistici:', error);
            showErrorMessage('Non è stato possibile aggiornare i dati statistici. Riprova più tardi.');
        });
}

/**
 * Mostra un messaggio di errore all'utente
 * @param {string} message Il messaggio di errore
 */
function showErrorMessage(message) {
    // Implementazione semplice: stampa in console e crea un div di notifica
    console.error(message);

    // Non usare alert per non bloccare UI
    // alert(message);

    // Crea o aggiorna un elemento per mostrare l'errore
    let errorElement = document.getElementById('error-message');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'error-message';
        errorElement.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); ' +
            'background-color: #f44336; color: white; padding: 15px 20px; border-radius: 4px; ' +
            'box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 9999; max-width: 80%;';
        document.body.appendChild(errorElement);
    }

    errorElement.textContent = message;

    // Nascondi il messaggio dopo 5 secondi
    setTimeout(() => {
        if (errorElement && errorElement.parentNode) {
            errorElement.parentNode.removeChild(errorElement);
        }
    }, 5000);
}


/**
 * Crea il grafico dei decessi
 * @param {Object} data Dati statistici
 */
function createDeathsChart(data) {
    if (!data || !data.dates || !data.deaths) {
        console.error('Dati mancanti per il grafico decessi');
        showErrorMessage('Dati mancanti per il grafico decessi');
        return;
    }
    console.log('[DEBUG] createDeathsChart - data.deaths:', data.deaths);
    const canvas = document.getElementById('deaths-chart');
    if (!canvas) {
        console.error('Canvas deaths-chart non trovato');
        return;
    }
    if (window.deathsChart instanceof Chart) window.deathsChart.destroy();
    try {
        const ctx = canvas.getContext('2d');
        window.deathsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: [{
                    label: 'Decessi',
                    data: data.deaths,
                    borderColor: '#a259c6',
                    backgroundColor: 'rgba(162,89,198,0.13)',
                    fill: true,
                    pointRadius: showPointOnVisibleTick,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) { return `Decessi: ${context.raw.toLocaleString()}`; }
                        }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(200,200,200,0.07)' } },
                    y: { grid: { color: 'rgba(200,200,200,0.07)' }, min: 180000, max: 200000 }
                }
            }
        });
        console.log('Grafico decessi creato con successo');
    } catch (error) { console.error('Errore grafico decessi:', error); }
}

/**
 * Crea il grafico dei guariti
 * @param {Object} data Dati statistici
 */
function createRecoveredChart(data) {
    if (!data || !data.dates || !data.recovered) {
        console.error('Dati mancanti per il grafico guariti');
        showErrorMessage('Dati mancanti per il grafico guariti');
        return;
    }
    console.log('[DEBUG] createRecoveredChart - data.recovered:', data.recovered);
    const canvas = document.getElementById('recovered-chart');
    if (!canvas) {
        console.error('Canvas recovered-chart non trovato');
        return;
    }
    if (window.recoveredChart instanceof Chart) window.recoveredChart.destroy();
    try {
        const ctx = canvas.getContext('2d');
        window.recoveredChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: [{
                    label: 'Guariti',
                    data: data.recovered,
                    borderColor: '#56d364',
                    backgroundColor: 'rgba(86,211,100,0.13)',
                    fill: true,
                    pointRadius: showPointOnVisibleTick,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) { return `Guariti: ${context.raw.toLocaleString()}`; }
                        }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(200,200,200,0.07)' } },
                    y: { grid: { color: 'rgba(200,200,200,0.07)' }, min: 25000000, max: 30000000 }
                }
            }
        });
        console.log('Grafico guariti creato con successo');
    } catch (error) { console.error('Errore grafico guariti:', error); }
}

// Aggiorna la metrica MAPE nella dashboard
function updateMapeMetric() {
    fetch('/api/model/mape')
        .then(r => r.json())
        .then(res => {
            const el = document.getElementById('mape-value');
            if (el) {
                if (res.mape !== null && res.mape !== undefined) {
                    el.textContent = (100 - res.mape).toFixed(1) + '%';
                } else {
                    el.textContent = '--';
                }
            }
        })
        .catch(() => {
            const el = document.getElementById('mape-value');
            if (el) el.textContent = '--';
        });
}

// --- ESPORTAZIONE GLOBALE DELLE FUNZIONI DEI GRAFICI (per compatibilità browser/non-module) ---
window.createDeathsChart = createDeathsChart;
window.createRecoveredChart = createRecoveredChart;
window.showErrorMessage = showErrorMessage;

// Funzione per mostrare il punto solo sulle label visibili dell'asse X
function showPointOnVisibleTick(context) {
    const index = context.dataIndex;
    const chart = context.chart;
    const xTicks = chart.scales.x.ticks;
    return xTicks.some(t => t.value === index) ? 4 : 0;
}

