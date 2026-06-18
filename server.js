const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// CONSTANTS
// ============================================================
const TICK = 60;
const MAP = 3000;
const SHIP_RADIUS = 22;
const SHIP_ACCEL = 0.12;
const SHIP_TURN = 0.04;
const SHIP_DRAG = 0.97;
const SHIP_MAX_HP = 100;
const CANNON_SPEED = 10;
const CANNON_DMG = 20;
const CANNON_CD = 600; // ms
const CANNON_LIFE = 50;
const TREASURE_COUNT = 8;
const TREASURE_SCORE = 50;
const TREASURE_HP = 20;
const ISLAND_COUNT = 10;
const SINK_SCORE = 100;
const RESPAWN_TIME = 180; // 3s at 60fps
const WIN_SCORE = 2000;
const AI_COUNT = 4;
const TREASURE_RESPAWN_TICKS = 180; // 3s at 60fps
const MAX_PLAYERS = 20;
const INPUT_RATE_LIMIT_MS = 16; // ~60fps

let nextId = 1;
const gid = () => nextId++;

// ============================================================
// LOGGING
// ============================================================
function log(level, msg, data = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...data,
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ============================================================
// WORLD GENERATION
// ============================================================
function makeIslands() {
  const islands = [];
  for (let i = 0; i < ISLAND_COUNT; i++) {
    islands.push({
      x: 300 + Math.random() * (MAP - 600),
      y: 300 + Math.random() * (MAP - 600),
      r: 50 + Math.random() * 80,
    });
  }
  return islands;
}

function makeTreasure(x, y) {
  return {
    id: gid(),
    x: x !== undefined ? x : 100 + Math.random() * (MAP - 200),
    y: y !== undefined ? y : 100 + Math.random() * (MAP - 200),
    size: 16,
    score: TREASURE_SCORE,
    hpRestore: TREASURE_HP,
    respawnTimer: 0,
  };
}

const islands = makeIslands();
let treasures = [];
for (let i = 0; i < TREASURE_COUNT; i++) treasures.push(makeTreasure());

// ============================================================
// SHIP FACTORY
// ============================================================
const COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#e67e22', '#1abc9c', '#d35400'];
let colorIdx = 0;

function makeShip(id, name, isAI = false) {
  const angle = Math.random() * Math.PI * 2;
  const col = isAI ? '#555' : COLORS[colorIdx++ % COLORS.length];
  return {
    id, name: String(name || 'Ship').slice(0, 16), isAI, color: col,
    x: 200 + Math.random() * (MAP - 400),
    y: 200 + Math.random() * (MAP - 400),
    angle,
    vx: 0, vy: 0,
    hp: SHIP_MAX_HP, maxHp: SHIP_MAX_HP,
    score: 0, kills: 0,
    input: { w: false, s: false, a: false, d: false, shoot: false, aimAngle: 0 },
    lastShot: 0,
    lastInputTime: 0,
    isDead: false, respawnTimer: 0,
    invuln: 0,
  };
}

// ============================================================
// GAME STATE
// ============================================================
const players = {};
const aiShips = [];
const cannonballs = [];
const effects = [];
let treasuresToRespawn = []; // { timer, x, y }

function spawnAI() {
  aiShips.length = 0;
  const names = ['Black Pearl', 'Flying Dutchman', 'Queen Anne', 'Jolly Roger'];
  for (let i = 0; i < AI_COUNT; i++) {
    const s = makeShip(gid(), names[i], true);
    s.maxHp = 80; s.hp = 80;
    aiShips.push(s);
  }
}
spawnAI();

// ============================================================
// HELPERS
// ============================================================
const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function pushFromIsland(entity, island) {
  const d = dist(entity, island);
  const minD = entity.r || SHIP_RADIUS;
  if (d < minD + island.r && d > 0) {
    const push = (minD + island.r - d);
    entity.x += ((entity.x - island.x) / d) * push;
    entity.y += ((entity.y - island.y) / d) * push;
  }
}

function getRandomPos() {
  for (let tries = 0; tries < 20; tries++) {
    const x = 200 + Math.random() * (MAP - 400);
    const y = 200 + Math.random() * (MAP - 400);
    let safe = true;
    for (const isl of islands) {
      if (dist({ x, y }, isl) < isl.r + 40) { safe = false; break; }
    }
    if (safe) return { x, y };
  }
  return { x: MAP / 2, y: MAP / 2 };
}

// ============================================================
// AI BEHAVIOR
// ============================================================
function updateAI(ship) {
  if (ship.isDead) return;

  let target = null;
  let minD = Infinity;

  for (const t of treasures) {
    const d = dist(ship, t);
    if (d < minD) { minD = d; target = t; }
  }

  for (const p of Object.values(players)) {
    if (p.isDead) continue;
    const d = dist(ship, p);
    if (d < 300 && d < minD) { minD = d; target = p; }
  }

  if (target) {
    const toAngle = Math.atan2(target.y - ship.y, target.x - ship.x);
    let diff = toAngle - ship.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    ship.input.a = diff < -0.1;
    ship.input.d = diff > 0.1;
    ship.input.w = true;
    ship.input.s = false;

    ship.input.shoot = false;
    for (const p of Object.values(players)) {
      if (!p.isDead && dist(ship, p) < 350) {
        ship.input.shoot = true;
        ship.input.aimAngle = Math.atan2(p.y - ship.y, p.x - ship.x);
        break;
      }
    }
  } else {
    ship.input.w = true;
    ship.input.a = Math.random() < 0.01;
    ship.input.d = Math.random() < 0.01;
  }
}

// ============================================================
// SHIP PHYSICS
// ============================================================
function updateShip(ship) {
  if (ship.isDead) {
    ship.respawnTimer--;
    if (ship.respawnTimer <= 0) {
      ship.isDead = false;
      ship.hp = ship.maxHp;
      ship.invuln = 120;
      const pos = getRandomPos();
      ship.x = pos.x;
      ship.y = pos.y;
    }
    return;
  }

  if (ship.invuln > 0) ship.invuln--;

  const inp = ship.input;
  if (inp.a) ship.angle -= SHIP_TURN;
  if (inp.d) ship.angle += SHIP_TURN;

  const ax = Math.cos(ship.angle) * SHIP_ACCEL;
  const ay = Math.sin(ship.angle) * SHIP_ACCEL;

  if (inp.w) { ship.vx += ax; ship.vy += ay; }
  if (inp.s) { ship.vx -= ax * 0.5; ship.vy -= ay * 0.5; }

  ship.vx *= SHIP_DRAG;
  ship.vy *= SHIP_DRAG;

  ship.x += ship.vx;
  ship.y += ship.vy;

  for (const isl of islands) pushFromIsland(ship, isl);

  ship.x = clamp(ship.x, SHIP_RADIUS, MAP - SHIP_RADIUS);
  ship.y = clamp(ship.y, SHIP_RADIUS, MAP - SHIP_RADIUS);

  if (inp.shoot) {
    const now = Date.now();
    if (now - ship.lastShot >= CANNON_CD) {
      ship.lastShot = now;
      const a = inp.aimAngle;
      cannonballs.push({
        id: gid(),
        x: ship.x + Math.cos(a) * (SHIP_RADIUS + 6),
        y: ship.y + Math.sin(a) * (SHIP_RADIUS + 6),
        vx: Math.cos(a) * CANNON_SPEED,
        vy: Math.sin(a) * CANNON_SPEED,
        damage: CANNON_DMG,
        owner: ship.id,
        life: CANNON_LIFE,
      });
    }
  }
}

// ============================================================
// GAME LOOP (60fps)
// ============================================================
let tick = 0;
let gameResetPending = false;

function gameLoop() {
  tick++;
  const now = Date.now();

  // Pre-compute all ships array once per frame
  const allShips = [...Object.values(players), ...aiShips];

  // Update all ships
  for (const s of Object.values(players)) updateShip(s);
  for (const s of aiShips) {
    updateAI(s);
    updateShip(s);
  }

  // Update cannonballs
  for (let i = cannonballs.length - 1; i >= 0; i--) {
    const c = cannonballs[i];
    c.x += c.vx;
    c.y += c.vy;
    c.life--;

    let hit = false;

    for (const isl of islands) {
      if (dist(c, isl) < isl.r) { hit = true; break; }
    }

    if (!hit) {
      for (const s of allShips) {
        if (s.isDead || s.id === c.owner || s.invuln > 0) continue;
        if (dist(c, s) < SHIP_RADIUS + 4) {
          s.hp -= c.damage;
          hit = true;

          const angle = Math.atan2(s.y - c.y, s.x - c.x);
          s.vx += Math.cos(angle) * 2;
          s.vy += Math.sin(angle) * 2;

          effects.push({ type: 'hit', x: c.x, y: c.y, life: 15 });

          if (s.hp <= 0) {
            s.isDead = true;
            s.respawnTimer = RESPAWN_TIME;
            effects.push({ type: 'sink', x: s.x, y: s.y, life: 30 });

            const killer = players[c.owner] || aiShips.find(a => a.id === c.owner);
            if (killer) {
              killer.score += SINK_SCORE;
              killer.kills++;
            }

            // AI respawn is now tick-based via respawnTimer
          }
          break;
        }
      }
    }

    if (c.life <= 0 || hit || c.x < 0 || c.x > MAP || c.y < 0 || c.y > MAP) {
      cannonballs.splice(i, 1);
    }
  }

  // Treasure collection
  for (let i = treasures.length - 1; i >= 0; i--) {
    const t = treasures[i];
    for (const s of allShips) {
      if (s.isDead) continue;
      if (dist(s, t) < SHIP_RADIUS + t.size) {
        s.score += t.score;
        s.hp = Math.min(s.maxHp, s.hp + t.hpRestore);
        effects.push({ type: 'collect', x: t.x, y: t.y, life: 20 });
        treasures.splice(i, 1);
        // Queue respawn with tick-based timer
        treasuresToRespawn.push({ timer: TREASURE_RESPAWN_TICKS });
        break;
      }
    }
  }

  // Treasure respawn (tick-based)
  for (let i = treasuresToRespawn.length - 1; i >= 0; i--) {
    treasuresToRespawn[i].timer--;
    if (treasuresToRespawn[i].timer <= 0) {
      treasures.push(makeTreasure());
      treasuresToRespawn.splice(i, 1);
    }
  }

  // Effects cleanup
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].life--;
    if (effects[i].life <= 0) effects.splice(i, 1);
  }

  // Build snapshot (compact to reduce bandwidth)
  const snapshot = {
    p: {}, // players
    a: aiShips.map(s => ({
      id: s.id, n: s.name, x: Math.round(s.x), y: Math.round(s.y),
      a: +s.angle.toFixed(2), hp: Math.round(s.hp), mhp: s.maxHp,
      c: s.color, sc: s.score, d: s.isDead ? 1 : 0, inv: s.invuln,
    })),
    b: cannonballs.map(c => ({ x: Math.round(c.x), y: Math.round(c.y) })),
    t: treasures.map(t => ({ x: Math.round(t.x), y: Math.round(t.y), id: t.id })),
    e: effects.map(e => ({ t: e.type, x: Math.round(e.x), y: Math.round(e.y), l: e.life })),
    w: gameState.wave || 0,
    ws: gameState.waveState || 'waiting',
    ea: gameState.enemiesAlive || 0,
    tk: gameState.totalKills || 0,
    k: tick,
    ms: MAP,
  };

  for (const p of Object.values(players)) {
    snapshot.p[p.id] = {
      id: p.id, n: p.name, x: Math.round(p.x), y: Math.round(p.y),
      a: +p.angle.toFixed(2), vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2),
      hp: Math.round(p.hp), mhp: p.maxHp, c: p.color,
      sc: p.score, kl: p.kills,
      d: p.isDead ? 1 : 0, rt: p.respawnTimer, inv: p.invuln,
      dmg: p.damage,
    };
  }

  io.emit('state', snapshot);

  // Check win
  if (!gameResetPending) {
    for (const p of Object.values(players)) {
      if (p.score >= WIN_SCORE) {
        gameResetPending = true;
        io.emit('winner', { id: p.id, name: p.name, score: p.score });
        log('info', 'winner', { name: p.name, score: p.score });
        setTimeout(() => {
          resetGame();
          gameResetPending = false;
        }, 5000);
        break;
      }
    }
  }
}

const gameState = { wave: 0, waveState: 'waiting', enemiesAlive: 0, totalKills: 0 };

setInterval(gameLoop, 1000 / TICK);

// ============================================================
// INPUT VALIDATION
// ============================================================
function sanitizeInput(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    w: !!data.w,
    a: !!data.a,
    s: !!data.s,
    d: !!data.d,
    shoot: !!data.shoot,
    aimAngle: typeof data.aimAngle === 'number' ? data.aimAngle : 0,
  };
}

// ============================================================
// SOCKET EVENTS
// ============================================================
io.on('connection', (socket) => {
  log('info', 'connection', { id: socket.id });

  socket.on('join', (data) => {
    if (Object.keys(players).length >= MAX_PLAYERS) {
      socket.emit('error_msg', { msg: '服务器已满' });
      socket.disconnect();
      return;
    }
    const name = (data && data.name) ? String(data.name).slice(0, 16) : 'Pirate';
    const ship = makeShip(socket.id, name);
    players[socket.id] = ship;
    socket.emit('joined', {
      id: socket.id, mapSize: MAP, islands, winScore: WIN_SCORE,
    });
    io.emit('player_joined', { id: socket.id, name: ship.name });
    log('info', 'player_joined', { name: ship.name, total: Object.keys(players).length });
  });

  socket.on('input', (data) => {
    const p = players[socket.id];
    if (!p) return;

    // Rate limiting
    const now = Date.now();
    if (now - p.lastInputTime < INPUT_RATE_LIMIT_MS) return;
    p.lastInputTime = now;

    const sanitized = sanitizeInput(data);
    if (sanitized) {
      p.input = { ...p.input, ...sanitized };
    }
  });

  socket.on('restart', () => {
    const p = players[socket.id];
    if (p) {
      p.score = 0; p.kills = 0; p.hp = SHIP_MAX_HP; p.maxHp = SHIP_MAX_HP;
      p.isDead = false; p.invuln = 120;
      const pos = getRandomPos();
      p.x = pos.x; p.y = pos.y;
      p.damage = CANNON_DMG;
      p.fireRate = CANNON_CD;
      p.upgrades = { damage: 0, speed: 0, hp: 0, fireRate: 0, range: 0 };
    }
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) {
      io.emit('player_left', { id: socket.id, name: p.name });
      delete players[socket.id];
      log('info', 'player_left', { name: p.name, total: Object.keys(players).length });
    }
  });
});

function resetGame() {
  for (const p of Object.values(players)) {
    p.score = 0; p.kills = 0; p.hp = SHIP_MAX_HP; p.maxHp = SHIP_MAX_HP;
    p.isDead = false; p.invuln = 120;
    const pos = getRandomPos();
    p.x = pos.x; p.y = pos.y;
  }
  spawnAI();
  treasures = [];
  treasuresToRespawn = [];
  for (let i = 0; i < TREASURE_COUNT; i++) treasures.push(makeTreasure());
  cannonballs.length = 0;
  effects.length = 0;
  gameState.wave = 0;
  gameState.waveState = 'waiting';
  gameState.enemiesAlive = 0;
  gameState.totalKills = 0;
  io.emit('game_reset');
  log('info', 'game_reset');
}

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
function shutdown(signal) {
  log('info', 'shutdown', { signal });
  io.emit('server_shutdown', { msg: '服务器正在重启...' });
  io.close(() => {
    server.close(() => {
      log('info', 'server_closed');
      process.exit(0);
    });
  });
  // Force exit after 5s
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  log('error', 'uncaughtException', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  log('error', 'unhandledRejection', { reason: String(reason) });
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    players: Object.keys(players).length,
    ai: aiShips.length,
    uptime: process.uptime(),
    tick,
  });
});

// ============================================================
// START
// ============================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  log('info', 'server_started', { port: PORT, map: MAP, ai: AI_COUNT });
});
