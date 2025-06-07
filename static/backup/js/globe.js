/**
 * Apollo Project - Globe Visualization
 * Implementazione semplificata con Three.js
 */

class Globe {
    constructor(containerId, tooltipId) {
        this.container = document.getElementById(containerId);
        this.tooltip = document.getElementById(tooltipId);
        
        if (!this.container) {
            console.error('Container not found:', containerId);
            return;
        }
        
        if (!this.tooltip) {
            console.error('Tooltip not found:', tooltipId);
            this.tooltip = document.createElement('div');
            this.tooltip.id = tooltipId;
            this.tooltip.className = 'tooltip';
            document.body.appendChild(this.tooltip);
        }
        
        // Dimensioni
        this.width = this.container.clientWidth || 500;
        this.height = this.container.clientHeight || 400;
        this.radius = 2;
        
        // Offset di longitudine per allineare i punti (-25 gradi come richiesto)
        this.longitudeOffset = -25;
        
        // Points storage
        this.points = [];
        this.dataPoints = [];
        
        this.init();
    }
    
    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 1000);
        this.camera.position.z = 5;
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.width, this.height);
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);
        
        // Controls
        if (typeof THREE.OrbitControls === 'function') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.autoRotate = false; // Nessuna rotazione automatica come richiesto
            this.controls.minDistance = 3;
            this.controls.maxDistance = 8;
        } else {
            console.warn('OrbitControls non disponibile');
        }
        
        // Light
        const light = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(light);
        
        // Wire Globe (white wireframe)
        const wireGeometry = new THREE.SphereGeometry(this.radius, 32, 32);
        const wireMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true,
            transparent: true,
            opacity: 0.4
        });
        const wireGlobe = new THREE.Mesh(wireGeometry, wireMaterial);
        this.scene.add(wireGlobe);
        
        // Green continent base
        const continentGeometry = new THREE.SphereGeometry(this.radius * 0.98, 32, 32);
        const continentMaterial = new THREE.MeshBasicMaterial({
            color: 0x80FF80,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        });
        const continents = new THREE.Mesh(continentGeometry, continentMaterial);
        this.scene.add(continents);
        
        // Stars
        this.addStars();
        
        // Group for data points
        this.pointsGroup = new THREE.Group();
        this.scene.add(this.pointsGroup);
        
        // Raycaster for detection
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Events
        window.addEventListener('resize', this.onResize.bind(this));
        this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
        
        // Start animation
        this.animate();
    }
    
    addStars() {
        const starsGeometry = new THREE.BufferGeometry();
        const starVertices = [];
        
        for (let i = 0; i < 1000; i++) {
            const radius = Math.random() * 50 + 10;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 2;
            
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            
            starVertices.push(x, y, z);
        }
        
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1
        });
        
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(stars);
    }
    
    onResize() {
        this.width = this.container.clientWidth || 500;
        this.height = this.container.clientHeight || 400;
        
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }
    
    onMouseMove(event) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / this.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / this.height) * 2 + 1;
        
        // Check for tooltip
        this.checkIntersection(event.clientX, event.clientY);
    }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        if (this.controls) {
            this.controls.update();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    // Converte coordinate geografiche in posizione 3D
    latLongToVector3(lat, long, altitude = 0) {
        const radius = this.radius + altitude;
        const phi = (90 - lat) * (Math.PI / 180);
        // Applica offset di longitudine -25 gradi come richiesto
        const theta = (long + this.longitudeOffset) * (Math.PI / 180);
        
        const x = -radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        
        return new THREE.Vector3(x, y, z);
    }
    
    // Aggiunge punti COVID al globo
    addCovidPoints(data) {
        // Rimuovi punti esistenti
        this.removePoints();
        
        // Se nessun dato valido, usa dati di esempio
        if (!data || !Array.isArray(data) || data.length === 0) {
            console.warn('Dati non validi, uso dati di esempio');
            data = [
                { country: "Italia", lat: 41.9, long: 12.5, cases: 5000, totalCases: 50000 },
                { country: "Francia", lat: 46.6, long: 2.3, cases: 3000, totalCases: 40000 },
                { country: "Germania", lat: 51.2, long: 10.4, cases: 4000, totalCases: 45000 },
                { country: "Spagna", lat: 40.5, long: -3.7, cases: 2500, totalCases: 30000 }
            ];
        }
        
        console.log(`Aggiunta di ${data.length} punti al globo`);
        this.dataPoints = data;
        
        // Crea punti per ogni paese
        data.forEach((point, index) => {
            if (!point || typeof point.lat !== 'number' || typeof point.long !== 'number') {
                return;
            }
            
            // Calcola dimensione in base ai casi (logaritmica)
            const size = Math.max(0.05, Math.min(0.2, Math.log10(point.cases + 1) * 0.05));
            
            // Posizione con offset di longitudine -25 come richiesto
            const position = this.latLongToVector3(point.lat, point.long, 0.02);
            
            // Punto rosso principale
            const geometry = new THREE.SphereGeometry(size, 16, 16);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0xff0000,
                transparent: true,
                opacity: 0.8
            });
            
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.copy(position);
            sphere.userData = { index };
            
            this.pointsGroup.add(sphere);
            this.points.push(sphere);
            
            // Effetto glow (sfera leggermente più grande e trasparente)
            const glowGeometry = new THREE.SphereGeometry(size * 1.3, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xff0000,
                transparent: true,
                opacity: 0.3
            });
            
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            glow.position.copy(position);
            
            this.pointsGroup.add(glow);
            this.points.push(glow);
        });
    }
    
    // Rimuove tutti i punti
    removePoints() {
        if (this.points && this.points.length > 0) {
            this.points.forEach(point => {
                if (point.geometry) point.geometry.dispose();
                if (point.material) point.material.dispose();
                this.pointsGroup.remove(point);
            });
            
            this.points = [];
        }
    }
    
    // Verifica intersezione per tooltip
    checkIntersection(x, y) {
        if (!this.raycaster || !this.points || this.points.length === 0) return;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.points);
        
        if (intersects.length > 0) {
            const pointIndex = intersects[0].object.userData.index;
            
            if (pointIndex !== undefined && this.dataPoints[pointIndex]) {
                const point = this.dataPoints[pointIndex];
                
                // Mostra il tooltip esattamente alle coordinate del cursore
                this.tooltip.innerHTML = `
                    <div class="tooltip-header">${point.country}</div>
                    <div class="tooltip-content">
                        Casi confermati: ${point.cases.toLocaleString()} casi<br>
                        Variazione: +${Math.round(point.cases/point.totalCases*100)}%
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
}
