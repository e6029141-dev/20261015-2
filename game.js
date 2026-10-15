const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreDisplay = document.getElementById('scoreDisplay');
        const stageDisplay = document.getElementById('stageDisplay');
        const hpDisplay = document.getElementById('hpDisplay');
        const powerDisplay = document.getElementById('powerDisplay');
        const stageOptions = document.getElementById('stageOptions');

        function loadHighestStage() {
            const savedStage = Number(localStorage.getItem('spaceShooterHighestStage'));
            return Number.isInteger(savedStage) && savedStage > 0 ? savedStage : 1;
        }

        let highestStageReached = loadHighestStage();
        
        let animationId;
        let gameActive = false;
        let score = 0;
        let currentStage = 1;
        let isStageTransition = false;
        let frameCount = 0;

        // Entities Arrays
        let projectiles = [];
        let enemies = [];
        let enemyProjectiles = [];
        let particles = [];
        let items = [];
        let stars = [];

        // Boss variables
        let boss = null;
        let bossActive = false;
        let bossProjectiles = [];
        let lastBossSpawnTime = 0;
        const bossInterval = 30000; // 30秒ごと

        let audioCtx;
        function initAudio() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        }

        function playSound(type) {
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            const now = audioCtx.currentTime;
            
            if (type === 'shoot') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
                gainNode.gain.setValueAtTime(0.05, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'enemyShoot') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.linearRampToValueAtTime(300, now + 0.15);
                gainNode.gain.setValueAtTime(0.05, now);
                gainNode.gain.linearRampToValueAtTime(0.001, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'explosion') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'powerup') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.setValueAtTime(600, now + 0.1);
                osc.frequency.setValueAtTime(800, now + 0.2);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.linearRampToValueAtTime(0.001, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);
            } else if (type === 'heal') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.setValueAtTime(900, now + 0.15);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.linearRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'shield') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.setValueAtTime(400, now + 0.1);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.linearRampToValueAtTime(0.001, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);
            } else if (type === 'damage') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.linearRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        }

        const player = {
            width: 30,
            height: 40,
            x: 0,
            y: 0,
            speed: 5,
            hp: 3,
            maxHp: 3,
            powerLevel: 1, // 1〜5
            lastShot: 0,
            invincibleUntil: 0,
            hasShield: false,
            isShooting: false,
            
            init() {
                this.x = canvas.width / 2 - this.width / 2;
                this.y = canvas.height - this.height - 50;
                this.hp = 3;
                this.powerLevel = 1;
                this.hasShield = false;
                this.invincibleUntil = 0;
                this.isShooting = false;
            },
            
            draw() {
                if (Date.now() < this.invincibleUntil && Math.floor(Date.now() / 100) % 2 === 0) {
                    return; 
                }
                
                ctx.save();
                ctx.translate(this.x + this.width/2, this.y + this.height/2);
                
                if (this.hasShield) {
                    ctx.beginPath();
                    ctx.arc(0, 0, this.width, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
                    ctx.fill();
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = 'rgba(96, 165, 250, 0.8)';
                    ctx.stroke();
                }

                ctx.shadowBlur = 10;
                ctx.shadowColor = '#3b82f6';
                
                if (this.isShooting) {
                    ctx.fillStyle = '#f97316';
                    ctx.beginPath();
                    ctx.moveTo(-6, this.height/2);
                    ctx.lineTo(0, this.height/2 + 10 + Math.random() * 8);
                    ctx.lineTo(6, this.height/2);
                    ctx.closePath();
                    ctx.fill();
                }

                ctx.fillStyle = '#1e3a8a';
                ctx.beginPath();
                ctx.moveTo(0, -this.height/4);
                ctx.lineTo(this.width/2 + 10, this.height/2 - 2);
                ctx.lineTo(this.width/2 + 5, this.height/2 + 5);
                ctx.lineTo(-this.width/2 - 5, this.height/2 + 5);
                ctx.lineTo(-this.width/2 - 10, this.height/2 - 2);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#60a5fa';
                ctx.beginPath();
                ctx.moveTo(0, -this.height/2);
                ctx.lineTo(10, 0);
                ctx.lineTo(12, this.height/2);
                ctx.lineTo(-12, this.height/2);
                ctx.lineTo(-10, 0);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#bae6fd';
                ctx.beginPath();
                ctx.ellipse(0, -5, 4, 8, 0, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            },
            
            update() {
                this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
                this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));
                
                if (this.isShooting && Date.now() - this.lastShot > 150 && !isStageTransition) {
                    this.shoot();
                    this.lastShot = Date.now();
                }
                
                this.draw();
            },
            
            shoot() {
                const cx = this.x + this.width / 2;
                const cy = this.y;
                const speed = 12;
                playSound('shoot');

                if (this.powerLevel === 1) {
                    projectiles.push(new Projectile(cx, cy, 0, -speed));
                } else if (this.powerLevel === 2) {
                    projectiles.push(new Projectile(cx - 8, cy, 0, -speed));
                    projectiles.push(new Projectile(cx + 8, cy, 0, -speed));
                } else if (this.powerLevel === 3) {
                    projectiles.push(new Projectile(cx, cy, 0, -speed));
                    projectiles.push(new Projectile(cx - 10, cy + 5, -2, -speed));
                    projectiles.push(new Projectile(cx + 10, cy + 5, 2, -speed));
                } else if (this.powerLevel === 4) {
                    projectiles.push(new Projectile(cx - 5, cy, 0, -speed));
                    projectiles.push(new Projectile(cx + 5, cy, 0, -speed));
                    projectiles.push(new Projectile(cx - 15, cy + 5, -3, -speed));
                    projectiles.push(new Projectile(cx + 15, cy + 5, 3, -speed));
                } else {
                    projectiles.push(new Projectile(cx, cy, 0, -speed));
                    projectiles.push(new Projectile(cx - 10, cy + 5, -1.5, -speed));
                    projectiles.push(new Projectile(cx + 10, cy + 5, 1.5, -speed));
                    projectiles.push(new Projectile(cx - 20, cy + 10, -4, -speed));
                    projectiles.push(new Projectile(cx + 20, cy + 10, 4, -speed));
                }
            }
        };

        function updatePlayerPos(clientX, clientY) {
            if (!gameActive) return;
            const rect = canvas.getBoundingClientRect();
            player.x = (clientX - rect.left) - player.width / 2;
            player.y = (clientY - rect.top) - player.height * 1.5; 
        }

        canvas.addEventListener('mousemove', (e) => updatePlayerPos(e.clientX, e.clientY));
        canvas.addEventListener('mousedown', (e) => {
            player.isShooting = true;
            updatePlayerPos(e.clientX, e.clientY);
        });
        canvas.addEventListener('mouseup', () => { player.isShooting = false; });
        canvas.addEventListener('mouseleave', () => { player.isShooting = false; });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            updatePlayerPos(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            player.isShooting = true;
            updatePlayerPos(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            player.isShooting = false;
        }, { passive: false });
        canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            player.isShooting = false;
        }, { passive: false });

        class Projectile {
            constructor(x, y, vx, vy) {
                this.x = x;
                this.y = y;
                this.vx = vx;
                this.vy = vy;
                this.radius = 4;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = '#fef08a';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#eab308';
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.draw();
            }
        }

        class EnemyProjectile {
            constructor(x, y, vx, vy) {
                this.x = x;
                this.y = y;
                this.vx = vx;
                this.vy = vy;
                this.radius = 4;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = '#ff9900'; 
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#ff9900';
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.draw();
            }
        }

        class BossProjectile {
            constructor(x, y, vx, vy) {
                this.x = x;
                this.y = y;
                this.vx = vx;
                this.vy = vy;
                this.radius = 6;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = '#ef4444';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#dc2626';
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.draw();
            }
        }

        class Enemy {
            constructor() {
                const extraSize = currentStage === 1 ? Math.random() * 20 + 40 : Math.random() * 20 + 20;
                this.width = extraSize;
                this.height = this.width;
                this.x = Math.random() * (canvas.width - this.width);
                this.y = -this.height;
                this.velocityY = (Math.random() * 1.5 + 1.0) + (currentStage * 0.2);
                this.vx = (Math.random() > 0.5 ? 2.5 : -2.5) + (currentStage * 0.1); 
                this.color = `hsl(${Math.random() * 360}, 70%, 60%)`;
                this.wobble = Math.random() * Math.PI * 2;
                
                this.points = Math.floor((60 - this.width) * 3); 

                this.canShoot = false;
                this.hasShot = false;
                if (currentStage >= 3) {
                    const shootProbability = Math.min(0.8, 0.2 + (currentStage - 3) * 0.15);
                    if (Math.random() < shootProbability) {
                        this.canShoot = true;
                        this.shootY = Math.random() * (canvas.height / 3) + 50; 
                    }
                }
            }
            draw() {
                ctx.save();
                ctx.translate(this.x + this.width/2, this.y + this.height/2);
                ctx.shadowBlur = 10;
                ctx.shadowColor = this.color;
                
                const shapeType = currentStage % 3;
                if (shapeType === 1) {
                    ctx.fillStyle = '#4b5563'; 
                    ctx.beginPath();
                    ctx.ellipse(0, 5, this.width/2, this.height/4, 0, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.fillStyle = this.color; 
                    ctx.beginPath();
                    ctx.ellipse(0, 0, this.width/2 + 2, this.height/5, 0, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.fillStyle = 'rgba(156, 163, 175, 0.8)'; 
                    ctx.beginPath();
                    ctx.arc(0, -5, this.width/3, Math.PI, 0);
                    ctx.fill();
                } else if (shapeType === 2) {
                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    ctx.moveTo(0, this.height/2); 
                    ctx.lineTo(-this.width/2, -this.height/4); 
                    ctx.lineTo(-this.width/4, -this.height/2);
                    ctx.lineTo(0, -this.height/4);
                    ctx.lineTo(this.width/4, -this.height/2);
                    ctx.lineTo(this.width/2, -this.height/4); 
                    ctx.closePath();
                    ctx.fill();
                    
                    ctx.fillStyle = '#1f2937'; 
                    ctx.beginPath();
                    ctx.moveTo(0, this.height/4);
                    ctx.lineTo(-5, -this.height/8);
                    ctx.lineTo(5, -this.height/8);
                    ctx.closePath();
                    ctx.fill();
                } else {
                    ctx.fillStyle = '#374151'; 
                    ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
                    
                    ctx.fillStyle = this.color; 
                    ctx.beginPath();
                    ctx.moveTo(-this.width/2, -this.height/2);
                    ctx.lineTo(this.width/2, -this.height/2);
                    ctx.lineTo(0, 0);
                    ctx.closePath();
                    ctx.fill();
                    
                    ctx.fillStyle = '#ef4444'; 
                    ctx.beginPath();
                    ctx.arc(0, this.height/4, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                ctx.restore();
            }
            update() {
                this.y += this.velocityY;
                
                const shapeType = currentStage % 3;
                if (shapeType === 1) {
                    this.x += Math.sin(Date.now() / 400 + this.wobble) * 1.5;
                } else if (shapeType === 2) {
                    this.x += Math.sin(Date.now() / 150 + this.wobble) * 6;
                    this.x = Math.max(0, Math.min(canvas.width - this.width, this.x)); 
                    this.y += 0.5; 
                } else {
                    this.x += this.vx;
                    if (this.x <= 0) {
                        this.x = 0;
                        this.vx *= -1;
                    }
                    if (this.x + this.width >= canvas.width) {
                        this.x = canvas.width - this.width;
                        this.vx *= -1;
                    }
                }

                if (this.canShoot && !this.hasShot && this.y > this.shootY) {
                    this.shoot();
                    this.hasShot = true;
                }

                this.draw();
            }

            shoot() {
                const cx = this.x + this.width / 2;
                const cy = this.y + this.height;
                const dx = (player.x + player.width / 2) - cx;
                const dy = (player.y + player.height / 2) - cy;
                const dist = Math.hypot(dx, dy);
                
                const speed = 3 + (currentStage * 0.5); 
                const vx = (dx / dist) * speed;
                const vy = (dy / dist) * speed;
                
                playSound('enemyShoot');
                enemyProjectiles.push(new EnemyProjectile(cx, cy, vx, vy));
            }
        }

        class Item {
            constructor(x, y, type) {
                this.x = x;
                this.y = y;
                this.width = 25;
                this.height = 25;
                this.vy = 2;
                this.type = type; // 'power', 'heal', 'shield'
            }
            draw() {
                ctx.save();
                ctx.translate(this.x + this.width/2, this.y + this.height/2);
                
                if (this.type === 'power') {
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#ef4444';
                    ctx.fillStyle = '#ef4444';
                    ctx.beginPath();
                    ctx.arc(0, 0, 12, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 16px Inter';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('P', 0, 1);
                } else if (this.type === 'heal') {
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#22c55e';
                    ctx.fillStyle = '#22c55e';
                    ctx.beginPath();
                    ctx.arc(0, 0, 12, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 14px Inter';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('♥', 0, 1);
                } else if (this.type === 'shield') {
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = '#3b82f6';
                    ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
                    ctx.beginPath();
                    ctx.arc(0, 0, 14, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#60a5fa';
                    ctx.stroke();
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 14px Inter';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('S', 0, 1);
                }
                
                ctx.restore();
            }
            update() {
                this.y += this.vy;
                this.draw();
            }
        }

        class Boss {
            constructor() {
                this.width = 120;
                this.height = 80;
                this.x = canvas.width / 2 - this.width / 2;
                this.y = -this.height;
                this.targetY = 50;
                this.vx = 2 + (currentStage * 0.5);
                this.hp = 50 + (currentStage * 20);
                this.maxHp = this.hp;
                this.lastShot = Date.now();
                this.color = '#ef4444';
            }
            draw() {
                ctx.save();
                ctx.translate(this.x + this.width/2, this.y + this.height/2);
                ctx.shadowBlur = 20;
                ctx.shadowColor = this.color;
                
                ctx.fillStyle = '#1f2937';
                ctx.beginPath();
                ctx.moveTo(-this.width/2, -this.height/2);
                ctx.lineTo(this.width/2, -this.height/2);
                ctx.lineTo(this.width/2 - 20, this.height/2);
                ctx.lineTo(-this.width/2 + 20, this.height/2);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(-this.width/2 + 10, -this.height/2);
                ctx.lineTo(this.width/2 - 10, -this.height/2);
                ctx.lineTo(0, this.height/4);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#4b5563';
                ctx.fillRect(-this.width/2 - 10, -this.height/4, 20, this.height/1.5);
                ctx.fillRect(this.width/2 - 10, -this.height/4, 20, this.height/1.5);

                ctx.fillStyle = '#fef08a';
                ctx.beginPath();
                ctx.arc(0, this.height/6, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, this.height/6, 6, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
                
                ctx.fillStyle = 'rgba(255,0,0,0.3)';
                ctx.fillRect(this.x, this.y - 15, this.width, 10);
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(this.x, this.y - 15, this.width * (this.hp / this.maxHp), 10);
            }
            update() {
                if (this.y < this.targetY) {
                    this.y += 2;
                } else {
                    this.x += this.vx;
                    if (this.x <= 0 || this.x + this.width >= canvas.width) {
                        this.vx *= -1;
                    }
                    
                    const shootInterval = Math.max(500, 1500 - (currentStage * 100));
                    if (Date.now() - this.lastShot > shootInterval) {
                        this.shoot();
                        this.lastShot = Date.now();
                    }
                }
                this.draw();
            }
            shoot() {
                const cx = this.x + this.width / 2;
                const cy = this.y + this.height;
                const speed = 5 + currentStage;
                playSound('enemyShoot');
                
                if (currentStage % 2 === 1) {
                    bossProjectiles.push(new BossProjectile(cx, cy, 0, speed));
                    bossProjectiles.push(new BossProjectile(cx, cy, -2, speed));
                    bossProjectiles.push(new BossProjectile(cx, cy, 2, speed));
                } else {
                    const dx = (player.x + player.width/2) - cx;
                    const dy = (player.y + player.height/2) - cy;
                    const dist = Math.hypot(dx, dy);
                    bossProjectiles.push(new BossProjectile(cx, cy, (dx/dist)*speed, (dy/dist)*speed));
                    bossProjectiles.push(new BossProjectile(cx, cy, -3, speed*0.8));
                    bossProjectiles.push(new BossProjectile(cx, cy, 3, speed*0.8));
                }
            }
        }

        class Particle {
            constructor(x, y, color) {
                this.x = x;
                this.y = y;
                this.vx = (Math.random() - 0.5) * 8;
                this.vy = (Math.random() - 0.5) * 8;
                this.radius = Math.random() * 3 + 1;
                this.color = color;
                this.life = 1.0;
            }
            draw() {
                ctx.globalAlpha = this.life;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.life -= 0.02;
                this.draw();
            }
        }

        function createExplosion(x, y, color, count = 15) {
            playSound('explosion');
            for (let i = 0; i < count; i++) {
                particles.push(new Particle(x, y, color));
            }
        }

        function spawnItemFromEnemy(x, y) {
            const dropRate = currentStage === 1 ? 0.075 : 0.035;
            if (Math.random() > dropRate) return;

            let rand = Math.random();
            let type = 'power';
            
            if (currentStage === 1) {
                if (rand > 0.90) type = 'shield';
                else if (rand > 0.80) type = 'heal';
                else type = 'power';
            } else {
                if (rand > 0.75) type = 'shield';
                else if (rand > 0.50) type = 'heal';
                else type = 'power';
            }
            
            items.push(new Item(x, y, type));
        }

        function updateUI() {
            scoreDisplay.innerText = score;
            stageDisplay.innerText = currentStage;
            powerDisplay.innerText = `POWER: ${player.powerLevel}`;
            
            let hpString = '';
            for(let i=0; i<player.hp; i++) hpString += '♥';
            hpDisplay.innerText = hpString;
            
            if (player.hp === 1) {
                hpDisplay.classList.add('hp-warning');
            } else {
                hpDisplay.classList.remove('hp-warning');
            }
        }

        function damagePlayer() {
            if (Date.now() < player.invincibleUntil) return;

            if (player.hasShield) {
                player.hasShield = false;
                player.invincibleUntil = Date.now() + 1500;
                playSound('shieldBreak');
                createExplosion(player.x + player.width/2, player.y + player.height/2, '#60a5fa', 20);
                return;
            }

            player.hp--;
            player.powerLevel = Math.max(1, player.powerLevel - 1);
            player.invincibleUntil = Date.now() + 1500;
            playSound('damage');
            
            createExplosion(player.x + player.width/2, player.y + player.height/2, '#ff4444', 30);
            updateUI();

            if (player.hp <= 0) {
                gameActive = false;
                document.getElementById('gameOverScreen').classList.remove('hidden');
                document.getElementById('finalScore').innerText = score;
            }
        }

        function handleStageClear() {
            isStageTransition = true;
            boss = null; 
            bossActive = false;
            bossProjectiles = [];
            enemyProjectiles = [];
            
            const clearScreen = document.getElementById('stageClearScreen');
            clearScreen.classList.remove('hidden');
            
            setTimeout(() => {
                clearScreen.classList.add('hidden');
                setTimeout(() => {
                    if (!gameActive) return;
                    currentStage++;
                    saveHighestStage(currentStage);
                    isStageTransition = false;
                    lastBossSpawnTime = performance.now();
                    updateUI();
                }, 1500);
            }, 2000);
        }

        function animate(currentTime) {
            if (!gameActive) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            frameCount++;

            if (Math.random() < 0.2) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: 0,
                    size: Math.random() * 2,
                    speed: Math.random() * 3 + 1
                });
            }
            for (let i = stars.length - 1; i >= 0; i--) {
                const s = stars[i];
                s.y += s.speed;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillRect(s.x, s.y, s.size, s.size);
                if (s.y > canvas.height) stars.splice(i, 1);
            }

            player.update();

            for (let i = projectiles.length - 1; i >= 0; i--) {
                projectiles[i].update();
                if (projectiles[i].y < 0) projectiles.splice(i, 1);
            }

            for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
                const ep = enemyProjectiles[i];
                ep.update();
                
                if (ep.x > player.x && ep.x < player.x + player.width &&
                    ep.y > player.y && ep.y < player.y + player.height) {
                    damagePlayer();
                    enemyProjectiles.splice(i, 1);
                    continue;
                }
                
                if (ep.y > canvas.height || ep.x < 0 || ep.x > canvas.width || ep.y < 0) {
                    enemyProjectiles.splice(i, 1);
                }
            }

            if (!isStageTransition && !bossActive) {
                const spawnChance = currentStage === 1 ? 0.01 : 0.015 + (currentStage * 0.005);
                if (Math.random() < spawnChance) {
                    enemies.push(new Enemy());
                }

                if (currentTime - lastBossSpawnTime > bossInterval && !boss) {
                    bossActive = true;
                    boss = new Boss();
                }
            }

            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                enemy.update();

                if (player.x < enemy.x + enemy.width &&
                    player.x + player.width > enemy.x &&
                    player.y < enemy.y + enemy.height &&
                    player.y + player.height > enemy.y) {
                    damagePlayer();
                    createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color);
                    enemies.splice(i, 1);
                    continue;
                }

                let enemyDestroyed = false;
                for (let j = projectiles.length - 1; j >= 0; j--) {
                    const p = projectiles[j];
                    if (p.x > enemy.x && p.x < enemy.x + enemy.width &&
                        p.y > enemy.y && p.y < enemy.y + enemy.height) {
                        
                        score += enemy.points;
                        createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color);
                        spawnItemFromEnemy(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
                        
                        enemies.splice(i, 1);
                        projectiles.splice(j, 1);
                        enemyDestroyed = true;
                        updateUI();
                        break;
                    }
                }
                
                if (enemyDestroyed) continue;

                if (enemy.y > canvas.height) {
                    enemies.splice(i, 1);
                }
            }

            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i];
                item.update();
                
                if (item.x + item.width > player.x && item.x < player.x + player.width &&
                    item.y + item.height > player.y && item.y < player.y + player.height) {
                    
                    if (item.type === 'power') {
                        if (player.powerLevel < 5) {
                            player.powerLevel++;
                            score += 100;
                        } else {
                            score += 1000;
                        }
                        playSound('powerup');
                    } else if (item.type === 'heal') {
                        player.hp = Math.min(player.maxHp, player.hp + 1);
                        score += 50;
                        playSound('heal');
                    } else if (item.type === 'shield') {
                        player.hasShield = true;
                        score += 50;
                        playSound('shield');
                    }
                    
                    updateUI();
                    items.splice(i, 1);
                    continue;
                }
                
                if (item.y > canvas.height) {
                    items.splice(i, 1);
                }
            }

            if (bossActive && boss) {
                boss.update();
                
                for (let j = projectiles.length - 1; j >= 0; j--) {
                    const p = projectiles[j];
                    if (p.x > boss.x && p.x < boss.x + boss.width &&
                        p.y > boss.y && p.y < boss.y + boss.height) {
                        
                        boss.hp--;
                        projectiles.splice(j, 1);
                        createExplosion(p.x, p.y, '#ffffff', 3);
                        
                        if (boss.hp <= 0) {
                            score += 1000 * currentStage;
                            createExplosion(boss.x + boss.width/2, boss.y + boss.height/2, '#ef4444', 100);
                            createExplosion(boss.x, boss.y, '#ffaa00', 50);
                            createExplosion(boss.x + boss.width, boss.y + boss.height, '#ffaa00', 50);
                            updateUI();
                            handleStageClear();
                            break; 
                        }
                    }
                }

                if (boss && player.x < boss.x + boss.width &&
                    player.x + player.width > boss.x &&
                    player.y < boss.y + boss.height &&
                    player.y + player.height > boss.y) {
                    damagePlayer();
                }
            }

            for (let i = bossProjectiles.length - 1; i >= 0; i--) {
                const bp = bossProjectiles[i];
                bp.update();
                
                if (bp.x > player.x && bp.x < player.x + player.width &&
                    bp.y > player.y && bp.y < player.y + player.height) {
                    damagePlayer();
                    bossProjectiles.splice(i, 1);
                    continue;
                }
                
                if (bp.y > canvas.height || bp.x < 0 || bp.x > canvas.width) {
                    bossProjectiles.splice(i, 1);
                }
            }

            for (let i = particles.length - 1; i >= 0; i--) {
                particles[i].update();
                if (particles[i].life <= 0) particles.splice(i, 1);
            }

            animationId = requestAnimationFrame(animate);
        }

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            if (player) {
                player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
                player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
            }
        }
        window.addEventListener('resize', resize);

        function saveHighestStage(stage) {
            if (stage <= highestStageReached) return;
            highestStageReached = stage;
            localStorage.setItem('spaceShooterHighestStage', String(highestStageReached));
            renderStageOptions();
        }

        function renderStageOptions() {
            stageOptions.replaceChildren();
            for (let stage = 1; stage <= highestStageReached + 1; stage++) {
                const isUnlocked = stage <= highestStageReached;
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'stage-option';
                button.textContent = isUnlocked ? `STAGE ${stage}` : `STAGE ${stage} - LOCKED`;
                button.disabled = !isUnlocked;
                if (isUnlocked) button.addEventListener('click', () => startGame(stage));
                stageOptions.append(button);
            }
        }

        function openStageSelect() {
            renderStageOptions();
            document.getElementById('startScreen').classList.add('hidden');
            document.getElementById('stageSelectScreen').classList.remove('hidden');
        }

        function closeStageSelect() {
            document.getElementById('stageSelectScreen').classList.add('hidden');
            document.getElementById('startScreen').classList.remove('hidden');
        }

        function startGame(startStage = 1) {
            initAudio();
            resize();
            
            document.getElementById('startScreen').classList.add('hidden');
            document.getElementById('stageSelectScreen').classList.add('hidden');
            document.getElementById('gameOverScreen').classList.add('hidden');
            
            cancelAnimationFrame(animationId);
            
            player.init();
            projectiles = [];
            enemies = [];
            enemyProjectiles = [];
            particles = [];
            items = [];
            stars = [];
            boss = null;
            bossActive = false;
            bossProjectiles = [];
            isStageTransition = false;
            
            score = 0;
            currentStage = startStage;
            saveHighestStage(currentStage);
            frameCount = 0;
            lastBossSpawnTime = performance.now();
            gameActive = true;
            
            updateUI();
            animationId = requestAnimationFrame(animate);
        }

        renderStageOptions();
        resize();
