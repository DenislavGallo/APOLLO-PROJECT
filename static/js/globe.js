/**
 * Apollo Project - 3D Globe Visualization
 * Questa è una copia fedele del globo originale dal progetto 3d-globe-with-threejs-main
 * con adattamenti minimi per funzionare nel contesto di Apollo
 */

class Globe {
    constructor(containerId, tooltipId) {
        console.log('Inizializzazione globo (copia diretta di 3d-globe-with-threejs-main)');
        
        // Riferimenti DOM
        this.container = document.getElementById(containerId);
        this.tooltip = document.getElementById(tooltipId);
        
        if (!this.container) {
            console.error('Container del globo non trovato:', containerId);
            return;
        }
        
        if (!this.tooltip) {
            console.error('Tooltip del globo non trovato:', tooltipId);
            this.tooltip = document.createElement('div');
            this.tooltip.id = tooltipId;
            document.body.appendChild(this.tooltip);
        }
        
        // Proprietà
        this.radius = 2;
        this.points = [];
        this.dataPoints = [];
        /**
         * Offset longitudine per allineamento punti/texture
         * Modificato per allineamento corretto con l'Italia
         */
        this.longitudeOffset = 180;
        
        // Supporto per visualizzazione multi-livello geografico
        this.enableMultiLevel = true; // Abilita il supporto multi-livello
        this.showLevelIndicator = false; // Non mostrare l'indicatore visivo per mantenere UI originale
        this.levels = {
            national: { min: 3.8, max: 5.5, active: true },   // Ridotto il range per vedere meglio
            regional: { min: 3.4, max: 3.8, active: false },  // Aumentato il minimo 
            provincial: { min: 3.2, max: 3.4, active: false } // Aumentato significativamente il minimo
        };
        this.currentLevel = 'national';
        
        // Cache per i dati dei diversi livelli geografici
        this.dataCache = {
            national: [],
            regional: {},
            provincial: {}
        };
        
        // Inizializzazione del globo
        this.initGlobe();
    }
    
    initGlobe() {
        try {
            // SETUP IDENTICO A index.js originale
            const w = this.container.clientWidth;
            const h = this.container.clientHeight;
            
            // Scene setup
            this.scene = new THREE.Scene();
            this.scene.fog = new THREE.FogExp2(0x000000, 0.3);
            
            // Camera setup
            this.camera = new THREE.PerspectiveCamera(75, w / h, 1, 100);
            this.camera.position.z = 5;
            
            // Renderer setup
            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setSize(w, h);
            this.container.innerHTML = '';
            this.container.appendChild(this.renderer.domElement);
            
            // OrbitControls
            if (typeof THREE.OrbitControls === 'function') {
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.autoRotate = false; // Nessuna rotazione automatica come richiesto
                this.controls.minDistance = 3.2; // Aumentato significativamente per impedire di entrare nel globo
                this.controls.maxDistance = 5.5; // Zoom out limit ridotto per non essere troppo lontani
            } else if (typeof OrbitControls === 'function') {
                // Prova a usare OrbitControls come funzione globale
                this.controls = new OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.autoRotate = false; // Nessuna rotazione automatica come richiesto
                this.controls.minDistance = 3.2; // Aumentato significativamente per impedire di entrare nel globo
                this.controls.maxDistance = 5.5; // Zoom out limit ridotto per non essere troppo lontani
            } else {
                console.error('OrbitControls non disponibile in nessun formato');
            }
            
            // Wireframe bianco
            const geometry = new THREE.SphereGeometry(this.radius, 64, 64);
            const lineMat = new THREE.LineBasicMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: 0.2,
                linewidth: 1
            });
            const edges = new THREE.EdgesGeometry(geometry, 1);
            const line = new THREE.LineSegments(edges, lineMat);
            this.scene.add(line);
            
            // Stelle
            try {
                // Usando la funzione esatta dall'originale
                const getStarfield = window.getStarfield || this.fallbackStarfield;
                const stars = getStarfield({ numStars: 1000, fog: false });
                this.scene.add(stars);
            } catch (error) {
                console.warn('Impossibile creare il campo di stelle:', error);
            }
            
            // Caricamento GeoJSON per i continenti verdi
            this.loadGeoJSON();
            
            // Raycaster per tooltip
            this.raycaster = new THREE.Raycaster();
            this.mouse = new THREE.Vector2();
            
            // Eventi
            window.addEventListener('resize', this.onResize.bind(this));
            this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
            
            // Avvio animazione
            this.animate();
            
            console.log('Globo 3D inizializzato con successo');
        } catch (error) {
            console.error('Errore nell\'inizializzazione del globo:', error);
        }
    }
    
    // Implementazione fallback per starfield se il modulo originale non è disponibile
    fallbackStarfield({ numStars = 1000 }) {
        const starsGeometry = new THREE.BufferGeometry();
        const positions = [];
        
        for (let i = 0; i < numStars; i++) {
            const r = 50 + 50 * Math.random();
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);
            
            positions.push(x, y, z);
        }
        
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1
        });
        
        return new THREE.Points(starsGeometry, starsMaterial);
    }
    
    loadGeoJSON() {
        console.log('Caricamento GeoJSON...');
        
        // Prova a caricare il GeoJSON da diverse posizioni possibili
        const paths = [
            '../static/geojson/ne_110m_land.json',
            './static/geojson/ne_110m_land.json',
            '/static/geojson/ne_110m_land.json'
        ];
        
        const tryPath = (index) => {
            if (index >= paths.length) {
                console.error('Impossibile caricare il GeoJSON, usando continenti di fallback');
                return this.createFallbackContinents();
            }
            
            fetch(paths[index])
                .then(response => {
                    if (!response.ok) throw new Error(`Errore caricamento da ${paths[index]}`);
                    return response.json();
                })
                .then(data => {
                    console.log('GeoJSON caricato con successo');
                    
                    try {
                        // Utilizzo della funzione dall'originale
                        const drawThreeGeo = window.drawThreeGeo || this.fallbackDrawThreeGeo;
                        const countries = drawThreeGeo({
                            json: data,
                            radius: this.radius,
                            materialOptions: {
                                color: 0x90FF90, // Verde più brillante per maggiore visibilità
                                transparent: true,
                                opacity: 0.9,  // Aumentata opacità per renderlo più visibile
                                linewidth: 2   // Tenta di aumentare lo spessore delle linee
                            }
                        });
                        this.scene.add(countries);
                    } catch (error) {
                        console.error('Errore nella visualizzazione GeoJSON:', error);
                        this.createFallbackContinents();
                    }
                })
                .catch(error => {
                    console.warn(`Errore caricamento ${paths[index]}:`, error);
                    tryPath(index + 1);
                });
        };
        
        tryPath(0);
    }
    
    // Fallback DrawThreeGeo (versione MOLTO semplificata)
    fallbackDrawThreeGeo({ json, radius, materialOptions }) {
        console.warn("Usando drawThreeGeo fallback");
        const container = new THREE.Object3D();
        
        // Semplice wireframe verde come fallback
        const geometry = new THREE.SphereGeometry(radius * 0.98, 64, 64);
        const material = new THREE.MeshBasicMaterial({
            color: materialOptions.color || 0x90FF90, // Verde più brillante
            wireframe: true,
            transparent: true,
            opacity: 0.9
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        container.add(mesh);
        
        return container;
    }
    
    createFallbackContinents() {
        console.warn('Utilizzando continenti di fallback');
        
        // Semplice sfera verde
        const geometry = new THREE.SphereGeometry(this.radius * 0.98, 64, 64);
        const material = new THREE.MeshBasicMaterial({
            color: 0x90FF90, // Verde più brillante
            wireframe: true,
            transparent: true,
            opacity: 0.9
        });
        
        const continents = new THREE.Mesh(geometry, material);
        this.scene.add(continents);
        
        return continents;
    }
    
    onResize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }
    
    onMouseMove(event) {
        // Calcola posizione mouse normalizzata
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / this.container.clientWidth) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / this.container.clientHeight) * 2 + 1;
        
        // Controlla intersezioni per tooltip
        this.checkIntersection(event.clientX, event.clientY);
    }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        
        // Controlla il livello geografico in base allo zoom (solo se abilitato)
        if (this.enableMultiLevel) {
            this.checkZoomLevel();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    // Converte lat/long in vettore 3D
    // Regola this.longitudeOffset per trovare l'allineamento perfetto tra punti e texture
    latLongToVector3(lat, long, radius) {
        radius = radius || this.radius;
        // Nessun offset di default. Modifica this.longitudeOffset per test.
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (long + this.longitudeOffset) * (Math.PI / 180);
        const x = -radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        return new THREE.Vector3(x, y, z);
    }
    
    checkIntersection(x, y) {
        if (!this.raycaster || !this.points || this.points.length === 0) return;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.points);
        if (intersects.length > 0) {
            const userData = intersects[0].object.userData;
            const pointIndex = userData.index;
            const level = userData.level || 'national';
            
            if (pointIndex !== undefined && this.dataPoints[pointIndex]) {
                const point = this.dataPoints[pointIndex];
                
                // Determina il nome dell'area e i dati da mostrare in base al livello
                let title, cases, totalCases;
                
                if (level === 'national') {
                    title = point.country || 'Paese';
                    cases = point.cases || 0;
                    totalCases = point.totalCases || 0;
                } else if (level === 'regional') {
                    title = point.region || point.denominazione_regione || 'Regione';
                    cases = point.cases || point.nuovi_positivi || 0;
                    totalCases = point.totalCases || point.totale_casi || 0;
                } else { // provincial
                    title = point.province || point.denominazione_provincia || 'Provincia';
                    cases = point.cases || point.totale_casi || 0;
                    totalCases = point.totalCases || point.totale_casi || 0;
                }
                
                // Tooltip vicino al cursore, senza offset
                this.tooltip.innerHTML = `
                    <div class="tooltip-header">${title}</div>
                    <div class="tooltip-content">
                        Casi: <b>${cases.toLocaleString()}</b><br>
                        Totale casi: <b>${totalCases.toLocaleString()}</b><br>
                        Percentuale: <b>${totalCases ? ((cases/totalCases)*100).toFixed(2) : '--'}%</b>
                    </div>
                `;
                this.tooltip.style.left = `${x}px`;
                this.tooltip.style.top = `${y}px`;
                this.tooltip.classList.add('visible');
            }
        } else {
            this.tooltip.classList.remove('visible');
        }
    }
    
    // Aggiunge punti COVID al globo in base al livello geografico
    addCovidPoints(data, level) {
        // Se il livello non è specificato, usa quello corrente
        if (!level) {
            level = this.currentLevel || 'national';
        }
        
        // Rimuovi punti precedenti
        this.removePoints();
        
        // Fallback se dati non validi
        if (!data || !Array.isArray(data) || data.length === 0) {
            console.warn(`Dati non validi per livello ${level}, uso dati di esempio`);
            if (level === 'national') {
                data = [
                    { country: "Italia", lat: 41.9, long: 12.5, cases: 5000, totalCases: 50000 },
                    { country: "Francia", lat: 46.6, long: 2.3, cases: 3000, totalCases: 40000 },
                    { country: "Germania", lat: 51.2, long: 10.4, cases: 4000, totalCases: 45000 },
                    { country: "Spagna", lat: 40.5, long: -3.7, cases: 2500, totalCases: 30000 }
                ];
            } else if (level === 'regional') {
                data = [
                    { region: "Lombardia", lat: 45.6, long: 9.8, cases: 2000, totalCases: 20000 },
                    { region: "Lazio", lat: 41.9, long: 12.5, cases: 1500, totalCases: 15000 },
                    { region: "Campania", lat: 40.9, long: 14.2, cases: 1800, totalCases: 18000 }
                ];
            } else { // provincial
                data = [
                    { province: "Milano", lat: 45.5, long: 9.2, cases: 800, totalCases: 8000 },
                    { province: "Roma", lat: 41.9, long: 12.5, cases: 600, totalCases: 6000 },
                    { province: "Napoli", lat: 40.9, long: 14.2, cases: 500, totalCases: 5000 }
                ];
            }
        }
        
        console.log(`Aggiunta di ${data.length} punti al globo (livello: ${level})`);
        this.dataPoints = data;
        
        // Determina colore in base al livello geografico (mantenendo il rosso per nazionale)
        let pointColor = 'rgba(255,0,0,0.9)'; // Colore default: rosso
        if (level === 'regional') {
            pointColor = 'rgba(255,127,0,0.9)'; // Arancione per livello regionale
        } else if (level === 'provincial') {
            pointColor = 'rgba(255,165,0,0.9)'; // Giallo/oro per livello provinciale
        }
        
        // Texture per sprite (chiazza 2D)
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        ctx.globalAlpha = 0.7;
        const radius = size / 2 * 0.85;
        const gradient = ctx.createRadialGradient(size/2, size/2, size/10, size/2, size/2, radius);
        gradient.addColorStop(0, pointColor);
        gradient.addColorStop(0.6, pointColor.replace('0.9', '0.3'));
        gradient.addColorStop(1, pointColor.replace('0.9', '0'));
        ctx.beginPath();
        ctx.arc(size/2, size/2, radius, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;

        // Aggiungi punti come sprite 2D
        data.forEach((point, index) => {
            // Estrai dati in base al livello
            let lat, long, cases, totalCases;
            
            if (level === 'national') {
                lat = point.lat;
                long = point.long;
                cases = point.cases || 0;
                totalCases = point.totalCases || cases;
            } else if (level === 'regional') {
                lat = point.lat;
                long = point.long;
                cases = point.cases || point.nuovi_positivi || 0;
                totalCases = point.totalCases || point.totale_casi || cases;
            } else { // provincial
                lat = point.lat;
                long = point.long;
                cases = point.cases || point.totale_casi || 0;
                totalCases = point.totalCases || point.totale_casi || cases;
            }
            
            // Verifica che abbiamo coordinate valide
            if (!point || typeof lat !== 'number' || typeof long !== 'number') {
                return;
            }
            
            // Adatta l'altezza in base al livello (per evitare sovrapposizioni)
            let pointHeight = this.radius * 1.02; // default per nazionale
            if (level === 'regional') pointHeight = this.radius * 1.015;
            if (level === 'provincial') pointHeight = this.radius * 1.01;
            
            const position = this.latLongToVector3(lat, long, pointHeight);
            
            // Dimensione sprite basata sui casi, ma ridotta per evitare sovrapposizioni
            // Adatta la dimensione in base al livello geografico
            let sizeMultiplier = 0.5; // Ridotto da 1.0 a 0.5 per tutti i livelli
            if (level === 'regional') sizeMultiplier = 0.4;
            if (level === 'provincial') sizeMultiplier = 0.3;
            
            // Ridotto il range dimensionale per avere punti più piccoli
            const spriteSize = Math.max(0.12, Math.min(0.35, Math.log10(cases + 1) * 0.08)) * sizeMultiplier;
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite = new THREE.Sprite(material);
            sprite.position.copy(position);
            sprite.scale.set(spriteSize, spriteSize, 1.0);
            sprite.userData = { index, level }; // Aggiungi il livello ai metadati
            this.scene.add(sprite);
            this.points.push(sprite);
            
            // Effetto glow ridotto per evitare sovrapposizioni
            const glowColor = level === 'national' ? 0xff0000 : (level === 'regional' ? 0xff7f00 : 0xffa500);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: glowColor,
                transparent: true,
                opacity: level === 'national' ? 0.4 : 0.3 // Ridotto per minore invasività
            });
            
            // Dimensione glow ulteriormente ridotta
            const glowSize = (level === 'national' ? 0.04 : (level === 'regional' ? 0.03 : 0.02));
            const glowSphere = new THREE.Mesh(
                new THREE.SphereGeometry(glowSize, 16, 16),
                glowMaterial
            );
            glowSphere.position.copy(position);
            this.scene.add(glowSphere);
            this.points.push(glowSphere);
        });
    }
    
    // Rimuove tutti i punti
    removePoints() {
        if (this.points && this.points.length > 0) {
            this.points.forEach(point => {
                if (point.parent) point.parent.remove(point);
                if (point.geometry) point.geometry.dispose();
                if (point.material) point.material.dispose();
            });
            this.points = [];
        }
    }
    
    // Metodo per ruotare il globo (richiesto dal main.js)
    rotateGlobe(x, y) {
        if (this.controls) {
            // Rotazione manuale del globo
            this.controls.rotateLeft(x * 0.01);
            this.controls.rotateUp(y * 0.01);
            this.controls.update();
        }
    }
    
    /**
     * Controlla il livello geografico in base allo zoom attuale
     * - Zoom out (camera lontana): livello nazionale
     * - Zoom medio: livello regionale
     * - Zoom in (camera vicina): livello provinciale
     */
    checkZoomLevel() {
        if (!this.camera || !this.controls) return;
        
        // Distanza attuale della camera
        const distance = this.camera.position.length();
        
        // Determina il livello in base alla distanza
        let newLevel = this.currentLevel;
        
        if (distance >= this.levels.national.min) {
            newLevel = 'national';
        } else if (distance >= this.levels.regional.min && distance < this.levels.regional.max) {
            newLevel = 'regional';
        } else if (distance >= this.levels.provincial.min && distance < this.levels.provincial.max) {
            newLevel = 'provincial';
        }
        
        // Cambia livello solo se necessario
        if (newLevel !== this.currentLevel) {
            this.changeLevel(newLevel);
        }
    }
    
    /**
     * Cambia il livello geografico e aggiorna i dati visualizzati
     */
    changeLevel(newLevel) {
        // Aggiorna lo stato dei livelli
        Object.keys(this.levels).forEach(level => {
            this.levels[level].active = (level === newLevel);
        });
        
        // Aggiorna il livello corrente
        this.currentLevel = newLevel;
        console.log(`Cambio livello geografico a: ${newLevel}`);
        
        // Carica i dati appropriati
        this.loadDataForLevel(newLevel);
    }
    
    /**
     * Carica i dati per il livello specifico
     */
    loadDataForLevel(level) {
        // Se abbiamo già i dati in cache, usiamo quelli
        if (level === 'national' && this.dataCache.national.length > 0) {
            this.addCovidPoints(this.dataCache.national, level);
            return;
        } else if (level === 'regional') {
            const countryCode = 'ITA'; // Default per Italia
            if (this.dataCache.regional[countryCode] && this.dataCache.regional[countryCode].length > 0) {
                this.addCovidPoints(this.dataCache.regional[countryCode], level);
                return;
            }
        } else if (level === 'provincial') {
            // Determina la regione in base alla posizione corrente della camera
            const regionCode = this.determineRegionFromCamera();
            if (this.dataCache.provincial[regionCode] && this.dataCache.provincial[regionCode].length > 0) {
                this.addCovidPoints(this.dataCache.provincial[regionCode], level);
                return;
            }
        }
        
        // Altrimenti, carica i dati dal server
        let url;
        let countryCode = 'ITA'; // Default per Italia
        let regionCode = this.determineRegionFromCamera(); // Determina regione in base alla visualizzazione
        
        if (level === 'national') {
            url = '/api/data/national';
        } else if (level === 'regional') {
            url = `/api/data/regional/${countryCode}`;
        } else if (level === 'provincial') {
            url = `/api/data/provincial/${regionCode}`;
        }
        
        // Esegue la richiesta per ottenere i dati
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Errore nella richiesta: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Aggiorna la cache e mostra i dati
                if (level === 'national') {
                    this.dataCache.national = data;
                } else if (level === 'regional') {
                    this.dataCache.regional[countryCode] = data;
                } else if (level === 'provincial') {
                    this.dataCache.provincial[regionCode] = data;
                }
                
                this.addCovidPoints(data, level);
            })
            .catch(error => {
                console.error(`Errore nel caricamento dei dati di livello ${level}:`, error);
                // In caso di errore, usa dati di esempio o quello che abbiamo
                this.addCovidPoints([], level); // Userà i dati di fallback
            });
    }
    
    /**
     * Determina la regione corrente in base alla posizione della camera
     * Questa è una semplificazione - in una implementazione completa
     * dovresti determinare la regione in base a dove l'utente sta guardando
     */
    determineRegionFromCamera() {
        // Per semplicita, restituisce sempre Lombardia come default
        // In un'implementazione reale, dovresti calcolare quale regione è al centro della vista
        return 'Lombardia';
    }
}
