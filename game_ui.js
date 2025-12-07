// --- 游戏数据状态 ---
const TOWER_PRICES = {
    'T1': { name: '基础机枪塔', cost: 100 },
    'T2': { name: '脉冲特斯拉', cost: 250 },
    // 更多塔可以在这里添加
};

const gameState = {
    coreHP: 10,
    maxHP: 10,
    gold: 450,
    tp: 3,
    wave: 12,
    // 4x4 网格，从 D4 到 A1
    map: {
        A4: '入口 >>>', B4: '空', C4: '空', D4: '出口',
        A3: '空', B3: '空', C3: '核心', D3: '空',
        A2: '空', B2: '空', C2: '空', D2: '空',
        A1: '空', B1: '空', C1: '空', D1: '空',
    },
    mutations: [
        '1. 破甲弹药: 所有塔 10% 几率移除 30% 物理护甲。',
        '2. 核心加固: 核心生命值上限永久 +2 点。',
        '3. 光环超载: T5 能量共振塔的攻速增益效果提高至 20%。'
    ]
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
    
    // 按照 A4, B4, C4, D4... 的顺序渲染 (从上到下，从左到右)
    const mapKeys = ['A4', 'B4', 'C4', 'D4', 'A3', 'B3', 'C3', 'D3', 'A2', 'B2', 'C2', 'D2', 'A1', 'B1', 'C1', 'D1'];
    
    mapKeys.forEach(coord => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        
        let content = gameState.map[coord];
        let color = '';

        if (content.includes('核心') || content.includes('入口') || content.includes('出口')) {
            color = 'background-color: #c0392b; color: white;'; 
        } else if (content.includes('Lv')) {
            color = 'background-color: #27ae60;'; // 有塔绿色
        }

        cell.style.cssText = color;
        cell.innerHTML = `<strong>${coord}</strong><br>${content}`;
        gridContainer.appendChild(cell);
    });
}

function renderMutations() {
    const list = document.getElementById('mutation-list');
    list.innerHTML = '';
    
    gameState.mutations.forEach((mutationText, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="mutation-option">${mutationText}</span>`;
        list.appendChild(li);
    });
}

// --- 指令处理逻辑 ---

window.processCommand = function() {
    const inputElement = document.getElementById('command-input');
    const command = inputElement.value.toUpperCase().trim();
    inputElement.value = ''; // 清空输入

    const parts = command.split(/\s+/); // 支持多个空格分隔
    const action = parts[0];

    switch (action) {
        case 'BUILD':
            handleBuild(parts);
            break;
        case 'CHOOSE':
            handleChoose(parts);
            break;
        case 'CONTINUE':
            alert('准备开始下一波战斗...');
            // 实际逻辑：启动下一波计时器
            break;
        default:
            alert(`未知指令: ${action}. 请使用 BUILD, CHOOSE 或 CONTINUE。`);
    }
}

function handleBuild(parts) {
    if (parts.length !== 3) {
        alert('BUILD 命令格式错误，应为: BUILD [坐标] [塔类型]');
        return;
    }
    
    const coord = parts[1]; // 例如 C2
    const towerId = parts[2]; // 例如 T1
    
    const towerInfo = TOWER_PRICES[towerId];

    // 1. 检查坐标是否有效且为空
    if (!gameState.map.hasOwnProperty(coord)) {
        alert(`错误：坐标 ${coord} 无效。`);
        return;
    }
    if (gameState.map[coord] !== '空') {
        alert(`错误：${coord} 处已有结构 (${gameState.map[coord]})。`);
        return;
    }
    
    // 2. 检查塔类型是否存在
    if (!towerInfo) {
        alert(`错误：塔类型 ${towerId} 不存在。`);
        return;
    }

    // 3. 检查资源是否足够
    if (gameState.gold < towerInfo.cost) {
        alert(`错误：GOLD 不足! 建造 ${towerInfo.name} 需要 ${towerInfo.cost} GOLD，你只有 ${gameState.gold}。`);
        return;
    }

    // 4. 执行建造和更新状态
    gameState.gold -= towerInfo.cost;
    gameState.map[coord] = `${towerInfo.name}/Lv1`; // 将塔放置在地图上

    // 5. 渲染更新
    renderStatus();
    renderMap();
    alert(`成功建造 ${towerInfo.name} 在 ${coord}。花费 ${towerInfo.cost} GOLD。`);
}

function handleChoose(parts) {
    if (parts.length !== 2 || isNaN(parts[1])) {
        alert('CHOOSE 命令格式错误，应为: CHOOSE [编号]');
        return;
    }
    
    const choice = parseInt(parts[1]);
    if (choice >= 1 && choice <= gameState.mutations.length) {
        alert(`你选择了变异 #${choice}: ${gameState.mutations[choice - 1]}.`);
        // 实际逻辑：应用变异效果，增加 TP 成本，重置变异列表
        // 示例：应用核心加固
        if (choice === 2) {
             gameState.maxHP += 2;
             gameState.coreHP = gameState.maxHP; // 恢复到满血
             renderStatus();
             alert('核心生命值上限永久 +2，已满血恢复！');
        }
        
        // 移除已选变异，并增加 TP 消耗
        gameState.tp += 5; // 模拟消耗 TP，这里暂时增加作为测试
    } else {
        alert('选择编号超出范围。');
    }
}

// --- 游戏启动 ---
document.addEventListener('DOMContentLoaded', () => {
    renderStatus();
    renderMap();
    renderMutations();
    console.log("Ascent Defense 策略原型 UI 已加载。尝试输入 'BUILD B4 T1' 并执行。");
});
