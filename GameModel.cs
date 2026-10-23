namespace RoadSensePatrol;

public enum HazardType { MinorPothole, Pothole, Patch, Hump }
public enum PickupType { RepairCrew, Shield, SignalBoost }
public enum TrafficType { Car, Truck, Motorcycle }
public enum GamePhase { Attract, Countdown, Playing, Crashing, CrashOutro, Results }

public sealed class RoadObject
{
    public int Lane { get; set; }
    public float? VisualLane { get; set; }
    public HazardType? Hazard { get; init; }
    public PickupType? Pickup { get; init; }
    public TrafficType? Traffic { get; init; }
    public int ColorIndex { get; init; }
    public float Y { get; set; } = -50;
    public bool Warned { get; set; }
    public bool Resolved { get; set; }
    public float WarningTime { get; set; }
    public bool ResponseAwarded { get; set; }
    public bool CloseDodge { get; set; }
    public float SwerveCooldown { get; set; } = 0.9f;
    public int SwerveCount { get; set; }
}

public readonly record struct RouteEvent(float Time, int Lane, HazardType? Hazard, PickupType? Pickup,
    TrafficType? Traffic = null, int ColorIndex = 0);
public readonly record struct HandledHazard(float Time, int Lane, HazardType Type, bool Clean);

public static class ScoreRules
{
    public static int Multiplier(int streak) => Math.Min(GameConfig.MultiplierCap, 1 + Math.Max(0, streak) / 3);
    public static int ResponsePoints(float seconds) => seconds <= 0.8f ? GameConfig.PerfectPoints
        : seconds <= 1.7f ? GameConfig.GoodPoints : GameConfig.LatePoints;
    public static string ResponseLabel(float seconds) => seconds <= 0.8f ? "PERFECT"
        : seconds <= 1.7f ? "GOOD" : "LATE";
    public static bool IsNearMiss(int carLane, int hazardLane) => Math.Abs(carLane - hazardLane) == 1;
}

public static class RouteGenerator
{
    public static List<RouteEvent> Generate(int seed, int durationSeconds, int offsetSeconds = 0)
    {
        var random = new Random(seed);
        var result = new List<RouteEvent>();
        for (float t = 1.5f; t < durationSeconds;)
        {
            int lane = random.Next(3);
            HazardType type = (HazardType)random.Next(4);
            result.Add(new(t + offsetSeconds, lane, type, null));
            float progress = t + offsetSeconds;
            if (progress >= 20 && random.NextDouble() < (progress >= 55 ? 0.78 : 0.48))
            {
                int other = (lane + 1 + random.Next(2)) % 3;
                HazardType otherType = type == HazardType.Pothole ? HazardType.MinorPothole : HazardType.Pothole;
                result.Add(new(t + offsetSeconds, other, otherType, null));
            }
            if (progress > 10 && random.NextDouble() < 0.13)
            {
                int pickupLane = (lane + 1 + random.Next(2)) % 3;
                result.Add(new(t + offsetSeconds + 0.9f, pickupLane, null, (PickupType)random.Next(3)));
            }
            t += progress < 20 ? 3.8f : progress < 55 ? 2.9f : Math.Max(1.35f, 2.2f - progress / 500f);
        }
        for (float t = offsetSeconds == 0 ? 12 : 1.5f; t < durationSeconds;)
        {
            float progress = t + offsetSeconds;
            // Leave a gap around each hazard spawn so traffic adds choices without filling all lanes at once.
            if (result.Any(e => e.Hazard.HasValue && Math.Abs(e.Time - progress) < .8f))
            {
                t += .5f;
                continue;
            }
            double trafficRoll = random.NextDouble();
            var traffic = progress >= 38 && trafficRoll < .29 ? TrafficType.Truck
                : progress >= 28 && trafficRoll < .63 ? TrafficType.Motorcycle : TrafficType.Car;
            var nearbyHazards = result.Where(e => e.Hazard.HasValue && e.Time > progress + .3f &&
                e.Time < progress + (traffic == TrafficType.Truck ? 2.6f : 2f)).ToList();
            int lane = nearbyHazards.Count > 0 ? nearbyHazards[random.Next(nearbyHazards.Count)].Lane : random.Next(3);
            result.Add(new(progress, lane, null, null, traffic, random.Next(6)));
            t += progress < 35 ? 8.5f : progress < 85 ? 6f : Math.Max(2.8f, 5f - progress / 200f);
        }
        return result.OrderBy(e => e.Time).ToList();
    }
}

public sealed class GameModel
{
    public const float PlayerY = 548;
    public const float BoostFrontY = 65;
    private readonly GameConfig config;
    private readonly List<RouteEvent> route;
    private int nextEvent;
    private float spawnClock;
    private float gameClock;
    private float scanCooldownDuration = 3f;
    private bool scanArmed = true;
    private float flashSeconds;
    private float resultIdle;
    private float countdown;
    private float crashSeconds;
    private float crashOutroSeconds;
    private float laneFrom = 1;
    private float laneMoveTime = 0.34f;
    private float boostFraction;
    private int routeChunk;

    public GamePhase Phase { get; private set; } = GamePhase.Attract;
    public int Seed { get; private set; }
    public int Lane { get; private set; } = 1;
    public float CarLane { get; private set; } = 1;
    public float CarY { get; private set; } = PlayerY;
    public int Score { get; private set; }
    public int Streak { get; private set; }
    public int BestStreak { get; private set; }
    public int Multiplier => ScoreRules.Multiplier(Streak);
    public int Shield { get; private set; }
    public int RepairCrew { get; private set; }
    public float SignalBoost { get; private set; }
    public float PatchSlowSeconds { get; private set; }
    public float ScanMeter { get; private set; } = 1;
    public float ScanCooldownRemaining { get; private set; }
    public float ScanCooldownProgress => ScanCooldownRemaining <= 0 ? 1 :
        1 - ScanCooldownRemaining / scanCooldownDuration;
    public bool IsScanning { get; private set; }
    public bool ScanHeld { get; set; }
    public bool AccelerateHeld { get; set; }
    public bool IsBoosting => Phase == GamePhase.Playing && boostFraction > 0;
    public bool RadarWide => IsScanning || SignalBoost > 0;
    public float RadarStartY => Math.Min(RadarWide ? 20 : gameClock < 20 ? 145 : gameClock < 55 ? 190 : 230,
        CarY - 210);
    public float BoostFraction => boostFraction;
    public bool BrakeHeld { get; private set; }
    public int Lives { get; private set; }
    public float Speed { get; private set; }
    public float EffectiveSpeed { get; private set; }
    // Road motion uses screen units per second; the HUD maps that progression to arcade km/h.
    public float CruiseKph => 80 + 20 * Math.Clamp((Speed - config.BaseSpeed) /
        Math.Max(1, config.MaxSpeed - config.BaseSpeed), 0, 1);
    public float DisplayKph => Math.Clamp(CruiseKph +
        (EffectiveSpeed / Math.Max(1, Speed) - 1) * (100f / 3f), 0, 125);
    public const float CrashDurationSeconds = 145f / 15f;
    public float CrashSceneDurationSeconds { get; private set; } = CrashDurationSeconds;
    public void SetCrashSceneDuration(float seconds)
    {
        if (seconds <= 0 || !float.IsFinite(seconds)) throw new ArgumentOutOfRangeException(nameof(seconds));
        CrashSceneDurationSeconds = seconds;
    }
    public const float CrashOutroDurationSeconds = .8f;
    public float CrashProgress => Phase == GamePhase.CrashOutro ? 1 :
        Phase == GamePhase.Crashing ? 1 - crashSeconds / CrashSceneDurationSeconds : 0;
    public float CrashElapsed => Phase == GamePhase.CrashOutro ? CrashSceneDurationSeconds :
        Phase == GamePhase.Crashing ? CrashSceneDurationSeconds - crashSeconds : 0;
    public float CrashOutroProgress => Phase == GamePhase.CrashOutro ?
        1 - crashOutroSeconds / CrashOutroDurationSeconds : 0;
    public float Elapsed => gameClock;
    public float FlashSeconds => flashSeconds;
    public float BonusFlashSeconds { get; private set; }
    public float ResultIdle => resultIdle;
    public string FloatingText { get; private set; } = "";
    public float FloatingSeconds { get; private set; }
    public string Warning { get; private set; } = "SCANNER READY";
    public HazardType? WarningType { get; private set; }
    public int Handled { get; private set; }
    public int Detected { get; private set; }
    public int Missed { get; private set; }
    public int AccuracyPercent => Handled + Missed == 0 ? 100 :
        (int)Math.Round(Handled * 100.0 / (Handled + Missed));
    public int NearMisses { get; private set; }
    public int TrafficPassed { get; private set; }
    public int TrafficCollisions { get; private set; }
    public bool TrafficWarning { get; private set; }
    public List<RoadObject> Objects { get; } = [];
    public List<HandledHazard> History { get; } = [];
    public event Action<string>? SoundRequested;

    public GameModel(GameConfig config)
    {
        this.config = config;
        Seed = config.BoothSeed ?? Environment.TickCount;
        route = RouteGenerator.Generate(Seed, 300);
    }

    public void Start()
    {
        Seed = config.BoothSeed ?? Random.Shared.Next();
        route.Clear();
        route.AddRange(RouteGenerator.Generate(Seed, 300));
        routeChunk = 0;
        nextEvent = 0; spawnClock = 0; gameClock = 0; countdown = 3.1f;
        resultIdle = 0; flashSeconds = 0;
        Score = Streak = BestStreak = Shield = RepairCrew = Handled = Detected = Missed = NearMisses = TrafficPassed = TrafficCollisions = 0;
        Lane = 1; CarLane = laneFrom = 1; CarY = PlayerY; boostFraction = 0;
        laneMoveTime = 0.34f; ScanMeter = 1; SignalBoost = PatchSlowSeconds = 0;
        ScanCooldownRemaining = 0; scanCooldownDuration = 3f; scanArmed = true; IsScanning = false;
        Lives = config.StartingLives; Speed = EffectiveSpeed = config.BaseSpeed;
        BrakeHeld = ScanHeld = AccelerateHeld = false;
        Warning = "SCANNER READY"; WarningType = null; TrafficWarning = false;
        Objects.Clear(); History.Clear(); Phase = GamePhase.Countdown;
        SoundRequested?.Invoke("start");
    }

    public void Attract() { Phase = GamePhase.Attract; Objects.Clear(); resultIdle = 0; }
    public void TouchResults() => resultIdle = 0;

    public void SkipCrash()
    {
        if (Phase is not (GamePhase.Crashing or GamePhase.CrashOutro)) return;
        Phase = GamePhase.Results;
        resultIdle = 0;
    }

    public void PressBoost()
    {
        if (Phase is GamePhase.Countdown or GamePhase.Playing)
        {
            AccelerateHeld = true;
        }
    }

    public void SetBrake(bool held)
    {
        bool justPressed = held && !BrakeHeld;
        BrakeHeld = held;
        if (!justPressed || Phase != GamePhase.Playing) return;
        var hazard = Objects.Where(o => o.Hazard is HazardType.MinorPothole or HazardType.Patch or HazardType.Hump &&
                o.Warned && !o.Resolved && !o.ResponseAwarded && o.Lane == Lane && o.Y < CarY)
            .OrderByDescending(o => o.Y).FirstOrDefault();
        if (hazard is not null) AwardResponse(hazard);
    }

    public void ChangeLane(int direction)
    {
        if (Phase != GamePhase.Playing) return;
        int previousLane = Lane;
        int target = Math.Clamp(Lane + direction, 0, 2);
        if (target == Lane) return;
        Lane = target;
        laneFrom = CarLane;
        laneMoveTime = 0;
        foreach (var obj in Objects.Where(o => o.Hazard.HasValue && !o.Resolved && o.Lane == previousLane &&
                     o.Y >= CarY - 160 && o.Y <= CarY - 35)) obj.CloseDodge = true;
        SoundRequested?.Invoke("lane");
        var hazard = Objects.Where(o => o.Hazard.HasValue && o.Warned && !o.Resolved &&
                !o.ResponseAwarded && o.Lane == previousLane && o.Y < CarY)
            .OrderByDescending(o => o.Y).FirstOrDefault();
        if (hazard is not null) AwardResponse(hazard);
    }

    public void Update(float dt)
    {
        dt = Math.Min(dt, 0.05f);
        FloatingSeconds = Math.Max(0, FloatingSeconds - dt);
        flashSeconds = Math.Max(0, flashSeconds - dt);
        BonusFlashSeconds = Math.Max(0, BonusFlashSeconds - dt);
        laneMoveTime = Math.Min(0.34f, laneMoveTime + dt);
        float laneT = laneMoveTime / 0.34f;
        float easedLaneT = laneT * laneT * (3 - 2 * laneT);
        CarLane = laneFrom + (Lane - laneFrom) * easedLaneT;
        if (Phase == GamePhase.Countdown)
        {
            float old = countdown;
            countdown -= dt;
            if ((int)Math.Ceiling(old) != (int)Math.Ceiling(countdown)) SoundRequested?.Invoke("count");
            if (countdown <= 0) { Phase = GamePhase.Playing; SoundRequested?.Invoke("go"); }
            return;
        }
        if (Phase == GamePhase.Results) { resultIdle += dt; return; }
        if (Phase == GamePhase.Crashing)
        {
            crashSeconds -= dt;
            if (crashSeconds <= 0)
            {
                Phase = GamePhase.CrashOutro;
                crashOutroSeconds = CrashOutroDurationSeconds;
            }
            return;
        }
        if (Phase == GamePhase.CrashOutro)
        {
            crashOutroSeconds -= dt;
            if (crashOutroSeconds <= 0) { Phase = GamePhase.Results; resultIdle = 0; }
            return;
        }
        if (Phase != GamePhase.Playing) return;

        gameClock += dt;
        spawnClock += dt;
        boostFraction = Math.Clamp(boostFraction +
            (AccelerateHeld && !BrakeHeld ? 0.75f : -0.75f) * dt, 0, 1);
        float forwardEased = boostFraction * boostFraction * (3 - 2 * boostFraction);
        CarY = PlayerY + (BoostFrontY - PlayerY) * forwardEased;
        SignalBoost = Math.Max(0, SignalBoost - dt);
        PatchSlowSeconds = Math.Max(0, PatchSlowSeconds - dt);
        ScanCooldownRemaining = Math.Max(0, ScanCooldownRemaining - dt);
        if (!ScanHeld) scanArmed = true;
        bool scanning = ScanHeld && scanArmed && ScanCooldownRemaining <= 0 &&
            (ScanMeter >= .25f || IsScanning && ScanMeter > 0);
        if (IsScanning && !scanning) BeginScanCooldown(3f);
        if (scanning)
        {
            ScanMeter = Math.Max(0, ScanMeter - .24f * dt);
            if (ScanMeter <= 0)
            {
                scanning = false;
                scanArmed = false;
                BeginScanCooldown(5f);
            }
        }
        else ScanMeter = Math.Min(1, ScanMeter + .10f * dt);
        IsScanning = scanning;
        Speed = Math.Min(config.MaxSpeed, config.BaseSpeed + gameClock * config.SpeedIncreasePerSecond);
        float speed = Speed;
        speed *= 1 + 0.75f * boostFraction;
        if (BrakeHeld) speed *= 0.63f;
        if (scanning) speed *= 0.82f;
        if (PatchSlowSeconds > 0) speed *= 0.68f;
        EffectiveSpeed = speed;

        if (nextEvent >= route.Count)
        {
            routeChunk++;
            route.AddRange(RouteGenerator.Generate(unchecked(Seed + routeChunk * 7919), 300, routeChunk * 300));
        }
        while (nextEvent < route.Count && route[nextEvent].Time <= spawnClock)
        {
            var e = route[nextEvent++];
            Objects.Add(new RoadObject { Lane = e.Lane, Hazard = e.Hazard, Pickup = e.Pickup,
                Traffic = e.Traffic, ColorIndex = e.ColorIndex, Y = e.Traffic == TrafficType.Truck ? -130 : -90,
                SwerveCooldown = .55f + e.ColorIndex * .14f });
        }
        foreach (var obj in Objects)
        {
            obj.Y += speed * (obj.Traffic == TrafficType.Truck ? .68f : obj.Traffic == TrafficType.Car ? .8f
                : obj.Traffic == TrafficType.Motorcycle ? 1.08f : 1f) * dt;
            if (obj.Traffic.HasValue && !obj.Resolved)
            {
                SteerTrafficAroundMajorPothole(obj, dt);
                if (obj.Traffic == TrafficType.Motorcycle) SwerveMotorcycle(obj, dt);
            }
            if (obj.Hazard.HasValue && !obj.Resolved && RepairCrew > 0 && obj.Y >= 60)
            {
                RepairCrew--; obj.Resolved = true; obj.Y = 800;
                Detected++; Handled++; Streak++; BestStreak = Math.Max(Streak, BestStreak);
                AddPoints(GameConfig.CleanPoints * Multiplier);
                History.Add(new HandledHazard(gameClock, obj.Lane, obj.Hazard.Value, true));
                Pop("REPAIR CREW CLEAR!"); SoundRequested?.Invoke("pickup");
                continue;
            }
            if (obj.Hazard.HasValue && !obj.Warned && obj.Y >= RadarStartY && obj.Y < CarY &&
                (obj.Lane == Lane || RadarWide))
            {
                obj.Warned = true; obj.WarningTime = gameClock; Detected++;
                SoundRequested?.Invoke(obj.Hazard == HazardType.Pothole ? "major" : obj.Hazard == HazardType.MinorPothole ? "minor" : obj.Hazard == HazardType.Patch ? "patch" : "hump");
            }
            if (obj.Traffic.HasValue && !obj.Resolved)
            {
                float clearance = obj.Traffic == TrafficType.Truck ? 100 : obj.Traffic == TrafficType.Motorcycle ? 53 : 70;
                float laneClearance = obj.Traffic == TrafficType.Motorcycle ? .29f : .43f;
                if (Math.Abs(CarLane - (obj.VisualLane ?? obj.Lane)) < laneClearance &&
                    obj.Y >= CarY - clearance && obj.Y <= CarY + clearance)
                {
                    obj.Resolved = true;
                    ResolveTraffic(obj);
                    obj.Y = 800;
                    continue;
                }
                if (obj.Y > CarY + clearance)
                {
                    obj.Resolved = true;
                    TrafficPassed++;
                }
            }
            if (!obj.Resolved && !obj.Traffic.HasValue && obj.Y >= CarY)
            {
                obj.Resolved = true;
                if (obj.Pickup.HasValue && Math.Abs(CarLane - obj.Lane) < .35f) Collect(obj.Pickup.Value);
                if (obj.Hazard.HasValue) ResolveHazard(obj, scanning);
            }
        }
        Objects.RemoveAll(o => o.Y > 750);
        var active = Objects.Where(o => o.Hazard.HasValue && o.Warned && !o.Resolved && o.Y < CarY)
            .OrderByDescending(o => o.Hazard == HazardType.Pothole ? 3 : o.Hazard == HazardType.MinorPothole ? 2 : 1)
            .ThenByDescending(o => o.Y).FirstOrDefault();
        WarningType = active?.Hazard;
        TrafficWarning = false;
        Warning = active?.Hazard == HazardType.Pothole ? "MAJOR POTHOLE AHEAD"
            : active?.Hazard == HazardType.MinorPothole ? "MINOR POTHOLE AHEAD"
            : active?.Hazard == HazardType.Patch ? "ROAD PATCHING AHEAD"
            : active?.Hazard == HazardType.Hump ? "ROAD HUMP AHEAD" : "SCANNER READY";
        if (active is null)
        {
            var trafficAhead = Objects.Where(o => o.Traffic.HasValue && !o.Resolved && o.Lane == Lane &&
                    o.Y >= Math.Min(120, CarY - 120) && o.Y < CarY).OrderByDescending(o => o.Y).FirstOrDefault();
            if (trafficAhead is not null)
            {
                TrafficWarning = true;
                Warning = trafficAhead.Traffic == TrafficType.Truck ? "TRUCK AHEAD"
                    : trafficAhead.Traffic == TrafficType.Motorcycle ? "MOTORCYCLE AHEAD" : "CAR AHEAD";
            }
        }
        if (Lives <= 0)
        {
            Phase = GamePhase.Crashing;
            crashSeconds = CrashSceneDurationSeconds;
            ScanHeld = BrakeHeld = AccelerateHeld = false;
            IsScanning = false;
            SoundRequested?.Invoke("crash");
        }
    }

    public int CountdownNumber => Math.Max(1, (int)Math.Ceiling(countdown));

    private void BeginScanCooldown(float seconds)
    {
        scanCooldownDuration = seconds;
        ScanCooldownRemaining = seconds;
    }

    private void SteerTrafficAroundMajorPothole(RoadObject car, float dt)
    {
        car.VisualLane ??= car.Lane;
        bool majorNearby = Objects.Any(o => o.Hazard == HazardType.Pothole && !o.Resolved &&
            o.Lane == car.Lane && Math.Abs(o.Y - car.Y) < 155);
        if (majorNearby)
        {
            int[] choices = car.Lane == 1 ? [0, 2] : [1];
            foreach (int target in choices)
            {
                bool blocked = Objects.Any(o => o != car && !o.Resolved && o.Lane == target &&
                    Math.Abs(o.Y - car.Y) < 145 && (o.Hazard == HazardType.Pothole || o.Traffic.HasValue));
                if (blocked) continue;
                car.Lane = target;
                break;
            }
        }
        car.VisualLane += (car.Lane - car.VisualLane.Value) * Math.Min(1, dt *
            (car.Traffic == TrafficType.Motorcycle ? 15f : 4.5f));
    }

    private void SwerveMotorcycle(RoadObject bike, float dt)
    {
        if (bike.Y < 65 || bike.Y >= CarY - 55) return;
        bike.SwerveCooldown -= dt;
        if (bike.SwerveCooldown > 0 || Math.Abs((bike.VisualLane ?? bike.Lane) - bike.Lane) > .08f) return;
        int direction = (bike.ColorIndex + bike.SwerveCount) % 2 == 0 ? 1 : -1;
        int target = bike.Lane + direction;
        if (target is < 0 or > 2) target = bike.Lane - direction;
        if (!Objects.Any(o => o != bike && !o.Resolved && o.Traffic.HasValue &&
            (o.VisualLane ?? o.Lane) >= target - .5f && (o.VisualLane ?? o.Lane) <= target + .5f &&
            Math.Abs(o.Y - bike.Y) < 105)) bike.Lane = target;
        bike.SwerveCount++;
        bike.SwerveCooldown = .8f + (bike.ColorIndex % 3) * .17f;
    }

    private void AwardResponse(RoadObject hazard)
    {
        hazard.ResponseAwarded = true;
        float delay = gameClock - hazard.WarningTime;
        AddPoints(ScoreRules.ResponsePoints(delay));
        Pop(ScoreRules.ResponseLabel(delay));
        SoundRequested?.Invoke("response");
    }

    private void ResolveHazard(RoadObject obj, bool scanning)
    {
        var type = obj.Hazard!.Value;
        bool sameLane = Math.Abs(CarLane - obj.Lane) < .5f;
        bool clean = type switch
        {
            HazardType.Pothole => !sameLane,
            HazardType.MinorPothole => !sameLane || BrakeHeld,
            _ => !sameLane || BrakeHeld
        };
        bool shielded = false;
        if (sameLane && type == HazardType.Pothole && Shield > 0 && !clean)
        {
            Shield--; shielded = true;
        }
        History.Add(new HandledHazard(gameClock, obj.Lane, type, clean || shielded));
        if (clean)
        {
            Handled++; Streak++; BestStreak = Math.Max(Streak, BestStreak);
            int basePoints = GameConfig.CleanPoints;
            if (scanning) basePoints *= 2;
            AddPoints(basePoints * Multiplier);
            if (obj.CloseDodge && ScoreRules.IsNearMiss(Lane, obj.Lane) && type == HazardType.Pothole)
            {
                NearMisses++; AddPoints(GameConfig.NearMissPoints * Multiplier);
                Pop("NEAR MISS +" + GameConfig.NearMissPoints * Multiplier);
                BonusFlashSeconds = 0.18f;
                SoundRequested?.Invoke("near");
            }
            else { Pop("SAFE +" + basePoints * Multiplier); SoundRequested?.Invoke("clean" + Multiplier); }
        }
        else
        {
            if (shielded) { Handled++; Pop("SHIELD SAVED YOU!"); SoundRequested?.Invoke("pickup"); }
            else
            {
                Missed++;
                Score = Math.Max(0, Score - (type == HazardType.Pothole ? GameConfig.MajorHitPenalty : GameConfig.MinorHitPenalty));
                Pop(type == HazardType.Pothole ? "POTHOLE HIT!" : "SLOW DOWN!");
                flashSeconds = 0.35f;
                if (type == HazardType.Patch) PatchSlowSeconds = 2;
                else Lives = Math.Max(0, Lives - 1);
                SoundRequested?.Invoke("hit");
            }
            Streak = 0;
        }
    }

    private void Collect(PickupType pickup)
    {
        switch (pickup)
        {
            case PickupType.RepairCrew: RepairCrew++; Pop("REPAIR CREW"); break;
            case PickupType.Shield: Shield++; Pop("SHIELD"); break;
            case PickupType.SignalBoost: SignalBoost = 5; Pop("SIGNAL BOOST"); break;
        }
        SoundRequested?.Invoke("pickup");
    }

    private void ResolveTraffic(RoadObject obj)
    {
        TrafficCollisions++;
        Lives = Math.Max(0, Lives - 1);
        Score = Math.Max(0, Score - 150);
        Streak = 0;
        flashSeconds = .4f;
        Pop(obj.Traffic == TrafficType.Truck ? "TRUCK COLLISION!" :
            obj.Traffic == TrafficType.Motorcycle ? "MOTORCYCLE COLLISION!" : "CAR COLLISION!");
        SoundRequested?.Invoke("hit");
    }

    private void AddPoints(int amount) => Score += amount;
    private void Pop(string label) { FloatingText = label; FloatingSeconds = 1.15f; }
}
