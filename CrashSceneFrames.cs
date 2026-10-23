using System.Drawing;
using System.IO.Compression;

namespace RoadSensePatrol;

public sealed class CrashSceneFrames : IDisposable
{
    public const int FrameRate = 15;
    public const int FrameCount = 145;
    public const float DurationSeconds = (float)FrameCount / FrameRate;
    private static readonly int[] Counts = [145, 415, 108];
    private static readonly string[] ArchiveNames =
        ["crash-scene-frames.zip", "crash-scene-2-frames.zip", "crash-scene-3-frames.zip"];

    private readonly MemoryStream archiveData = new();
    private readonly ZipArchive archive;
    private readonly int frameCount;
    private Bitmap? cachedFrame;
    private int cachedIndex = -1;

    public int CarIndex { get; }
    public float ClipDurationSeconds => (float)frameCount / FrameRate;

    public CrashSceneFrames(int carIndex = 0)
    {
        if (carIndex < 0 || carIndex >= Counts.Length) throw new ArgumentOutOfRangeException(nameof(carIndex));
        CarIndex = carIndex;
        frameCount = Counts[carIndex];
        var assembly = typeof(CrashSceneFrames).Assembly;
        string resource = assembly.GetManifestResourceNames().Single(n =>
            n.EndsWith(ArchiveNames[carIndex], StringComparison.OrdinalIgnoreCase));
        using (var source = assembly.GetManifestResourceStream(resource)!) source.CopyTo(archiveData);
        archiveData.Position = 0;
        archive = new ZipArchive(archiveData, ZipArchiveMode.Read, leaveOpen: true);
    }

    public Bitmap FrameAt(float seconds)
    {
        int index = Math.Clamp((int)(seconds * FrameRate), 0, frameCount - 1);
        if (index == cachedIndex && cachedFrame is not null) return cachedFrame;
        var entry = archive.GetEntry($"frame-{index + 1:000}.jpg") ??
            throw new InvalidDataException($"Crash scene frame {index + 1} is missing.");
        using var source = entry.Open();
        using var data = new MemoryStream();
        source.CopyTo(data);
        data.Position = 0;
        using var image = Image.FromStream(data);
        var frame = new Bitmap(image);
        cachedFrame?.Dispose();
        cachedFrame = frame;
        cachedIndex = index;
        return frame;
    }

    public void Dispose()
    {
        cachedFrame?.Dispose();
        archive.Dispose();
        archiveData.Dispose();
    }
}
