// 获取 Canvas 元素和 2D 绘图上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 游戏状态变量 ---
let player = {
    x: canvas.width / 2,
    y: canvas.height - 30,
    width: 60,
    height: 10,
    color: '#007BFF',
    speed: 5
};

let bullets = [];
let enemies = [];
let score = 0;
let keys = {}; // 用于存储当前按下的键

const ENEMY_SPAWN_RATE = 60; // 每 60 帧生成一个敌人
let spawnCounter = 0;

// --- 键盘输入处理 ---
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    // 按下空格键立即尝试发射子弹 (如果允许)
    if (e.key === ' ') {
        fireBullet();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// --- 游戏对象行为 ---

function fireBullet() {
    // 限制发射速度
    if (bullets.length < 5) { 
        bullets.push({
            x: player.x,
            y: player.y - player.height / 2,
            radius: 3,
            color: 'yellow',
            speed: 7
        });
    }
}

function spawnEnemy() {
    enemies.push({
        x: Math.random() * (canvas.width - 40) + 20, // 随机生成 X 坐标
        y: 0,
        width: 30,
        height: 20,
        color: 'red',
        speed: Math.random() * 1.5 + 0.5 // 随机速度
    });
}

// --- 游戏更新逻辑 ---

function updatePlayer() {
    // 处理左右移动
    if (keys['ArrowLeft'] || keys['a']) {
        player.x -= player.speed;
    }
    if (keys['ArrowRight'] || keys['d']) {
        player.x += player.speed;
    }

    // 边界检查
    if (player.x < player.width / 2) player.x = player.width / 2;
    if (player.x > canvas.width - player.width / 2) player.x = canvas.width - player.width / 2;
}

function updateBullets() {
    // 移动子弹
    bullets.forEach(bullet => {
        bullet.y -= bullet.speed;
    });

    // 移除移出屏幕的子弹
    bullets = bullets.filter(bullet => bullet.y > 0);
}

function updateEnemies() {
    // 移动敌人
    enemies.forEach(enemy => {
        enemy.y += enemy.speed;
    });

    // 移除移出屏幕的敌人 (如果需要游戏结束逻辑，这里可以处理)
    enemies = enemies.filter(enemy => enemy.y < canvas.height);

    // 敌人生成
    spawnCounter++;
    if (spawnCounter >= ENEMY_SPAWN_RATE) {
        spawnEnemy();
        spawnCounter = 0;
    }
}

function checkCollisions() {
    // 新的子弹列表 (未命中)
    let newBullets = [];
    // 新的敌人列表 (未被击中)
    let newEnemies = [];

    enemies.forEach(enemy => {
        let hit = false;
        
        bullets.forEach(bullet => {
            // 简单的矩形/圆形碰撞检测
            if (
                bullet.x > enemy.x - enemy.width / 2 &&
                bullet.x < enemy.x + enemy.width / 2 &&
                bullet.y > enemy.y - enemy.height / 2 &&
                bullet.y < enemy.y + enemy.height / 2
            ) {
                // 子弹命中敌人
                hit = true;
                score += 10; // 增加分数
                // 命中子弹不会被添加到 newBullets
            } else {
                // 未命中的子弹保留
                newBullets.push(bullet);
            }
        });

        // 如果敌人未被命中，则保留
        if (!hit) {
            newEnemies.push(enemy);
        }
    });

    bullets = newBullets;
    enemies = newEnemies;
}

// --- 绘制函数 ---

function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x - player.width / 2, player.y - player.height / 2, player.width, player.height);
}

function drawBullets() {
    bullets.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fillStyle = bullet.color;
        ctx.fill();
        ctx.closePath();
    });
}

function drawEnemies() {
    enemies.forEach(enemy => {
        ctx.fillStyle = enemy.color;
        ctx.fillRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height);
    });
}

function drawScore() {
    ctx.font = '24px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText('得分: ' + score, 10, 30);
}

// --- 游戏主循环 ---

function gameLoop() {
    // 1. 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. 更新游戏状态
    updatePlayer();
    updateBullets();
    updateEnemies();
    checkCollisions(); // 检测碰撞并更新列表

    // 3. 绘制游戏对象
    drawPlayer();
    drawBullets();
    drawEnemies();
    drawScore();

    // 4. 请求下一帧动画
    requestAnimationFrame(gameLoop);
}

// 启动游戏循环
gameLoop();

console.log('游戏已启动！使用 A/D 或左右箭头移动，空格键发射子弹。');
