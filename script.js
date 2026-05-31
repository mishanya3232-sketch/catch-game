const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

let score = 0;
let basket = {
    x: canvas.width / 2 - 50,
    y: canvas.height - 30,
    width: 100,
    height: 20,
    speed: 8,
    dx: 0
};

let fruits = [];
let fruitTypes = [
    { color: '#FF0000', radius: 15 }, // red
    { color: '#FFA500', radius: 15 }, // orange
    { color: '#FFFF00', radius: 15 }, // yellow
    { color: '#008000', radius: 15 }, // green
    { color: '#0000FF', radius: 15 }  // blue
];
let fruitFallSpeed = 3;
let spawnRate = 30; // frames between spawns
let frameCount = 0;

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') basket.dx = -basket.speed;
    if (e.key === 'ArrowRight') basket.dx = basket.speed;
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') basket.dx = 0;
});

// Update basket position
function updateBasket() {
    basket.x += basket.dx;
    // Prevent basket from going out of canvas
    if (basket.x < 0) basket.x = 0;
    if (basket.x + basket.width > canvas.width) basket.x = canvas.width - basket.width;
}

// Create a new fruit
function spawnFruit() {
    const type = fruitTypes[Math.floor(Math.random() * fruitTypes.length)];
    const fruit = {
        x: Math.random() * (canvas.width - type.radius * 2) + type.radius,
        y: -type.radius,
        radius: type.radius,
        color: type.color,
        speed: fruitFallSpeed + Math.random() * 2
    };
    fruits.push(fruit);
}

// Update fruits
function updateFruits() {
    for (let i = 0; i < fruits.length; i++) {
        const f = fruits[i];
        f.y += f.speed;

        // Check for collision with basket
        if (
            f.y + f.radius > basket.y &&
            f.y - f.radius < basket.y + basket.height &&
            f.x + f.radius > basket.x &&
            f.x - f.radius < basket.x + basket.width
        ) {
            score++;
            scoreElement.textContent = score;
            fruits.splice(i, 1);
            i--;
            continue;
        }

        // Remove fruit if it goes off screen (bottom)
        if (f.y - f.radius > canvas.height) {
            fruits.splice(i, 1);
            i--;
        }
    }
}

// Draw everything
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw basket
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(basket.x, basket.y, basket.width, basket.height);

    // Draw fruits
    for (const f of fruits) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fillStyle = f.color;
        ctx.fill();
        ctx.closePath();
    }
}

// Game loop
function gameLoop() {
    frameCount++;
    if (frameCount >= spawnRate) {
        spawnFruit();
        frameCount = 0;
    }

    updateBasket();
    updateFruits();
    draw();

    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();