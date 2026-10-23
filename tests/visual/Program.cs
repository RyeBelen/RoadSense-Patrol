using System.Drawing;
using System.Reflection;
using System.Media;
using System.Windows.Forms;
using RoadSensePatrol;

Application.EnableVisualStyles();
var resources = typeof(GameForm).Assembly;
using (var crashWave = resources.GetManifestResourceStream(resources.GetManifestResourceNames()
    .Single(n => n.EndsWith("crash.wav", StringComparison.OrdinalIgnoreCase)))!)
using (var crashPlayer = new SoundPlayer(crashWave)) crashPlayer.Load();
if (!resources.GetManifestResourceNames().Any(n => n.EndsWith("roadsense-app.ico", StringComparison.OrdinalIgnoreCase)))
    throw new Exception("RoadSense window icon is missing");
using (var scene = new CrashSceneFrames())
{
    if (Math.Abs(CrashSceneFrames.DurationSeconds - GameModel.CrashDurationSeconds) > .001f ||
        scene.FrameAt(0).Width != 1020 || scene.FrameAt(9.6f).Height < 400)
        throw new Exception("Embedded crash scene frames or timing are invalid");
}
var inputHandler = typeof(GameForm).GetMethod("OnKeyDown", BindingFlags.Instance | BindingFlags.NonPublic,
    null, [typeof(object), typeof(KeyEventArgs)], null)!;
var keyUpHandler = typeof(GameForm).GetMethod("OnKeyUp", BindingFlags.Instance | BindingFlags.NonPublic,
    null, [typeof(object), typeof(KeyEventArgs)], null)!;
using (var inputForm = new GameForm())
{
    var inputModel = (GameModel)typeof(GameForm).GetField("game", BindingFlags.Instance | BindingFlags.NonPublic)!
        .GetValue(inputForm)!;
    inputHandler.Invoke(inputForm, [null, new KeyEventArgs(Keys.W)]);
    if (inputModel.Phase != GamePhase.Countdown || !inputModel.AccelerateHeld)
        throw new Exception("W must start the game and stay held through countdown");
    for (int i = 0; i < 190; i++) inputModel.Update(1f / 60f);
    inputModel.Update(1f / 60f);
    if (inputModel.Phase != GamePhase.Playing || inputModel.EffectiveSpeed <= inputModel.Speed ||
        inputModel.EffectiveSpeed >= inputModel.Speed * 1.1f)
        throw new Exception("W key must begin a gradual boost once gameplay begins");
    for (int i = 0; i < 89; i++) inputModel.Update(1f / 60f);
    if (Math.Abs(inputModel.CarY - GameModel.BoostFrontY) > .01f ||
        inputModel.EffectiveSpeed < inputModel.Speed * 1.74f)
        throw new Exception("Holding W must reach the top and full boost");
    keyUpHandler.Invoke(inputForm, [null, new KeyEventArgs(Keys.W)]);
    inputModel.Update(1f / 60f);
    if (inputModel.AccelerateHeld || !inputModel.IsBoosting ||
        inputModel.EffectiveSpeed >= inputModel.Speed * 1.75f)
        throw new Exception("Releasing W must begin gradual deceleration");
    for (int i = 0; i < 89; i++) inputModel.Update(1f / 60f);
    if (inputModel.IsBoosting || Math.Abs(inputModel.EffectiveSpeed - inputModel.Speed) > .01f)
        throw new Exception("W boost must end and restore cruise speed");
    var syncBoostKey = typeof(GameForm).GetMethod("SyncBoostKey", BindingFlags.Instance | BindingFlags.NonPublic)!;
    syncBoostKey.Invoke(inputForm, [true, true]);
    for (int i = 0; i < 90; i++) inputModel.Update(1f / 60f);
    if (!inputModel.AccelerateHeld || Math.Abs(inputModel.CarY - GameModel.BoostFrontY) > .01f)
        throw new Exception("Polling a physically held W must move the car to the top");
    syncBoostKey.Invoke(inputForm, [false, true]);
    for (int i = 0; i < 90; i++) inputModel.Update(1f / 60f);
    if (inputModel.AccelerateHeld || Math.Abs(inputModel.EffectiveSpeed - inputModel.Speed) > .01f)
        throw new Exception("Losing game focus must release W and restore cruise speed");
    inputModel.Attract();
    inputHandler.Invoke(inputForm, [null, new KeyEventArgs(Keys.Up)]);
    if (inputModel.Phase != GamePhase.Countdown || !inputModel.AccelerateHeld)
        throw new Exception("Up Arrow must start the game and enable forward boost");
    for (int i = 0; i < 280; i++) inputModel.Update(1f / 60f);
    if (inputModel.Phase != GamePhase.Playing ||
        Math.Abs(inputModel.CarY - GameModel.BoostFrontY) > .01f ||
        inputModel.EffectiveSpeed < inputModel.Speed * 1.74f)
        throw new Exception("Holding Up Arrow must move the car to the top and increase speed");
    keyUpHandler.Invoke(inputForm, [null, new KeyEventArgs(Keys.Up)]);
    for (int i = 0; i < 90; i++) inputModel.Update(1f / 60f);
    if (inputModel.AccelerateHeld || Math.Abs(inputModel.CarY - GameModel.PlayerY) > .01f ||
        Math.Abs(inputModel.EffectiveSpeed - inputModel.Speed) > .01f)
        throw new Exception("Releasing Up Arrow must return the car and speed to cruise");
}
using var form = new GameForm();
if (!form.Text.Contains("v0.5.0")) throw new Exception("Window title must identify the build being tested");
var model = (GameModel)typeof(GameForm).GetField("game", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(form)!;
void Save(string name)
{
    using var bitmap = new Bitmap(form.Width, form.Height);
    form.DrawToBitmap(bitmap, new Rectangle(0, 0, form.Width, form.Height));
    bitmap.Save(Path.Combine(AppContext.BaseDirectory, name));
    Console.WriteLine(name);
}
Save("start.png");
var keyHandler = typeof(GameForm).GetMethod("OnKeyDown", BindingFlags.Instance | BindingFlags.NonPublic,
    null, [typeof(object), typeof(KeyEventArgs)], null)!;
void Key(Keys key) => keyHandler.Invoke(form, [null, new KeyEventArgs(key)]);
Key(Keys.Escape);
Save("menu.png");
Key(Keys.R);
Save("rankings.png");
Key(Keys.H);
Save("distress-guide.png");
Key(Keys.Escape);
model.Start();
for (int i = 0; i < 190; i++) model.Update(1f / 60f);
model.AccelerateHeld = true;
for (int i = 0; i < 65; i++) model.Update(1f / 60f);
Save("speed-boost.png");
model.AccelerateHeld = false;
model.Start();
for (int i = 0; i < 190; i++) model.Update(1f / 60f);
model.ChangeLane(1);
for (int i = 0; i < 6; i++) model.Update(1f / 60f);
Save("lane-transition.png");
model.Start();
for (int i = 0; i < 12 * 60; i++) model.Update(1f / 60f);
Save("gameplay.png");
model.ScanHeld = true;
for (int i = 0; i < 30; i++) model.Update(1f / 60f);
model.ScanHeld = false;
model.Update(1f / 60f);
Save("scan-cooldown.png");
var hazardPreview = new[]
{
    new RoadObject { Lane = 0, Hazard = HazardType.MinorPothole, Y = 220, Warned = true },
    new RoadObject { Lane = 1, Hazard = HazardType.Pothole, Y = 220, Warned = true },
    new RoadObject { Lane = 2, Hazard = HazardType.Hump, Y = 220, Warned = true }
};
var originalObjects = model.Objects.ToArray();
model.Objects.Clear();
model.Objects.AddRange(hazardPreview);
model.Update(1f / 60f);
typeof(GameModel).GetProperty("FloatingSeconds")!.SetValue(model, 0f);
Save("hazards.png");
model.Objects.Clear();
model.Objects.Add(new RoadObject { Lane = 1, Hazard = HazardType.Patch, Y = 220, Warned = true });
model.Update(1f / 60f);
Save("patch.png");
model.Objects.Clear();
model.Objects.AddRange(originalObjects);
for (int i = 0; i < 4 * 60; i++) model.Update(1f / 60f);
Save("traffic.png");
model.Objects.Add(new RoadObject { Lane = 2, Traffic = TrafficType.Truck, ColorIndex = 3, Y = 260 });
Save("traffic-truck.png");
model.Objects.Add(new RoadObject { Lane = 0, Traffic = TrafficType.Motorcycle, ColorIndex = 1, Y = 310 });
Save("traffic-motorcycle.png");
for (int i = 0; i < 300 * 60 && model.Phase != GamePhase.Crashing; i++) model.Update(1f / 60f);
for (int i = 0; i < 55; i++) model.Update(1f / 60f);
Save("crash.png");
for (int i = 0; i < 600 && model.Phase != GamePhase.Results; i++) model.Update(1f / 60f);
if (model.Phase != GamePhase.Results) throw new Exception("Crash clip did not finish into results");
typeof(GameModel).GetProperty("Score")!.SetValue(model, 5000);
Save("results.png");
foreach (var letter in new[] { Keys.M, Keys.A, Keys.P })
    keyHandler.Invoke(form, [null, new KeyEventArgs(letter)]);
string typed = (string)typeof(GameForm).GetField("typedInitials", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(form)!;
if (typed != "MAP") throw new Exception("Typing initials failed: " + typed);
Save("typed-results.png");
