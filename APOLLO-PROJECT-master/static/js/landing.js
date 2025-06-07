/**
 * landing.js
 * Script per gli effetti dinamici della landing page di Apollo
 */

document.addEventListener('DOMContentLoaded', function() {
    // Inizializza solo il globo orbitante se siamo nella landing page
    const orbitGlobeElement = document.getElementById('orbit-globe');
    if (orbitGlobeElement) {
        initOrbitGlobe();
    }
});

/**
 * Crea il globo 3D con il puntino orbitante
 */
function initOrbitGlobe() {
    // Setup Three.js
    const container = document.getElementById('orbit-globe');
    const scene = new THREE.Scene();
    
    // Dimensioni del container
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 300;
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({
        canvas: container,
        alpha: true,
        antialias: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Illuminazione
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 3, 5);
    scene.add(mainLight);
    
    const secondaryLight = new THREE.DirectionalLight(0x3894ff, 0.3);
    secondaryLight.position.set(-5, 0, -5);
    scene.add(secondaryLight);
    
    // Crea il globo
    const globeRadius = Math.min(width, height) * 0.15;
    const globeGeometry = new THREE.SphereGeometry(globeRadius, 64, 64);
    const globeMaterial = new THREE.MeshPhongMaterial({
        color: 0x3894ff,
        transparent: true,
        opacity: 0.2,
        wireframe: true
    });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);
    
    // Crea un overlay solido più interno
    const innerGlobeGeometry = new THREE.SphereGeometry(globeRadius * 0.95, 32, 32);
    const innerGlobeMaterial = new THREE.MeshPhongMaterial({
        color: 0x3894ff,
        transparent: true,
        opacity: 0.1
    });
    const innerGlobe = new THREE.Mesh(innerGlobeGeometry, innerGlobeMaterial);
    scene.add(innerGlobe);
    
    // Crea l'effetto bagliore
    const glowGeometry = new THREE.SphereGeometry(globeRadius * 1.2, 32, 32);
    const glowMaterial = new THREE.ShaderMaterial({
        uniforms: {
            "c": { type: "f", value: 0.2 },
            "p": { type: "f", value: 6.0 },
            glowColor: { type: "c", value: new THREE.Color(0x3894ff) },
            viewVector: { type: "v3", value: camera.position }
        },
        vertexShader: `
            uniform vec3 viewVector;
            varying float intensity;
            void main() {
                vec3 vNormal = normalize(normalMatrix * normal);
                vec3 vNormel = normalize(normalMatrix * viewVector);
                intensity = pow(0.72 - dot(vNormal, vNormel), 2.0);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 glowColor;
            uniform float c;
            uniform float p;
            varying float intensity;
            void main() {
                vec3 glow = glowColor * c * pow(intensity, p);
                gl_FragColor = vec4(glow, 1.0);
            }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true
    });
    
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowMesh);
    
    // Crea il punto rosso orbitante (satellite)
    const satelliteGeometry = new THREE.SphereGeometry(globeRadius * 0.05, 16, 16);
    const satelliteMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.8
    });
    const satellite = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
    scene.add(satellite);
    
    // Crea una scia per il satellite
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
        color: 0xff3333,
        transparent: true,
        opacity: 0.4
    });
    
    const trailPositions = new Float32Array(300 * 3); // Conserva 100 posizioni passate
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(trail);
    
    let trailIndex = 0;
    const trailLength = 100; // Numero di posizioni da memorizzare
    
    // Funzione per aggiornare la posizione del satellite e la sua scia
    function updateSatellite(time) {
        // Calcola la posizione orbitale
        const orbit = {
            radius: globeRadius * 1.5,
            speed: 0.5,
            tilt: Math.PI / 6 // Inclinazione dell'orbita
        };
        
        // Parametri orbitali variabili per rendere il movimento più interessante
        const wobble = Math.sin(time * 0.5) * 0.2;
        
        // Posizione base con wobble
        const angle = time * orbit.speed;
        const x = orbit.radius * Math.cos(angle);
        const z = orbit.radius * Math.sin(angle);
        const y = orbit.radius * Math.sin(angle * 0.5) * Math.sin(orbit.tilt + wobble);
        
        // Aggiorna la posizione del satellite
        satellite.position.set(x, y, z);
        
        // Aggiorna la scia
        const positions = trail.geometry.attributes.position.array;
        
        // Sposta tutti i punti indietro di uno slot
        for (let i = trailLength - 1; i > 0; i--) {
            const currentIndex = i * 3;
            const prevIndex = (i - 1) * 3;
            
            positions[currentIndex] = positions[prevIndex];
            positions[currentIndex + 1] = positions[prevIndex + 1];
            positions[currentIndex + 2] = positions[prevIndex + 2];
        }
        
        // Aggiungi la posizione corrente all'inizio
        positions[0] = x;
        positions[1] = y;
        positions[2] = z;
        
        // Marca la geometria per l'aggiornamento
        trail.geometry.attributes.position.needsUpdate = true;
    }
    
    // Gestisci il ridimensionamento della finestra
    function onWindowResize() {
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
    
    window.addEventListener('resize', onWindowResize);
    
    // Animazione
    function animate(timestamp) {
        const time = timestamp * 0.001; // Converti in secondi
        
        // Ruota il globo lentamente
        globe.rotation.y = time * 0.1;
        innerGlobe.rotation.y = time * 0.08;
        
        // Aggiorna la posizione del satellite
        updateSatellite(time);
        
        // Rendering
        renderer.render(scene, camera);
        
        requestAnimationFrame(animate);
    }
    
    // Avvia l'animazione
    requestAnimationFrame(animate);
}
