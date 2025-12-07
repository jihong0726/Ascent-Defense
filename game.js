// --- 游戏数据状态 ---
const gameState = {
    coreHP: 10,
    maxHP: 10,
    gold: 450,
    tp: 3,
    wave: 12,
    map: {
        A4: '入口 >>>', B4: '空', C4: '空', D4: '出口',
        A3: 'Tesla/Lv1', B3: 'Flame/Lv2', C3: '核心', D3: '空',
        A2: '空', B2: 'Resonance/Lv2', C2: '空', D2: '空',
        A1: 'Cryo/Lv3', B1: '空', C1: '空', D1: '空',
    },
    mutations: [
        '1. 破甲弹药: 所有塔 $10\\%$ 几率移除 $30\\%$ 物理护甲。',
        '2. 核心加固: 核心生命值上限永久 +2 点。',
        '3. 光环超载: T5 能量共振塔的攻速增益效果提高至 $20\\%$。'
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

        if (content.includes('核心')) {
            color = 'background-color: #c0392b;'; // 核心红色
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

    const parts = command.split(' ');
    const action = parts[0];

    switch (action) {
        case 'BUILD':
            if (parts.length === 3) {
                const coord = parts[1];
                const towerType = parts[2];
                // 假设 T1 = Basic Tower, T2 = Tesla
                alert(`尝试在 ${coord} 建造 ${towerType} (需 ${gameState.gold} Gold).`);
                // 实际逻辑：扣除 Gold，更新 gameState.map，并调用 renderMap()
            } else {
                alert('BUILD 命令格式错误，应为: BUILD [坐标] [塔类型]');
            }
            break;
        case 'CHOOSE':
            if (parts.length === 2 && !isNaN(parts[1])) {
                const choice = parseInt(parts[1]);
                if (choice >= 1 && choice <= gameState.mutations.length) {
                    alert(`你选择了变异 #${choice}: ${gameState.mutations[choice - 1]}.`);
                    // 实际逻辑：应用变异效果，增加 TP 成本，重置变异列表
                } else {
                    alert('选择编号超出范围。');
                }
            } else {
                alert('CHOOSE 命令格式错误，应为: CHOOSE [编号]');
            }
            break;
        case 'CONTINUE':
            alert('准备开始下一波战斗...');
            // 实际逻辑：启动下一波计时器
            break;
        default:
            alert(`未知指令: ${action}. 请使用 BUILD, CHOOSE 或 CONTINUE。`);
    }
}

// --- 游戏启动 ---
document.addEventListener('DOMContentLoaded', () => {
    renderStatus();
    renderMap();
    renderMutations();
    console.log("策略 UI 框架已加载。尝试在输入框中输入 'CHOOSE 2' 并点击执行。");
});
