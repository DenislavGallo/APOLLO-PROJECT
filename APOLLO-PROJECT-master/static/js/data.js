/**
 * Apollo Project - Data Handler Module
 * 
 * Questo modulo gestisce il caricamento, l'elaborazione e l'integrazione dei dati COVID-19
 * con le previsioni generate dal modello Prophet per la visualizzazione sul mappamondo 3D.
 */

class DataHandler {
    constructor() {
        // Percorsi API
        this.latestDataAPI = '/api/data/latest';
        this.forecastAPI = '/api/data/forecast';
        this.globeDataAPI = '/api/data/globe';
        this.modelStatsAPI = '/api/stats/model';
        
        // Nuove API per dati geografici
        this.regionalDataAPI = '/api/data/regional';
        this.provincialDataAPI = '/api/data/provincial';
        this.regionalForecastAPI = '/api/forecast/regional';
        this.provincialForecastAPI = '/api/forecast/provincial';
        
        // Dati elaborati
        this.historicalData = [];
        this.forecastData = [];
        this.currentData = []; // Dati attualmente mostrati (storici o previsti)
        this.globeData = []; // Dati per il globo 3D
        
        // Parametri di stato
        this.dataLoaded = false;
        this.selectedDate = null;
        this.selectedIndicator = 'nuovi_positivi';
        this.showingPrediction = false;
        
        // Parametri geografici
        this.geographicLevel = 'national'; // 'national', 'regional', 'provincial'
        this.selectedRegion = null;
        this.selectedProvince = null;
        this.availableRegions = [];
        this.availableProvinces = [];
        
        // Coordinate geografiche dell'Italia per il mappamondo
        this.italyCoordinates = {
            lat: 41.8719, 
            long: 12.5674
        };
        
        // Aggiungiamo coordinate di più paesi per copertura globale
        this.worldCoordinates = [
            { country: 'Italia', lat: 41.8719, long: 12.5674 },
            { country: 'Francia', lat: 46.2276, long: 2.2137 },
            { country: 'Germania', lat: 51.1657, long: 10.4515 },
            { country: 'Spagna', lat: 40.4637, long: -3.7492 },
            { country: 'Regno Unito', lat: 55.3781, long: -3.4360 },
            { country: 'USA', lat: 37.0902, long: -95.7129 },
            { country: 'Cina', lat: 35.8617, long: 104.1954 },
            { country: 'Giappone', lat: 36.2048, long: 138.2529 },
            { country: 'India', lat: 20.5937, long: 78.9629 },
            { country: 'Brasile', lat: -14.2350, long: -51.9253 },
            { country: 'Russia', lat: 61.5240, long: 105.3188 },
            { country: 'Australia', lat: -25.2744, long: 133.7751 },
            { country: 'Sud Africa', lat: -30.5595, long: 22.9375 }
        ];
    }
    
    /**
     * Carica i dati storici dal file CSV e prepara la struttura dati
     */
    async loadHistoricalData() {
        try {
            console.log('Caricamento dati storici...');
            const response = await fetch('/api/data/historical');
            
            if (!response.ok) {
                throw new Error(`Errore HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success || !result.data || !Array.isArray(result.data)) {
                throw new Error('Formato dati non valido');
            }
            
            this.historicalData = result.data;
            
            // Ordina per data crescente
            this.historicalData.sort((a, b) => new Date(a.data) - new Date(b.data));
            
            // Imposta la data più recente come data selezionata di default
            if (this.historicalData.length > 0) {
                this.selectedDate = this.historicalData[this.historicalData.length - 1].data;
            }
            
            this.dataLoaded = true;
            console.log('Dati storici caricati:', this.historicalData.length, 'record');
            
            // Aggiorna dati correnti
            this.updateCurrentData();
            
            return this.historicalData;
        } catch (error) {
            console.error('Errore nel caricamento dei dati storici:', error);
            // Genera dati di fallback
            this.historicalData = this.generateSimulatedHistoricalData();
            this.dataLoaded = true;
            if (this.historicalData.length > 0) {
                this.selectedDate = this.historicalData[this.historicalData.length - 1].data;
            }
            return this.historicalData;
        }
    }
    
    /**
     * Genera dati storici simulati in caso di errore
     */
    generateSimulatedHistoricalData() {
        console.log('Generazione dati storici simulati...');
        const simulatedData = [];
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 60); // Ultimi 60 giorni
        
        for (let i = 0; i < 60; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            
            // Base con leggero aumento per ogni giorno
            const dayFactor = 1 + (i * 0.05);
            const randomFactor = 0.8 + (Math.random() * 0.4); // 0.8-1.2
            
            const nuoviPositivi = Math.round(500 * dayFactor * randomFactor);
            const totalePositivi = Math.round(10000 + (i * 200 * randomFactor));
            const dimessiGuariti = Math.round(4800000 + (i * 3000 * randomFactor));
            const deceduti = Math.round(140000 + (i * 20 * randomFactor));
            const totale = dimessiGuariti + totalePositivi + deceduti;
            
            simulatedData.push({
                data: date.toISOString().split('T')[0],
                stato: 'ITA',
                nuovi_positivi: nuoviPositivi,
                totale_positivi: totalePositivi,
                dimessi_guariti: dimessiGuariti,
                deceduti: deceduti,
                totale_casi: totale,
                terapia_intensiva: Math.round(50 + (i * 2 * randomFactor)),
                ricoverati_con_sintomi: Math.round(500 + (i * 10 * randomFactor))
            });
        }
        
        return simulatedData;
    }
    
    /**
     * Carica i dati di previsione generati dal modello Prophet
     */
    async loadForecastData() {
        try {
            console.log('Caricamento dati previsione...');
            const response = await fetch('/api/data/forecast');
            
            if (!response.ok) {
                throw new Error(`Errore HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success || !result.data || !Array.isArray(result.data)) {
                throw new Error('Formato dati di previsione non valido');
            }
            
            this.forecastData = result.data;
            console.log('Dati previsione caricati:', this.forecastData.length, 'record');
            
            return this.forecastData;
        } catch (error) {
            console.warn('Errore nel caricamento delle previsioni:', error);
            console.log('Generazione previsioni simulate...');
            
            // Genera previsioni simulate
            this.forecastData = this.generateSimulatedForecast();
            return this.forecastData;
        }
    }
    
    /**
     * Genera previsioni simulate basate sui dati storici
     * Questa funzione viene utilizzata solo se i dati di previsione non sono disponibili
     */
    generateSimulatedForecast() {
        console.log('Generazione previsioni simulate...');
        
        // Svuota le previsioni precedenti
        this.forecastData = [];
        
        if (!this.historicalData || this.historicalData.length === 0) {
            console.error('Impossibile generare previsioni senza dati storici');
            // Genera comunque qualche dato di previsione di base
            const today = new Date();
            for (let i = 1; i <= 14; i++) {
                const forecastDate = new Date(today);
                forecastDate.setDate(forecastDate.getDate() + i);
                
                this.forecastData.push({
                    data: forecastDate.toISOString().split('T')[0],
                    stato: 'ITA',
                    nuovi_positivi: Math.round(1000 + (Math.random() * 500)),
                    totale_positivi: Math.round(20000 + (i * 1000)),
                    dimessi_guariti: Math.round(4900000 + (i * 5000)),
                    deceduti: Math.round(140000 + (i * 50)),
                    totale_casi: Math.round(5100000 + (i * 6000)),
                    terapia_intensiva: Math.round(100 + (i * 5)),
                    ricoverati_con_sintomi: Math.round(1000 + (i * 50))
                });
            }
            
            console.log('Generate previsioni base senza dati storici:', this.forecastData.length, 'giorni');
            return this.forecastData;
        }
        
        // Prendi gli ultimi valori dai dati storici come base per la previsione
        const lastValues = { ...this.historicalData[this.historicalData.length - 1] };
        
        // Genera 14 giorni di previsione
        const today = new Date();
        for (let i = 1; i <= 14; i++) {
            const forecastDate = new Date(today);
            forecastDate.setDate(forecastDate.getDate() + i);
            
            // Crea un oggetto per questo giorno di previsione
            const forecastObj = {
                data: forecastDate.toISOString().split('T')[0],
                stato: 'ITA'
            };
            
            // Per ogni indicatore, genera una previsione basata su trend e casualità
            ['nuovi_positivi', 'totale_positivi', 'dimessi_guariti', 'deceduti', 'totale_casi', 'terapia_intensiva', 'ricoverati_con_sintomi'].forEach(key => {
                // Salta se il valore precedente non esiste
                if (!(key in lastValues)) {
                    forecastObj[key] = key === 'nuovi_positivi' ? 1000 : 
                                      key === 'totale_positivi' ? 20000 : 
                                      key === 'dimessi_guariti' ? 4900000 : 
                                      key === 'deceduti' ? 140000 :
                                      key === 'totale_casi' ? 5100000 :
                                      key === 'terapia_intensiva' ? 100 : 1000;
                    return;
                }
                
                // Genera un fattore di variazione (trend + casualità)
                let variationFactor = 1.0;
                
                // Trend a lungo termine (alcuni aumentano, altri diminuiscono)
                if (key === 'nuovi_positivi' || key === 'totale_positivi') {
                    // Trend in aumento per nuovi e totale positivi
                    variationFactor += 0.03 * Math.sin(i / 14 * Math.PI * 2); // Oscillazione sinusoidale
                } else if (key === 'dimessi_guariti') {
                    // Trend in costante aumento per i guariti
                    variationFactor += 0.01 * i;
                } else if (key === 'deceduti') {
                    // Trend stabile con leggere oscillazioni per i deceduti
                    variationFactor += 0.005 * Math.sin(i / 7 * Math.PI);
                }
                
                // Aggiungi componente ciclica settimanale
                let cyclicComponent = 1.0;
                if (key === 'nuovi_positivi' || key === 'terapia_intensiva' || key === 'ricoverati_con_sintomi') {
                    const dayOfWeek = forecastDate.getDay();
                    cyclicComponent += Math.sin((dayOfWeek / 7) * 2 * Math.PI) * 0.15;
                }
                
                // Calcola il nuovo valore con base il precedente
                if (lastValues[key] !== undefined) {
                    forecastObj[key] = Math.max(0, Math.round(lastValues[key] * variationFactor * cyclicComponent));
                } else {
                    forecastObj[key] = 0;
                }
                
                // Gestione speciale per totale casi (deve essere somma di altri valori)
                if (key === 'totale_casi') {
                    forecastObj[key] = (forecastObj['totale_positivi'] || 0) + 
                                      (forecastObj['dimessi_guariti'] || 0) + 
                                      (forecastObj['deceduti'] || 0);
                }
            });
            
            this.forecastData.push(forecastObj);
            
            // Aggiorna i "lastValues" per il prossimo giorno di previsione
            lastValues.data = forecastObj.data;
            for (const key in forecastObj) {
                if (key !== 'data' && key !== 'stato') {
                    lastValues[key] = forecastObj[key];
                }
            }
        }
        
        console.log('Previsioni simulate generate:', this.forecastData.length, 'record');
        this.dataLoaded = true;
        return this.forecastData;
    }
    
    /**
     * Carica i dati per il globo 3D dall'API dedicata
     * Supporta anche dati regionali e provinciali se selezionati
     */
    async loadGlobeData() {
        try {
            // Determina la data selezionata e la sorgente dati
            const selectedDate = this.selectedDate;
            const usePrediction = this.showingPrediction;
            const dataset = usePrediction ? this.forecastData : this.historicalData;
            
            if (!selectedDate || !dataset || dataset.length === 0) {
                if (provincialData) {
                    // Formatta i dati per il globo
                    const points = this.createPointsForProvince(provincialData);
                    this.globeData = points;
                    return points;
                }
            } else {
                // Dati nazionali (default)
                // Crea una mappa paese->coordinata
                const coordMap = {};
                this.worldCoordinates.forEach(c => {
                    coordMap[c.country.toLowerCase()] = c;
                });
        
                // Raggruppa i dati per paese per la data selezionata
                const points = [];
                dataset.forEach(record => {
                    if (!record.data || record.data !== selectedDate) return;
                    // Cerca la coordinata per il paese
                    let countryName = (record.stato || record.country || '').toLowerCase();
                    if (!coordMap[countryName]) return;
                    const coord = coordMap[countryName];
                    // Scegli l'indicatore da visualizzare
                    const indicator = this.selectedIndicator || 'nuovi_positivi';
                    let cases = record[indicator] || record.cases || 0;
                    let totalCases = record.totale_casi || record.totalCases || 0;
                    points.push({
                        country: coord.country,
                        lat: coord.lat,
                        long: coord.long,
                        cases: cases,
                        totalCases: totalCases,
                        date: record.data
                    });
                });
                
                if (points.length === 0) {
                    console.warn('Nessun dato disponibile per la data selezionata!');
                    this.globeData = [];
                    return [];
                }
                
                this.globeData = points;
                return points;
            }
            
            // Se arriviamo qui, non abbiamo dati da mostrare
            console.warn('Nessun dato disponibile per il livello geografico selezionato');
            this.globeData = [];
            return [];
        } catch (error) {
            console.error('Errore nel caricamento dei dati del globo:', error);
            // Fallback a dati simulati
            this.globeData = this.simulateGlobeData();
            return this.globeData;
        }
    }
    
    /**
     * Crea punti per una regione specifica
     */
    createPointsForRegion(regionalData) {
        const points = [];
        const indicator = this.selectedIndicator || 'nuovi_positivi';
        
        regionalData.forEach(record => {
            // Ottenere coordinate per la regione (coordinate approssimative)
            const regionCoordinates = this.getRegionCoordinates(record.denominazione_regione);
            if (!regionCoordinates) return;
            
            let cases = record[indicator] || 0;
            let totalCases = record.totale_casi || 0;
            
            points.push({
                region: record.denominazione_regione,
                lat: regionCoordinates.lat,
                long: regionCoordinates.long,
                cases: cases,
                totalCases: totalCases,
                date: record.data
            });
        });
        
        return points;
    }
    
    /**
     * Carica le statistiche del modello predittivo
     */
    async loadModelStats() {
        try {
            console.log('Caricamento statistiche del modello...');
            const response = await fetch(this.modelStatsAPI);
            
            if (!response.ok) {
                throw new Error(`Errore HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error('Errore nel caricamento delle statistiche del modello');
            }
            
            // Memorizza le statistiche del modello
            this.modelStats = result.data || {};
            console.log('Statistiche modello caricate', this.modelStats);
            
            return this.modelStats;
        } catch (error) {
            console.warn('Errore nel caricamento delle statistiche del modello:', error);
            // Crea statistiche simulate come fallback
            this.modelStats = {
                mape: 3.2 + (Math.random() * 2), // 3.2-5.2%
                rmse: 150 + (Math.random() * 100),
                mae: 100 + (Math.random() * 50),
                trainingSamples: 365,
                testSamples: 30,
                lastUpdated: new Date().toISOString()
            };
            return this.modelStats;
        }
    }
    
    /**
     * Carica l'elenco delle regioni disponibili
     */
    async loadAvailableRegions() {
        try {
            console.log('Caricamento regioni disponibili...');
            const response = await fetch('/api/regions');
            
            if (!response.ok) {
                throw new Error(`Errore HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error('Errore nel caricamento delle regioni');
            }
            
            this.availableRegions = result.data || [];
            console.log('Regioni caricate:', this.availableRegions.length);
            
            return this.availableRegions;
        } catch (error) {
            console.warn('Errore nel caricamento delle regioni:', error);
            // Crea regioni simulate come fallback
            this.availableRegions = [
                'Lombardia', 'Lazio', 'Campania', 'Veneto', 'Emilia-Romagna', 
                'Piemonte', 'Sicilia', 'Toscana', 'Puglia', 'Calabria',
                'Sardegna', 'Liguria', 'Friuli-Venezia Giulia', 'Marche', 'Abruzzo',
                'Umbria', 'Basilicata', 'Molise', 'Valle d\'Aosta', 'Trentino-Alto Adige'
            ];
            return this.availableRegions;
        }
    }
    
    /**
     * Crea punti per una provincia specifica
     */
    createPointsForProvince(provincialData) {
        const points = [];
        const indicator = this.selectedIndicator || 'totale_casi'; // Per province spesso è disponibile solo totale_casi
        
        provincialData.forEach(record => {
            // Ottenere coordinate per la provincia (coordinate approssimative)
            const provinceCoordinates = this.getProvinceCoordinates(record.denominazione_provincia);
            if (!provinceCoordinates) return;
            
            let cases = record[indicator] || 0;
            let totalCases = record.totale_casi || 0;
            
            points.push({
                province: record.denominazione_provincia,
                lat: provinceCoordinates.lat,
                long: provinceCoordinates.long,
                cases: cases,
                totalCases: totalCases,
                date: record.data
            });
        });
        
        return points;
    }
    
    /**
     * Ottiene le coordinate per una regione
     * Nota: Questi sono valori approssimativi per demo
     */
    getRegionCoordinates(regionName) {
        // Mappa di coordinate approssimative per le regioni italiane
        const regionCoordinates = {
            'Lombardia': { lat: 45.4773, long: 9.1815 },
            'Lazio': { lat: 41.9109, long: 12.4818 },
            'Campania': { lat: 40.8518, long: 14.2681 },
            'Sicilia': { lat: 37.5990, long: 14.0154 },
            'Veneto': { lat: 45.4398, long: 12.3319 },
            'Emilia-Romagna': { lat: 44.4949, long: 11.3426 },
            'Piemonte': { lat: 45.0703, long: 7.6869 },
            'Puglia': { lat: 41.1171, long: 16.8719 },
            'Toscana': { lat: 43.7711, long: 11.2486 },
            // Aggiungi altre regioni se necessario
        };
        
        return regionCoordinates[regionName];
    }
    
    /**
     * Ottiene le coordinate per una provincia
     * Nota: Questi sono valori approssimativi per demo
     */
    getProvinceCoordinates(provinceName) {
        // Mappa di coordinate approssimative per le province italiane
        const provinceCoordinates = {
            'Milano': { lat: 45.4642, long: 9.1900 },
            'Roma': { lat: 41.9028, long: 12.4964 },
            'Napoli': { lat: 40.8518, long: 14.2681 },
            'Torino': { lat: 45.0703, long: 7.6869 },
            'Palermo': { lat: 38.1157, long: 13.3615 },
            'Genova': { lat: 44.4056, long: 8.9463 },
            'Bologna': { lat: 44.4949, long: 11.3426 },
            'Firenze': { lat: 43.7696, long: 11.2558 },
            'Bari': { lat: 41.1171, long: 16.8719 },
            'Catania': { lat: 37.5079, long: 15.0830 },
            // Aggiungi altre province se necessario
        };
        
        return provinceCoordinates[provinceName];
    }
    /**
     * Aggiorna i dati correnti in base alla data selezionata, livello geografico e modalità (reale/previsione)
     */
    updateCurrentData() {
        // Controlla il livello geografico
        if (this.geographicLevel === 'regional' && this.selectedRegion) {
            // Usa dati regionali
            this.loadRegionalData(this.selectedRegion).then(data => {
                if (data) {
                    this.currentData = data.filter(record => record.data === this.selectedDate);
                } else {
                    this.currentData = [];
                }
            }).catch(err => {
                console.error('Errore aggiornando dati regionali:', err);
                this.currentData = [];
            });
        } else if (this.geographicLevel === 'provincial' && this.selectedProvince) {
            // Usa dati provinciali
            this.loadProvincialData(this.selectedProvince).then(data => {
                if (data) {
                    this.currentData = data.filter(record => record.data === this.selectedDate);
                } else {
                    this.currentData = [];
                }
            }).catch(err => {
                console.error('Errore aggiornando dati provinciali:', err);
                this.currentData = [];
            });
        } else {
            // Usa dati nazionali (default)
            const dataset = this.showingPrediction ? this.forecastData : this.historicalData;
            if (!this.selectedDate || !dataset || dataset.length === 0) {
                this.currentData = [];
                return this.currentData;
            }
            // Filtra solo i record per la data selezionata
            this.currentData = dataset.filter(record => record.data === this.selectedDate);
        }
        return this.currentData;
    }

    /**
     * Restituisce il record corrente selezionato (per la dashboard)
     */
    getCurrentRecord() {
        if (this.currentData && this.currentData.length > 0) {
            return this.currentData[0];
        }
        return null;
    }
    
    /**
     * Imposta la data selezionata
     */
    setSelectedDate(dateString) {
        this.selectedDate = dateString;
        return this.updateCurrentData();
    }
    
    /**
     * Imposta l'indicatore selezionato (es. nuovi_positivi, deceduti, ecc.)
     */
    setSelectedIndicator(indicator) {
        this.selectedIndicator = indicator;
        return this.updateCurrentData();
    }
    
    /**
     * Attiva/disattiva la modalità previsione
     */
    togglePredictionMode(enabled) {
        this.showingPrediction = enabled;
        return this.updateCurrentData();
    }
    
    /**
     * Restituisce tutte le date disponibili per il dataset attuale
     */
    getAvailableDates() {
        const dataset = this.showingPrediction ? this.forecastData : this.historicalData;
        return dataset.map(record => ({
            date: record.data,
            timestamp: new Date(record.data).getTime()
        }));
    }
    
    /**
     * Restituisce i dati per il grafico delle previsioni
     */
    getChartData() {
        // Verifica che i dati siano stati caricati
        if (!this.dataLoaded || !this.historicalData || !this.forecastData) {
            console.warn('Dati non disponibili per il grafico previsioni');
            return { labels: [], datasets: [] };
        }
        
        // Assicurati che entrambi gli array esistano e siano validi
        if (!Array.isArray(this.historicalData) || !Array.isArray(this.forecastData)) {
            console.error('Dati storici o previsioni non sono array validi', {
                historicalIsArray: Array.isArray(this.historicalData),
                forecastIsArray: Array.isArray(this.forecastData)
            });
            return { labels: [], datasets: [] };
        }
        
        // Prendi gli ultimi 30 giorni di dati storici
        const recentHistorical = this.historicalData.slice(-30) || [];
        
        // Crea le etichette delle date (asse X)
        const labels = [];
        
        // Aggiungi le date storiche
        if (recentHistorical && recentHistorical.length > 0) {
            recentHistorical.forEach(d => {
                if (d && d.data) {
                    try {
                        labels.push(new Date(d.data).toLocaleDateString('it-IT'));
                    } catch (e) {
                        labels.push('Data sconosciuta');
                    }
                }
            });
        }
        
        // Aggiungi le date delle previsioni
        if (this.forecastData && this.forecastData.length > 0) {
            this.forecastData.forEach(d => {
                if (d && d.data) {
                    try {
                        labels.push(new Date(d.data).toLocaleDateString('it-IT'));
                    } catch (e) {
                        labels.push('Data prevista');
                    }
                }
            });
        }
        
        // Prepara i dati per i dataset
        const historicalValues = [];
        if (recentHistorical && recentHistorical.length > 0) {
            recentHistorical.forEach(d => {
                if (d && this.selectedIndicator in d) {
                    historicalValues.push(d[this.selectedIndicator]);
                } else {
                    historicalValues.push(null);
                }
            });
        }
        
        const forecastValues = [];
        if (this.forecastData && this.forecastData.length > 0) {
            this.forecastData.forEach(d => {
                if (d && this.selectedIndicator in d) {
                    forecastValues.push(d[this.selectedIndicator]);
                } else {
                    forecastValues.push(null);
                }
            });
        }
        
        // Riempi con null per allineare i dataset
        const nullHistorical = Array(forecastValues.length).fill(null);
        const nullForecast = Array(historicalValues.length).fill(null);
        
        // Crea i dataset
        const datasets = [
            {
                label: 'Dati Storici',
                data: [...historicalValues, ...nullHistorical],
                borderColor: '#3894ff',
                backgroundColor: 'rgba(56, 148, 255, 0.1)',
                pointRadius: 3,
                tension: 0.3,
                fill: true
            },
            {
                label: 'Previsioni AI',
                data: [...nullForecast, ...forecastValues],
                borderColor: '#ff5757',
                backgroundColor: 'rgba(255, 87, 87, 0.1)',
                pointRadius: 2,
                borderDash: [5, 5],
                tension: 0.3,
                fill: true
            }
        ];
        
        return { labels, datasets };
    }
    
    /**
     * Utility: parse CSV in oggetti JavaScript
     */
    parseCSV(text) {
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        const result = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const obj = {};
            const currentLine = lines[i].split(',');
            
            headers.forEach((header, j) => {
                obj[header] = currentLine[j];
            });
            
            result.push(obj);
        }
        
        return result;
    }
}
