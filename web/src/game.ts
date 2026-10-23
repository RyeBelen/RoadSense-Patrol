export type Phase =
  "menu" | "countdown" | "playing" | "paused" | "crashing" | "results";
export type Hazard = "pothole" | "minor" | "patch" | "hump";
export type Traffic = "car" | "truck" | "motorcycle";
export type Pickup = "shield" | "repair" | "signal";
export type ObjectKind = Hazard | Traffic | Pickup;
export interface RoadObject {
  id: number;
  kind: ObjectKind;
  lane: number;
  x: number;
  z: number;
  color: number;
  detected: boolean;
  detectedAt: number;
  responded: boolean;
  resolved: boolean;
  swerve: number;
  near: boolean;
}
export interface RouteEvent {
  time: number;
  lane: number;
  kind: ObjectKind;
  color: number;
}
export const LANE_WIDTH = 3.5;
export const laneX = (lane: number) => (lane - 1) * LANE_WIDTH;
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const isHazard = (kind: ObjectKind): kind is Hazard =>
  ["pothole", "minor", "patch", "hump"].includes(kind);
export const isTraffic = (kind: ObjectKind): kind is Traffic =>
  ["car", "truck", "motorcycle"].includes(kind);
export const multiplier = (streak: number) =>
  Math.min(8, 1 + Math.floor(Math.max(0, streak) / 3));
export const responsePoints = (seconds: number) =>
  seconds <= 0.8 ? 150 : seconds <= 1.7 ? 75 : 25;

export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRoute(
  seed: number,
  duration = 300,
  offset = 0,
): RouteEvent[] {
  const random = seededRandom(seed);
  const events: RouteEvent[] = [];
  const hazards: Hazard[] = ["minor", "pothole", "patch", "hump"];
  for (let t = 1.5; t < duration;) {
    const time = t + offset;
    const lane = Math.floor(random() * 3);
    const kind = hazards[Math.floor(random() * 4)];
    events.push({ time, lane, kind, color: 0 });
    if (time >= 20 && random() < (time >= 55 ? 0.7 : 0.45)) {
      events.push({
        time,
        lane: (lane + 1 + Math.floor(random() * 2)) % 3,
        kind: kind === "pothole" ? "minor" : "pothole",
        color: 0,
      });
    }
    if (time > 10 && random() < 0.3) {
      events.push({
        time: time + 1,
        lane: (lane + 1) % 3,
        kind: (["shield", "repair", "signal"] as Pickup[])[
          Math.floor(random() * 3)
        ],
        color: 0,
      });
    }
    t += time < 20 ? 3.8 : time < 55 ? 2.9 : Math.max(1.8, 2.5 - time / 500);
  }
  for (let t = offset === 0 ? 12 : 1.5; t < duration;) {
    const time = t + offset;
    // Keep a reaction gap around each road hazard, with at least one clear lane per row.
    if (events.some((e) => isHazard(e.kind) && Math.abs(e.time - time) < 1)) {
      t += 0.5;
      continue;
    }
    const roll = random();
    const kind: Traffic =
      time >= 38 && roll < 0.29
        ? "truck"
        : time >= 28 && roll < 0.63
          ? "motorcycle"
          : "car";
    const nearby = events.find(
      (e) => isHazard(e.kind) && e.time > time && e.time < time + 3,
    );
    events.push({
      time,
      lane: nearby?.lane ?? Math.floor(random() * 3),
      kind,
      color: Math.floor(random() * 6),
    });
    t += time < 35 ? 8.5 : time < 85 ? 6 : 4.5;
  }
  return events.sort((a, b) => a.time - b.time);
}

export class Game {
  phase: Phase = "menu";
  previousPhase: Phase = "playing";
  seed = 0;
  time = 0;
  distance = 0;
  countdown = 3;
  crashTime = 0;
  lane = 1;
  x = 0;
  playerZ = 0;
  lives = 3;
  score = 0;
  streak = 0;
  bestStreak = 0;
  handled = 0;
  missed = 0;
  trafficPassed = 0;
  nearMisses = 0;
  detected = 0;
  speed = 22;
  cruiseSpeed = 22;
  boost = 0;
  brake = false;
  accelerate = false;
  scanHeld = false;
  scanning = false;
  scanEnergy = 1;
  scanCooldown = 0;
  scanCooldownDuration = 3;
  scanArmed = true;
  shield = 0;
  repair = 0;
  signal = 0;
  roughRoad = 0;
  hitFlash = 0;
  invulnerable = 0;
  message = "";
  messageTime = 0;
  objects: RoadObject[] = [];
  sound: (name: string) => void = () => {};
  private route: RouteEvent[] = [];
  private nextEvent = 0;
  private chunk = 0;
  private nextId = 1;
  get multiplier() {
    return multiplier(this.streak);
  }
  get accuracy() {
    return this.handled + this.missed === 0
      ? 100
      : Math.round((this.handled * 100) / (this.handled + this.missed));
  }
  get kph() {
    return Math.round(this.speed * 3.6);
  }
  get wideScan() {
    return this.scanning || this.signal > 0;
  }

  start(seed = Math.floor(Math.random() * 2147483647)) {
    const sound = this.sound;
    Object.assign(this, new Game());
    this.sound = sound;
    this.seed = seed;
    this.route = generateRoute(seed);
    this.phase = "countdown";
    this.sound("start");
  }
  clearInput() {
    this.brake = this.accelerate = this.scanHeld = false;
  }
  pause() {
    if (this.phase !== "playing" && this.phase !== "countdown") return;
    this.previousPhase = this.phase;
    this.phase = "paused";
    this.clearInput();
  }
  resume() {
    if (this.phase === "paused") this.phase = this.previousPhase;
  }
  pop(text: string) {
    this.message = text;
    this.messageTime = 1.5;
  }
  turn(direction: number) {
    if (this.phase !== "playing") return;
    const old = this.lane;
    this.lane = clamp(this.lane + Math.sign(direction), 0, 2);
    if (old === this.lane) return;
    const hazard = this.objects.find(
      (o) =>
        isHazard(o.kind) &&
        !o.resolved &&
        o.detected &&
        o.lane === old &&
        o.z < this.playerZ,
    );
    if (hazard) this.respond(hazard);
    this.objects.forEach((o) => {
      if (
        isHazard(o.kind) &&
        o.lane === old &&
        o.z > this.playerZ - 18 &&
        o.z < this.playerZ - 4
      )
        o.near = true;
    });
    this.sound("turn");
  }
  setBrake(held: boolean) {
    if (held && !this.brake && this.phase === "playing") {
      const hazard = this.objects.find(
        (o) =>
          isHazard(o.kind) &&
          o.kind !== "pothole" &&
          o.detected &&
          !o.resolved &&
          o.lane === this.lane &&
          o.z < this.playerZ,
      );
      if (hazard) this.respond(hazard);
    }
    this.brake = held;
  }
  private respond(object: RoadObject) {
    if (object.responded) return;
    object.responded = true;
    const points = responsePoints(this.time - object.detectedAt);
    this.score += points;
    this.pop(
      `${points === 150 ? "Perfect response" : points === 75 ? "Good response" : "Just in time"} +${points}`,
    );
    this.sound("score");
  }
  addObject(kind: ObjectKind, lane: number, z = -125, color = 0) {
    const object: RoadObject = {
      id: this.nextId++,
      kind,
      lane,
      x: laneX(lane),
      z,
      color,
      detected: false,
      detectedAt: 0,
      responded: false,
      resolved: false,
      swerve: 1.4 + color * 0.15,
      near: false,
    };
    this.objects.push(object);
    return object;
  }
  private cooldown(seconds: number) {
    this.scanCooldown = this.scanCooldownDuration = seconds;
  }
  private hit(label: string, penalty: number, loseLife = true) {
    if (this.invulnerable > 0) return;
    this.streak = 0;
    this.score = Math.max(0, this.score - penalty);
    if (loseLife) this.lives = Math.max(0, this.lives - 1);
    this.hitFlash = 0.65;
    this.invulnerable = 1.25;
    this.pop(label);
    this.sound("hit");
  }
  private clean(object: RoadObject) {
    this.handled++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const near =
      object.near &&
      object.kind === "pothole" &&
      Math.abs(object.lane - this.lane) === 1;
    if (near) this.nearMisses++;
    const points =
      ((this.scanning ? 200 : 100) + (near ? 50 : 0)) * this.multiplier;
    this.score += points;
    this.pop(`${near ? "Close call" : "Clear road"} +${points}`);
    this.sound("score");
  }
  private resolve(object: RoadObject) {
    const sameLane = Math.abs(this.x - object.x) < 1.6;
    if (isHazard(object.kind)) {
      if (!sameLane || (object.kind !== "pothole" && this.brake))
        this.clean(object);
      else if (this.shield > 0) {
        this.shield--;
        this.handled++;
        this.pop("Shield absorbed the hit");
        this.sound("pickup");
      } else {
        this.missed++;
        this.hit(
          object.kind === "pothole" ? "Pothole hit" : "Brake for rough road",
          object.kind === "pothole" ? 200 : 50,
          object.kind !== "patch",
        );
        if (object.kind === "patch") this.roughRoad = 2;
      }
    } else if (sameLane) {
      if (object.kind === "shield") {
        this.shield++;
        this.pop("Shield ready");
      }
      if (object.kind === "repair") {
        this.repair++;
        this.pop("Repair crew on standby");
      }
      if (object.kind === "signal") {
        this.signal = 5;
        this.pop("Wide radar for 5 seconds");
      }
      this.sound("pickup");
    }
  }
  update(dt: number) {
    dt = clamp(dt, 0, 0.05);
    if (
      this.phase === "paused" ||
      this.phase === "menu" ||
      this.phase === "results"
    )
      return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.messageTime = Math.max(0, this.messageTime - dt);
    if (this.phase === "countdown") {
      const old = Math.ceil(this.countdown);
      this.countdown -= dt;
      if (Math.ceil(this.countdown) !== old) this.sound("count");
      if (this.countdown <= 0) {
        this.phase = "playing";
        this.pop("Patrol started");
        this.sound("go");
      }
      return;
    }
    if (this.phase === "crashing") {
      this.crashTime += dt;
      if (this.crashTime >= 3) this.phase = "results";
      return;
    }
    this.time += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.signal = Math.max(0, this.signal - dt);
    this.roughRoad = Math.max(0, this.roughRoad - dt);
    this.boost = clamp(
      this.boost + (this.accelerate && !this.brake ? 0.75 : -0.75) * dt,
      0,
      1,
    );
    this.playerZ = -this.boost * 7;
    this.x += (laneX(this.lane) - this.x) * (1 - Math.exp(-12 * dt));
    this.scanCooldown = Math.max(0, this.scanCooldown - dt);
    if (!this.scanHeld) this.scanArmed = true;
    let scanning =
      this.scanHeld &&
      this.scanArmed &&
      this.scanCooldown <= 0 &&
      (this.scanEnergy >= 0.25 || (this.scanning && this.scanEnergy > 0));
    if (this.scanning && !scanning) this.cooldown(3);
    if (scanning) {
      this.scanEnergy = Math.max(0, this.scanEnergy - 0.24 * dt);
      if (this.scanEnergy <= 0) {
        scanning = false;
        this.scanArmed = false;
        this.cooldown(5);
      }
    } else this.scanEnergy = Math.min(1, this.scanEnergy + 0.1 * dt);
    this.scanning = scanning;
    this.cruiseSpeed = Math.min(36, 22 + this.time * 0.08);
    this.speed =
      this.cruiseSpeed *
      (1 + 0.75 * this.boost) *
      (this.brake ? 0.63 : 1) *
      (scanning ? 0.82 : 1) *
      (this.roughRoad > 0 ? 0.68 : 1);
    this.distance += this.speed * dt;
    if (this.time >= (this.chunk + 1) * 300 - 5) {
      this.chunk++;
      this.route = this.route
        .slice(this.nextEvent)
        .concat(
          generateRoute(this.seed + this.chunk * 7919, 300, this.chunk * 300),
        );
      this.nextEvent = 0;
    }
    while (
      this.nextEvent < this.route.length &&
      this.route[this.nextEvent].time <= this.time
    ) {
      const event = this.route[this.nextEvent++];
      this.addObject(event.kind, event.lane, -125, event.color);
    }
    for (const object of this.objects) {
      const previousZ = object.z;
      const traffic = isTraffic(object.kind);
      object.z +=
        this.speed *
        (object.kind === "truck"
          ? 0.68
          : object.kind === "car"
            ? 0.8
            : object.kind === "motorcycle"
              ? 1.08
              : 1) *
        dt;
      if (object.resolved) continue;
      if (traffic) {
        if (
          object.kind === "motorcycle" &&
          object.z > -65 &&
          object.z < this.playerZ - 14
        ) {
          object.swerve -= dt;
          if (object.swerve <= 0) {
            const target =
              object.lane === 0
                ? 1
                : object.lane === 2
                  ? 1
                  : object.color % 2
                    ? 0
                    : 2;
            if (
              !this.objects.some(
                (o) =>
                  o !== object &&
                  !o.resolved &&
                  (isTraffic(o.kind) || o.kind === "pothole") &&
                  o.lane === target &&
                  Math.abs(o.z - object.z) < 12,
              )
            )
              object.lane = target;
            object.swerve = 1.5;
            object.color++;
          }
        }
        // Drivers steer around a major pothole if the neighboring lane is clear.
        if (
          this.objects.some(
            (o) =>
              o.kind === "pothole" &&
              !o.resolved &&
              o.lane === object.lane &&
              o.z < object.z &&
              o.z > object.z - 16,
          )
        ) {
          const options = object.lane === 1 ? [0, 2] : [1];
          const free = options.find(
            (lane) =>
              !this.objects.some(
                (o) =>
                  o !== object &&
                  !o.resolved &&
                  o.lane === lane &&
                  Math.abs(o.z - object.z) < 16,
              ),
          );
          if (free !== undefined) object.lane = free;
        }
        object.x +=
          (laneX(object.lane) - object.x) *
          Math.min(1, dt * (object.kind === "motorcycle" ? 7 : 3));
        const length =
          object.kind === "truck"
            ? 5
            : object.kind === "motorcycle"
              ? 2.6
              : 3.5;
        const width = object.kind === "motorcycle" ? 1.05 : 1.65;
        if (
          Math.abs(this.x - object.x) < width &&
          object.z >= this.playerZ - length &&
          previousZ <= this.playerZ + length
        ) {
          object.resolved = true;
          this.hit("Traffic collision", 150);
        } else if (object.z > this.playerZ + length) {
          object.resolved = true;
          this.trafficPassed++;
        }
      } else {
        if (isHazard(object.kind) && this.repair > 0 && object.z > -65) {
          this.repair--;
          object.resolved = true;
          this.detected++;
          this.clean(object);
          this.pop("Repair crew cleared a hazard");
          continue;
        }
        if (
          isHazard(object.kind) &&
          !object.detected &&
          object.z > (this.wideScan ? -115 : -65) &&
          object.z < this.playerZ &&
          (object.lane === this.lane || this.wideScan)
        ) {
          object.detected = true;
          object.detectedAt = this.time;
          this.detected++;
          this.sound("detect");
        }
        if (object.z >= this.playerZ) {
          object.resolved = true;
          this.resolve(object);
        }
      }
      if (this.lives <= 0) {
        this.phase = "crashing";
        this.crashTime = 0;
        this.scanning = false;
        this.clearInput();
        this.sound("crash");
        break;
      }
    }
    this.objects = this.objects.filter((object) => object.z < 22);
  }
  get warning(): { title: string; action: string; danger: boolean } | null {
    const ahead = this.objects
      .filter(
        (o) =>
          !o.resolved &&
          o.z < this.playerZ &&
          o.z > -90 &&
          (isHazard(o.kind)
            ? o.detected
            : isTraffic(o.kind) && o.lane === this.lane),
      )
      .sort((a, b) => b.z - a.z)[0];
    if (!ahead) return null;
    const names: Record<string, string> = {
      pothole: "Major pothole",
      minor: "Minor pothole",
      patch: "Road patch",
      hump: "Speed hump",
      car: "Traffic ahead",
      truck: "Truck ahead",
      motorcycle: "Swerving motorcycle",
    };
    const danger = ahead.kind === "pothole" || isTraffic(ahead.kind);
    return {
      title: names[ahead.kind],
      action: danger ? "Change lane" : "Brake or change lane",
      danger,
    };
  }
}
