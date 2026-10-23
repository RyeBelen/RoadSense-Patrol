using System.Media;

namespace RoadSensePatrol;

public sealed class SoundBank : IDisposable
{
    private readonly Dictionary<string, (MemoryStream Stream, SoundPlayer Player)> sounds = [];
    public bool Muted { get; set; }

    public SoundBank()
    {
        Add("start", 440, 130); Add("count", 560, 80); Add("go", 780, 180);
        Add("lane", 460, 45); Add("major", 220, 180); Add("minor", 410, 110);
        Add("hump", 620, 100); Add("patch", 520, 120); Add("response", 800, 110); Add("clean", 680, 70);
        Add("near", 930, 130); Add("hit", 150, 250); Add("pickup", 1020, 150);
        for (int i = 1; i <= GameConfig.MultiplierCap; i++) Add("clean" + i, 580 + i * 65, 80);
        Add("results", 760, 250);
        AddEmbedded("crash", "crash.wav");
    }

    public void Play(string name)
    {
        if (Muted || !sounds.TryGetValue(name, out var sound)) return;
        try { sound.Stream.Position = 0; sound.Player.Play(); } catch { }
    }

    private void Add(string name, double frequency, int durationMs)
    {
        const int rate = 22050;
        int count = rate * durationMs / 1000;
        var stream = new MemoryStream();
        using (var writer = new BinaryWriter(stream, System.Text.Encoding.ASCII, true))
        {
            writer.Write("RIFF".ToCharArray()); writer.Write(36 + count * 2);
            writer.Write("WAVE".ToCharArray()); writer.Write("fmt ".ToCharArray()); writer.Write(16);
            writer.Write((short)1); writer.Write((short)1); writer.Write(rate); writer.Write(rate * 2);
            writer.Write((short)2); writer.Write((short)16); writer.Write("data".ToCharArray()); writer.Write(count * 2);
            for (int i = 0; i < count; i++)
            {
                double fade = Math.Min(1, i / (rate * 0.008)) * Math.Min(1, (count - i) / (rate * 0.03));
                double wave = Math.Sin(2 * Math.PI * frequency * i / rate);
                writer.Write((short)(wave * fade * 8000));
            }
        }
        stream.Position = 0;
        sounds[name] = (stream, new SoundPlayer(stream));
    }

    private void AddEmbedded(string name, string suffix)
    {
        var assembly = typeof(SoundBank).Assembly;
        string? resource = assembly.GetManifestResourceNames().FirstOrDefault(n =>
            n.EndsWith(suffix, StringComparison.OrdinalIgnoreCase));
        if (resource is null) throw new InvalidOperationException($"Missing sound: {suffix}");
        using var source = assembly.GetManifestResourceStream(resource) ??
            throw new InvalidOperationException($"Cannot open sound: {suffix}");
        var stream = new MemoryStream();
        source.CopyTo(stream);
        stream.Position = 0;
        sounds[name] = (stream, new SoundPlayer(stream));
    }

    public void Dispose()
    {
        foreach (var sound in sounds.Values) { sound.Player.Dispose(); sound.Stream.Dispose(); }
    }
}
