using System.Drawing;
using System.Reflection;
using System.Windows.Forms;
using RoadSensePatrol;

Application.EnableVisualStyles();
using var form = new GameForm();
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
model.Update(1f / 60f);
Save("speed-boost.png");
model.AccelerateHeld = false;
model.ChangeLane(1);
for (int i = 0; i < 6; i++) model.Update(1f / 60f);
Save("lane-transition.png");
model.Start();
for (int i = 0; i < 12 * 60; i++) model.Update(1f / 60f);
Save("gameplay.png");
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
model.Objects.AddRange(originalObjects);
for (int i = 0; i < 4 * 60; i++) model.Update(1f / 60f);
Save("traffic.png");
model.Objects.Add(new RoadObject { Lane = 2, Traffic = TrafficType.Truck, ColorIndex = 3, Y = 260 });
Save("traffic-truck.png");
for (int i = 0; i < 300 * 60 && model.Phase != GamePhase.Crashing; i++) model.Update(1f / 60f);
for (int i = 0; i < 55; i++) model.Update(1f / 60f);
Save("crash.png");
for (int i = 0; i < 150; i++) model.Update(1f / 60f);
typeof(GameModel).GetProperty("Score")!.SetValue(model, 5000);
Save("results.png");
foreach (var letter in new[] { Keys.M, Keys.A, Keys.P })
    keyHandler.Invoke(form, [null, new KeyEventArgs(letter)]);
string typed = (string)typeof(GameForm).GetField("typedInitials", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(form)!;
if (typed != "MAP") throw new Exception("Typing initials failed: " + typed);
Save("typed-results.png");
