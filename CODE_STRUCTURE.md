# CS-Lite Web v0.1 — 代码结构

> 公网联机骨架版 · Babylon.js + Colyseus + TypeScript  
> 公网地址：https://cs-lite-web-5v5.onrender.com  
> GitHub：github.com/Sando-39/cs-lite-web-5v5

---

## 目录总览

```
cs-lite-web-5v5/
├── shared/                  # 客户端 + 服务端共享
│   ├── constants.ts         # 核心常量
│   └── types.ts             # 共享类型定义
│
├── server/                  # 服务端（Colyseus + Express）
│   ├── index.ts             # 服务端入口
│   ├── config/
│   │   └── spawns.ts        # 出生点配置
│   ├── logic/
│   │   ├── movement.ts      # 移动校验（防作弊）
│   │   └── playerSlots.ts   # 玩家槽位管理
│   └── rooms/
│       ├── GameRoom.ts      # 房间主逻辑
│       └── schema/
│           ├── GameState.ts # 房间状态 Schema
│           └── PlayerState.ts # 玩家状态 Schema
│
├── src/                     # 客户端（Vite + Babylon.js）
│   ├── main.ts              # 前端入口
│   ├── styles.css           # 全局样式
│   ├── app/
│   │   └── App.ts           # 首页 UI（创建/加入房间）
│   ├── game/
│   │   ├── ClientGame.ts    # 3D 游戏主循环
│   │   ├── InputController.ts # WASD + 鼠标输入
│   │   ├── MapBuilder.ts    # 3D 地图构建
│   │   └── RemotePlayerView.ts # 远端玩家渲染
│   └── network/
│       └── NetworkClient.ts # Colyseus 客户端封装
│
├── tests/                   # 测试
│   ├── server/
│   │   ├── movement.test.ts
│   │   ├── playerSlots.test.ts
│   │   └── GameRoom.test.ts
│   └── client/
│       └── NetworkClient.test.ts
│
├── index.html               # HTML 入口
├── package.json             # 依赖和脚本
├── tsconfig.json            # 客户端 TS 配置
├── tsconfig.server.json     # 服务端 TS 配置
├── vite.config.ts           # Vite 构建配置
├── vitest.config.ts         # Vitest 测试配置
├── render.yaml              # Render 部署配置
└── README.md                # 项目文档
```

---

## 文件说明

### `shared/` — 共享层

| 文件 | 职责 |
|------|------|
| `constants.ts` | 7 个核心常量：`ROOM_NAME`（房间名）、`MAX_PLAYERS`（最大玩家数 2）、`PLAYER_SPEED_UNITS_PER_SECOND`（客户端速度 6）、`MAX_SERVER_MOVE_SPEED_UNITS_PER_SECOND`（服务端限速 9）、`MOVE_SEND_HZ`（发送频率 20Hz）、`MAP_HALF_SIZE`（地图半边长 24）、`CAMERA_HEIGHT`（相机高度 1.7） |
| `types.ts` | 4 个共享类型：`PlayerColor`（`"blue" \| "orange"`）、`MoveMessage`（x, y, z, rotationY）、`ServerPlayerRecord`（含 sessionId, name, color, lastMoveAt）、`ClientPlayerSnapshot`（客户端用的玩家快照） |

### `server/` — 服务端

| 文件 | 职责 |
|------|------|
| `index.ts` | Express + Colyseus 服务端入口。监听 `PORT`（默认 2567），`/healthz` 健康检查，生产模式托管 Vite 构建的 `dist/client` 静态文件 |
| `config/spawns.ts` | 两个出生点：蓝方 `(-4, 1.7, 0)` 朝东，橙方 `(4, 1.7, 0)` 朝西 |
| `logic/movement.ts` | 移动校验核心：`normalizeMoveMessage()` 清洗客户端消息，`clampToMapBounds()` 边界钳制，`validateAndClampMove()` 速度限制 + 防瞬移（9 单位/秒上限） |
| `logic/playerSlots.ts` | 玩家槽位：`canAcceptPlayer()`（≤2人）、`getSpawnForSlot()`、`getColorForSlot()`、`createPlayerRecord()` |
| `rooms/GameRoom.ts` | Colyseus 房间主类。`onCreate` 注册 "move" 消息处理器，`onJoin` 分配出生点/颜色，`onLeave` 清理状态 + 广播 `playerLeft` |
| `rooms/schema/GameState.ts` | `MapSchema<PlayerState>` — 按 sessionId 索引的玩家 Map |
| `rooms/schema/PlayerState.ts` | `@colyseus/schema` 装饰器类，8 个同步字段（sessionId, name, x, y, z, rotationY, color, lastMoveAt），`applyRecord()` 批量更新 |

### `src/` — 客户端

| 文件 | 职责 |
|------|------|
| `main.ts` | Vite 入口。创建 `App` 实例，回调中创建 `ClientGame`（支持销毁重进） |
| `styles.css` | 200 行全局样式：暗色主题、首页面板、按钮渐变、HUD 卡片、十字准星、游戏画布全屏 |
| `app/App.ts` | 首页 UI 控制器。渲染"创建房间"/"加入房间"按钮和状态显示，连接成功后回调 `startGame` |
| `game/ClientGame.ts` | 游戏主循环。初始化 Babylon.js Engine/Scene，每帧更新输入 → 发送移动 → 渲染远端玩家 → 更新 HUD |
| `game/InputController.ts` | WASD 移动 + Pointer Lock 鼠标视角。WASD 根据 yaw 角计算方向向量，鼠标 sensitivity 0.0022，pitch 钳制 ±1.35 弧度，地图边界留 1 单位 margin |
| `game/MapBuilder.ts` | 静态场景构建器。48×48 沙色地面 + 四周围墙 + 4 个掩体方块，天蓝色 clearColor，半球光 |
| `game/RemotePlayerView.ts` | 远端玩家渲染。为每个远端玩家创建彩色方块（蓝 `0.15,0.45,1` / 橙 `1,0.45,0.12`），白色"鼻子"指示朝向，玩家离开时自动清理 mesh |
| `network/NetworkClient.ts` | Colyseus SDK 封装。`getColyseusEndpoint()` 自动选择 ws/wss，`createRoom()`/`joinRoom()` 连接管理，`sendMove()` 发送移动，`getPlayersSnapshot()` 读取同步状态，断线/错误/离开事件回调 |

### `tests/` — 测试

| 文件 | 测试数 | 覆盖内容 |
|------|--------|---------|
| `server/movement.test.ts` | 5 | 消息清洗、边界钳制、合法移动、瞬移截断 |
| `server/playerSlots.test.ts` | 4 | 人数限制、颜色分配、出生点差异、完整记录创建 |
| `server/GameRoom.test.ts` | 5 | 加入/离开/满员拒绝/位置更新/非法消息忽略 |
| `client/NetworkClient.test.ts` | 5 | ws/wss 端点选择（dev/prod）、中英文错误消息映射 |

### 配置文件

| 文件 | 职责 |
|------|------|
| `package.json` | 依赖：Babylon.js 8, Colyseus 0.17, Express 5, Vite 6, Vitest 4, TypeScript 5.8。脚本：`dev`（并行 client+server）、`build`、`start`、`test` |
| `tsconfig.json` | 客户端 TS 配置：ES2022, Bundler 模块, strict, experimentalDecorators |
| `tsconfig.server.json` | 服务端 TS 配置：NodeNext 模块, 输出 `dist/server`, sourceMap |
| `vite.config.ts` | Vite：端口 5173，输出 `dist/client` |
| `vitest.config.ts` | Vitest：globals 模式，node 环境，`tests/**/*.test.ts` |
| `render.yaml` | Render Blueprint：Node runtime, Free plan, build/start 命令, `/healthz` 健康检查 |

---

## 数据流

```
浏览器 A                         浏览器 B
  │                                │
  │ WASD + 鼠标                     │ WASD + 鼠标
  ▼                                ▼
InputController                 InputController
  │                                │
  │ MoveMessage (20Hz)             │ MoveMessage (20Hz)
  ▼                                ▼
NetworkClient ──WebSocket──▶  Colyseus Server  ◀──WebSocket── NetworkClient
                                │
                                ├─ normalizeMoveMessage()
                                ├─ validateAndClampMove()
                                ├─ 更新 PlayerState
                                └─ 广播状态变更
                                     │
                              ┌──────┴──────┐
                              ▼              ▼
                         浏览器 A        浏览器 B
                       RemotePlayerView RemotePlayerView
                       (渲染 B 的方块)   (渲染 A 的方块)
```

---

## 关键数值

| 参数 | 值 | 位置 |
|------|-----|------|
| 最大玩家数 | 2 | `shared/constants.ts` |
| 客户端移动速度 | 6 单位/秒 | `shared/constants.ts` |
| 服务端限速 | 9 单位/秒 | `shared/constants.ts` |
| 移动发送频率 | 20 Hz | `shared/constants.ts` |
| 地图尺寸 | 48×48 单位 | `shared/constants.ts` |
| 相机高度 | 1.7 单位 | `shared/constants.ts` |
| 鼠标灵敏度 | 0.0022 | `src/game/InputController.ts` |
| 开发端口 | 5173 (Vite) / 2567 (Server) | `vite.config.ts` / `server/index.ts` |
