# 海盗争霸 | Pirate Battle

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](#)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-orange.svg)](#)

**多人实时海盗船对战网页游戏 — 打开浏览器就能和朋友一起抢宝箱、轰敌船、海上争霸！**

> 🌍 [English](#english) | [中文](#中文) | [日本語](#日本語)

---

## 中文

### 游戏简介

在广阔的海洋上驾驶你的海盗船，与AI敌船和其他玩家展开激烈海战。收集漂浮的宝箱获取分数，用大炮击沉敌船夺取战利品，率先达到2000分的船长获胜！

### 核心玩法

- **驾驶船只** — `WASD` 控制方向，感受真实的海上漂移感
- **瞄准射击** — 鼠标瞄准，左键开炮，体验侧舷齐射的快感
- **收集宝藏** — 海面漂浮的宝箱是得分的关键
- **击沉敌船** — AI巡逻船和其他玩家都是你的目标
- **先到2000分** — 每个宝箱50分，击沉敌船100分

### 操作方式

| 按键 | 功能 |
|------|------|
| `W` | 加速前进 |
| `S` | 减速/后退 |
| `A` | 向左转舵 |
| `D` | 向右转舵 |
| 鼠标移动 | 瞄准方向 |
| 左键点击/按住 | 发射炮弹 |
| `Tab` | 显示排行榜 |

### 游戏特色

- 🚢 **真实船舶物理** — 惯性漂移、转向半径、速度衰减
- 🏝️ **热带海岛地图** — 10座岛屿作为掩体和战术要地
- 💰 **宝箱系统** — 定时刷新，拾取回复生命值
- 🤖 **AI敌船** — 4艘AI巡逻船，会主动追击和射击
- 👥 **多人对战** — 支持多人同时在线对战
- 📊 **实时排行榜** — 实时更新所有玩家得分
- 🎯 **击杀播报** — 每次击沉都有全屏播报

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/cyl147368/pirate-battle.git
cd pirate-battle

# 安装依赖
npm install

# 启动服务器
node server.js

# 浏览器打开 http://localhost:3000
```

### 多人游戏

1. 确保所有玩家在同一局域网，或服务器有公网IP
2. 分享链接 `http://你的服务器IP:3000`
3. 输入船名，点击"扬帆起航"
4. 开始海战！

### 技术架构

| 组件 | 技术 | 说明 |
|------|------|------|
| 服务器 | Node.js + Express | REST API + 静态文件服务 |
| 实时通信 | Socket.io | WebSocket双向通信，60fps状态同步 |
| 游戏引擎 | 服务端权威 | 物理计算、碰撞检测、伤害判定全在服务端 |
| 渲染 | HTML5 Canvas | 2D渲染，客户端插值平滑 |
| UI设计 | Pirata One + Crimson Text | 热带落日航海风格 |

### 项目结构

```
pirate-battle/
├── server.js          # 服务端游戏引擎 + API
├── public/
│   └── index.html     # 客户端游戏界面
├── package.json
└── README.md
```

---

## English

### Overview

**Pirate Battle** is a real-time multiplayer pirate ship battle web game. Sail the open seas, collect treasure chests, blast enemy ships with cannons, and dominate the ocean! First captain to reach 2000 points wins.

### Core Gameplay

- **Ship Navigation** — `WASD` controls with realistic inertia and drift mechanics
- **Cannon Combat** — Mouse aim, left-click to fire cannonballs at enemies
- **Treasure Collection** — Floating chests give points and restore health
- **Ship Sinking** — Sink AI patrol ships and other players for bonus points
- **Score Race** — First to 2000 points wins the match

### Controls

| Key | Action |
|-----|--------|
| `W` | Accelerate forward |
| `S` | Brake / Reverse |
| `A` | Turn left |
| `D` | Turn right |
| Mouse | Aim direction |
| Left Click | Fire cannons |
| `Tab` | Show leaderboard |

### Features

- 🚢 **Realistic Ship Physics** — Inertia, drift, turning radius, drag
- 🏝️ **Tropical Island Map** — 10 islands as cover and tactical positions
- 💰 **Treasure System** — Periodic spawns with health restoration
- 🤖 **AI Enemy Ships** — 4 patrol ships that actively chase and shoot
- 👥 **Multiplayer** — Support multiple players online simultaneously
- 📊 **Live Leaderboard** — Real-time score tracking
- 🎯 **Kill Feed** — Global notifications for every ship sunk

### Quick Start

```bash
git clone https://github.com/cyl147368/pirate-battle.git
cd pirate-battle
npm install
node server.js
# Open http://localhost:3000 in your browser
```

### Tech Stack

| Component | Technology | Description |
|-----------|------------|-------------|
| Server | Node.js + Express | REST API + static file serving |
| Networking | Socket.io | WebSocket full-duplex, 60fps state sync |
| Game Engine | Server-authoritative | Physics, collision, damage on server |
| Rendering | HTML5 Canvas | 2D rendering with client interpolation |
| Design | Pirata One + Crimson Text | Tropical sunset maritime aesthetic |

---

## 日本語

### 概要

**パイレートバトル** は、リアルタイム多人数対海賊船バトルWebゲームです。広大な海を航行し、宝箱を集め、大砲で敵船を沈め、海を支配しましょう！最初に2000ポイントに到達した船長が勝利です！

### 基本ゲームプレイ

- **船の操作** — `WASD` で慣性とドリフトを体感しながら操縦
- **大砲戦闘** — マウスで照準、左クリックでキャノンボール発射
- **宝箱収集** — 海に浮かぶ宝箱でポイント獲得と体力回復
- **船の沈没** — AIパトロール船や他のプレイヤーを沈めてボーナスポイント
- **スコアレース** — 最初に2000ポイントに到達した人が勝利

### 操作方法

| キー | 機能 |
|------|------|
| `W` | 前進加速 |
| `S` | ブレーキ / 後退 |
| `A` | 左回転 |
| `D` | 右回転 |
| マウス | 照準方向 |
| 左クリック | 大砲発射 |
| `Tab` | リーダーボード表示 |

### 特徴

- 🚢 **リアルな船の物理** — 惯性、ドリフト、旋回半径、抵抗
- 🏝️ **熱帯島マップ** — 隠れ場所と戦術的位置となる10の島
- 💰 **宝箱システム** — 定期スポーン、体力回復効果
- 🤖 **AI敵船** — 積極的に追跡・射撃する4隻のパトロール船
- 👥 **マルチプレイヤー** — 複数プレイヤーの同時オンライン対戦対応
- 📊 **リアルタイムリーダーボード** — リアルタイムスコア追跡
- 🎯 **キルフィード** — 船が沈むたびにグローバル通知

### クイックスタート

```bash
git clone https://github.com/cyl147368/pirate-battle.git
cd pirate-battle
npm install
node server.js
# ブラウザで http://localhost:3000 を開く
```

### 技術スタック

| コンポーネント | 技術 | 説明 |
|----------------|------|------|
| サーバー | Node.js + Express | REST API + 静的ファイル配信 |
| ネットワーキング | Socket.io | WebSocket全二重通信、60fps状態同期 |
| ゲームエンジン | サーバー権威型 | 物理、衝突、ダメージ計算はサーバー側 |
| レンダリング | HTML5 Canvas | クライアント補間付き2Dレンダリング |
| デザイン | Pirata One + Crimson Text | 熱帯の夕暮れ海事美学 |

---

## 许可证 | License

MIT License - 自由使用、修改和分发。

---

**由热爱大海的开发者用心打造 ⚓**
