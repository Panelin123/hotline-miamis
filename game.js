const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let keys = {};
let mouse = { x: 0, y: 0, clicked: false };
let gameStarted = false;
let gameOver = false;
let currentLevel = 1;
let enemies = [];

// Eventos de teclado e mouse
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});
canvas.addEventListener('mousedown', e => mouse.clicked = true);
canvas.addEventListener('mouseup', e => mouse.clicked = false);

// Classes
class Player {
  constructor() {
    this.x = canvas.width / 2;
    this.y = canvas.height / 2;
    this.radius = 15;
    this.speed = 3;
    this.angle = 0;
    this.health = 3;

    this.weapons = [
      new MeleeWeapon(this),
      new GunWeapon(this)
    ];
    this.currentWeaponIndex = 0;
    this.currentWeapon = this.weapons[this.currentWeaponIndex];
  }

  update() {
    // Movimento WASD
    if(keys['w']) this.y -= this.speed;
    if(keys['s']) this.y += this.speed;
    if(keys['a']) this.x -= this.speed;
    if(keys['d']) this.x += this.speed;

    // Limite da tela
    this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

    // Mira com mouse
    this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

    // Atirar
    if(mouse.clicked) {
      this.currentWeapon.shoot();
    }

    // Trocar arma (Q)
    if(keys['q']) {
      this.switchWeapon();
      keys['q'] = false; // Evita trocar várias vezes ao segurar
    }

    this.currentWeapon.update();
  }

  draw() {
    // Jogador
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = 'cyan';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    // Arma simples - um retângulo à frente
    ctx.fillStyle = 'yellow';
    ctx.fillRect(0, -5, 25, 10);
    ctx.restore();

    // Desenha arma atual (se tiver draw)
    if(this.currentWeapon && typeof this.currentWeapon.draw === 'function') {
      this.currentWeapon.draw();
    }

    // Barra de vida
    for(let i = 0; i < this.health; i++) {
      ctx.fillStyle = 'red';
      ctx.fillRect(10 + i*30, 10, 20, 20);
    }
  }

  switchWeapon() {
    this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weapons.length;
    this.currentWeapon = this.weapons[this.currentWeaponIndex];
  }

  takeDamage() {
    this.health--;
    if(this.health <= 0) {
      gameOver = true;
    }
  }
}

class Weapon {
  constructor(owner) {
    this.owner = owner;
  }
  shoot() {}
  update() {}
  draw() {}
}

class MeleeWeapon extends Weapon {
  constructor(owner) {
    super(owner);
    this.name = 'Facão';
    this.cooldown = 0;
    this.cooldownTime = 20; // frames
    this.range = 40;
    this.damage = 1;
  }

  update() {
    if(this.cooldown > 0) this.cooldown--;
  }

  shoot() {
    if(this.cooldown > 0) return;

    // Ataque corpo a corpo (hitbox em frente)
    const attackX = this.owner.x + Math.cos(this.owner.angle) * this.range;
    const attackY = this.owner.y + Math.sin(this.owner.angle) * this.range;

    enemies.forEach(e => {
      if(e.dead) return;
      const dist = Math.hypot(e.x - attackX, e.y - attackY);
      if(dist < this.range) {
        e.takeDamage(this.damage);
      }
    });

    this.cooldown = this.cooldownTime;
  }

  draw() {
    // Opcional: desenhar algo para corpo a corpo (por exemplo, um círculo vermelho curto alcance)
    ctx.save();
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.arc(this.owner.x + Math.cos(this.owner.angle)*this.range, this.owner.y + Math.sin(this.owner.angle)*this.range, this.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

class GunWeapon extends Weapon {
  constructor(owner) {
    super(owner);
    this.name = 'Pistola';
    this.cooldown = 0;
    this.cooldownTime = 15;
    this.bullets = [];
    this.bulletSpeed = 7;
    this.damage = 1;
  }

  update() {
    if(this.cooldown > 0) this.cooldown--;
    // Atualiza balas
    this.bullets.forEach(bullet => bullet.update());
    // Remove balas mortas
    this.bullets = this.bullets.filter(bullet => !bullet.dead);
  }

  shoot() {
    if(this.cooldown > 0) return;

    const bullet = new Bullet(
      this.owner.x + Math.cos(this.owner.angle)*20,
      this.owner.y + Math.sin(this.owner.angle)*20,
      this.owner.angle,
      this.bulletSpeed,
      this.damage
    );
    this.bullets.push(bullet);

    this.cooldown = this.cooldownTime;
  }

  draw() {
    // Desenha as balas
    this.bullets.forEach(bullet => bullet.draw());
  }
}

class Bullet {
  constructor(x, y, angle, speed, damage) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.damage = damage;
    this.radius = 5;
    this.dead = false;
  }

  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // Saiu da tela?
    if(this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
      this.dead = true;
      return;
    }

    // Colisão com inimigos
    enemies.forEach(e => {
      if(e.dead) return;
      const dist = Math.hypot(e.x - this.x, e.y - this.y);
      if(dist < e.radius + this.radius) {
        e.takeDamage(this.damage);
        this.dead = true;
      }
    });
  }

  draw() {
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 15;
    this.speed = 1.5;
    this.health = 2;
    this.dead = false;
  }

  update() {
    if(this.dead) return;

    // Move em direção ao jogador
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if(dist > 0) {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }

    // Colisão com jogador
    if(dist < this.radius + player.radius) {
      player.takeDamage();
      this.dead = true;
    }
  }

  takeDamage(dmg) {
    this.health -= dmg;
    if(this.health <= 0) {
      this.dead = true;
    }
  }

  draw() {
    if(this.dead) return;
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Funções do jogo
let player;

function spawnEnemies(level) {
  enemies = [];
  const count = level * 5;
  for(let i = 0; i < count; i++) {
    let x, y;
    // Spawn longe do player
    do {
      x = Math.random() * canvas.width;
      y = Math.random() * canvas.height;
    } while(Math.hypot(x - player.x, y - player.y) < 100);
    enemies.push(new Enemy(x, y));
  }
}

function resetGame() {
  player = new Player();
  spawnEnemies(currentLevel);
  gameOver = false;
}

function update() {
  if(!gameStarted || gameOver) return;

  player.update();

  enemies.forEach(e => e.update());

  // Verifica se venceu a fase
  if(enemies.every(e => e.dead)) {
    currentLevel++;
    spawnEnemies(currentLevel);
  }
}

function draw() {
  if(!gameStarted) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  player.draw();
  enemies.forEach(e => e.draw());

  if(gameOver) {
    ctx.fillStyle = 'white';
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', canvas.width/2, canvas.height/2);
    ctx.font = '24px sans-serif';
    ctx.fillText('Pressione R para reiniciar', canvas.width/2, canvas.height/2 + 40);
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Eventos adicionais
window.addEventListener('keydown', e => {
  if(gameOver && e.key.toLowerCase() === 'r') {
    resetGame();
  }
});

// Iniciar o jogo via botão no index.html
function startGame() {
  gameStarted = true;
  resetGame();
  document.getElementById('menu').classList.add('hidden');
  canvas.style.display = 'block';
}

// Exponha startGame para o HTML chamar
window.startGame = startGame;

gameLoop();
