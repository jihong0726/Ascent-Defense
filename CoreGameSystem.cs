using System.Collections.Generic;
using UnityEngine;
using System;
using System.Linq;

// ==============================================================================
// 文件名: CoreGameSystem.cs
// 描述: 包含所有核心游戏逻辑（资源、变异、塔、敌人、游戏管理器）
//       以及用于测试的 TestHarness 脚本。
//
// 使用方法:
// 1. 将此脚本放入 Unity 项目中。
// 2. 在场景中创建以下对象并附加对应的脚本（拖拽）：
//    - GameObject -> GameManager (附加 GameManager 脚本)
//    - GameObject -> BasicTower (附加 BasicGunTower 脚本)
//    - GameObject -> TestEnemy (附加 Enemy 脚本)
//    - GameObject -> TestHarness (附加 TestHarness 脚本)
// 3. 运行场景，按 [空格键] 启动测试流程，按 [回车键] 触发手动攻击。
// ==============================================================================

// ===============================================
// 1. 基础单例类 (Singleton)
// ===============================================
public abstract class Singleton<T> : MonoBehaviour where T : MonoBehaviour
{
    private static T _instance;
    public static T Instance
    {
        get
        {
            if (_instance == null)
            {
                _instance = FindObjectOfType<T>();
                if (_instance == null)
                {
                    GameObject obj = new GameObject();
                    obj.name = typeof(T).Name;
                    _instance = obj.AddComponent<T>();
                }
            }
            return _instance;
        }
    }

    protected virtual void Awake()
    {
        if (_instance == null)
        {
            _instance = this as T;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            if (_instance != this)
            {
                Destroy(gameObject);
            }
        }
    }
}

// ===============================================
// 2. 资源管理器 (ResourceManager)
// ===============================================
public class ResourceManager : MonoBehaviour
{
    public int Gold { get; private set; }
    public int TechPoints { get; private set; } // TP

    public void Initialize(int initialGold, int initialTP)
    {
        Gold = initialGold;
        TechPoints = initialTP;
        Debug.Log($"资源初始化：Gold={Gold}, TP={TechPoints}");
    }

    public void AddGold(int amount)
    {
        Gold += amount;
        Debug.Log($"获得 Gold: {amount}. 当前: {Gold}");
    }

    public bool TrySpendGold(int amount)
    {
        if (Gold >= amount)
        {
            Gold -= amount;
            Debug.Log($"花费 Gold: {amount}. 剩余: {Gold}");
            return true;
        }
        Debug.Log("Gold 不足！");
        return false;
    }

    public void AddTechPoints(int amount)
    {
        TechPoints += amount;
        Debug.Log($"获得 TP: {amount}. 当前: {TechPoints}");
    }

    public bool TrySpendTechPoints(int amount)
    {
        if (TechPoints >= amount)
        {
            TechPoints -= amount;
            Debug.Log($"花费 TP: {amount}. 剩余: {TechPoints}");
            return true;
        }
        Debug.Log($"TP 不足！需要 {amount}，只有 {TechPoints}。");
        return false;
    }
}

// ===============================================
// 3. 变异数据结构 (Mutation)
// ===============================================
public abstract class Mutation 
{
    public string Name { get; protected set; }
    public string Description { get; protected set; }

    // 属性修改乘数/加数
    public float DamageMultiplier = 1f;
    public float RangeBonus = 0f;
    public float FireRateMultiplier = 1f;

    // 1. 立即应用属性修改
    public virtual void ApplyToTower(Tower tower)
    {
        tower.Damage *= DamageMultiplier;
        tower.Range += RangeBonus;
        tower.FireRate *= FireRateMultiplier;
    }

    // 2. 运行时修改伤害 (如暴击)
    public virtual float ModifyDamage(float rawDamage)
    {
        return rawDamage; 
    }
}

// 示例变异 1: 原始增幅 (属性修改)
public class BasicDamageBoost : Mutation
{
    public BasicDamageBoost()
    {
        Name = "原始增幅";
        Description = "伤害提高 20%。";
        DamageMultiplier = 1.2f;
    }
}

// 示例变异 2: 暴击机会 (运行时修改)
public class CriticalHitMutation : Mutation
{
    private const float CritChance = 0.15f; // 15% 几率
    private const float CritMultiplier = 2.0f; // 200% 伤害
    
    public CriticalHitMutation()
    {
        Name = "致命核心";
        Description = $"有 {CritChance * 100}% 几率造成 {CritMultiplier * 100}% 伤害。";
    }

    public override float ModifyDamage(float rawDamage)
    {
        if (UnityEngine.Random.value < CritChance)
        {
            Debug.Log($"<color=red>暴击触发！伤害 x{CritMultiplier}！</color>");
            return rawDamage * CritMultiplier; 
        }
        return rawDamage;
    }
}

// ===============================================
// 4. 变异管理器 (MutationManager)
// ===============================================
public class MutationManager : Singleton<MutationManager>
{
    private List<Mutation> AllMutations = new List<Mutation>(); 

    protected override void Awake()
    {
        base.Awake();
        InitializeMutations();
    }

    private void InitializeMutations()
    {
        // 注册所有可用的变异
        AllMutations.Add(new BasicDamageBoost());
        AllMutations.Add(new CriticalHitMutation());
        
        Debug.Log($"变异管理器加载了 {AllMutations.Count} 种变异。");
    }

    public Mutation GetRandomMutation()
    {
        if (AllMutations.Count == 0) return null;

        int index = UnityEngine.Random.Range(0, AllMutations.Count);
        Mutation template = AllMutations[index];
        
        // 返回一个新的实例
        return (Mutation)Activator.CreateInstance(template.GetType()); 
    }
}

// ===============================================
// 5. 敌人基类 (Enemy)
// ===============================================
public class Enemy : MonoBehaviour 
{
    public float MaxHealth = 100f;
    private float CurrentHealth;
    public int RewardGold = 20;
    public int RewardTechPoints = 5;
    
    void Start()
    {
        CurrentHealth = MaxHealth;
    }
    
    public float GetCurrentHealth() => CurrentHealth;
    
    public void TakeDamage(float amount)
    {
        CurrentHealth -= amount;
        
        if (CurrentHealth <= 0)
        {
            Die();
        }
        Debug.Log($"Enemy ({gameObject.name}) 受到 {amount:F2} 伤害. 剩余 HP: {CurrentHealth:F2}");
    }

    public void Die()
    {
        Debug.Log($"Enemy 死亡。奖励 {RewardGold} Gold, {RewardTechPoints} TP。");
        GameManager.Instance.ResourceManager.AddGold(RewardGold);
        GameManager.Instance.ResourceManager.AddTechPoints(RewardTechPoints);
        
        Destroy(gameObject); 
    }
    
    // 简化逻辑
    public void ReachedEnd()
    {
        GameManager.Instance.TakeDamage(1); 
        Destroy(gameObject);
    }
}

// ===============================================
// 6. 防御塔基类 (Tower)
// ===============================================
public abstract class Tower : MonoBehaviour
{
    public string TowerName = "基础塔";
    public float Damage { get; set; } = 10f;
    public float Range { get; set; } = 5f;
    public float FireRate { get; set; } = 1f; // Attacks per second
    
    private float AttackCooldown = 0f;
    public int TechPointCostToMutate { get; private set; } = 10;
    
    public List<Mutation> ActiveMutations = new List<Mutation>();

    void Update()
    {
        AttackCooldown -= Time.deltaTime;
        if (GameManager.Instance != null && GameManager.Instance.CurrentState == GameManager.GameState.BattlePhase)
        {
            if (AttackCooldown <= 0f)
            {
                PerformAttack();
                AttackCooldown = 1f / FireRate; 
            }
        }
    }

    protected virtual void PerformAttack()
    {
        Enemy target = FindTarget(); 

        if (target != null)
        {
            ApplyDamage(target, Damage);
        }
    }

    private Enemy FindTarget()
    {
        // 简化：找到场景中存在的第一个敌人
        return FindObjectOfType<Enemy>();
    }

    protected void ApplyDamage(Enemy target, float rawDamage)
    {
        float effectiveDamage = rawDamage; 
        
        // 1. 行为变异修改伤害
        foreach (var mutation in ActiveMutations)
        {
            effectiveDamage = mutation.ModifyDamage(effectiveDamage);
        }
        
        // 2. 敌人承受伤害
        target.TakeDamage(effectiveDamage);
    }
    
    // --- 变异逻辑 ---
    public bool AttemptMutation()
    {
        if (GameManager.Instance == null || MutationManager.Instance == null)
        {
            Debug.LogError("管理器未就绪。");
            return false;
        }

        if (GameManager.Instance.ResourceManager.TrySpendTechPoints(TechPointCostToMutate))
        {
            Mutation newMutation = MutationManager.Instance.GetRandomMutation();
            
            if (newMutation != null)
            {
                ApplyMutation(newMutation);

                // 变异成功后，下次变异成本提高
                TechPointCostToMutate = (int)(TechPointCostToMutate * 1.5f); 
                
                Debug.Log($"<color=green>塔 '{TowerName}' 变异成功！获得了: {newMutation.Name}. 新成本: {TechPointCostToMutate} TP.</color>");
                return true;
            }
            else
            {
                GameManager.Instance.ResourceManager.AddTechPoints(TechPointCostToMutate); 
                return false;
            }
        }
        return false;
    }

    private void ApplyMutation(Mutation mutation)
    {
        ActiveMutations.Add(mutation);
        mutation.ApplyToTower(this); // 应用属性修改
        Debug.Log($"塔属性更新：伤害={Damage:F2}, 射速={FireRate:F2}");
    }
    
    // 供 TestHarness 脚本手动调用的公共测试方法
    public void TestAttackPublic()
    {
        PerformAttack();
    }
}

// 示例具体塔
public class BasicGunTower : Tower
{
    void Start()
    {
        TowerName = "机枪塔";
        Damage = 15f;
        Range = 6f;
        FireRate = 2f;
    }
}


// ===============================================
// 7. 游戏管理器 (GameManager) - 核心控制
// ===============================================
public class GameManager : Singleton<GameManager> 
{
    public int CoreHealth { get; private set; } = 20;
    
    [Header("子系统引用")]
    public ResourceManager ResourceManager;
    
    public enum GameState { DeploymentPhase, BattlePhase, GameOver }
    public GameState CurrentState { get; private set; } = GameState.DeploymentPhase;

    protected override void Awake()
    {
        base.Awake();
        SetupSubsystems();
        InitializeGame();
    }
    
    private void SetupSubsystems()
    {
        if (ResourceManager == null)
        {
            GameObject resourceObj = GameObject.Find("ResourceManager");
            if (resourceObj == null)
            {
                resourceObj = new GameObject("ResourceManager");
                ResourceManager = resourceObj.AddComponent<ResourceManager>();
            }
            else
            {
                 ResourceManager = resourceObj.GetComponent<ResourceManager>();
            }
        }
    }

    private void InitializeGame()
    {
        ResourceManager.Initialize(initialGold: 500, initialTP: 0); 
        CoreHealth = 20;
        CurrentState = GameState.DeploymentPhase;
        
        MutationManager.Instance.gameObject.name = "MutationManager";

        Debug.Log("--- 游戏初始化完成，进入部署阶段。 ---");
    }
    
    public void StartBattlePhase()
    {
        if (CurrentState == GameState.DeploymentPhase)
        {
            CurrentState = GameState.BattlePhase;
            Debug.Log("<color=yellow>!!! 战斗阶段开始 !!!</color>");
        }
    }
    
    public void TakeDamage(int damage)
    {
        CoreHealth -= damage;
        Debug.Log($"<color=red>核心受到伤害：{damage}。剩余生命值：{CoreHealth}</color>");
        
        if (CoreHealth <= 0)
        {
            GameOver();
        }
    }

    private void GameOver()
    {
        CurrentState = GameState.GameOver;
        Debug.Log("--- 游戏结束！核心被摧毁。 ---");
        Time.timeScale = 0f;
    }
}

// ===============================================
// 8. 辅助测试脚本 (TestHarness)
// ===============================================
public class TestHarness : MonoBehaviour
{
    private BasicGunTower testTower;
    private Enemy testEnemy;
    private bool initialSetupComplete = false;

    void Update()
    {
        // 确保所有实体在 Update 中找到，以防 Start 顺序问题
        if (!initialSetupComplete)
        {
            SetupTestEntities();
            return;
        }

        if (Input.GetKeyDown(KeyCode.Space))
        {
            RunFullTestCycle();
        }
        
        if (Input.GetKeyDown(KeyCode.Return) && GameManager.Instance.CurrentState == GameManager.GameState.BattlePhase)
        {
            Debug.Log("--- 手动触发攻击 ---");
            testTower.TestAttackPublic();
        }
    }

    private void SetupTestEntities()
    {
        testTower = FindObjectOfType<BasicGunTower>();
        testEnemy = FindObjectOfType<Enemy>();

        if (testTower != null && testEnemy != null && GameManager.Instance != null)
        {
            Debug.Log($"测试就绪。塔 (Dmg: {testTower.Damage})，敌 (HP: {testEnemy.MaxHealth})。");
            // 将塔的射速调慢，便于手动测试攻击效果
            testTower.FireRate = 0.01f; 
            initialSetupComplete = true;
        }
        else if (GameManager.Instance != null && Time.time > 1f) 
        {
             Debug.LogError("请确保场景中存在 BasicGunTower 和 Enemy 实例！");
             initialSetupComplete = true; 
        }
    }

    private void RunFullTestCycle()
    {
        Debug.Log("\n==================== 🚀 测试周期开始 (按空格键) ====================");
        
        // --- 阶段 1: 部署和变异测试 ---
        Debug.Log($"--- 部署测试: 当前 TP: {GameManager.Instance.ResourceManager.TechPoints}, 变异成本: {testTower.TechPointCostToMutate} ---");
        
        // 1. 增加 TP 
        GameManager.Instance.ResourceManager.AddTechPoints(100);

        // 2. 第一次变异 (应成功)
        Debug.Log("尝试第一次变异...");
        testTower.AttemptMutation(); 
        
        // 3. 第二次变异 (应成功)
        Debug.Log("尝试第二次变异...");
        testTower.AttemptMutation(); 
        
        // 检查变异结果
        string mutations = string.Join(", ", testTower.ActiveMutations.ConvertAll(m => m.Name));
        Debug.Log($"**当前塔属性:** 伤害={testTower.Damage:F2}, 射程={testTower.Range:F2}");
        Debug.Log($"**当前变异:** [{mutations}]。下一变异成本: {testTower.TechPointCostToMutate} TP。");

        // --- 阶段 2: 战斗模拟 ---
        GameManager.Instance.StartBattlePhase();
        Debug.Log("--- 战斗测试: 请按 [Enter] 键观察多次攻击和暴击/伤害结算！ ---");
    }
}
