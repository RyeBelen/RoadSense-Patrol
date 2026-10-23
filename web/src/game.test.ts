import test from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  generateRoute,
  isHazard,
  multiplier,
  responsePoints,
  laneX,
} from "./game.ts";
import { loadScores, saveScore, SCORE_KEY } from "./storage.ts";
import { hazardVisible } from "./game.ts";

test("hazards stay hidden until the scanner finds them, then remain revealed after a lane change", () => {
  const game = new Game();
  game.phase = "playing";
  const hazard = game.addObject("pothole", 0, -40);
  game.update(1 / 60);
  assert.equal(hazardVisible(hazard), false);
  assert.equal(game.radarStartZ, -65);
  game.scanHeld = true;
  game.update(1 / 60);
  assert.equal(game.radarStartZ, -115);
  assert.equal(hazardVisible(hazard), true);
  game.scanHeld = false;
  game.turn(1);
  game.update(1 / 60);
  assert.equal(game.radarStartZ, -65);
  assert.equal(hazardVisible(hazard), true);
  hazard.resolved = true;
  assert.equal(hazardVisible(hazard), false);
});

test("blocked browser storage does not break rankings or score entry", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Storage blocked");
    },
  });
  try {
    assert.deepEqual(loadScores(), []);
    assert.equal(
      saveScore({ name: "AAA", score: 100, distance: 100, date: "2026-10-23" }),
      false,
    );
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

function playing() {
  const game = new Game();
  game.phase = "playing";
  return game;
}
function advance(game: Game, seconds: number, hz = 60) {
  for (let i = 0; i < Math.round(seconds * hz); i++) game.update(1 / hz);
}

test("seeded routes reproduce hazards and reserve at least one lane per row", () => {
  const route = generateRoute(4242);
  assert.deepEqual(route, generateRoute(4242));
  assert.notDeepEqual(route, generateRoute(4243));
  for (const event of route) {
    assert.ok(event.lane >= 0 && event.lane <= 2);
    assert.ok(route.filter((other) => other.time === event.time).length <= 2);
  }
  for (const kind of [
    "minor",
    "pothole",
    "patch",
    "hump",
    "car",
    "truck",
    "motorcycle",
    "shield",
    "repair",
    "signal",
  ])
    assert.ok(
      route.some((event) => event.kind === kind),
      kind,
    );
  assert.ok(
    route.filter((e) => e.kind === "motorcycle").every((e) => e.time >= 28),
  );
  assert.ok(route.filter((e) => e.kind === "truck").every((e) => e.time >= 38));
  assert.ok(
    route.filter((e) => e.time > 200).length >
      route.filter((e) => e.time < 100).length,
  );
});
test("response timing and streak thresholds match arcade scoring", () => {
  assert.equal(multiplier(0), 1);
  assert.equal(multiplier(3), 2);
  assert.equal(multiplier(99), 8);
  assert.equal(responsePoints(0.8), 150);
  assert.equal(responsePoints(1.7), 75);
  assert.equal(responsePoints(2), 25);
});
test("start resets every run and countdown leads into gameplay", () => {
  const game = playing();
  game.score = 1000;
  game.lives = 1;
  game.shield = 2;
  game.scanHeld = true;
  game.start(123);
  assert.equal(game.phase, "countdown");
  assert.equal(game.lives, 3);
  assert.equal(game.score, 0);
  assert.equal(game.shield, 0);
  assert.equal(game.scanHeld, false);
  advance(game, 3.1);
  assert.equal(game.phase, "playing");
  assert.ok(game.time < 0.2);
});
test("acceleration ramps and braking takes priority", () => {
  const game = playing();
  game.accelerate = true;
  advance(game, 0.5);
  assert.ok(game.boost > 0.3 && game.boost < 0.4);
  advance(game, 1);
  assert.equal(game.boost, 1);
  assert.ok(game.playerZ < 0);
  assert.ok(game.speed > game.cruiseSpeed * 1.7);
  game.setBrake(true);
  advance(game, 1.5);
  assert.equal(game.boost, 0);
  assert.ok(game.speed < game.cruiseSpeed * 0.64);
});
test("scanner release starts a three-second cooldown and can recharge", () => {
  const game = playing();
  game.scanHeld = true;
  advance(game, 1);
  assert.equal(game.scanning, true);
  assert.ok(game.scanEnergy < 0.8);
  game.scanHeld = false;
  game.update(1 / 60);
  assert.equal(game.scanCooldown, 3);
  assert.equal(game.scanning, false);
  game.scanHeld = true;
  advance(game, 1);
  assert.equal(game.scanning, false);
  advance(game, 2.1);
  assert.equal(game.scanning, true);
});
test("depleted scanner waits five seconds and requires release before rearming", () => {
  const game = playing();
  game.scanHeld = true;
  advance(game, 4.2);
  assert.equal(game.scanning, false);
  assert.ok(game.scanCooldown > 4.9);
  assert.equal(game.scanArmed, false);
  advance(game, 6);
  assert.equal(game.scanning, false);
  assert.ok(game.scanEnergy > 0.5);
  game.scanHeld = false;
  game.update(1 / 60);
  game.scanHeld = true;
  game.update(1 / 60);
  assert.equal(game.scanning, true);
});
test("normal radar marks only its lane and scan reveals neighboring hazards", () => {
  const game = playing();
  const center = game.addObject("minor", 1, -40);
  const left = game.addObject("pothole", 0, -40);
  game.update(1 / 60);
  assert.equal(center.detected, true);
  assert.equal(left.detected, false);
  game.scanHeld = true;
  game.update(1 / 60);
  assert.equal(left.detected, true);
  game.turn(1);
  assert.equal(left.detected, true);
});
test("major potholes require steering even under braking", () => {
  const game = playing();
  game.brake = true;
  game.addObject("pothole", 1, -0.1);
  game.update(1 / 60);
  assert.equal(game.lives, 2);
  const avoid = playing();
  avoid.lane = 0;
  avoid.x = laneX(0);
  avoid.addObject("pothole", 1, -0.1);
  avoid.update(1 / 60);
  assert.equal(avoid.lives, 3);
  assert.equal(avoid.handled, 1);
  assert.equal(avoid.score, 100);
});
test("minor hazards and humps are safe when braking; patches slow instead of costing a life", () => {
  for (const kind of ["minor", "hump", "patch"] as const) {
    const game = playing();
    game.brake = true;
    game.addObject(kind, 1, -0.1);
    game.update(1 / 60);
    assert.equal(game.lives, 3);
    assert.equal(game.handled, 1);
  }
  const patch = playing();
  patch.addObject("patch", 1, -0.1);
  patch.update(1 / 60);
  assert.equal(patch.lives, 3);
  assert.equal(patch.roughRoad, 2);
  assert.equal(patch.missed, 1);
});
test("collision uses the visible car position during lane transitions", () => {
  const game = playing();
  game.turn(-1);
  game.addObject("pothole", 1, -0.1);
  game.update(1 / 60);
  assert.equal(game.lives, 2);
  const game2 = playing();
  game2.turn(-1);
  advance(game2, 0.5);
  game2.addObject("pothole", 1, -0.1);
  game2.update(1 / 60);
  assert.equal(game2.lives, 3);
});
test("traffic collisions cost one life and short recovery prevents piled-up damage", () => {
  const game = playing();
  game.addObject("car", 1, -2);
  game.addObject("truck", 1, -3);
  game.update(1 / 60);
  assert.equal(game.lives, 2);
  advance(game, 1.3);
  game.addObject("motorcycle", 1, -1);
  game.update(1 / 60);
  assert.equal(game.lives, 1);
});
test("shield, repair and signal pickups apply their documented effects", () => {
  const game = playing();
  game.addObject("shield", 1, -0.1);
  game.update(1 / 60);
  assert.equal(game.shield, 1);
  game.addObject("pothole", 1, -0.1);
  game.update(1 / 60);
  assert.equal(game.shield, 0);
  assert.equal(game.lives, 3);
  game.addObject("repair", 1, -0.1);
  game.update(1 / 60);
  const object = game.addObject("pothole", 1, -50);
  game.update(1 / 60);
  assert.equal(object.resolved, true);
  assert.equal(game.repair, 0);
  game.addObject("signal", 1, -0.1);
  game.update(1 / 60);
  assert.equal(game.wideScan, true);
  advance(game, 5.1);
  assert.equal(game.wideScan, false);
});
test("responding to a warning awards once and scan doubles clean points", () => {
  const game = playing();
  const object = game.addObject("minor", 1, -40);
  game.update(1 / 60);
  game.setBrake(true);
  assert.equal(game.score, 150);
  game.setBrake(false);
  game.setBrake(true);
  assert.equal(game.score, 150);
  object.z = -0.1;
  game.scanHeld = true;
  game.update(1 / 60);
  assert.equal(game.score, 350);
});
test("pause freezes the route and clears held input", () => {
  const game = playing();
  game.accelerate = game.brake = game.scanHeld = true;
  const object = game.addObject("car", 1, -40);
  game.pause();
  advance(game, 5);
  assert.equal(game.time, 0);
  assert.equal(object.z, -40);
  assert.equal(game.brake, false);
  game.resume();
  advance(game, 1);
  assert.ok(game.time > 0.9);
  assert.ok(object.z > -40);
});
test("third life ends the run, crash transitions to results, and replay resets", () => {
  const game = playing();
  game.lives = 1;
  game.addObject("pothole", 1, -0.1);
  game.update(1 / 60);
  assert.equal(game.phase, "crashing");
  assert.equal(game.lives, 0);
  const distance = game.distance;
  advance(game, 3.1);
  assert.equal(game.phase, "results");
  assert.equal(game.distance, distance);
  game.start(5);
  assert.equal(game.objects.length, 0);
  assert.equal(game.lives, 3);
  assert.equal(game.phase, "countdown");
});
test("30 and 120 Hz movement have comparable distance and lane positions", () => {
  const a = playing(),
    b = playing();
  a.accelerate = b.accelerate = true;
  a.turn(1);
  b.turn(1);
  advance(a, 3, 30);
  advance(b, 3, 120);
  assert.ok(Math.abs(a.distance - b.distance) < 1);
  assert.ok(Math.abs(a.x - b.x) < 0.01);
});
test("route continues across the five-minute boundary and cleans passed objects", () => {
  const game = new Game();
  game.start(55);
  game.phase = "playing";
  game.lives = 10000;
  advance(game, 310);
  assert.ok(game.time > 309);
  assert.ok(game.objects.some((o) => o.z < 0));
  assert.ok(game.objects.every((o) => o.z < 22));
  assert.ok(game.objects.length < 50);
  assert.ok(game.objects.some((o) => isHazard(o.kind)));
});
test("rankings tolerate corrupt storage, reject invalid records, and retain only the top ten", () => {
  const map = new Map<string, string>();
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
  map.set(SCORE_KEY, "not json");
  assert.deepEqual(loadScores(storage), []);
  map.set(
    SCORE_KEY,
    JSON.stringify([
      { name: "<script>", score: 100, distance: 0, date: "" },
      { name: "AAA", score: -1, distance: 0, date: "" },
    ]),
  );
  assert.deepEqual(loadScores(storage), []);
  for (let i = 0; i < 15; i++)
    assert.equal(
      saveScore(
        { name: "ABC", score: i * 100, distance: i, date: "2026-10-23" },
        storage,
      ),
      true,
    );
  const scores = loadScores(storage);
  assert.equal(scores.length, 10);
  assert.equal(scores[0].score, 1400);
  assert.equal(scores[9].score, 500);
  assert.equal(
    saveScore(
      { name: "ABC", score: 0, distance: 0, date: "" },
      {
        getItem: () => null,
        setItem: () => {
          throw Error("quota");
        },
      },
    ),
    false,
  );
});
