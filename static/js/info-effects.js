// Script per effetti avanzati nella pagina informazioni

document.addEventListener('DOMContentLoaded', function() {
    // Inizializza effetti all'avvio
    initParticleEffect();
    initGlitchEffect();
    initHoverEffects();
    initSectionObserver();
    
    console.log("Effetti della pagina informazioni inizializzati");
});

// Crea particelle animate nello sfondo
function initParticleEffect() {
    const kineticBg = document.createElement('div');
    kineticBg.className = 'kinetic-bg';
    document.querySelector('.info-content').appendChild(kineticBg);
    
    // Crea particelle casuali
    for (let i = 0; i < 50; i++) {
        createParticle(kineticBg);
    }
}

// Crea una singola particella con posizione e movimento casuale
function createParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Imposta dimensione casuale
    const size = Math.random() * 5 + 1;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    
    // Posizione casuale
    const posX = Math.random() * 100;
    const posY = Math.random() * 100;
    particle.style.left = `${posX}%`;
    particle.style.top = `${posY}%`;
    
    // Opacità casuale
    particle.style.opacity = Math.random() * 0.5 + 0.1;
    
    // Colore casuale tra tre opzioni
    const colors = ['#4b6eff', '#26c9ff', '#9e42ff'];
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Aggiungi la particella al container
    container.appendChild(particle);
    
    // Anima la particella
    animateParticle(particle);
}

// Anima le particelle con movimento fluido
function animateParticle(particle) {
    // Durata casuale dell'animazione
    const duration = Math.random() * 20 + 10;
    
    // Nuova posizione casuale
    const newPosX = Math.random() * 100;
    const newPosY = Math.random() * 100;
    
    // Applica l'animazione
    particle.style.transition = `all ${duration}s linear`;
    
    setTimeout(() => {
        particle.style.left = `${newPosX}%`;
        particle.style.top = `${newPosY}%`;
        
        // Quando l'animazione è completa, riavviala
        setTimeout(() => {
            animateParticle(particle);
        }, duration * 1000);
    }, 100);
}

// Effetto glitch per i titoli - rimosso e sostituito con shimmer
function initGlitchEffect() {
    // Rimosso l'effetto glitch, ora usa shimmer CSS
    // Non serve più impostare l'attributo data-text
}

// Aggiungi effetti hover alle icone e ai contenitori
function initHoverEffects() {
    // Per ogni icona nella feature grid
    document.querySelectorAll('.feature-item i').forEach(icon => {
        // Aggiungi un effetto casuale di rotazione o scala quando si passa sopra
        icon.addEventListener('mouseenter', function() {
            const randomEffect = Math.floor(Math.random() * 3);
            
            switch(randomEffect) {
                case 0:
                    this.style.animation = 'rotate 1s infinite alternate';
                    break;
                case 1:
                    this.style.animation = 'pulse 1s infinite alternate';
                    break;
                case 2:
                    this.style.animation = 'bounce 1s infinite alternate';
                    break;
            }
        });
        
        // Rimuovi l'effetto quando esci
        icon.addEventListener('mouseleave', function() {
            this.style.animation = '';
        });
    });
    
    // Aggiungi effetti di animazione per le icone della tecnologia
    document.querySelectorAll('.tech-list li').forEach(tech => {
        tech.addEventListener('mouseenter', function() {
            const icon = this.querySelector('i');
            if (icon) {
                icon.style.transform = 'scale(1.3) rotate(5deg)';
            }
        });
        
        tech.addEventListener('mouseleave', function() {
            const icon = this.querySelector('i');
            if (icon) {
                icon.style.transform = '';
            }
        });
    });
}

// Animazione per far apparire le sezioni durante lo scroll
function initSectionObserver() {
    // Ottieni tutte le sezioni
    const sections = document.querySelectorAll('.info-section');
    
    // Crea un observer per rilevare quando una sezione diventa visibile
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // Quando una sezione diventa visibile
            if (entry.isIntersecting) {
                // Aggiungi una classe di animazione
                entry.target.classList.add('section-visible');
                // Imposta un ritardo per le animazioni dei figli
                animateChildren(entry.target);
                // Smetti di osservare questa sezione
                observer.unobserve(entry.target);
            }
        });
    }, {
        // Imposta la soglia dell'intersezione al 20%
        threshold: 0.2
    });
    
    // Osserva ogni sezione
    sections.forEach(section => {
        // Aggiungi stile iniziale
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        // Inizia a osservare
        observer.observe(section);
    });
}

// Anima i figli delle sezioni con un effetto a cascata
function animateChildren(section) {
    // Resetta lo stile della sezione
    section.style.opacity = '1';
    section.style.transform = 'translateY(0)';
    
    // Seleziona gli elementi interessanti da animare con un ritardo
    const animatableElements = section.querySelectorAll('h3, .feature-item, .tech-list li, .step, .author-info, .acknowledgments');
    
    // Anima ogni elemento con un ritardo incrementale
    animatableElements.forEach((element, index) => {
        // Imposta stile iniziale
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
        // Applica l'animazione con ritardo
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, 100 + (index * 100)); // 100ms di ritardo per ogni elemento
    });
}

// Effetti cyber avanzati per i titoli delle sezioni
document.addEventListener('mousemove', function(e) {
    const icons = document.querySelectorAll('.section-icon');
    
    icons.forEach(icon => {
        // Calcola la distanza tra il cursore e l'icona
        const rect = icon.getBoundingClientRect();
        const iconX = rect.left + rect.width / 2;
        const iconY = rect.top + rect.height / 2;
        
        const distX = e.clientX - iconX;
        const distY = e.clientY - iconY;
        
        // Calcola la distanza totale
        const dist = Math.sqrt(distX * distX + distY * distY);
        
        // Se il cursore è vicino all'icona (entro 150px), crea un effetto di attrazione
        if (dist < 150) {
            const strength = 1 - dist / 150; // Più forte quando sei più vicino
            const moveX = distX * strength * 0.1; // Ridotto per movimento più sottile
            const moveY = distY * strength * 0.1;
            
            // Applica un leggero movimento all'icona
            icon.style.transform = `translate(${moveX}px, ${moveY}px)`;
        } else {
            // Altrimenti, resetta la posizione
            icon.style.transform = '';
        }
    });
});

// Aggiungi effetti interattivi ai bottoni
document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('button');
    
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05) translateY(-2px)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
        
        button.addEventListener('mousedown', function() {
            this.style.transform = 'scale(0.95)';
        });
        
        button.addEventListener('mouseup', function() {
            this.style.transform = 'scale(1.05) translateY(-2px)';
        });
    });
});
