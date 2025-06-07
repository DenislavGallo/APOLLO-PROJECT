/**
 * Apollo Project - VirusLoader Canvas
 * 
 * Un'animazione organica e fluida che simula la diffusione di un virus,
 * implementata con Canvas per ottenere effetti simili a quelli dei videogiochi.
 */

class VirusLoader {
    constructor() {
        // Elementi DOM
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.messageElement = null;
        this.progressBar = null;
        this.progressText = null;
        
        // Dimensioni
        this.width = 0;
        this.height = 0;
        this.centerX = 0;
        this.centerY = 0;
        
        // Animazione
        this.animationId = null;
        this.isActive = false;
        this.progress = 0;
        this.startTime = 0;
        this.lastTime = 0;
        this.deltaTime = 0;
        
        // Core virus
        this.core = {
            radius: 40,
            pulseMin: 35,
            pulseMax: 45,
            pulseSpeed: 0.05,
            phase: 0,
            color: '#ff5722',
            glowSize: 20,
            glowColor: 'rgba(255, 87, 34, 0.6)'
        };
        
        // Collezioni
        this.droplets = [];
        this.tentacles = [];
        this.particles = [];
        
        // Limiti
        this.maxDroplets = 25;
        this.maxTentacles = 12;
        this.maxParticles = 30;
        
        // Messaggi
        this.messages = [
            'Inizializzazione analisi virale...',
            'Identificazione pattern infettivi...',
            'Mappatura diffusione globale...',
            'Elaborazione dati epidemiologici...',
            'Analisi mutazioni genomiche...',
            'Calibrazione modello predittivo...'
        ];
        this.currentMessage = 0;
        this.charIndex = 0;
        this.messageTimer = null;
        
        // Inizializzazione
        this.init();
    }
    
    /**
     * Inizializza l'animazione di caricamento con Canvas
     */
    init() {
        // Crea il container principale
        this.container = document.createElement('div');
        this.container.className = 'virus-loader';
        
        // Crea il canvas per l'animazione
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'virus-canvas';
        this.ctx = this.canvas.getContext('2d');
        
        // Aggiungi stile al canvas
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        
        // Crea il messaggio di stato con effetto typewriter
        this.messageElement = document.createElement('div');
        this.messageElement.className = 'virus-message';
        this.messageElement.textContent = '';
        
        // Crea il contenitore della barra di progresso
        const progressContainer = document.createElement('div');
        progressContainer.className = 'virus-progress-container';
        
        // Crea la barra di progresso
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'virus-progress-bar';
        progressContainer.appendChild(this.progressBar);
        
        // Crea il testo della percentuale
        this.progressText = document.createElement('div');
        this.progressText.className = 'virus-percent';
        this.progressText.textContent = '0%';
        
        // Aggiungi tutti gli elementi al container
        this.container.appendChild(this.canvas);
        this.container.appendChild(this.messageElement);
        this.container.appendChild(progressContainer);
        this.container.appendChild(this.progressText);
        
        // Aggiungi il container al body
        document.body.appendChild(this.container);
        
        // Gestisci il ridimensionamento del canvas
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
    }
    
    /**
     * Ridimensiona il canvas per adattarsi alla finestra
     */
    resizeCanvas() {
        if (!this.canvas) return;
        
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        
        // Imposta le dimensioni del canvas
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Applica le impostazioni del contesto
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }
    
    /**
     * Mostra il loader virale
     */
    show() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.progress = 0;
        this.startTime = performance.now();
        this.lastFrameTime = this.startTime;
        this.droplets = [];
        this.tentacles = [];
        this.particles = [];
        
        // Mostra il container
        this.container.classList.add('active');
        
        // Avvia l'effetto typewriter per i messaggi
        this.startTypewriter();
        
        // Avvia l'animazione
        this.animate();
    }
    
    /**
     * Nasconde il loader
     */
    hide() {
        if (!this.isActive) return;
        
        // Ferma l'animazione
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Ferma il typewriter
        clearTimeout(this.messageTimer);
        
        // Nascondi il container
        this.container.classList.remove('active');
        this.isActive = false;
    }
    
    /**
     * Avvia l'effetto macchina da scrivere
     */
    startTypewriter() {
        // Reset
        this.currentMessage = 0;
        this.charIndex = 0;
        clearTimeout(this.messageTimer);
        
        // Avvia l'effetto
        this.typeNextChar();
    }
    
    /**
     * Effetto macchina da scrivere
     */
    typeNextChar() {
        const message = this.messages[this.currentMessage];
        
        if (this.charIndex <= message.length) {
            this.messageElement.textContent = message.substring(0, this.charIndex);
            this.charIndex++;
            this.messageTimer = setTimeout(() => this.typeNextChar(), 40 + Math.random() * 30);
        } else {
            // Passa al prossimo messaggio dopo una pausa
            this.messageTimer = setTimeout(() => {
                this.currentMessage = (this.currentMessage + 1) % this.messages.length;
                this.charIndex = 0;
                this.typeNextChar();
            }, 3000);
        }
    }
    
    /**
     * Crea una goccia di virus
     * @param {number} angle - Angolo in radianti
     * @param {number} speed - Velocità della goccia
     * @param {number} size - Dimensione iniziale
     * @param {number} lifespan - Durata di vita in millisecondi
     */
    createDroplet(angle, speed, size, lifespan) {
        this.droplets.push({
            x: this.centerX,
            y: this.centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: size,
            initialRadius: size,
            growth: 1 + Math.random() * 0.5,
            lifespan: lifespan,
            age: 0,
            color: '#ff7043',
            opacity: 0.8 + Math.random() * 0.2
        });
    }
    
    /**
     * Crea un tentacolo che si estende dal nucleo
     */
    createTentacle() {
        const angle = Math.random() * Math.PI * 2;
        const length = 0; // Inizia con lunghezza zero e cresce
        const maxLength = 100 + Math.random() * 200 + (this.progress || 0);
        const growSpeed = 0.5 + Math.random() * 1.5 + ((this.progress || 0) / 100);
        const width = 2 + Math.random() * 5;
        const lifespan = 3000 + Math.random() * 3000;
        
        this.tentacles.push({
            x: this.centerX,
            y: this.centerY,
            angle: angle,
            length: length,
            maxLength: maxLength,
            growSpeed: growSpeed,
            width: width,
            lifespan: lifespan,
            age: 0,
            color: '#ff5722',
            opacity: 0.7 + Math.random() * 0.3
        });
    }
    
    /**
     * Crea una particella nell'ambiente
     */
    createParticle() {
        const size = 2 + Math.random() * 4;
        const distance = 50 + Math.random() * 300;
        const angle = Math.random() * Math.PI * 2;
        const lifespan = 2000 + Math.random() * 3000;
        
        const x = this.centerX + Math.cos(angle) * distance;
        const y = this.centerY + Math.sin(angle) * distance;
        
        this.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: size,
            lifespan: lifespan,
            age: 0,
            color: '#ff8a65',
            opacity: 0.1 + Math.random() * 0.4
        });
    }

        
/**
 * Crea un tentacolo che si estende dal nucleo
 */
createTentacle() {
    const angle = Math.random() * Math.PI * 2;
    const length = 0; // Inizia con lunghezza zero e cresce
    const maxLength = 100 + Math.random() * 200 + (this.progress);
    const growSpeed = 0.5 + Math.random() * 1.5 + (this.progress / 100);
    const width = 2 + Math.random() * 5;
    const lifespan = 3000 + Math.random() * 3000;
        
    this.tentacles.push({
        x: this.centerX,
        y: this.centerY,
        angle: angle,
        length: length,
        maxLength: maxLength,
        growSpeed: growSpeed,
        width: width,
        lifespan: lifespan,
        age: 0,
        color: '#ff5722',
        opacity: 0.7 + Math.random() * 0.3
    });
}
        
/**
 * Crea una particella nell'ambiente
 */
createParticle() {
    const size = 2 + Math.random() * 4;
    const distance = 50 + Math.random() * 300;
    const angle = Math.random() * Math.PI * 2;
    const lifespan = 2000 + Math.random() * 3000;
        
    const x = this.centerX + Math.cos(angle) * distance;
    const y = this.centerY + Math.sin(angle) * distance;
        
    this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: size,
        lifespan: lifespan,
        age: 0,
        color: '#ff8a65',
        opacity: 0.1 + Math.random() * 0.4
    });
    }
}

// Crea un'istanza globale del loader
window.virusLoader = new VirusLoader();
