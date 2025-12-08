// --- 核心配置数据 ---
let NEXT_ID = 1;

const PATH = [
    { x: 0, y: 5 }, { x: 2, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 8 }, 
    { x: 8, y: 8 }, { x: 8, y: 2 }, { x: 10, y: 2 } 
];

const ENEMY_CONFIGS = {
    'S_Basic': { hp: 100, armor: 5, speed: 1, reward: 5 },
    'F_Runner': { hp: 50, armor: 0, speed: 2, reward: 8 },
    'T_Tank': { hp: 300, armor: 15, speed: 0.5, reward: 20 }
};

const STRATEGIES = {
    FIRST: 'FIRST',       // 进度最靠前的 (跑得最远的)
    STRONGEST: 'STRONGEST', // 血量最高的 (坦克)
    WEAKEST: 'WEAKEST',   // 血量最低的 (补刀)
    CLOSEST: 'CLOSEST'    // 距离塔最近的
};

const TOWER_CONFIGS = {
    'T1': { 
        damage: 10, range: 3, cost: 50, type: 'Physical',
        cooldown: 10, // 攻速快 (每10 tick一发)
        description: '基础物理塔'
    },
    'T2': { 
        damage: 50, range: 5, cost: 120, type: 'ArmorPiercing', armor_pierce: 0.5,
        cooldown: 40, // 狙击塔：攻速慢，伤害高，范围大
        description: '高伤穿甲塔'
    },
    'T3': { 
        damage: 5, range: 2, cost: 200, type: 'Cryo', effect: { magnitude: 0.3, duration: 20, radius: 1 },
        cooldown: 5, // 喷雾塔：攻速极快，AoE 减速
        description: '群控减速塔'
    },
    'T4': { 
        damage: 15, range: 3, cost: 250, type: 'Shredding', 
        effect: { type: 'ArmorShred', magnitude: 2, duration: 5 }, // 削减 2 点护甲，持续 5 回合
        cooldown: 15,
        description: '护甲削弱塔'
    } 
};

const WAVES_CONFIG = [
    { waveId: 1, segments: [
        { type: 'S_Basic', count: 5, delay: 0, interval: 5 }, // 5个基础兵，每隔5 tick生成
        { type: 'F_Runner', count: 2, delay: 30, interval: 8 } // 30 tick 后，生成2个跑者，每隔8 tick生成
    ]},
    { waveId: 2, segments: [
        { type: 'S_Basic', count: 10, delay: 0, interval: 4 },
        { type: 'T_Tank', count: 1, delay: 50, interval: 0 } // Boss 在 50 tick 后单独生成
    ]}
];

// --- 实体类定义 ---

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

        this.activeEffects = []; // [{ type: 'Slow', magnitude: 0.3, duration: 20, sourceId: 1 }, ...]
    }

    /** 应用状态效果，支持叠加或刷新持续时间 */
    applyEffect(type, magnitude, duration, sourceId) {
        const existingEffect = this.activeEffects.find(e => e.type === type && e.sourceId === sourceId);
        
        if (existingEffect) {
            // 刷新持续时间
            existingEffect.duration = duration;
            // 如果效果可叠加，可以修改 magnitude (本例只叠加减速，其他效果刷新)
        } else {
            this.activeEffects.push({ type, magnitude, duration, sourceId });
        }
    }

    /** 计算实际速度 (乘性叠加减速，并设置下限) */
    getActualSpeed() {
        let speedMultiplier = 1.0;
        
        this.activeEffects
            .filter(e => e.type === 'Slow')
            .forEach(e => {
                // 乘性叠加: (1 - 0.3) * (1 - 0.2) = 0.56 最终速度
                speedMultiplier *= (1 - e.magnitude); 
            });

        // 限制：速度最低不能低于基础速度的 10%
        const minSpeed = this.baseSpeed * 0.1;
        return Math.max(minSpeed, this.baseSpeed * speedMultiplier);
    }

    /** 计算有效护甲 (受 ArmorShred 影响) */
    getEffectiveArmor() {
        let armorDelta = 0; 
        this.activeEffects
            .filter(e => e.type === 'ArmorShred')
            .forEach(e => {
                armorDelta -= e.magnitude; 
            });

        // 护甲最低为 0 (可以改为允许负数实现增伤，但这里设为0)
        return Math.max(0, this.baseArmor + armorDelta);
    }

    /** 移除过期效果并处理周期性效果 */
    tickEffects() {
        this.activeEffects = this.activeEffects
            .map(effect => ({ ...effect, duration: effect.duration - 1 }))
            .filter(effect => effect.duration > 0);
    }

    /** 移动逻辑 */
    move(steps) {
        if (this.pathIndex >= PATH.length - 1) return true; // 已到达终点

        this.pathIndex = Math.min(this.pathIndex + steps, PATH.length - 1);
        this.x = PATH[this.pathIndex].x;
        this.y = PATH[this.pathIndex].y;
        
        return this.pathIndex === PATH.length - 1; // 返回是否到达终点
    }
}


class Tower {
    constructor(type, x, y) {
        const config = TOWER_CONFIGS[type];
        this.id = NEXT_ID++;
        this.type = type;
        this.x = x;
        this.y = y;
        
        // 属性
        this.level = 1;
        this.range = config.range;
        this.baseDamage = config.damage;
        
        // 冷却/攻速机制
        this.cooldownMax = config.cooldown; 
        this.cooldownCurrent = 0;

        // 索敌策略
        this.strategy = STRATEGIES.FIRST; 
    }

    /** 升级塔：提升属性 */
    upgrade() {
        this.level++;
        this.baseDamage = Math.floor(this.baseDamage * 1.5); // 伤害提升 50%
        this.range += 0.5; // 范围微增
        this.cooldownMax = Math.max(5, this.cooldownMax - 2); // 攻速略微提升，有下限
    }

    /** 切换索敌模式 */
    setStrategy(newStrategy) {
        if (STRATEGIES[newStrategy]) {
            this.strategy = newStrategy;
            console.log(`Tower ${this.id} strategy set to ${newStrategy}`);
        }
    }

    /** 智能索敌逻辑 */
    findTarget(enemies) {
        // 1. 筛选出范围内的所有敌人
        const candidates = enemies.filter(e => 
            Math.hypot(e.x - this.x, e.y - this.y) <= this.range 
        );

        if (candidates.length === 0) return null;

        // 2. 根据策略选择目标
        switch (this.strategy) {
            case STRATEGIES.STRONGEST:
                return candidates.reduce((prev, curr) => (prev.hp > curr.hp) ? prev : curr);
            
            case STRATEGIES.WEAKEST:
                return candidates.reduce((prev, curr) => (prev.hp < curr.hp) ? prev : curr);

            case STRATEGIES.CLOSEST:
                return candidates.reduce((prev, curr) => {
                    const distPrev = Math.hypot(prev.x - this.x, prev.y - this.y);
                    const distCurr = Math.hypot(curr.x - this.x, curr.y - this.y);
                    return (distPrev < distCurr) ? prev : curr;
                });

            case STRATEGIES.FIRST:
            default:
                // 跑得最远的 (pathIndex 最大)
                return candidates.reduce((prev, curr) => (prev.pathIndex > curr.pathIndex) ? prev : curr);
        }
    }

    /** 冷却/索敌/攻击主循环 */
    tryAttack(game) {
        // 1. 冷却检查
        if (this.cooldownCurrent > 0) {
            this.cooldownCurrent--;
            return;
        }

        // 2. 索敌
        const target = this.findTarget(game.enemies);
        
        // 3. 攻击
        if (target) {
            this.attack(target, game);
            this.cooldownCurrent = this.cooldownMax; // 重置冷却
        }
    }

    /** 伤害计算 */
    calculateDamage(enemy, config) {
        // 使用敌人的动态有效护甲
        let effectiveArmor = enemy.getEffectiveArmor(); 

        if (config.type === 'ArmorPiercing') {
            effectiveArmor *= (1 - config.armor_pierce); // T2 穿甲
        }
        
        // 使用塔的当前基础伤害
        let finalDamage = this.baseDamage - effectiveArmor;
        
        // 伤害最低为 1 (保底伤害，防止高甲敌人无敌)
        return Math.max(1, finalDamage);
    }

    /** 核心攻击方法 */
    attack(target, game) {
        const config = TOWER_CONFIGS[this.type];
        
        if (this.type === 'T3') {
            // T3 Cryo Tower: AoE 减速
            const aoeRange = config.effect.radius;
            game.enemies.forEach(enemy => {
                if (Math.hypot(enemy.x - target.x, enemy.y - target.y) <= aoeRange) {
                    // 造成微量伤害
                    enemy.hp -= this.calculateDamage(enemy, config);
                    // 应用减速
                    enemy.applyEffect('Slow', config.effect.magnitude, config.effect.duration, this.id);
                }
            });
            
        } else if (this.type === 'T4') {
            // T4 Shredding Tower: 施加 ArmorShred 效果
            const damage = this.calculateDamage(target, config);
            target.hp -= damage;
            
            target.applyEffect(config.effect.type, config.effect.magnitude, config.effect.duration, this.id);
            
        } else {
            // T1 / T2: 标准伤害计算
            const damage = this.calculateDamage(target, config);
            target.hp -= damage;
        }
        
        // 记录攻击行为
        // console.log(`Tower ${this.id} (${this.type} Lv${this.level}) attacked Enemy ${target.id} for ${target.hp <= 0 ? damage : damage.toFixed(1)} damage. Target HP: ${target.hp.toFixed(1)}`);
    }
}

// --- 游戏主类 ---

class Game {
    constructor(initialMoney = 200, initialLives = 20) {
        this.tickCount = 0;
        this.money = initialMoney;
        this.lives = initialLives;
        this.wave = 0;
        
        this.towers = [];
        this.enemies = [];

        // 波次控制变量
        this.currentWaveSegment = []; // 待生成的敌人队列
        this.waveDelayTimer = 0;      // 下一个分段生成前的等待计时器
    }

    /** 尝试购买并建造塔 */
    buildTower(type, x, y) {
        const config = TOWER_CONFIGS[type];
        if (!config) return console.error(`Invalid tower type: ${type}`);
        
        if (this.money >= config.cost) {
            const newTower = new Tower(type, x, y);
            this.towers.push(newTower);
            this.money -= config.cost;
            console.log(`Built ${type} at (${x},${y}). Money left: ${this.money}`);
            return newTower;
        } else {
            console.log(`Not enough money to build ${type}. Need ${config.cost}, have ${this.money}.`);
            return null;
        }
    }
    
    /** 尝试升级塔 */
    upgradeTower(towerId) {
        const tower = this.towers.find(t => t.id === towerId);
        if (!tower) return console.error(`Tower ID ${towerId} not found.`);

        const upgradeCost = Math.floor(TOWER_CONFIGS[tower.type].cost * tower.level * 0.8); // 假设升级费用递增
        
        if (this.money >= upgradeCost) {
            tower.upgrade();
            this.money -= upgradeCost;
            console.log(`Upgraded Tower ${towerId} to Lv${tower.level}. Cost: ${upgradeCost}. Money left: ${this.money}`);
            return true;
        } else {
            console.log(`Not enough money to upgrade Tower ${towerId}. Need ${upgradeCost}, have ${this.money}.`);
            return false;
        }
    }

    /** 启动波次并填充生成队列 */
    startWave() {
        if (this.wave >= WAVES_CONFIG.length) {
            console.log("Game Over: All waves defeated!");
            return false;
        }
        
        const waveConfig = WAVES_CONFIG[this.wave];
        
        // 填充生成队列，每个敌人实例记录其生成延迟
        this.currentWaveSegment = [];
        waveConfig.segments.forEach(segment => {
            for (let i = 0; i < segment.count; i++) {
                this.currentWaveSegment.push({ 
                    type: segment.type, 
                    delay: segment.delay + i * segment.interval // 总延迟 = 波次延迟 + 内部生成间隔
                });
            }
        });
        
        // 按延迟排序，确保生成顺序正确
        this.currentWaveSegment.sort((a, b) => a.delay - b.delay);
        
        this.wave++;
        this.waveDelayTimer = 0;
        console.log(`--- Starting Wave ${this.wave} ---`);
        return true;
    }

    /** 处理敌人生成逻辑 */
    processEnemySpawning() {
        if (this.currentWaveSegment.length === 0) return;

        // 检查计时器是否允许生成下一批敌人
        if (this.waveDelayTimer > 0) {
            this.waveDelayTimer--;
            return;
        }

        // 找到下一个待生成的敌人组
        const nextGroupDelay = this.currentWaveSegment[0].delay;
        const enemiesToSpawn = this.currentWaveSegment.filter(e => e.delay === nextGroupDelay);

        // 生成敌人
        enemiesToSpawn.forEach(enemyConfig => {
            this.enemies.push(new Enemy(enemyConfig.type, 0));
        });

        // 移除已生成的敌人
        this.currentWaveSegment = this.currentWaveSegment.filter(e => e.delay !== nextGroupDelay);

        // 如果队列未空，设置下一个分段的延迟
        if (this.currentWaveSegment.length > 0) {
            const nextDelay = this.currentWaveSegment[0].delay;
            // 设置计时器
            this.waveDelayTimer = nextDelay - nextGroupDelay;
            // 减去所有剩余敌人的 delay，使其从新的计时器基准开始
            this.currentWaveSegment = this.currentWaveSegment.map(e => ({...e, delay: e.delay - this.waveDelayTimer}));
        }
    }

    /** 处理塔攻击 */
    processTowerAttacks() {
        this.towers.forEach(tower => {
            tower.tryAttack(this);
        });
    }

    /** 处理敌人移动和效果更新 */
    processEnemyMovement() {
        const deadEnemies = [];
        const reachedEnd = [];

        this.enemies.forEach(enemy => {
            // 1. 效果更新
            enemy.tickEffects(); 

            // 2. 移动
            const actualSpeed = enemy.getActualSpeed();
            const steps = Math.floor(actualSpeed); 
            
            if (steps > 0) {
                const reached = enemy.move(steps);
                if (reached) {
                    reachedEnd.push(enemy);
                }
            }

            // 3. 检查死亡
            if (enemy.hp <= 0) {
                deadEnemies.push(enemy);
            }
        });

        // 奖励金钱并移除死亡敌人
        deadEnemies.forEach(e => {
            this.money += e.reward;
            // console.log(`Enemy ${e.id} defeated. Gained ${e.reward}. Total Money: ${this.money}`);
        });

        // 扣除生命值并移除到达终点的敌人
        reachedEnd.forEach(() => {
            this.lives--;
            // console.log("Enemy reached end! Lives left: " + this.lives);
        });

        // 过滤掉死亡或到达终点的敌人
        const enemiesToKeep = this.enemies.filter(enemy => 
            enemy.hp > 0 && enemy.pathIndex < PATH.length - 1
        );

        this.enemies = enemiesToKeep;

        // 检查波次结束
        if (this.currentWaveSegment.length === 0 && this.enemies.length === 0) {
            console.log(`Wave ${this.wave} cleared!`);
            this.money += 50; // 波次奖励
            this.startWave(); // 尝试开始下一波
        }
    }

    /** 核心游戏逻辑：一个时间刻度 */
    tick() {
        if (this.lives <= 0) {
            console.log("GAME OVER!");
            return false;
        }

        if (this.enemies.length === 0 && this.currentWaveSegment.length === 0 && this.wave === 0) {
            this.startWave(); // 首次启动
        }
        
        this.tickCount++;
        
        this.processEnemySpawning();
        this.processTowerAttacks();
        this.processEnemyMovement();
        
        return true;
    }
}


// --- 示例用法 ---

const game = new Game(500, 20); // 初始 500 金，20 生命

// 建造初始塔
const tower1 = game.buildTower('T1', 2, 6); // 基础塔
const tower2 = game.buildTower('T2', 6, 8); // 狙击塔
const tower3 = game.buildTower('T4', 5, 4); // 破甲塔

// 设置塔的策略：让狙击塔专注于血量最高的敌人
if (tower2) tower2.setStrategy(STRATEGIES.STRONGEST); 

// 运行游戏循环
console.log("\n--- Game Start ---");
let running = true;
let i = 0;

while(running && i < 300) { // 限制运行 300 刻度
    running = game.tick();
    
    // 示例：在第 150 刻度升级 T1 塔
    if (i === 150 && tower1) {
        game.upgradeTower(tower1.id);
    }
    
    // 打印关键状态（每 10 刻度打印一次）
    if (i % 10 === 0) {
        console.log(`\n--- Tick ${i} | Lives: ${game.lives} | Money: ${game.money} ---`);
        game.enemies.forEach(e => {
            const actualSpeed = e.getActualSpeed();
            const effectiveArmor = e.getEffectiveArmor();
            console.log(`  Enemy ${e.id} (${e.type}): HP ${e.hp.toFixed(1)}/${e.maxHp} | Armor ${effectiveArmor.toFixed(1)} (Base ${e.baseArmor}) | Speed ${actualSpeed.toFixed(1)} (Base ${e.baseSpeed}) | Effects: ${e.activeEffects.length}`);
        });
        if (game.enemies.length === 0 && game.currentWaveSegment.length === 0) {
            console.log("  Waiting for next wave...");
        }
    }
    i++;
}

console.log("\n--- Simulation Ended ---");
