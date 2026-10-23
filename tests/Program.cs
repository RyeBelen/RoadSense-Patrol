using RoadSensePatrol;

static void Check(bool condition, string message)
{
    if (!condition) throw new Exception(message);
    Console.WriteLine("PASS " + message);
}

Check(ScoreRules.Multiplier(0) == 1 && ScoreRules.Multiplier(2) == 1 &&
      ScoreRules.Multiplier(3) == 2 && ScoreRules.Multiplier(99) == 8, "streak multiplier thresholds and cap");
Check(ScoreRules.ResponsePoints(0.5f) == 150 && ScoreRules.ResponsePoints(1.2f) == 75 &&
      ScoreRules.ResponsePoints(2.1f) == 25, "warning response timing");
Check(ScoreRules.IsNearMiss(0, 1) && !ScoreRules.IsNearMiss(0, 2) &&
      !ScoreRules.IsNearMiss(1, 1), "near miss adjacency");
var a = RouteGenerator.Generate(4242, 75);
var b = RouteGenerator.Generate(4242, 75);
var c = RouteGenerator.Generate(4243, 75);
Check(a.SequenceEqual(b) && !a.SequenceEqual(c), "seeded route determinism");
Check(a.All(e => e.Lane is >= 0 and <= 2) && a.Any(e => e.Pickup.HasValue), "route lanes and pickups");
Check(a.Any(e => e.Hazard == HazardType.Patch), "route includes road patches");
Check(a.Any(e => e.Traffic == TrafficType.Car && e.Time < 38) &&
      a.Any(e => e.Traffic == TrafficType.Truck && e.Time >= 38) &&
      a.Where(e => e.Traffic.HasValue).All(e => e.ColorIndex is >= 0 and < 6),
    "cars arrive first, trucks and color variants appear later");
var longRoute = RouteGenerator.Generate(4242, 140);
Check(longRoute.Count(e => e.Traffic.HasValue && e.Time >= 85) >
      longRoute.Count(e => e.Traffic.HasValue && e.Time < 35),
    "traffic density increases during progression");
var model = new GameModel(new GameConfig { BoothSeed = 4242 });
model.Start();
for (int i = 0; i < 15 * 60; i++) model.Update(1f / 60f);
Check(model.Speed > 205 && model.Lives <= 3, "speed rises during an endless run");
var speedModel = new GameModel(new GameConfig { BoothSeed = 4242, StartingLives = 999 });
speedModel.Start();
Check(Math.Abs(speedModel.CruiseKph - 80) < .01f && Math.Abs(speedModel.DisplayKph - 80) < .01f,
    "speedometer starts at 80 km/h instead of using world scroll units");
for (int i = 0; i < 63 * 60; i++) speedModel.Update(1f / 60f);
Check(speedModel.Speed >= 325 && speedModel.Speed < 350,
    "speed has a visible rise after one minute of survival");
float cruiseSpeed = speedModel.Speed;
speedModel.AccelerateHeld = true;
speedModel.Update(1f / 60f);
Check(speedModel.EffectiveSpeed > speedModel.Speed * 1.34f && speedModel.Speed > cruiseSpeed,
    "W boost raises effective speed without resetting progression");
for (int i = 0; i < 65; i++) speedModel.Update(1f / 60f);
Check(Math.Abs(speedModel.CarY - GameModel.BoostFrontY) < .01f &&
      speedModel.EffectiveSpeed > speedModel.Speed * 1.74f,
    "holding W drives the whole car to the top edge at higher speed");
Check(speedModel.DisplayKph > speedModel.CruiseKph && speedModel.DisplayKph <= 125,
    "W shows a temporary higher km/h reading");
speedModel.AccelerateHeld = false;
speedModel.Update(1f / 60f);
Check(Math.Abs(speedModel.EffectiveSpeed - speedModel.Speed) < .01f && speedModel.Speed > cruiseSpeed,
    "releasing W returns to current progression speed");
Check(Math.Abs(speedModel.DisplayKph - speedModel.CruiseKph) < .01f,
    "releasing W restores the current cruise km/h reading");
for (int i = 0; i < 50; i++) speedModel.Update(1f / 60f);
Check(Math.Abs(speedModel.CarY - GameModel.PlayerY) < .01f,
    "releasing W brings the car back to its cruise position");
var tapModel = new GameModel(new GameConfig { BoothSeed = 4242, StartingLives = 999 });
tapModel.Start();
for (int i = 0; i < 190; i++) tapModel.Update(1f / 60f);
tapModel.PressBoost();
tapModel.AccelerateHeld = false;
for (int i = 0; i < 30; i++) tapModel.Update(1f / 60f);
Check(Math.Abs(tapModel.CarY - GameModel.BoostFrontY) < .01f && tapModel.IsBoosting,
    "a quick W tap reaches the top without holding the key");
for (int i = 0; i < 100; i++) tapModel.Update(1f / 60f);
Check(Math.Abs(tapModel.CarY - GameModel.PlayerY) < .01f && !tapModel.IsBoosting,
    "a quick W tap returns to the current cruise position");
var steeringModel = new GameModel(new GameConfig { BoothSeed = 88 });
steeringModel.Start();
for (int i = 0; i < 190; i++) steeringModel.Update(1f / 60f);
steeringModel.ChangeLane(1);
steeringModel.Update(.08f);
Check(steeringModel.CarLane > 1 && steeringModel.CarLane < 2,
    "car moves visibly between lanes");
for (int i = 0; i < 30; i++) steeringModel.Update(1f / 60f);
Check(Math.Abs(steeringModel.CarLane - 2) < .001f,
    "car finishes lane change smoothly");
steeringModel.ChangeLane(-1);
steeringModel.Objects.Add(new RoadObject { Lane = 2, Hazard = HazardType.Pothole, Y = GameModel.PlayerY - 1 });
steeringModel.Update(1f / 60f);
Check(steeringModel.Lives == 2,
    "collision follows the visible car during a lane change");
for (int i = 0; i < 30; i++) steeringModel.Update(1f / 60f);
steeringModel.Objects.Add(new RoadObject { Lane = 2, Hazard = HazardType.Pothole, Y = GameModel.PlayerY - 1 });
steeringModel.Update(1f / 60f);
Check(steeringModel.Lives == 2,
    "completed lane change clears the former lane");
var boostCollision = new GameModel(new GameConfig { BoothSeed = 14, StartingLives = 99 });
boostCollision.Start();
for (int i = 0; i < 190; i++) boostCollision.Update(1f / 60f);
boostCollision.AccelerateHeld = true;
for (int i = 0; i < 65; i++) boostCollision.Update(1f / 60f);
boostCollision.Objects.Add(new RoadObject { Lane = 1, Hazard = HazardType.Pothole, Y = boostCollision.CarY - 1 });
boostCollision.Update(1f / 60f);
Check(boostCollision.Lives == 98, "boost collisions follow the car at the top of the road");
bool crashed = false;
int crashSoundRequests = 0;
model.SoundRequested += name => { if (name == "crash") crashSoundRequests++; };
for (int i = 0; i < 300 * 60 && model.Phase != GamePhase.Results; i++)
{
    model.Update(1f / 60f);
    crashed |= model.Phase == GamePhase.Crashing;
}
Check(crashed && model.Phase == GamePhase.Results && model.Lives == 0 && model.Score >= 0 &&
      model.Detected > 0 && model.NearMisses == 0,
    "three lost lives trigger crash and results");
Check(crashSoundRequests == 1, "final lost life plays crash sound once");
var mechanics = new GameModel(new GameConfig { BoothSeed = 99 });
mechanics.Start();
for (int i = 0; i < 190; i++) mechanics.Update(1f / 60f);
mechanics.Objects.Add(new RoadObject { Lane = 1, Pickup = PickupType.Shield, Y = GameModel.PlayerY - 1 });
mechanics.Update(1f / 60f);
Check(mechanics.Shield == 1, "shield pickup activates");
mechanics.Objects.Add(new RoadObject { Lane = 1, Hazard = HazardType.Pothole, Y = GameModel.PlayerY - 1 });
mechanics.Update(1f / 60f);
Check(mechanics.Shield == 0 && mechanics.Lives == 3, "shield absorbs a major pothole hit");
mechanics.Objects.Add(new RoadObject { Lane = 1, Pickup = PickupType.RepairCrew, Y = GameModel.PlayerY - 1 });
mechanics.Update(1f / 60f);
mechanics.Objects.Add(new RoadObject { Lane = 1, Hazard = HazardType.Pothole, Y = 60 });
mechanics.Update(1f / 60f);
Check(mechanics.RepairCrew == 0 && mechanics.Lives == 3, "repair crew clears the next hazard");
mechanics.Objects.Add(new RoadObject { Lane = 1, Pickup = PickupType.SignalBoost, Y = GameModel.PlayerY - 1 });
mechanics.Update(1f / 60f);
Check(mechanics.SignalBoost > 4.9f, "signal pickup extends scan range");
mechanics.ScanHeld = true;
float beforeScan = mechanics.ScanMeter;
for (int i = 0; i < 60; i++) mechanics.Update(1f / 60f);
Check(mechanics.ScanMeter < beforeScan, "scan boost drains meter");
mechanics.ScanHeld = false;
mechanics.SetBrake(true);
mechanics.Objects.Add(new RoadObject { Lane = 1, Hazard = HazardType.Hump, Y = GameModel.PlayerY - 1 });
mechanics.Update(1f / 60f);
Check(mechanics.Lives == 3, "braking makes a road hump safe");
mechanics.SetBrake(false);
mechanics.Objects.Add(new RoadObject { Lane = 1, Hazard = HazardType.Hump, Y = GameModel.PlayerY - 1 });
mechanics.Update(1f / 60f);
Check(mechanics.Lives == 2, "hitting a road hump without braking costs a life");
var patchModel = new GameModel(new GameConfig { BoothSeed = 99 });
patchModel.Start();
for (int i = 0; i < 190; i++) patchModel.Update(1f / 60f);
patchModel.Objects.Add(new RoadObject { Lane = 1, Hazard = HazardType.Patch, Y = GameModel.PlayerY - 1 });
patchModel.Update(1f / 60f);
patchModel.Update(1f / 60f);
Check(patchModel.Lives == 3 && patchModel.PatchSlowSeconds > 0 && patchModel.EffectiveSpeed < patchModel.Speed,
    "crossing road patch slows car without costing a life");
patchModel.SetBrake(true);
patchModel.Objects.Add(new RoadObject { Lane = 1, Hazard = HazardType.Patch, Y = GameModel.PlayerY - 1 });
patchModel.Update(1f / 60f);
Check(patchModel.Handled == 1 && patchModel.Missed == 1,
    "braking handles road patch cleanly");
var warningModel = new GameModel(new GameConfig { BoothSeed = 1 });
warningModel.Start();
for (int i = 0; i < 190; i++) warningModel.Update(1f / 60f);
warningModel.Objects.Add(new RoadObject { Lane = 0, Hazard = HazardType.Pothole, Y = 270, Warned = true });
warningModel.Objects.Add(new RoadObject { Lane = 2, Hazard = HazardType.MinorPothole, Y = 400, Warned = true });
warningModel.Update(1f / 60f);
Check(warningModel.WarningType == HazardType.Pothole, "warning panel prioritizes major pothole");
var trafficModel = new GameModel(new GameConfig { BoothSeed = 7 });
trafficModel.Start();
for (int i = 0; i < 190; i++) trafficModel.Update(1f / 60f);
trafficModel.Objects.Add(new RoadObject { Lane = 0, Traffic = TrafficType.Car, ColorIndex = 2,
    Y = GameModel.PlayerY + 71 });
trafficModel.Update(1f / 60f);
Check(trafficModel.TrafficPassed == 1 && trafficModel.Lives == 3, "passing a car in another lane is safe");
trafficModel.Objects.Add(new RoadObject { Lane = 1, Traffic = TrafficType.Truck, ColorIndex = 4,
    Y = GameModel.PlayerY - 1 });
trafficModel.Update(1f / 60f);
Check(trafficModel.TrafficCollisions == 1 && trafficModel.Lives == 2, "truck collision costs one life");
var driverModel = new GameModel(new GameConfig { BoothSeed = 15 });
driverModel.Start();
for (int i = 0; i < 190; i++) driverModel.Update(1f / 60f);
var avoidingCar = new RoadObject { Lane = 1, Traffic = TrafficType.Car, Y = 300 };
driverModel.Objects.Add(avoidingCar);
driverModel.Objects.Add(new RoadObject { Lane = 1, Hazard = HazardType.Pothole, Y = 340 });
driverModel.Update(1f / 60f);
Check(avoidingCar.Lane != 1 && avoidingCar.VisualLane is > 0 and < 2,
    "traffic steers smoothly away from a major pothole");
var minorCar = new RoadObject { Lane = 2, Traffic = TrafficType.Car, Y = 190 };
driverModel.Objects.Add(minorCar);
driverModel.Objects.Add(new RoadObject { Lane = 2, Hazard = HazardType.MinorPothole, Y = 210 });
driverModel.Update(1f / 60f);
Check(minorCar.Lane == 2, "traffic does not swerve for a minor pothole");
var boardDir = Path.Combine(Path.GetTempPath(), "RoadSensePatrolTests", Guid.NewGuid().ToString("N"));
var board = new LeaderboardStore(boardDir);
board.Add("bob", 3000);
board.Add("ace", 4000);
Check(new LeaderboardStore(boardDir).Entries.Select(e => e.Name).SequenceEqual(["ACE", "BOB"]),
    "leaderboard persists and sorts scores");
File.WriteAllText(Path.Combine(boardDir, "leaderboard.json"), "corrupt json");
Check(new LeaderboardStore(boardDir).Entries.Count == 0, "corrupt leaderboard is handled");
Directory.Delete(boardDir, true);
