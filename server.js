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
const RESPAWN_TIME = 180; // 3s
const WIN_SCORE = 2000;
const AI_COUNT = 4;

let nextId = 1;
const gid = () => nextId++;

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

function makeTreasure() {
  return {
    id: gid(),
    x: 100 + Math.random() * (MAP - 200),
    y: 100 + Math.random() * (MAP - 200),
    size: 16,
    score: TREASURE_SCORE,
    hpRestore: TREASURE_HP,
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
    id, name: name || `Ship_${id}`, isAI, color: col,
    x: 200 + Math.random() * (MAP - 400),
    y: 200 + Math.random() * (MAP - 400),
    angle,
    vx: 0, vy: 0,
    hp: SHIP_MAX_HP, maxHp: SHIP_MAX_HP,
    score: 0, kills: 0,
    input: { w: false, s: false, a: false, d: false, shoot: false, aimAngle: 0 },
    lastShot: 0,
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
const effects = []; // explosions, splashes

// Spawn AI ships
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

function circleIsland(cx, cy, cr, ix, iy, ir) {
  return dist({ x: cx, y: cy }, { x: ix, y: iy }) < cr + ir;
}

function pushFromIsland(entity, island) {
  const d = dist(entity, island);
  const minD = entity.r || SHIP_RADIUS;
  if (d < minD + island.r && d > 0) {
    const push = (minD + island.r - d);
    entity.x += ((entity.x - island.x) / d) * push;
    entity.y += ((entity.y - island.y) / d) * push;
  }
}

// ============================================================
// AI BEHAVIOR
// ============================================================
function updateAI(ship, dt) {
  if (ship.isDead) return;

  // Find nearest target (player or treasure)
  let target = null;
  let minD = Infinity;

  // Prefer treasure
  for (const t of treasures) {
    const d = dist(ship, t);
    if (d < minD) { minD = d; target = t; }
  }

  // If close to a player, consider attacking
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

    // Shoot at nearby players
    ship.input.shoot = false;
    for (const p of Object.values(players)) {
      if (!p.isDead && dist(ship, p) < 350) {
        ship.input.shoot = true;
        ship.input.aimAngle = Math.atan2(p.y - ship.y, p.x - ship.x);
        break;
      }
    }
  } else {
    // Wander
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
      ship.x = 200 + Math.random() * (MAP - 400);
      ship.y = 200 + Math.random() * (MAP - 400);
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

  // Island collision
  for (const isl of islands) pushFromIsland(ship, isl);

  // Map bounds
  ship.x = clamp(ship.x, SHIP_RADIUS, MAP - SHIP_RADIUS);
  ship.y = clamp(ship.y, SHIP_RADIUS, MAP - SHIP_RADIUS);

  // Shooting
  if (inp.shoot) {
    const now = Date.now();
    if (now - ship.lastShot >= CANNON_CD) {
      ship.lastShot = now;
      const a = ship.isAI ? inp.aimAngle : inp.aimAngle;
      // Fire from ship side (offset perpendicular)
      const perpAngle = a;
      cannonballs.push({
        id: gid(),
        x: ship.x + Math.cos(perpAngle) * (SHIP_RADIUS + 6),
        y: ship.y + Math.sin(perpAngle) * (SHIP_RADIUS + 6),
        vx: Math.cos(perpAngle) * CANNON_SPEED,
        vy: Math.sin(perpAngle) * CANNON_SPEED,
        damage: CANNON_DMG,
        owner: ship.id,
        life: CANNON_LIFE,
      });
    }
  }
}

// ============================================================
// GAME LOOP
// ============================================================
let tick = 0;

function gameLoop() {
  tick++;
  const now = Date.now();

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

    // Hit island
    for (const isl of islands) {
      if (dist(c, isl) < isl.r) { hit = true; break; }
    }

    // Hit ships
    if (!hit) {
      const allShips = [...Object.values(players), ...aiShips];
      for (const s of allShips) {
        if (s.isDead || s.id === c.owner || s.invuln > 0) continue;
        if (dist(c, s) < SHIP_RADIUS + 4) {
          s.hp -= c.damage;
          hit = true;

          // Knockback
          const angle = Math.atan2(s.y - c.y, s.x - c.x);
          s.vx += Math.cos(angle) * 2;
          s.vy += Math.sin(angle) * 2;

          effects.push({ type: 'hit', x: c.x, y: c.y, life: 15 });

          if (s.hp <= 0) {
            s.isDead = true;
            s.respawnTimer = RESPAWN_TIME;
            effects.push({ type: 'sink', x: s.x, y: s.y, life: 30 });

            // Score for killer
            const killer = players[c.owner] || aiShips.find(a => a.id === c.owner);
            if (killer) {
              killer.score += SINK_SCORE;
              killer.kills++;
            }

            // AI respawns
            if (s.isAI) {
              setTimeout(() => {
                s.isDead = false;
                s.hp = s.maxHp;
                s.invuln = 120;
                s.x = 200 + Math.random() * (MAP - 400);
                s.y = 200 + Math.random() * (MAP - 400);
              }, 3000);
            }
          }
          break;
        }
      }
    }

    if (c.life <= 0 || hit) {
      cannonballs.splice(i, 1);
      continue;
    }

    // Out of map
    if (c.x < 0 || c.x > MAP || c.y < 0 || c.y > MAP) {
      cannonballs.splice(i, 1);
    }
  }

  // Treasure collection
  for (let i = treasures.length - 1; i >= 0; i--) {
    const t = treasures[i];
    const allShips = [...Object.values(players), ...aiShips];
    for (const s of allShips) {
      if (s.isDead) continue;
      if (dist(s, t) < SHIP_RADIUS + t.size) {
        s.score += t.score;
        s.hp = Math.min(s.maxHp, s.hp + t.hpRestore);
        effects.push({ type: 'collect', x: t.x, y: t.y, life: 20 });
        treasures.splice(i, 1);
        // Respawn treasure
        setTimeout(() => treasures.push(makeTreasure()), 3000);
        break;
      }
    }
  }

  // Effects cleanup
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].life--;
    if (effects[i].life <= 0) effects.splice(i, 1);
  }

  // Build snapshot
  const snapshot = {
    players: {},
    ai: aiShips.map(s => ({
      id: s.id, name: s.name, x: s.x, y: s.y, angle: s.angle,
      hp: s.hp, maxHp: s.maxHp, color: s.color, score: s.score,
      isDead: s.isDead, invuln: s.invuln,
    })),
    cannonballs: cannonballs.map(c => ({ x: c.x, y: c.y })),
    treasures: treasures.map(t => ({ x: t.x, y: t.y, id: t.id })),
    effects,
    islands,
    tick,
    mapSize: MAP,
  };

  for (const p of Object.values(players)) {
    snapshot.players[p.id] = {
      id: p.id, name: p.name, x: p.x, y: p.y, angle: p.angle,
      vx: p.vx, vy: p.vy,
      hp: p.hp, maxHp: p.maxHp, color: p.color,
      score: p.score, kills: p.kills,
      isDead: p.isDead, respawnTimer: p.respawnTimer,
      invuln: p.invuln,
    };
  }

  io.emit('state', snapshot);

  // Check win
  for (const p of Object.values(players)) {
    if (p.score >= WIN_SCORE) {
      io.emit('winner', { id: p.id, name: p.name, score: p.score });
      // Reset after 5s
      setTimeout(resetGame, 5000);
      break;
    }
  }
}

setInterval(gameLoop, 1000 / TICK);

// ============================================================
// SOCKET EVENTS
// ============================================================
io.on('connection', (socket) => {
  socket.on('join', (data) => {
    const ship = makeShip(socket.id, data.name);
    players[socket.id] = ship;
    socket.emit('joined', {
      id: socket.id, mapSize: MAP, islands, winScore: WIN_SCORE,
    });
    io.emit('player_joined', { id: socket.id, name: ship.name });
    console.log(`${ship.name} joined (${Object.keys(players).length} players)`);
  });

  socket.on('input', (data) => {
    const p = players[socket.id];
    if (!p) return;
    p.input = { ...p.input, ...data };
  });

  socket.on('restart', () => {
    const p = players[socket.id];
    if (p) {
      p.score = 0; p.kills = 0; p.hp = SHIP_MAX_HP;
      p.isDead = false; p.invuln = 120;
      p.x = 200 + Math.random() * (MAP - 400);
      p.y = 200 + Math.random() * (MAP - 400);
    }
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) {
      io.emit('player_left', { id: socket.id, name: p.name });
      delete players[socket.id];
    }
  });
});

function resetGame() {
  for (const p of Object.values(players)) {
    p.score = 0; p.kills = 0; p.hp = SHIP_MAX_HP;
    p.isDead = false; p.invuln = 120;
    p.x = 200 + Math.random() * (MAP - 400);
    p.y = 200 + Math.random() * (MAP - 400);
  }
  spawnAI();
  treasures = [];
  for (let i = 0; i < TREASURE_COUNT; i++) treasures.push(makeTreasure());
  cannonballs.length = 0;
  io.emit('game_reset');
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Pirate Battle server on port ${PORT}`);
});
