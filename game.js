// --- 核心配置数据 ---
let NEXT_ID = 1;

// PATH 定义: 用于敌人移动的格子坐标 (x, y)
const PATH = [
    { x: 0, y: 5 }, { x: 2, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 8 }, 
    { x: 8, y: 8 }, { x: 8, y: 2 }, { x: 15, y: 2 } // 终点
];

const ENEMY_CONFIGS = {
    'S_Basic': { hp: 100, armor: 5, speed: 1, reward: 5 },
    'F_Runner': { hp: 50, armor: 0, speed: 2, reward: 8 },
    'T_Tank': { hp: 300, armor: 15, speed: 0.5, reward: 20 }
};

const STRATEGIES = {
    FIRST: 'FIRST',       
    STRONGEST: 'STRONGEST', 
    WEAKEST: 'WEAKEST',   
    CLOSEST: 'CLOSEST'    
};

const TOWER_CONFIGS = {
    'T1': { 
        damage: 10, range: 3, cost: 50, type: 'Physical',
        cooldown: 10, // 攻速快
        description: '基础物理塔'
    },
    'T2': { 
        damage: 50, range: 5, cost: 120, type: 'ArmorPiercing', armor_pierce: 0.5,
        cooldown: 40, // 狙击塔：攻速慢
        description: '高伤穿甲塔'
    },
    'T3': { 
        damage: 5, range: 2, cost: 200, type: 'Cryo', effect: { magnitude: 0.3, duration: 20, radius: 1 },
        cooldown: 5, // 喷雾塔：攻速极快，AoE 减速
        description: '群控减速塔'
    },
    'T4': { 
        damage: 15, range: 3, cost: 250, type: 'Shredding', 
        effect: { type: 'ArmorShred', magnitude: 2, duration: 5, color: 'rgb(179, 157, 219)' }, // 削减 2 点护甲
        cooldown: 15,
        description: '护甲削弱塔'
    } 
};

const WAVES_CONFIG = [
    { waveId: 1, segments: [
        { type: 'S_Basic', count: 5, delay: 0, interval: 8 }, 
        { type: 'F_Runner', count: 3, delay: 50, interval: 10 } 
    ]},
    { waveId: 2, segments: [
        { type: 'T_Tank', count: 1, delay: 0, interval: 0 },
        { type: 'S_Basic', count: 10, delay: 30, interval: 5 }
    ]}
];

// --- 实体类定义 (为简洁省略，但与上一次回复的完整逻辑相同) ---

class Enemy {
    constructor(type, pathIndex = 0) {
        const config = ENEMY_CONFIGS[type];
        this.id = NEXT_ID++;
        this.type = type;
        this.hp = config.hp;
        this.maxHp = config.hp;
        this.baseArmor = config.armor;
        this.baseSpeed = config.speed;
        this.reward = config.reward;
        this.pathIndex = pathIndex;
        this.x = PATH[pathIndex].x;
        this.y = PATH[pathIndex].y;
        this.activeEffects = []; 
    }
    applyEffect(type, magnitude, duration, sourceId) {
        const existingEffect = this.activeEffects.find(e => e.type === type && e.sourceId === sourceId);
        if (existingEffect) { existingEffect.duration = duration; } 
        else { this.activeEffects.push({ type, magnitude, duration, sourceId }); }
    }
    getActualSpeed() {
        let speedMultiplier = 1.0;
        this.activeEffects.filter(e => e.type === 'Slow').forEach(e => { speedMultiplier *= (1 - e.magnitude); });
        const minSpeed = this.baseSpeed * 0.1;
        return Math.max(minSpeed, this.baseSpeed * speedMultiplier);
    }
    getEffectiveArmor() {
        let armorDelta = 0; 
        this.activeEffects.filter(e => e.type === 'ArmorShred').forEach(e => { armorDelta -= e.magnitude; });
        return Math.max(0, this.baseArmor + armorDelta);
    }
    tickEffects() {
        this.activeEffects = this.activeEffects.map(effect => ({ ...effect, duration: effect.duration - 1 })).filter(effect => effect.duration > 0);
    }
    move(steps) {
        if (this.pathIndex >= PATH.length - 1) return true; 
        this.pathIndex = Math.min(this.pathIndex + steps, PATH.length - 1);
        this.x = PATH[this.pathIndex].x;
        this.y = PATH[this.pathIndex].y;
        return this.pathIndex === PATH.length - 1; 
    }
}


class Tower {
    constructor(type, x, y) {
        const config = TOWER_CONFIGS[type];
        this.id = NEXT_ID++;
        this.type = type;
        this.x = x;
        this.y = y;
        this.level = 1;
        this.range = config.range;
        this.baseDamage = config.damage;
        this.cooldownMax = config.cooldown; 
        this.cooldownCurrent = 0;
        this.strategy = STRATEGIES.FIRST; 
    }
    upgrade() {
        this.level++;
        this.baseDamage = Math.floor(this.baseDamage * 1.5); 
        this.range += 0.5; 
        this.cooldownMax = Math.max(5, this.cooldownMax - 2); 
    }
    setStrategy(newStrategy) {
        if (STRATEGIES[newStrategy]) { this.strategy = newStrategy; }
    }
    findTarget(enemies) {
        const candidates = enemies.filter(e => Math.hypot(e.x - this.x, e.y - this.y) <= this.range);
        if (candidates.length === 0) return null;
        switch (this.strategy) {
            case STRATEGIES.STRONGEST: return candidates.reduce((prev, curr) => (prev.hp > curr.hp) ? prev : curr);
            case STRATEGIES.WEAKEST: return candidates.reduce((prev, curr) => (prev.hp < curr.hp) ? prev : curr);
            case STRATEGIES.CLOSEST: return candidates.reduce((prev, curr) => (Math.hypot(prev.x - this.x, prev.y - this.y) < Math.hypot(curr.x - this.x, curr.y - this.y)) ? prev : curr);
            case STRATEGIES.FIRST: default: return candidates.reduce((prev, curr) => (prev.pathIndex > curr.pathIndex) ? prev : curr);
        }
    }
    tryAttack(game) {
        if (this.cooldownCurrent > 0) { this.cooldownCurrent--; return; }
        const target = this.findTarget(game.enemies);
        if (target) {
            this.attack(target, game);
            this.cooldownCurrent = this.cooldownMax;
        }
    }
    calculateDamage(enemy, config) {
        let effectiveArmor = enemy.getEffectiveArmor(); 
        if (config.type === 'ArmorPiercing') { effectiveArmor *= (1 - config.armor_pierce); }
        let finalDamage = this.baseDamage - effectiveArmor;
        return Math.max(1, finalDamage);
    }
    attack(target, game) {
        const config = TOWER_CONFIGS[this.type];
        if (this.type === 'T3') {
            const aoeRange = config.effect.radius;
            game.enemies.forEach(enemy => {
                if (Math.hypot(enemy.x - target.x, enemy.y - target.y) <= aoeRange) {
                    enemy.hp -= this.calculateDamage(enemy, config);
                    enemy.applyEffect('Slow', config.effect.magnitude, config.effect.duration, this.id);
                }
            });
        } else if (this.type === 'T4') {
            const damage = this.calculateDamage(target, config);
            target.hp -= damage;
            target.applyEffect(config.effect.type, config.effect.magnitude, config.effect.duration, this.id);
        } else {
            const damage = this.calculateDamage(target, config);
            target.hp -= damage;
        }
    }
}

// --- 游戏主类 ---

class Game {
    constructor(initialMoney = 500, initialLives = 20, canvas, ctx) {
        this.tickCount = 0;
        this.money = initialMoney;
        this.lives = initialLives;
        this.wave = 0;
        this.towers = [];
        this.enemies = [];
        this.currentWaveSegment = [];
        this.waveDelayTimer = 0;
        
        // Canvas & UI
        this.canvas = canvas;
        this.ctx = ctx;
        this.GRID_SIZE = 50;
        this.log = document.getElementById('log-output');
        this.updateUI();
    }

    buildTower(type, x, y) {
        const config = TOWER_CONFIGS[type];
        if (!config) return this.logMessage(`无效的塔类型: ${type}`, 'red');
        if (this.money >= config.cost) {
            const newTower = new Tower(type, x, y);
            this.towers.push(newTower);
            this.money -= config.cost;
            this.logMessage(`建造 ${type} (ID ${newTower.id}) 在 (${x},${y})`, 'lime');
            this.updateUI();
            this.render();
            return newTower;
        } else {
            this.logMessage(`资金不足，需要 ${config.cost}，现有 ${this.money}。`, 'orange');
            return null;
        }
    }
    
    upgradeTower(towerId) {
        const tower = this.towers.find(t => t.id === towerId);
        if (!tower) return this.logMessage(`塔 ID ${towerId} 未找到。`, 'red');

        const upgradeCost = Math.floor(TOWER_CONFIGS[tower.type].cost * tower.level * 0.8);
        
        if (this.money >= upgradeCost) {
            tower.upgrade();
            this.money -= upgradeCost;
            this.logMessage(`升级塔 ${towerId} 至 Lv${tower.level}. 花费: ${upgradeCost}`, 'cyan');
            this.updateUI();
            this.render();
            return true;
        } else {
            this.logMessage(`升级资金不足。需要 ${upgradeCost}，现有 ${this.money}。`, 'orange');
            return false;
        }
    }

    setStrategy(towerId, newStrategy) {
        const tower = this.towers.find(t => t.id === towerId);
        if (tower) {
            tower.setStrategy(newStrategy);
            this.logMessage(`塔 ID ${towerId} 策略已切换为: ${newStrategy}`, 'yellow');
        } else {
            this.logMessage(`塔 ID ${towerId} 未找到。`, 'red');
        }
    }
    
    startWave() {
        if (this.wave >= WAVES_CONFIG.length) {
            this.logMessage("所有波次已击败! 游戏胜利!", 'gold');
            return false;
        }
        
        const waveConfig = WAVES_CONFIG[this.wave];
        this.currentWaveSegment = [];
        waveConfig.segments.forEach(segment => {
            for (let i = 0; i < segment.count; i++) {
                this.currentWaveSegment.push({ 
                    type: segment.type, 
                    delay: segment.delay + i * segment.interval 
                });
            }
        });
        this.currentWaveSegment.sort((a, b) => a.delay - b.delay);
        
        this.wave++;
        this.waveDelayTimer = 0;
        this.logMessage(`--- 开始第 ${this.wave} 波 ---`, 'lime');
        this.updateUI();
        return true;
    }

    processEnemySpawning() {
        if (this.currentWaveSegment.length === 0) return;
        if (this.waveDelayTimer > 0) {
            this.waveDelayTimer--;
            return;
        }

        const nextGroupDelay = this.currentWaveSegment[0].delay;
        const enemiesToSpawn = this.currentWaveSegment.filter(e => e.delay === nextGroupDelay);

        enemiesToSpawn.forEach(enemyConfig => {
            this.enemies.push(new Enemy(enemyConfig.type, 0));
        });

        this.currentWaveSegment = this.currentWaveSegment.filter(e => e.delay !== nextGroupDelay);

        if (this.currentWaveSegment.length > 0) {
            const nextDelay = this.currentWaveSegment[0].delay;
            this.waveDelayTimer = nextDelay - nextGroupDelay;
            this.currentWaveSegment = this.currentWaveSegment.map(e => ({...e, delay: e.delay - this.waveDelayTimer}));
        }
    }

    processTowerAttacks() {
        this.towers.forEach(tower => {
            tower.tryAttack(this);
        });
    }

    processEnemyMovement() {
        const deadEnemies = [];
        const reachedEnd = [];

        this.enemies.forEach(enemy => {
            enemy.tickEffects(); 
            const steps = Math.floor(enemy.getActualSpeed()); 
            
            if (steps > 0) {
                const reached = enemy.move(steps);
                if (reached) { reachedEnd.push(enemy); }
            }
            if (enemy.hp <= 0) { deadEnemies.push(enemy); }
        });

        deadEnemies.forEach(e => { this.money += e.reward; });
        reachedEnd.forEach(() => { this.lives--; });

        this.enemies = this.enemies.filter(enemy => enemy.hp > 0 && enemy.pathIndex < PATH.length - 1);

        this.updateUI();
        this.render();

        if (this.currentWaveSegment.length === 0 && this.enemies.length === 0) {
            this.logMessage(`波次 ${this.wave} 清理完毕! 奖励 50 资金。`, 'white');
            this.money += 50;
            this.startWave();
        }
    }

    tick() {
        if (this.lives <= 0) {
            this.logMessage("GAME OVER!", 'red');
            return false;
        }

        if (this.enemies.length === 0 && this.currentWaveSegment.length === 0 && this.wave === 0) {
            this.startWave(); 
        }
        
        this.tickCount++;
        
        this.processEnemySpawning();
        this.processTowerAttacks();
        this.processEnemyMovement();
        
        return true;
    }
    
    // --- 渲染和 UI 方法 ---
    logMessage(message, color = 'white') {
        const entry = document.createElement('p');
        entry.innerHTML = message;
        entry.style.color = color;
        this.log.prepend(entry);
        if (this.log.children.length > 50) this.log.lastChild.remove(); 
    }

    updateUI() {
        document.getElementById('money-display').textContent = this.money.toFixed(0);
        document.getElementById('lives-display').textContent = this.lives;
        document.getElementById('wave-display').textContent = this.wave;
        document.getElementById('tick-display').textContent = this.tickCount;
    }

    render() {
        if (!this.ctx) return;
        const { ctx, canvas, GRID_SIZE, towers, enemies } = this;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. 绘制路径
        ctx.strokeStyle = '#4A90E2';
        ctx.lineWidth = 15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        PATH.forEach((point, index) => {
            const x = point.x * GRID_SIZE + GRID_SIZE / 2;
            const y = point.y * GRID_SIZE + GRID_SIZE / 2;
            if (index === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
        });
        ctx.stroke();

        // 2. 绘制塔
        towers.forEach(tower => {
            const centerX = tower.x * GRID_SIZE + GRID_SIZE / 2;
            const centerY = tower.y * GRID_SIZE + GRID_SIZE / 2;
            
            // 绘制塔本体
            ctx.fillStyle = TOWER_CONFIGS[tower.type].color || (tower.type === 'T1' ? '#81c784' : tower.type === 'T2' ? '#ffab40' : tower.type === 'T3' ? '#4fc3f7' : '#b39ddb');
            ctx.beginPath();
            ctx.arc(centerX, centerY, GRID_SIZE / 3, 0, Math.PI * 2);
            ctx.fill();

            // 绘制等级
            ctx.fillStyle = 'black';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Lv${tower.level}`, centerX, centerY + 5);

            // 绘制冷却进度 (玩家反馈)
            if (tower.cooldownMax > 0 && tower.cooldownCurrent > 0) {
                 ctx.strokeStyle = 'red';
                 ctx.lineWidth = 2;
                 const progressAngle = (tower.cooldownMax - tower.cooldownCurrent) / tower.cooldownMax * Math.PI * 2;
                 ctx.beginPath();
                 ctx.arc(centerX, centerY, GRID_SIZE / 3 + 4, 0, progressAngle, true); // 逆时针绘制
                 ctx.stroke();
            }
        });

        // 3. 绘制敌人
        enemies.forEach(enemy => {
            const centerX = enemy.x * GRID_SIZE + GRID_SIZE / 2;
            const centerY = enemy.y * GRID_SIZE + GRID_SIZE / 2;
            const hpRatio = enemy.hp / enemy.maxHp;
            const isSlowed = enemy.activeEffects.some(e => e.type === 'Slow');
            const isShredded = enemy.activeEffects.some(e => e.type === 'ArmorShred');
            
            // 绘制敌人本体
            ctx.fillStyle = enemy.type === 'T_Tank' ? 'darkred' : enemy.type === 'F_Runner' ? 'yellow' : 'white';
            ctx.beginPath();
            ctx.rect(centerX - 10, centerY - 10, 20, 20);
            ctx.fill();

            // 绘制状态效果提示 (玩家反馈)
            if (isSlowed) {
                ctx.strokeStyle = 'lightblue';
                ctx.lineWidth = 3;
                ctx.strokeRect(centerX - 12, centerY - 12, 24, 24);
            }
            if (isShredded) {
                ctx.strokeStyle = TOWER_CONFIGS.T4.effect.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
                ctx.stroke();
            }

            // 绘制血条 (玩家反馈)
            ctx.fillStyle = 'red';
            ctx.fillRect(centerX - 15, centerY - 20, 30, 3);
            ctx.fillStyle = 'green';
            ctx.fillRect(centerX - 15, centerY - 20, 30 * hpRatio, 3);
        });
    }
}

// --- 游戏控制和启动 ---
let game = null;
let gameInterval = null;
const TICK_RATE_MS = 100; // 每 100 毫秒一个 tick

// 确保在 DOM 元素加载完毕后执行初始化
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error("初始化失败: gameCanvas 元素未找到!");
        return;
    }
    const ctx = canvas.getContext('2d');
    
    // 实例化 Game 类
    game = new Game(500, 20, canvas, ctx); 
    
    // 放置初始塔 (用于测试 ID 1, 2, 3)
    const tower1 = game.buildTower('T1', 2, 6); 
    const tower2 = game.buildTower('T2', 6, 8); 
    const tower3 = game.buildTower('T3', 5, 4); 
    
    game.logMessage("初始化完成。请点击 '开始模拟' 按钮。", 'yellow');
    
    // 立即渲染初始状态
    game.render();
});


// --- 全局控制函数 (供 HTML 按钮调用) ---

function startGame() {
    if (!game) return alert("游戏尚未初始化完成，请稍候。");
    
    document.getElementById('start-btn').disabled = true;
    document.getElementById('pause-btn').disabled = false;

    if (gameInterval) return;

    gameInterval = setInterval(() => {
        if (!game.tick()) {
            clearInterval(gameInterval);
            gameInterval = null;
            document.getElementById('pause-btn').disabled = true;
        }
    }, TICK_RATE_MS);
    game.logMessage("游戏循环启动!", 'lime');
}

function pauseGame() {
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
        document.getElementById('start-btn').disabled = false;
        document.getElementById('pause-btn').disabled = true;
        document.getElementById('start-btn').textContent = '继续模拟';
        game.logMessage("游戏暂停。", 'yellow');
    }
}

function placeTower(type, x, y) {
    if (!game) return;
    game.buildTower(type, x, y);
}

function upgradeTower(towerId) {
    if (!game) return;
    game.upgradeTower(towerId);
}

function setTowerStrategy(towerId, strategy) {
    if (!game) return;
    game.setStrategy(towerId, strategy);
}
