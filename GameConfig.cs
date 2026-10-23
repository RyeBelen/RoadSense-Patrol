using System.Text.Json;

namespace RoadSensePatrol;

public sealed class GameConfig
{
    public int? BoothSeed { get; set; }
    public int PrizeScore { get; set; } = 5000;
    public bool ShowPrizeTarget { get; set; }
    public bool FullscreenOnStart { get; set; }
    public int StartingLives { get; set; } = 3;
    public float BaseSpeed { get; set; } = 205;
    public float SpeedIncreasePerSecond { get; set; } = 2.1f;
    public float MaxSpeed { get; set; } = 520;

    public const int CleanPoints = 100;
    public const int NearMissPoints = 50;
    public const int PerfectPoints = 150;
    public const int GoodPoints = 75;
    public const int LatePoints = 25;
    public const int MajorHitPenalty = 200;
    public const int MinorHitPenalty = 50;
    public const int MultiplierCap = 8;

    public static GameConfig Load()
    {
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "settings.json");
            var config = JsonSerializer.Deserialize<GameConfig>(File.ReadAllText(path),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            config.PrizeScore = Math.Max(1, config.PrizeScore);
            config.StartingLives = Math.Clamp(config.StartingLives, 1, 9);
            config.BaseSpeed = Math.Clamp(config.BaseSpeed, 120, 400);
            config.MaxSpeed = Math.Clamp(config.MaxSpeed, config.BaseSpeed, 800);
            config.SpeedIncreasePerSecond = Math.Clamp(config.SpeedIncreasePerSecond, 0.1f, 5);
            return config;
        }
        catch { return new GameConfig(); }
    }
}
