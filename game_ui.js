// --- 游戏数据和状态 ---
const TOWER_PRICES = {
    'T1': { name: '基础机枪塔', cost: 100, level: 1, damage: 10, range: 2 }, 
    'T2': { name: '脉冲特斯拉', cost: 250, level: 1, damage: 25, range: 3 },
};

const gameState = {
    coreHP: 10,
    maxHP: 10,
    gold: 450,
    tp: 3,
    wave: 12,
    enemies: [], 
    map: {
        A4: { content: '入口 >>>', type: 'special' }, B4: { content: '空', type: 'empty' }, C4: { content: '空', type: 'empty' }, D4: { content: '出口', type: 'special' },
        A3: { content: '空', type: 'empty' }, B3: { content: '空', type: 'empty' }, C3: { content: '核心', type: 'special' }, D3: { content: '空', type: 'empty' },
        A2: { content: '空', type: 'empty' }, B2: { content: '空', type: 'empty' }, C2: { content: '空', type: 'empty' }, D2: { content: '空', type: 'empty' },
        A1: { content: '空', type: 'empty' }, B1: { content: '空', type: 'empty' }, C1: { content: '空', type: 'empty' }, D1: { content: '空', type: 'empty' },
    },
    mutations: [
        { id: 1, text: '破甲弹药: 所有塔 10% 几率移除 30% 物理护甲。', action: 'ARMOR_PIERCING' },
        { id: 2, text: '核心加固: 核心生命值上限永久 +2 点。', action: 'CORE_HP_BOOST' },
        { id: 3, text: '光环超载: T5 能量共振塔的攻速增益效果提高至 20%。', action: 'AURA_BOOST' }
    ],
    currentMode: 'DEPLOYMENT'
};

// --- 渲染函数 ---

function renderStatus() {
    document.getElementById('coreHP').textContent = `${gameState.coreHP}/${gameState.maxHP}`;
    document.getElementById('gold').textContent = gameState.gold;
    document.getElementById('tp').textContent = gameState.tp;
    document.getElementById('wave').textContent = gameState.wave;
}

function renderMap() {
    const gridContainer = document.getElementById('grid-container');
    gridContainer.innerHTML = '';
    
    // 确保顺序是从上到下，从左到右 (A4, B4, C4, D4, ...)
    const mapKeys = ['A4', 'B4', 'C4', 'D4', 'A3', 'B3', 'C3', 'D3', 'A2', 'B2', 'C2', 'D2', 'A1', 'B1', 'C1', 'D1'];
    
    mapKeys.forEach(coord => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.coord = coord; 
        
        // **修复：确保点击事件绑定到全局函数**
        if (gameState.map[coord].type !== 'special') {
             cell.onclick = () => window.handleGridClick(coord); 
        } else {
             // 特殊单元格只显示信息，不绑定操作
             cell.onclick = () => updateActionPrompt(`信息：${coord} 是 ${gameState.map[coord].content}，不能在此操作。`);
        }


        const cellData = gameState.map[coord];
        let content = cellData.content;
        cell.innerHTML = `<strong>${coord}</strong><br>${content}`;
        
        if (cellData.type === 'special') {
            cell.classList.add('special-cell');
        } else if (cellData.type === 'tower') {
            cell.classList.add('tower-cell');
        }
        
        gridContainer.appendChild(cell);
    });
}

function renderMutations() {
    const choiceArea = document.getElementById('mutation-choice-area');
    choiceArea.innerHTML = '';
    
    gameState.mutations.forEach(mutation => {
        const button = document.createElement('button');
        button.className = 'mutation-button';
        button.innerHTML = `(${mutation.id}) ${mutation.text}`;
        button.onclick = () => window.chooseMutation(mutation.id); // 绑定到全局
        choiceArea.appendChild(button);
    });
}

function updateActionPrompt(message) {
    document.getElementById('action-prompt').innerHTML = message;
}

// --- 交互/点击逻辑 (FIXED: 声明为 window. 确保全局可访问) ---

window.handleGridClick = function(coord) {
    const cellData = gameState.map[coord];

    if (cellData.type === 'special') {
        updateActionPrompt(`信息：${coord} 是 ${cellData.content}，不能在此操作。`);
        return;
    }

    if (cellData.type === 'empty') {
        updateActionPrompt(`你选择了空地 ${coord}。请点击下方塔类型按钮进行建造。`);
        showBuildButtons(coord);
    } else if (cellData.type === 'tower') {
        updateActionPrompt(`你选择了 ${coord} 处的 ${cellData.content}。你想升级还是出售？`);
        showUpgradeSellButtons(coord);
    }
}

function showBuildButtons(coord) {
    const promptArea = document.getElementById('action-prompt');
    let buttonsHTML = `<p>选择要建造的塔：</p>`;
    
    Object.keys(TOWER_PRICES).forEach(id => {
        const info = TOWER_PRICES[id];
        buttonsHTML += `<button onclick="window.buildTower('${coord}', '${id}')" style="margin-right: 10px;">
                            建造 ${id} (${info.name}) - ${info.cost} GOLD
                        </button>`;
    });

    buttonsHTML += `<button onclick="window.resetAction()" style="margin-top: 10px;">取消</button>`;
    promptArea.innerHTML = buttonsHTML;
}

function showUpgradeSellButtons(coord) {
    const promptArea = document.getElementById('action-prompt');
    const towerId = gameState.map[coord].towerId;
    const upgradeCost = Math.floor(TOWER_PRICES[towerId].cost * 0.6); 
    const sellValue = Math.floor(TOWER_PRICES[towerId].cost * 0.7); 
    
    const buttonsHTML = `
        <button onclick="window.upgradeTower('${coord}')" style="margin-right: 10px;">升级 (费用: ${upgradeCost} GOLD)</button>
        <button onclick="window.sellTower('${coord}')" style="margin-right: 10px; background-color: #f39c12;">出售 (获得: ${sellValue} GOLD)</button>
        <button onclick="window.resetAction()">取消</button>
    `;
    promptArea.innerHTML = buttonsHTML;
}


// --- 核心动作函数 (都使用 window. 确保 HTML 内联事件能调用) ---

window.buildTower = function(coord, towerId) {
    const towerInfo = TOWER_PRICES[towerId];

    if (gameState.gold < towerInfo.cost) {
        alert(`错误：GOLD 不足! 需要 ${towerInfo.cost} GOLD。`);
        return;
    }

    gameState.gold -= towerInfo.cost;
    gameState.map[coord] = {
        content: `${towerInfo.name}/Lv1`,
        type: 'tower',
        towerId: towerId,
        level: 1,
    };

    renderStatus();
    renderMap();
    updateActionPrompt(`成功建造 ${towerInfo.name} 在 ${coord}。`);
}

window.upgradeTower = function(coord) {
    const cellData = gameState.map[coord];
    const towerId = cellData.towerId;
    const upgradeCost = Math.floor(TOWER_PRICES[towerId].cost * 0.6 * cellData.level); // 升级费用随等级增加

    if (gameState.gold < upgradeCost) {
        alert(`错误：升级需要 ${upgradeCost} GOLD，资源不足。`);
        return;
    }

    gameState.gold -= upgradeCost;
    cellData.level += 1;
    cellData.content = `${TOWER_PRICES[towerId].name}/Lv${cellData.level}`;

    renderStatus();
    renderMap();
    updateActionPrompt(`${coord} 处的塔已升级到 Lv${cellData.level}。`);
}

window.sellTower = function(coord) {
    const cellData = gameState.map[coord];
    const towerId = cellData.towerId;
    // 假设售价为基础成本 * 0.7 + (升级成本 * 0.5 * (等级-1))
    const baseSell = Math.floor(TOWER_PRICES[towerId].cost * 0.7);
    const totalUpgradeCost = Math.floor(TOWER_PRICES[towerId].cost * 0.6) * (cellData.level - 1);
    const sellValue = baseSell + Math.floor(totalUpgradeCost * 0.5);

    gameState.gold += sellValue;
    gameState.map[coord] = { content: '空', type: 'empty' };

    renderStatus();
    renderMap();
    updateActionPrompt(`成功出售 ${coord} 处的塔，获得 ${sellValue} GOLD。`);
}


window.chooseMutation = function(id) {
    const mutation = gameState.mutations.find(m => m.id === id);
    if (!mutation) return;

    if (gameState.tp < 1) {
        alert('错误：TP 不足，无法选择变异！');
        return;
    }
    gameState.tp -= 1;

    if (mutation.action === 'CORE_HP_BOOST') {
        gameState.maxHP += 2;
        gameState.coreHP = gameState.maxHP;
        alert(`核心生命值上限永久 +2 (${gameState.maxHP})，已满血恢复！`);
    } else {
        alert(`已选择变异 #${id}: ${mutation.text}。效果已应用。`);
    }
    
    renderStatus();
    // 移除已选择的变异，并重新渲染变异菜单 (此处简化为只更新状态)
}

window.resetAction = function() {
    updateActionPrompt("请选择一个地图坐标（A1-D4）开始操作。");
}

// --- 回合制战斗逻辑 ---

window.continueWave = function() {
    if (gameState.coreHP <= 0) {
        alert("核心已被摧毁。游戏结束！");
        return;
    }

    if (gameState.enemies.length === 0) {
        // 如果没有敌人，进入下一波 (生成敌人)
        gameState.wave += 1;
        
        // 动态生成敌人：波次越高，敌人越多/血量越高
        const enemyCount = 2 + Math.floor(gameState.wave / 5);
        for(let i = 0; i < enemyCount; i++) {
             gameState.enemies.push(
                { id: Date.now() + i, hp: 50 + gameState.wave * 10, maxHp: 50 + gameState.wave * 10, position: 'D4', speed: 1, reward: 12 + gameState.wave }
            );
        }
       
        updateActionPrompt(`第 ${gameState.wave} 波敌人已生成 (${gameState.enemies.length} 个)。点击 [继续下一波战斗] 开始结算。`);
        renderStatus();
        return;
    }

    // 真正的回合结算开始
    alert(`开始回合结算 (${gameState.enemies.length} 敌人剩余)...`);
    
    // 1. 塔攻击阶段
    processTowerAttacks();

    // 2. 敌人移动阶段
    processEnemyMovement();
    
    // 3. 结算和渲染
    if (gameState.coreHP <= 0) {
        alert("核心已被摧毁。游戏结束！");
        return;
    }

    if (gameState.enemies.length > 0) {
        updateActionPrompt(`回合结算完成。剩余 ${gameState.enemies.length} 个敌人。请继续。`);
    } else {
        // 敌人清空，回合结束，等待玩家部署
        updateActionPrompt(`所有敌人已被消灭！获得 1 TP。请部署或升级，然后点击下一波。`);
        gameState.tp += 1;
    }
    
    renderStatus();
    renderMap();
}

function processTowerAttacks() {
    // 遍历地图上的所有塔
    Object.keys(gameState.map).forEach(coord => {
        const cellData = gameState.map[coord];
        if (cellData.type === 'tower' && gameState.enemies.length > 0) {
            const towerInfo = TOWER_PRICES[cellData.towerId];
            
            // 简化：总是攻击第一个敌人
            let target = gameState.enemies[0];
            
            if (target) {
                const damage = towerInfo.damage * cellData.level;
                target.hp -= damage;
                
                if (target.hp <= 0) {
                    gameState.gold += target.reward; 
                    gameState.enemies.splice(0, 1); 
                    // 实际中这里会更新敌人模型，本次简化为只更新状态和金钱
                }
            }
        }
    });
}

function processEnemyMovement() {
    // 路径模拟 (入口 D4, 出口 C3 核心)
    const simplifiedPath = {
        'D4': 'C4', 'C4': 'B4', 'B4': 'A4', 
        'A4': 'A3', 'A3': 'B3', 'B3': 'C3', // 走向核心C3
        'D3': 'C3', 'D2': 'C3', 'D1': 'C3', 
        'C1': 'C2', 'C2': 'C3', 
        // 简化的路径，确保所有点最终都能走向核心 C3
    };

    // 敌人移动和核心伤害
    gameState.enemies = gameState.enemies.filter(enemy => {
        if (enemy.position === 'C3') {
            // 到达核心，造成伤害
            gameState.coreHP -= 1; 
            updateActionPrompt(`敌人到达核心！核心 HP 减 1。`);
            return false; // 敌人消失
        }
        
        const nextPos = simplifiedPath[enemy.position];
        if (nextPos) {
            enemy.position = nextPos;
            return true;
        }

        // 如果敌人路径走到尽头，但不是核心 (理论上不应发生)
        gameState.coreHP -= 1; 
        updateActionPrompt(`警告：敌人路径错误，强制伤害核心。`);
        return false;
    });
}

// --- 游戏启动 ---
document.addEventListener('DOMContentLoaded', () => {
    // 初始化塔的成本显示
    document.getElementById('T1-cost').textContent = TOWER_PRICES.T1.cost;
    document.getElementById('T2-cost').textContent = TOWER_PRICES.T2.cost;
    
    renderStatus();
    renderMap();
    renderMutations();
    window.resetAction();
    console.log("Ascent Defense 策略原型已启动。");
});
