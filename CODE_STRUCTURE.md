# CS-Lite Web v0.4.3 — 代码结构

> 浏览器多人 FPS 训练场 · Babylon.js + Colyseus + TypeScript  
> 公网地址：http://152.136.24.49:2567  
> GitHub：github.com/Sando-39/cs-lite-web-5v5  
> 测试：93 个 · 构建：Vite + tsc

---

## 目录总览

```
cs-lite-web-5v5/
├── shared/                        # 客户端 + 服务端共享
│   ├── constants.ts               # 全部核心常量
│   ├── types.ts                   # 全部共享类型
│   ├── weapons.ts                 # 武器配置（AR-4, R-47）
│   ├── aiEnemies.ts               # AI 敌人配置（3 个巡逻兵）
│   ├── staticTargets.ts           # 静态靶子配置（v0.4 后已弃用）
│   ├── mapGeometry.ts             # 地图碰撞几何体
│   └── collision.ts               # 碰撞检测纯函数
│
├── server/                        # 服务端（Colyseus + Express）
│   ├── index.ts                   # 入口（Express 静态托管 + Colyseus WebSocket）
│   ├── config/
│   │   └── spawns.ts              # 玩家出生点
│   ├── logic/
│   │   ├── movement.ts            # 移动校验（速度限制 + 边界 + 碰撞）
│   │   ├── combat.ts              # 战斗系统（射线命中检测）
│   │   ├── weaponSystem.ts        # 武器系统（开火/换弹/切换/散布）
│   │   ├── aiSystem.ts            # AI 系统（巡逻/视野检测/伤害/复活）
│   │   └── playerSlots.ts         # 玩家槽位管理
│   └── rooms/
│       ├── GameRoom.ts            # 房间主逻辑（核心集成点）
│       └── schema/
│           ├── GameState.ts       # 根状态（players + targets + aiEnemies）
│           ├── PlayerState.ts     # 玩家状态（位置/HP/武器）
│           ├── PlayerWeaponState.ts # 单把武器状态
│           ├── TargetState.ts     # 静态靶子状态（已弃用）
│           └── AiEnemyState.ts    # AI 敌人状态
│
├── src/                           # 客户端（Vite + Babylon.js）
│   ├── main.ts                    # 入口
│   ├── styles.css                 # 全局样式
│   ├── app/
│   │   └── App.ts                 # 首页 UI（创建/加入房间）
│   ├── game/
│   │   ├── ClientGame.ts          # 游戏主循环（核心集成点）
│   │   ├── InputController.ts     # WASD + 鼠标 + 开火/换弹/切枪输入
│   │   ├── MapBuilder.ts          # 3D 地图构建
│   │   ├── RemotePlayerView.ts    # 远端玩家渲染（插值）
│   │   ├── WeaponView.ts          # 第一人称枪模 + 枪口火光 + 后坐力 + 动画
│   │   ├── WeaponHud.ts           # 武器弹药/HP HUD
│   │   ├── TracerView.ts          # 曳光弹视觉
│   │   ├── TargetView.ts          # 静态靶子渲染（已弃用）
│   │   ├── AiEnemyView.ts         # AI 敌人 3D 渲染
│   │   ├── GameAudio.ts           # 合成音效（Web Audio API）
│   │   ├── HitFeedback.ts         # 命中/未命中文字反馈
│   │   ├── ReloadProgress.ts      # 换弹进度条
│   │   ├── DebugHud.ts            # F3 调试面板
│   │   ├── DebugMetrics.ts        # 指标模型（时序/计数器）
│   │   ├── DebugLineChart.ts      # Canvas 走线图
│   │   └── interpolation.ts       # 插值工具
│   └── network/
│       └── NetworkClient.ts       # Colyseus 客户端封装
│
├── tests/                         # 93 个测试
│   ├── server/
│   │   ├── movement.test.ts       # 移动校验
│   │   ├── GameRoom.test.ts       # 房间逻辑
│   │   ├── combat.test.ts         # 战斗系统
│   │   ├── weaponSystem.test.ts   # 武器系统
│   │   ├── aiSystem.test.ts       # AI 系统
│   │   └── playerSlots.test.ts    # 玩家槽位
│   ├── client/
│   │   ├── NetworkClient.test.ts  # 网络客户端
│   │   ├── debugMetrics.test.ts   # 调试指标
│   │   ├── interpolation.test.ts  # 插值
│   │   └── recoil.test.ts         # 后坐力
│   └── shared/
│       └── collision.test.ts      # 碰撞检测
│
├── index.html                     # HTML 入口
├── package.json                   # 依赖和脚本
├── tsconfig.json / tsconfig.server.json
├── vite.config.ts / vitest.config.ts
├── render.yaml                    # Render 部署配置（已弃用）
├── README.md
└── CODE_STRUCTURE.md
```

---

## 核心架构

```
浏览器                         Colyseus 服务端
  │                               │
  │ WASD + 鼠标                     │ 权威校验
  ▼                               ▼
InputController ──move──▶  movement.ts (碰撞 + 限速)
  │                               │
  │ 左键/1/2/R                     │ weaponSystem.ts
  │                               ├─ canFireWeapon (射速/弹药)
  │ ──weaponFire──▶               ├─ updateWeapon (消费弹药+散布)
  │ ──reload──▶                   ├─ startReload / completeReload
  │ ──switchWeapon──▶             └─ switchWeapon
  │                               │
  │                               │ combat.ts
  │                               ├─ createShotRay (yaw+pitch)
  │                               ├─ intersectRayWithAiEnemy
  │                               └─ 命中 → AI HP 减少/死亡
  │                               │
  │                               │ aiSystem.ts
  │                               ├─ patrol (waypoint 移动)
  │                               ├─ FOV detection (120°) 
  │                               ├─ attack (900ms 间隔, 12 dmg)
  │                               └─ respawn (5s)
  │                               │
  │ ◀──state broadcast──          │ Colyseus Schema 同步
  │                               │
  ▼                               │
WeaponView (枪模+动画)            │
TracerView (曳光弹)               │
AiEnemyView (AI 渲染)             │
RemotePlayerView (远端玩家)        │
DebugHud (F3 面板)                │
```

---

## 数据流（开火）

```
按住左键 (60fps)
  │
  ▼
ClientGame.trySendHeldFire()
  │ RPM 节流（AR-4=12.5/s, R-47=10/s）
  │
  ▼ sendWeaponFire (WebSocket)
GameRoom.handleWeaponFire()
  ├─ canFireWeapon()         ← 弹药/冷却/换弹检查
  ├─ updateWeapon()          ← 消费弹药, 散布增加
  ├─ createShotRay()         ← yaw+pitch → 射线
  ├─ intersectRayWithAiEnemy ← 命中检测
  ├─ ai.hp -= weapon.damage  ← 服务端权威伤害
  │
  ▼ broadcast weaponFireResult
ClientGame (weaponFireResult handler)
  ├─ accepted → playAcceptedFire (火光+后坐力+曳光弹+枪声)
  ├─ empty_mag → playEmptyClick (咔嗒声)
  └─ hit → playHit (命中声+文字反馈)
```

---

## 两把原创步枪

| 属性 | AR-4 | R-47 |
|------|------|------|
| 伤害 | 24 | 34 |
| 射速 | 750 RPM | 600 RPM |
| 弹匣 | 30 发 | 30 发 |
| 备弹 | 90 发 | 90 发 |
| 换弹 | 1.9s | 2.2s |
| 散布 | 低（0.004→0.035） | 高（0.006→0.055） |
| 后坐力 | 较小 | 较大 |
| 曳光弹 | 蓝青色细线 | 橙黄色粗线 |
| 枪模颜色 | 蓝灰/黑 | 棕橙/黑 |
| 切换键 | 1 | 2 |

---

## 3 个 AI 巡逻敌人

| ID | 名称 | 出生点 | 巡逻路线 |
|----|------|--------|---------|
| ai-1 | Patrol One | (-10, -12) | (-10,-12) → (-4,-14) → (-2,-8) |
| ai-2 | Patrol Two | (10, -12) | (10,-12) → (4,-14) → (2,-8) |
| ai-3 | Patrol Three | (0, 12) | (0,12) → (-6,8) → (6,8) |

- HP：100，伤害 12/每 0.9s，检测范围 18 单位，FOV 120°
- 死亡 5s 后复活
- 巡逻时橙色，攻击时亮红色，死亡倒地灰色

---

## F3 Debug HUD 指标

| 类别 | 指标 |
|------|------|
| FPS | 当前/平均 + 走线图 |
| Ping | 当前/avg/min/max/jitter + 走线图 |
| 网络 | move/fire/reload sends/sec, recv/sec, WS buffer |
| 服务端 | tick ms, AI ms, fire ms, accepted/rejected/sec, alive AI |
| 渲染 | 5Hz 降频刷新, 4 条 canvas 走线图 |

---

## 关键数值

| 参数 | 值 | 位置 |
|------|-----|------|
| 地图尺寸 | 48×48 单位 | `shared/constants.ts` |
| 相机高度 | 1.7 单位 | `shared/constants.ts` |
| 玩家最大 HP | 100 | `shared/constants.ts` |
| HP 回血延迟 | 3s 不受伤害后 | `shared/constants.ts` |
| 回血速度 | 10 HP/s | `shared/constants.ts` |
| 客户端移动速度 | 6 单位/s | `shared/constants.ts` |
| 服务端限速 | 9 单位/s | `shared/constants.ts` |
| 移动发送频率 | 20 Hz | `shared/constants.ts` |
| 鼠标灵敏度 | 0.0022 | `src/game/InputController.ts` |
| Pitch 范围 | ±1.35 弧度 | `shared/constants.ts` |
| AI 移动速度 | 2.2 单位/s | `shared/constants.ts` |
| AI 攻击间隔 | 900ms | `shared/constants.ts` |
| AI 复活延迟 | 5s | `shared/constants.ts` |
| 枪口火光持续 | 70ms | `shared/constants.ts` |
| 曳光弹持续 | 90ms | `src/game/TracerView.ts` |
| 伤害反馈视角 punch | -0.06 | `src/game/ClientGame.ts` |
| 开发端口 | 5173 (Vite) / 2567 (Server) | 配置文件 |
