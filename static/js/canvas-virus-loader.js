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
     * Inizializza l'animazione con Canvas
     */
    init() {
        // Crea il container principale
        this.container = document.createElement('div');
        this.container.className = 'virus-loader';
        
        // Crea il canvas per l'animazione
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'virus-canvas';
        this.ctx = this.canvas.getContext('2d');
        
        // Stile canvas
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        
        // Crea il messaggio di stato con effetto typewriter
        this.messageElement = document.createElement('div');
        this.messageElement.className = 'virus-message';
        
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
        this.lastTime = this.startTime;
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
     * Aggiorna la progressione del caricamento
     */
    updateProgress(percent) {
        this.progress = Math.min(100, Math.max(0, percent));
        
        // Aggiorna la barra di progresso
        this.progressBar.style.width = `${this.progress}%`;
        this.progressText.textContent = `${Math.round(this.progress)}%`;
        
        // Intensità aumenta con il progresso
        const intensity = this.progress / 100;
        
        // Aumenta gli effetti con il progresso
        if (Math.random() < 0.03 + (intensity * 0.07)) {
            this.createDroplet();
        }
        
        if (Math.random() < 0.02 + (intensity * 0.04)) {
            this.createTentacle();
        }
        
        if (Math.random() < 0.05 + (intensity * 0.1)) {
            this.createParticle();
        }
    }
    
    /**
     * Crea una goccia che si stacca dal nucleo
     */
    createDroplet() {
        if (this.droplets.length >= this.maxDroplets) return;
        
        // Parametri della goccia
        const angle = Math.random() * Math.PI * 2;
        const size = 5 + Math.random() * 10;
        const speed = 0.5 + Math.random() * 1.5 + (this.progress / 100 * 2);
        const lifespan = 2000 + Math.random() * 3000;
        
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
        if (this.tentacles.length >= this.maxTentacles) return;
        
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
        if (this.particles.length >= this.maxParticles) return;
        
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
     * Loop di animazione principale
     */
    animate() {
        if (!this.isActive) return;
        
        // Calcola delta time
        const now = performance.now();
        this.deltaTime = (now - this.lastTime) / 16; // Normalizzato per 60fps
        this.lastTime = now;
        
        // Pulisci canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Disegna il nucleo del virus
        this.drawCore();
        
        // Aggiorna e disegna le gocce
        this.updateAndDrawDroplets();
        
        // Aggiorna e disegna i tentacoli
        this.updateAndDrawTentacles();
        
        // Aggiorna e disegna le particelle
        this.updateAndDrawParticles();
        
        // Continua l'animazione
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    /**
     * Disegna il nucleo pulsante del virus
     */
    drawCore() {
        // Aggiorna la fase di pulsazione
        this.core.phase += this.core.pulseSpeed * this.deltaTime;
        
        // Calcola il raggio attuale in base alla pulsazione
        const pulseFactor = Math.sin(this.core.phase) * 0.5 + 0.5;
        const currentRadius = this.core.pulseMin + pulseFactor * (this.core.pulseMax - this.core.pulseMin);
        
        // Disegna il glow
        const grd = this.ctx.createRadialGradient(
            this.centerX, this.centerY, currentRadius * 0.5,
            this.centerX, this.centerY, currentRadius + this.core.glowSize
        );
        grd.addColorStop(0, this.core.glowColor);
        grd.addColorStop(1, 'rgba(255, 87, 34, 0)');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, currentRadius + this.core.glowSize, 0, Math.PI * 2);
        this.ctx.fillStyle = grd;
        this.ctx.fill();
        
        // Disegna il nucleo
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, currentRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = this.core.color;
        this.ctx.fill();
    }
    
    /**
     * Aggiorna e disegna le gocce che si staccano dal nucleo
     */
    updateAndDrawDroplets() {
        for (let i = this.droplets.length - 1; i >= 0; i--) {
            const droplet = this.droplets[i];
            
            // Aggiorna età
            droplet.age += this.deltaTime * 16;
            
            // Rimuovi se troppo vecchio
            if (droplet.age >= droplet.lifespan) {
                this.droplets.splice(i, 1);
                continue;
            }
            
            // Calcola opacità in base all'età
            let opacity = droplet.opacity;
            if (droplet.age < 200) {
                // Fade in
                opacity = (droplet.age / 200) * droplet.opacity;
            } else if (droplet.age > droplet.lifespan - 300) {
                // Fade out
                opacity = ((droplet.lifespan - droplet.age) / 300) * droplet.opacity;
            }
            
            // Aggiorna posizione
            droplet.x += droplet.vx * this.deltaTime;
            droplet.y += droplet.vy * this.deltaTime;
            
            // Calcola il fattore di crescita basato sulla distanza dal centro
            const distanceFromCenter = Math.sqrt(
                Math.pow(droplet.x - this.centerX, 2) + 
                Math.pow(droplet.y - this.centerY, 2)
            );
            
            // La goccia cresce mentre si allontana dal nucleo
            const growthProgress = Math.min(1, distanceFromCenter / 150);
            const currentRadius = droplet.initialRadius * (1 + (droplet.growth - 1) * growthProgress);
            
            // Disegna la goccia
            this.ctx.beginPath();
            this.ctx.arc(droplet.x, droplet.y, currentRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 112, 67, ${opacity})`;
            this.ctx.fill();
        }
    }
    
    /**
     * Aggiorna e disegna i tentacoli
     */
    updateAndDrawTentacles() {
        for (let i = this.tentacles.length - 1; i >= 0; i--) {
            const tentacle = this.tentacles[i];
            
            // Aggiorna età
            tentacle.age += this.deltaTime * 16;
            
            // Rimuovi se troppo vecchio
            if (tentacle.age >= tentacle.lifespan) {
                this.tentacles.splice(i, 1);
                continue;
            }
            
            // Aumenta la lunghezza fino al massimo
            if (tentacle.length < tentacle.maxLength) {
                tentacle.length += tentacle.growSpeed * this.deltaTime;
            }
            
            // Calcola opacità in base all'età
            let opacity = tentacle.opacity;
            if (tentacle.age < 300) {
                // Fade in
                opacity = (tentacle.age / 300) * tentacle.opacity;
            } else if (tentacle.age > tentacle.lifespan - 500) {
                // Fade out
                opacity = ((tentacle.lifespan - tentacle.age) / 500) * tentacle.opacity;
            }
            
            // Calcola endpoint
            const endX = this.centerX + Math.cos(tentacle.angle) * tentacle.length;
            const endY = this.centerY + Math.sin(tentacle.angle) * tentacle.length;
            
            // Disegna il tentacolo
            this.ctx.beginPath();
            this.ctx.moveTo(this.centerX, this.centerY);
            this.ctx.lineTo(endX, endY);
            this.ctx.lineWidth = tentacle.width;
            this.ctx.strokeStyle = `rgba(255, 87, 34, ${opacity})`;
            this.ctx.stroke();
            
            // Disegna un piccolo cerchio alla fine del tentacolo
            this.ctx.beginPath();
            this.ctx.arc(endX, endY, tentacle.width * 1.5, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 87, 34, ${opacity})`;
            this.ctx.fill();
        }
    }
    
    /**
     * Aggiorna e disegna le particelle ambientali
     */
    updateAndDrawParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Aggiorna età
            particle.age += this.deltaTime * 16;
            
            // Rimuovi se troppo vecchio
            if (particle.age >= particle.lifespan) {
                this.particles.splice(i, 1);
                continue;
            }
            
            // Calcola opacità in base all'età
            let opacity = particle.opacity;
            if (particle.age < 300) {
                // Fade in
                opacity = (particle.age / 300) * particle.opacity;
            } else if (particle.age > particle.lifespan - 300) {
                // Fade out
                opacity = ((particle.lifespan - particle.age) / 300) * particle.opacity;
            }
            
            // Aggiorna posizione
            particle.x += particle.vx * this.deltaTime;
            particle.y += particle.vy * this.deltaTime;
            
            // Disegna la particella
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 138, 101, ${opacity})`;
            this.ctx.fill();
        }
    }
}

// Crea un'istanza globale
window.virusLoader = new VirusLoader();
