// VERSIONE SEMPLIFICATA - BASE PULITA
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM caricato, inizializzazione pagina previsioni');
    
    try {
        initForecastPage();
        updateForecastMapeMetric();
        
        const forecastPeriod = document.getElementById('forecast-period');
        if (forecastPeriod) {
            forecastPeriod.addEventListener('change', function() {
                console.log('Periodo cambiato');
                updateUI();
                updateForecastMapeMetric();
            });
        }
        
        const forecastIndicator = document.getElementById('forecast-indicator');
        if (forecastIndicator) {
            forecastIndicator.addEventListener('change', function() {
                console.log('Indicatore cambiato');
                updateUI();
                updateForecastMapeMetric();
            });
        }

        // Aggiorna tutto al cambio paese
        const countrySelect = document.getElementById('country-select');
        if (countrySelect) {
            countrySelect.addEventListener('change', function() {
                console.log('Paese cambiato:', countrySelect.value);
                updateUI();
                updateForecastMapeMetric();
            });
        }
    } catch (error) {
        console.error('Errore inizializzazione:', error);
    }
});

// FUNZIONI PRINCIPALI

function initForecastPage() {
    // Mostra skeleton loader iniziale
    showForecastSkeletonLoader();
    console.log('Inizializzazione pagina previsioni...');
    // Aggiorna valori dell'interfaccia utente
    const lastForecastDate = document.getElementById('last-forecast-date');
    if (lastForecastDate) {
        lastForecastDate.textContent = new Date().toLocaleDateString('it-IT') + ' 12:00';
    }
    // Prendi paese selezionato
    let country = 'ITA';
    const countrySelect = document.getElementById('country-select');
    if (countrySelect && countrySelect.value) country = countrySelect.value;
    // Carica i dati e aggiorna l'interfaccia
    fetch(`/api/data/forecast?country=${encodeURIComponent(country)}`)
        .then(function(response) { return response.json(); })
        .then(function(jsonResponse) {
            // Nascondi skeleton loader
            hideForecastSkeletonLoader();
            if (!jsonResponse.success) throw new Error('Risposta API non valida');
            const apiData = jsonResponse.data;
            // Ricava le metriche disponibili da una entry Prophet
            if (Array.isArray(apiData) && apiData.length > 0) {
                const keys = Object.keys(apiData[0]);
                const metricaRegex = /^(nuovi_positivi|totale_casi|deceduti|dimessi_guariti)$/;
                const metricheDisponibili = keys.filter(k => metricaRegex.test(k));
                const select = document.getElementById('forecast-indicator');
                if (select) {
                    select.innerHTML = '';
                    metricheDisponibili.forEach(function(met) {
                        const opt = document.createElement('option');
                        opt.value = met;
                        opt.textContent = {
                            'nuovi_positivi': 'Nuovi Positivi',
                            'totale_casi': 'Totale Casi',
                            'deceduti': 'Deceduti',
                            'dimessi_guariti': 'Guariti'
                        }[met] || met;
                        select.appendChild(opt);
                    });
                    // Imposta default su nuovi_positivi se presente
                    if (metricheDisponibili.includes('nuovi_positivi')) {
                        select.value = 'nuovi_positivi';
                    } else if (metricheDisponibili.length > 0) {
                        select.value = metricheDisponibili[0];
                    }
                }
            }
            // Assegna direttamente l'array dei dati previsione
            window.forecastData = apiData;
            updateUI();
            updateAIPredictionCard(apiData);

        })
        .catch(function(error) {
        });

}

function fetchData() {
    return new Promise(function(resolve, reject) {
        // Prendi paese selezionato
        let country = 'ITA';
        const countrySelect = document.getElementById('country-select');
        if (countrySelect && countrySelect.value) country = countrySelect.value;
        // Periodo fisso: 30 giorni
        fetch(`/api/data/forecast?days=30&country=${encodeURIComponent(country)}`)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Errore HTTP: ' + response.status);
                }
                return response.json();
            })
            .then(function(result) {
                if (!result.success || !result.data) {
                    throw new Error('Dati di previsione non validi');
                }
                const apiData = result.data;
                // Assegna direttamente l'array dei dati previsione
                window.forecastData = apiData;
                updateUI();
            })
            .catch(function(error) {
                console.error('Errore caricamento dati:', error);
                // Fallback a dati simulati
                const simulatedData = generateSimulatedData();
                resolve(simulatedData);
            });
    });
}

function prepareData(apiData) {
    if (!apiData || !Array.isArray(apiData) || apiData.length === 0) {
        return generateSimulatedData();
    }
    
    try {
        // Ordinamento per data
        const sortedData = apiData.slice().sort(function(a, b) {
            return new Date(a.ds) - new Date(b.ds);
        });
        
        // Selezione dinamica metrica
        const indicator = document.getElementById('forecast-indicator')?.value || 'nuovi_positivi';
        if (sortedData.length > 0) {
            console.log("Chiavi disponibili in Prophet:", Object.keys(sortedData[0]));
            if (!(indicator in sortedData[0])) {
                showError('La metrica "' + indicator + '" non è disponibile nelle previsioni Prophet.');
                return null;
            }
        }
        
        const result = {
            forecast: [],
            trend: [],
            seasonal: []
        };
        
        let foundValid = false;
        sortedData.forEach(function(item) {
            const date = item.ds;
            const value = parseFloat(item[indicator]);
            if (!isNaN(value)) foundValid = true;
            result.forecast.push({ date: date, value: isNaN(value) ? null : value });
            result.trend.push({ date: date, value: isNaN(value) ? null : value });
            const seasonalFactor = Math.sin(new Date(date).getDay() * Math.PI / 3.5) * 0.2;
            result.seasonal.push({ date: date, value: isNaN(value) ? null : Math.floor(value * (1 + seasonalFactor)) });
        });
        
        if (!foundValid) return null;
        return result;
    } catch (error) {
        console.error('Errore preparazione dati:', error);
        return generateSimulatedData();
    }
}

function generateSimulatedData() {
    const result = {
        forecast: [],
        trend: [],
        seasonal: []
    };
    
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        const baseValue = 2000 + (i * 10);
        const dayOfWeek = date.getDay();
        const seasonalFactor = dayOfWeek === 0 || dayOfWeek === 6 ? -300 : 100;
        const value = baseValue + seasonalFactor + Math.floor(Math.random() * 300);
        
        result.forecast.push({ date: dateStr, value: value });
        result.trend.push({ date: dateStr, value: baseValue });
        result.seasonal.push({ date: dateStr, value: seasonalFactor });
    }
    
    return result;
}

// FUNZIONI DI AGGIORNAMENTO UI

function updateUI() {
    const data = window.forecastData;
    const indicator = document.getElementById('forecast-indicator')?.value || 'nuovi_positivi';
    // Ora data è una lista di oggetti previsione
    if (!data || !Array.isArray(data) || !data.some(d => d[indicator] !== null && d[indicator] !== undefined)) {
        showError('Nessun dato di previsione disponibile per la metrica selezionata ("' + indicator + '").');
        // Pulisci grafici e tabella
        if (window.mainChart) window.mainChart.destroy();
        if (window.seasonalChart) window.seasonalChart.destroy();
        if (window.trendChart) window.trendChart.destroy();
        const tableBody = document.querySelector('#forecast-table tbody');
        if (tableBody) tableBody.innerHTML = '';
        return;
    }
    
    try {
        createMainChart(data, indicator);
        createSeasonalChart(data, indicator);
        createTrendChart(data, indicator);
        updateTable(data);
        
        // Nascondi loader se presente
        const loader = document.querySelector('.loading-indicator');
        if (loader) loader.classList.add('hidden');


    } catch (error) {
        console.error('Errore aggiornamento UI:', error);
    }
}

// FUNZIONI PER I GRAFICI

function createMainChart(data, indicator) {
    const canvas = document.getElementById('main-forecast-chart');
    if (!canvas) {
        console.error('Canvas non trovato');
        return;
    }
    
    // Distruggi grafico esistente
    if (window.mainChart) {
        window.mainChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    try {
        window.mainChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(function(d) { return d.data; }),
                datasets: [
                    {
                        label: 'Previsione Prophet (' + indicator.replace('_', ' ') + ')',
                        data: data.map(function(d) { return d[indicator]; }),
                        borderColor: '#C0392B',
                        backgroundColor: 'rgba(192,57,43,0.15)',
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: '#C0392B',
                        fill: false,
                        tension: 0.3,
                        spanGaps: true,
                        pointHoverRadius: 7,
                        pointHoverBackgroundColor: '#922B21',
                        pointStyle: 'circle',
                        tooltip: {
                            callbacks: {
                                label: function(ctx) {
                                    return 'Previsione Prophet: ' + ctx.parsed.y.toLocaleString();
                                }
                            }
                        }
                    },
                    {
                        label: 'Intervallo di Confidenza',
                        data: data.map(function(d) { return d[indicator + '_upper']; }),
                        backgroundColor: 'rgba(56,148,255,0.28)',
                        borderColor: 'rgba(56,148,255,0.45)',
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: '-1',
                        order: 1,
                        tension: 0.3,
                        spanGaps: true,
                        pointHitRadius: 0,
                        pointHoverRadius: 0
                    },
                    {
                        label: 'Intervallo di Confidenza',
                        data: data.map(function(d) { return d[indicator + '_lower']; }),
                        backgroundColor: 'rgba(56,148,255,0.28)',
                        borderColor: 'rgba(56,148,255,0.45)',
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: '+1',
                        order: 1,
                        tension: 0.3,
                        spanGaps: true,
                        pointHitRadius: 0,
                        pointHoverRadius: 0
                    }
                ]
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
    } catch (error) {
        console.error('Errore creazione grafico principale:', error);
    }
}

function createSeasonalChart(data, indicator) {
    const canvas = document.getElementById('seasonal-chart');
    if (!canvas) return;
    
    if (window.seasonalChart) {
        window.seasonalChart.destroy();
    }
    
    try {
        const ctx = canvas.getContext('2d');
        window.seasonalChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(function(d) { return d.data; }),
                datasets: [{
                    label: 'Componente Stagionale (' + indicator.replace('_',' ') + ')',
                    data: data.map(function(d) {
                        // Se hai dati stagionali separati per indicatore, usa d[indicator + '_seasonal']
                        // Altrimenti usa d.seasonal
                        return d.seasonal ?? 0;
                    }),
                    borderColor: '#FF9F40',
                    backgroundColor: 'rgba(255, 159, 64, 0.1)',
                    fill: true
                }]
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
    } catch (error) {
        console.error('Errore creazione grafico stagionale:', error);
    }
}

function createTrendChart(data, indicator) {
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;
    
    if (window.trendChart) {
        window.trendChart.destroy();
    }
    
    try {
        const ctx = canvas.getContext('2d');
        window.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(function(d) { return d.data; }),
                datasets: [{
                    label: 'Trend (' + indicator.replace('_',' ') + ')',
                    data: data.map(function(d) {
                        // Se hai dati trend separati per indicatore, usa d[indicator + '_trend']
                        // Altrimenti usa d.trend
                        return d.trend ?? 0;
                    }),
                    borderColor: '#4BC0C0',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    fill: true
                }]
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
    } catch (error) {
        console.error('Errore creazione grafico trend:', error);
    }
}

function updateTable(data) {
    const indicator = document.getElementById('forecast-indicator')?.value || 'nuovi_positivi';
    const tableBody = document.querySelector('#forecast-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    let prevValue = null;
    data.forEach(function(row, idx) {
        const tr = document.createElement('tr');
        // Data
        const dateCell = document.createElement('td');
        dateCell.textContent = formatDate(row.data);
        // Tooltip sulla data
        addTooltip(dateCell, 'Data della previsione');
        tr.appendChild(dateCell);
        // Valore principale (es: nuovi positivi)
        const mainCell = document.createElement('td');
        let value = row[indicator] != null ? row[indicator] : null;
        mainCell.textContent = value != null ? value.toLocaleString() : '-';
        // Badge trend
        if (prevValue != null && value != null) {
            const badge = document.createElement('span');
            badge.className = 'badge-trend ' + (value > prevValue ? 'up' : value < prevValue ? 'down' : '');
            badge.innerHTML = value > prevValue ? '<i class="fa fa-arrow-up"></i>' : (value < prevValue ? '<i class="fa fa-arrow-down"></i>' : '');
            mainCell.appendChild(badge);
            // Highlight dinamico
            if (value > prevValue) mainCell.classList.add('td-highlight-up');
            else if (value < prevValue) mainCell.classList.add('td-highlight-down');
        }
        prevValue = value;
        // Tooltip sulla cella principale
        addTooltip(mainCell, 'Valore previsto per la data');
        tr.appendChild(mainCell);
        // Intervallo inferiore/superiore
        const lowerKey = indicator + '_lower';
        const upperKey = indicator + '_upper';
        const lowerCell = document.createElement('td');
        lowerCell.textContent = row[lowerKey] != null ? row[lowerKey].toLocaleString() : '-';
        addTooltip(lowerCell, 'Limite inferiore intervallo di confidenza');
        tr.appendChild(lowerCell);
        const upperCell = document.createElement('td');
        upperCell.textContent = row[upperKey] != null ? row[upperKey].toLocaleString() : '-';
        addTooltip(upperCell, 'Limite superiore intervallo di confidenza');
        tr.appendChild(upperCell);
        // Trend (se presente)
        const trendCell = document.createElement('td');
        trendCell.textContent = row.trend != null ? row.trend.toLocaleString() : '-';
        addTooltip(trendCell, 'Trend stimato (differenza rispetto al giorno precedente)');
        tr.appendChild(trendCell);
        tableBody.appendChild(tr);
    });
    // Attiva i tooltip
    enableTableTooltips();
}

// Aggiorna la metrica MAPE nella pagina previsioni
function updateForecastMapeMetric() {
    // Per shine animazione
    const el = document.getElementById('model-accuracy');
    let previousValue = el ? el.textContent : null;
    const indicatorSelect = document.getElementById('forecast-indicator');
    let indicator = 'nuovi_positivi';
    if (indicatorSelect && indicatorSelect.value) indicator = indicatorSelect.value;
    // Lista degli indicatori "base" per cui la MAPE ha senso
    const baseIndicators = ['nuovi_positivi', 'deceduti', 'dimessi_guariti', 'terapia_intensiva', 'ricoverati_con_sintomi'];
    // (el già dichiarato sopra)

    if (!baseIndicators.includes(indicator)) {
        // Se l'indicatore è derivato, mostra messaggio e non chiamare l'API
        if (el) el.textContent = '--';
        return;
    }
    // Rileva paese selezionato (puoi adattare id o metodo di selezione)
    let country = 'ITA';
    const countrySelect = document.getElementById('country-select');
    if (countrySelect && countrySelect.value) country = countrySelect.value;
    fetch(`/api/model/mape?indicator=${encodeURIComponent(indicator)}&country=${encodeURIComponent(country)}`)
        .then(r => r.json())
        .then(res => {
            if (el) {
                if (res.mape !== null && res.mape !== undefined) {
                    const newValue = (100 - res.mape).toFixed(1) + '%';
                    // Shine animazione se migliora
                    if (previousValue && !isNaN(parseFloat(previousValue)) && parseFloat(newValue) > parseFloat(previousValue)) {
                        el.classList.add('shine');
                        setTimeout(() => el.classList.remove('shine'), 1500);
                    }
                    el.textContent = newValue;
                } else {
                    el.textContent = '--';
                }
            }
        })
        .catch(() => {
            if (el) el.textContent = '--';
        });
}


// Analisi AI dinamica del trend e generazione messaggio
function updateAIPredictionCard(forecastData) {
    const aiCard = document.getElementById('ai-prediction-card');
    if (!aiCard || !forecastData || !Array.isArray(forecastData) || forecastData.length < 7) return;
    // Analizza ultimi 7 giorni e prossimi 7 previsti di nuovi_positivi
    const indicator = 'nuovi_positivi';
    // Prendi ultimi 7 reali e primi 7 previsti (se disponibili)
    const values = forecastData.map(row => row[indicator]).filter(x => typeof x === 'number' && !isNaN(x));
    if (values.length < 7) {
        aiCard.innerHTML = '<span style="color:#ffb347">Dati insufficienti per un parere IA affidabile.</span>';
        return;
    }
    // Trend: confronto tra media ultimi 7 giorni e media dei 7 successivi (se ci sono abbastanza dati)
    const last7 = values.slice(-14, -7);
    const next7 = values.slice(-7);
    if (last7.length < 7 || next7.length < 7) {
        aiCard.innerHTML = '<span style="color:#ffb347">Dati insufficienti per un parere IA affidabile.</span>';
        return;
    }
    const avgLast = last7.reduce((a,b)=>a+b,0)/7;
    const avgNext = next7.reduce((a,b)=>a+b,0)/7;
    const diff = avgNext - avgLast;
    const perc = (diff/avgLast)*100;
    let message = '';
    if (perc < -7) {
        message = '📉 <b>Tendenza in miglioramento:</b> Le previsioni mostrano una diminuzione dei nuovi casi. Continua a seguire le buone pratiche!';
    } else if (perc > 7) {
        message = '⚠️ <b>Tendenza in peggioramento:</b> I dati indicano una possibile risalita dei nuovi casi. Si raccomanda prudenza e attenzione.';
    } else {
        message = '⏸️ <b>SITUAZIONE STABILE:</b> Le proiezioni mostrano una situazione stabile. Mantieni comportamenti responsabili.';
    }
    aiCard.innerHTML = message;
}

// SKELETON LOADER FORECAST TABLE
function showForecastSkeletonLoader() {
    const tableBody = document.querySelector('#forecast-table tbody');
    if (tableBody) {
        tableBody.innerHTML = '';
        for (let i = 0; i < 8; i++) {
            const tr = document.createElement('tr');
            tr.className = 'skeleton-row';
            for (let j = 0; j < 5; j++) {
                const td = document.createElement('td');
                td.innerHTML = '&nbsp;';
                tr.appendChild(td);
            }
            tableBody.appendChild(tr);
        }
    }
}
function hideForecastSkeletonLoader() {
    const skeletons = document.querySelectorAll('.skeleton-row');
    skeletons.forEach(el => el.remove());
}
// TOOLTIP MODERNI
function addTooltip(cell, text) {
    cell.addEventListener('mouseenter', function(e) {
        let tooltip = document.querySelector('.table-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'table-tooltip';
            document.body.appendChild(tooltip);
        }
        tooltip.textContent = text;
        tooltip.style.left = (e.pageX + 12) + 'px';
        tooltip.style.top = (e.pageY - 16) + 'px';
        tooltip.classList.add('active');
    });
    cell.addEventListener('mousemove', function(e) {
        const tooltip = document.querySelector('.table-tooltip');
        if (tooltip) {
            tooltip.style.left = (e.pageX + 12) + 'px';
            tooltip.style.top = (e.pageY - 16) + 'px';
        }
    });
    cell.addEventListener('mouseleave', function() {
        const tooltip = document.querySelector('.table-tooltip');
        if (tooltip) tooltip.classList.remove('active');
    });
}
function enableTableTooltips() {
    // NOP, già gestito in addTooltip
}
// FUNZIONI UTILITY

function formatDate(dateStr) {
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('it-IT');
    } catch (e) {
        return dateStr;
    }
}

function showError(message) {
    console.error(message);
    
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(function() {
        document.body.removeChild(toast);
    }, 5000);
}
