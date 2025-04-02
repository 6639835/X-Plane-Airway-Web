// X-Plane Airway Converter - Main JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize background animations and effects
    initRadarAnimation();
    initAlertSystem();
    initParticleSystem();
    
    // Set up global event handlers for UI interactions
    setupTooltips();
    setupButtonEffects();
    
    // File input visualization
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    // Maximum file size (in bytes) - 20MB default limit 
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    
    fileInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const fileName = file?.name;
            const fileLabel = e.target.parentElement.querySelector('.form-label');
            const dropzone = e.target.closest('.dropzone');
            
            if (file) {
                // Check file size
                if (file.size > MAX_FILE_SIZE) {
                    // Show error
                    const errorMessage = `File too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`;
                    
                    // Create alert container if not exists
                    let alertContainer = document.querySelector('.file-size-alerts');
                    if (!alertContainer) {
                        alertContainer = document.createElement('div');
                        alertContainer.className = 'file-size-alerts';
                        document.querySelector('.card-body').prepend(alertContainer);
                    }
                    
                    // Add alert message
                    const alert = document.createElement('div');
                    alert.className = 'alert alert-danger';
                    alert.innerHTML = `
                        <div class="alert-icon">
                            <i class="bi bi-exclamation-triangle-fill"></i>
                        </div>
                        <div class="alert-content">
                            <div class="alert-title">File Size Error</div>
                            <p class="alert-message">${errorMessage}</p>
                        </div>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="Close"></button>
                    `;
                    alertContainer.appendChild(alert);
                    
                    // Reset the file input
                    e.target.value = '';
                    if (dropzone) {
                        dropzone.classList.remove('file-selected');
                        dropzone.classList.add('shake');
                        dropzone.style.borderColor = 'var(--danger)';
                        
                        setTimeout(() => {
                            dropzone.classList.remove('shake');
                            setTimeout(() => {
                                dropzone.style.borderColor = '';
                            }, 500);
                        }, 820);
                    }
                    
                    // Initialize alert system for new alert
                    const closeBtn = alert.querySelector('.btn-close');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => {
                            alert.style.opacity = '0';
                            alert.style.transform = 'translateY(-10px)';
                            
                            setTimeout(() => {
                                alert.remove();
                            }, 300);
                        });
                    }
                    
                    return;
                }
                
                fileLabel.textContent = fileName;
                e.target.parentElement.classList.add('file-selected');
            } else {
                fileLabel.textContent = e.target.getAttribute('data-default-text') || 
                                       e.target.parentElement.querySelector('.form-label').dataset.defaultText;
                e.target.parentElement.classList.remove('file-selected');
            }
        });
    });
    
    // Store original label texts
    fileInputs.forEach(input => {
        const label = input.parentElement.querySelector('.form-label');
        label.dataset.defaultText = label.textContent;
    });
    
    // Add some visual effects to alert messages
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        // Animate alerts in
        setTimeout(() => {
            alert.style.transition = 'all 0.3s ease';
            alert.style.transform = 'translateY(0)';
            alert.style.opacity = '1';
        }, 100);
        
        // Auto-dismiss after 7 seconds
        if (!alert.classList.contains('alert-danger')) {
            setTimeout(() => {
                alert.classList.remove('show');
                setTimeout(() => {
                    alert.remove();
                }, 150);
            }, 7000);
        }
    });
    
    // Initialize wave animation on page load
    initWaveAnimation();
    
    // Add airplane animation
    addAirplaneAnimation();
    
    // Form submission handling
    const conversionForm = document.querySelector('form[action*="convert"]');
    
    if (conversionForm) {
        conversionForm.addEventListener('submit', function(e) {
            // Only if the form is valid
            if (conversionForm.checkValidity()) {
                const submitBtn = conversionForm.querySelector('button[type="submit"]');
                
                if (submitBtn) {
                    // Change button text and disable
                    const originalText = submitBtn.innerHTML;
                    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';
                    submitBtn.disabled = true;
                    
                    // If submission takes more than 10 seconds, show a progress message
                    setTimeout(() => {
                        if (submitBtn.disabled) {
                            const processingMsg = document.createElement('div');
                            processingMsg.className = 'alert alert-info mt-3';
                            processingMsg.innerHTML = '<i class="bi bi-info-circle me-2"></i>Processing large files may take a few moments. Please wait...';
                            
                            const formParent = conversionForm.parentElement;
                            if (!formParent.querySelector('.alert-info')) {
                                formParent.appendChild(processingMsg);
                            }
                        }
                    }, 10000);
                }
            }
        });
    }
});

// Initialize radar animation with randomly positioned blips
function initRadarAnimation() {
    const radar = document.querySelector('.radar-container');
    if (!radar) return;
    
    // Create additional blips dynamically
    for (let i = 0; i < 5; i++) {
        const blip = document.createElement('div');
        blip.className = 'radar-blip';
        
        // Random position within the radar 
        const x = Math.floor(Math.random() * 60 - 30);
        const y = Math.floor(Math.random() * 60 - 30);
        
        blip.style.setProperty('--x', x);
        blip.style.setProperty('--y', y);
        blip.style.animationDelay = (Math.random() * 5) + 's';
        
        radar.appendChild(blip);
    }
}

// Setup tooltip functionality
function setupTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Add animation and interaction effects to buttons
function setupButtonEffects() {
    const buttons = document.querySelectorAll('.btn');
    
    buttons.forEach(button => {
        // Add hover effect with sound
        button.addEventListener('mouseenter', () => {
            playSound('hover');
        });
        
        // Add click effect
        button.addEventListener('click', () => {
            playSound('click');
            
            const ripple = document.createElement('span');
            ripple.className = 'btn-ripple';
            
            button.appendChild(ripple);
            
            // Remove ripple after animation completes
            setTimeout(() => {
                ripple.remove();
            }, 1000);
        });
    });
}

// Enhanced alert system with animations
function initAlertSystem() {
    const alerts = document.querySelectorAll('.alert');
    
    alerts.forEach(alert => {
        // Add close button functionality
        const closeBtn = alert.querySelector('.btn-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                alert.style.opacity = '0';
                alert.style.transform = 'translateY(-10px)';
                
                setTimeout(() => {
                    alert.remove();
                }, 300);
            });
        }
        
        // Auto-dismiss non-error alerts
        if (!alert.classList.contains('alert-danger')) {
            setTimeout(() => {
                alert.style.opacity = '0';
                alert.style.transform = 'translateY(-10px)';
                
                setTimeout(() => {
                    alert.remove();
                }, 300);
            }, 8000);
        }
    });
}

// Create floating particle effect for aviation theme
function initParticleSystem() {
    const container = document.querySelector('.app-container');
    if (!container) return;
    
    // Create particle container
    const particleContainer = document.createElement('div');
    particleContainer.className = 'particle-container';
    particleContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
        overflow: hidden;
    `;
    
    container.appendChild(particleContainer);
    
    // Create particles
    for (let i = 0; i < 20; i++) {
        createParticle(particleContainer);
    }
}

// Create a single floating particle
function createParticle(container) {
    const particle = document.createElement('div');
    
    // Random particle type (dot or small airplane icon)
    const isPlane = Math.random() > 0.7;
    
    if (isPlane) {
        particle.innerHTML = '<i class="bi bi-airplane-fill"></i>';
        particle.className = 'floating-plane';
        particle.style.cssText = `
            position: absolute;
            color: rgba(99, 102, 241, 0.1);
            font-size: ${Math.random() * 14 + 8}px;
            transform: rotate(${Math.random() * 360}deg);
        `;
    } else {
        particle.className = 'floating-dot';
        particle.style.cssText = `
            position: absolute;
            background-color: rgba(99, 102, 241, ${Math.random() * 0.1 + 0.05});
            width: ${Math.random() * 4 + 2}px;
            height: ${Math.random() * 4 + 2}px;
            border-radius: 50%;
            box-shadow: 0 0 ${Math.random() * 4 + 2}px rgba(99, 102, 241, 0.3);
        `;
    }
    
    // Set random position
    const startX = Math.random() * 100;
    const startY = Math.random() * 100;
    
    particle.style.left = `${startX}vw`;
    particle.style.top = `${startY}vh`;
    
    // Set animation
    const duration = Math.random() * 120 + 80;
    const delay = Math.random() * 40;
    
    particle.style.animation = `float ${duration}s ease-in-out ${delay}s infinite`;
    
    // Add to container
    container.appendChild(particle);
    
    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes float {
            0%, 100% {
                transform: translate(0, 0) ${isPlane ? `rotate(${Math.random() * 360}deg)` : ''};
                opacity: ${Math.random() * 0.5 + 0.3};
            }
            25% {
                transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px) ${isPlane ? `rotate(${Math.random() * 360}deg)` : ''};
            }
            50% {
                transform: translate(${Math.random() * 200 - 100}px, ${Math.random() * 100 - 50}px) ${isPlane ? `rotate(${Math.random() * 360}deg)` : ''};
                opacity: ${Math.random() * 0.5 + 0.5};
            }
            75% {
                transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 200 - 100}px) ${isPlane ? `rotate(${Math.random() * 360}deg)` : ''};
            }
        }
    `;
    
    document.head.appendChild(style);
}

// Play UI sound effects (disabled by default, can be enabled in settings)
function playSound(type) {
    // Check user preference (disabled by default)
    const soundEnabled = localStorage.getItem('sound_enabled') === 'true';
    if (!soundEnabled) return;
    
    let sound;
    
    switch (type) {
        case 'hover':
            sound = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAuLi4uLi4uLi4uLi4uLi4uLjV1dXV1dXV1dXV1dXV1dXV1fLy8vLy8vLy8vLy8vLy8vLy////////////AAAAOExhdmM1OC4xMy4xMDAAAAAAAAAAAAAAACQCgAAAAAAAAAGwoM7hzQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+MYxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxDsAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
            sound.volume = 0.1;
            break;
        case 'click':
            sound = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAeAANjY2NjY2NjY2NjY2NjY2NjZNTU1NTU1NTU1NTU1NTU1NTWpqampqampqampqampqamqGhoaGhoaGhoaGhoaGhoaGhv///////////wAAAA5MYXZjNTguMTMuMTAwAAAAAAAAAAAAAAD/4zLEAAAA/gAAABBJbmZvAAAADwAAAAMAAAUwADIyMjIyMjIyMjIyMjIyMjIyMjI+Pj4+Pj4+Pj4+Pj4+Pj4+PlRUVFRUVFRUVFRUVFRUVFRUaGhoaGhoaGhoaGhoaGhoaGj/4zLEIQAAAf4AAAAw///////////+AAAADkxhdmM1OC4xMy4xMDAAAAAAAAAAAAAAACQDgAAAAAAAAAUw4O6vi4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/4xjEBQAAAZkAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjEIQAAAZkAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=');
            sound.volume = 0.2;
            break;
    }
    
    if (sound) {
        sound.play().catch(err => {
            console.log('Audio playback prevented: ' + err);
        });
    }
}

// Create a gentle wave animation in the background
function initWaveAnimation() {
    const waveSvg = document.createElement('div');
    waveSvg.className = 'wave-container';
    waveSvg.innerHTML = `
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path class="wave-path-1" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
            <path class="wave-path-2" d="M0,224L48,213.3C96,203,192,181,288,154.7C384,128,480,96,576,106.7C672,117,768,171,864,181.3C960,192,1056,160,1152,149.3C1248,139,1344,149,1392,154.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
    `;
    
    // Add CSS for the waves
    const style = document.createElement('style');
    style.textContent = `
        .wave-container {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 15vh;
            pointer-events: none;
            z-index: -1;
        }
        .wave-container svg {
            width: 100%;
            height: 100%;
        }
        .wave-path-1 {
            fill: rgba(52, 152, 219, 0.05);
            animation: wave1 15s ease-in-out infinite alternate;
        }
        .wave-path-2 {
            fill: rgba(52, 152, 219, 0.03);
            animation: wave2 20s ease-in-out infinite alternate;
        }
        @keyframes wave1 {
            from { transform: translateX(-5%); }
            to { transform: translateX(5%); }
        }
        @keyframes wave2 {
            from { transform: translateX(5%); }
            to { transform: translateX(-5%); }
        }
    `;
    
    document.body.appendChild(style);
    document.body.appendChild(waveSvg);
}

// Add animated airplane that follows mouse
function addAirplaneAnimation() {
    const airplane = document.createElement('div');
    airplane.className = 'animated-airplane';
    airplane.innerHTML = '<i class="bi bi-airplane-fill"></i>';
    
    // Add CSS for the airplane
    const style = document.createElement('style');
    style.textContent = `
        .animated-airplane {
            position: fixed;
            font-size: 1.5rem;
            color: rgba(52, 152, 219, 0.6);
            pointer-events: none;
            z-index: 1000;
            transform: rotate(-45deg);
            transition: left 1s cubic-bezier(0.1, 0.8, 0.2, 1), 
                       top 1s cubic-bezier(0.1, 0.8, 0.2, 1);
            filter: drop-shadow(0 0 10px rgba(52, 152, 219, 0.4));
            opacity: 0;
        }
        
        .airplane-visible {
            opacity: 1;
        }
        
        .animated-airplane:after {
            content: '';
            position: absolute;
            width: 20px;
            height: 3px;
            background: linear-gradient(90deg, rgba(52, 152, 219, 0.6), transparent);
            top: 50%;
            right: 100%;
            transform: translateY(-50%);
        }
    `;
    
    document.body.appendChild(style);
    document.body.appendChild(airplane);
    
    // Only activate on non-touch devices
    if (!('ontouchstart' in window)) {
        let timeout;
        let isVisible = false;
        
        document.addEventListener('mousemove', e => {
            if (!isVisible) {
                airplane.classList.add('airplane-visible');
                isVisible = true;
            }
            
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                airplane.classList.remove('airplane-visible');
                isVisible = false;
            }, 3000);
            
            // Position airplane with slight delay for smooth effect
            setTimeout(() => {
                airplane.style.left = (e.clientX + 15) + 'px';
                airplane.style.top = (e.clientY - 15) + 'px';
            }, 100);
        });
    }
}

// Format file size in human-readable format
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 