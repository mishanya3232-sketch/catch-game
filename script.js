const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');

// Resize canvas to container width, keep aspect ratio
function resizeCanvas() {
    const container = document.getElementById('game-container');
    const width = container.clientWidth;
    const height = width * 0.6; // 5:3 aspect
    canvas.width = width;
    canvas.height = height;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Game constants
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 20;
const PADDLE_SPEED = 8;
const ITEM_SIZE = 40;
const ITEM_SPEED_START = 2;
const ITEM_SPEED_INCREMENT = 0.001;
const SPAWN_INTERVAL_START = 800; // ms
const SPAWN_INTERVAL_MIN = 200;

// Game state
let paddleX = (canvas.width - PADDLE_WIDTH) / 2;
let lives = 3;
let score = 0;
let gameOver = false;
let lastSpawn = 0;
let itemSpeed = ITEM_SPEED_START;
let spawnInterval = SPAWN_INTERVAL_START;
let items = [];

// Input
const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; });
window.addEventListener('keyup', e => { keys[e.key] = false; });
// Touch support
let touchStartX = null;
canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
    }
}, { passive: true });
canvas.addEventListener('touchmove', e => {
    if (!touchStartX) return;
    const touchX = e.touches[0].clientX;
    const delta = touchX - touchStartX;
    paddleX += delta * 0.5; // sensitivity
    touchStartX = touchX;
    // clamp paddle
    if (paddleX < 0) paddleX = 0;
    if (paddleX > canvas.width - PADDLE_WIDTH) paddleX = canvas.width - PADDLE_WIDTH;
}, { passive: true });
canvas.addEventListener('touchend', () => { touchStartX = null; }, { passive: true });

// Item types
const ITEM_TYPES = [
    {type: 'mdf', color: '#8B4513', points: 10}, // brown MDF
    {type: 'glass', color: '#ff4136', points: -20}, // red glass (penalty)
    {type: 'scratch', color: '#ffdc00', points: -5} // yellow scratch
];

function spawnItem() {
    const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
    items.push({
        x: Math.random() * (canvas.width - ITEM_SIZE),
        y: -ITEM_SIZE,
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        ...type
    });
}

function update() {
    if (gameOver) return;

    // Paddle movement
    if (keys['ArrowLeft'] || keys['a']) paddleX -= PADDLE_SPEED;
    if (keys['ArrowRight'] || keys['d']) paddleX += PADDLE_SPEED;
    // clamp paddle
    if (paddleX < 0) paddleX = 0;
    if (paddleX > canvas.width - PADDLE_WIDTH) paddleX = canvas.width - PADDLE_WIDTH;

    // Spawn items
    const now = Date.now();
    if (now - lastSpawn > spawnInterval) {
        spawnItem();
        lastSpawn = now;
        // gradually increase difficulty
        itemSpeed += ITEM_SPEED_INCREMENT;
        spawnInterval = Math.max(SPAWN_INTERVAL_MIN, spawnInterval * 0.995);
    }

    // Update items
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.y += itemSpeed;

        // Check collision with paddle
        if (
            item.y + item.height >= canvas.height - PADDLE_HEIGHT &&
            item.x < paddleX + PADDLE_WIDTH &&
            item.x + item.width > paddleX &&
            item.y < canvas.height
        ) {
            // caught
            if (item.type === 'mdf') {
                score += item.points;
            } else {
                // penalty items reduce lives
                lives--;
                if (lives <= 0) {
                    gameOver = true;
                }
            }
            scoreEl.textContent = score;
            livesEl.textContent = lives;
            items.splice(i, 1);
            continue;
        }

        // Remove if off screen (missed)
        if (item.y > canvas.height) {
            // missed MDF reduces lives? maybe not; only penalize if missed MDF? We'll treat missed MDF as no penalty.
            if (item.type === 'mdf') {
                // missed MDF: no penalty, just ignore
            } else {
                // missed penalty? no effect
            }
            items.splice(i, 1);
        }
    }

    // Clear and draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Paddle
    ctx.fillStyle = '#ffeb3b'; // yellow paddle
    ctx.fillRect(paddleX, canvas.height - PADDLE_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT);
    // Items
    items.forEach(item => {
        ctx.fillStyle = item.color;
        ctx.fillRect(item.x, item.y, item.width, item.height);
    });
}

function gameLoop() {
    update();
    if (!gameOver) {
        requestAnimationFrame(gameLoop);
    } else {
        // Game over screen
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Игра окончена', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '18px Arial';
        ctx.fillText(`Счёт: ${score}`, canvas.width / 2, canvas.height / 2 + 10);
        ctx.fillText('Нажмите R для рестарта', canvas.width / 2, canvas.height / 2 + 40);
    }
}

// Restart on key R
window.addEventListener('keypress', e => {
    if (e.key.toLowerCase() === 'r' && gameOver) {
        // reset
        lives = 3;
        score = 0;
        gameOver = false;
        items = [];
        paddleX = (canvas.width - PADDLE_WIDTH) / 2;
        itemSpeed = ITEM_SPEED_START;
        spawnInterval = SPAWN_INTERVAL_START;
        lastSpawn = Date.now();
        scoreEl.textContent = score;
        livesEl.textContent = lives;
        gameLoop();
    }
});

// Start
gameLoop();