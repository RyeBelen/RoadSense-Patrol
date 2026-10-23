# RoadSense Patrol

A Windows-only, top-down C# arcade game for the RoadSense booth. **Road hazards and scanner detections are simulated for demonstration.** This game does not run the RoadSense AI model or connect to the iOS app. Patrol continues until three damaging hits use up your lives; road speed rises as you survive. Cars appear first; trucks and denser traffic arrive later. Traffic avoids nearby major potholes. Traffic collisions cost a life.

## Run

Requires Windows 10/11 and the .NET 8 SDK for development.

```powershell
dotnet run
```

Build and test:

```powershell
dotnet build -c Release
dotnet run --project tests/RoadSensePatrol.Tests.csproj -c Release
```

Make a portable, self-contained Windows x64 release:

```powershell
dotnet publish RoadSensePatrol.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
```

Copy the **entire `publish` folder** to the booth PC. Run `RoadSensePatrol.exe`. The build is offline; no account or network is needed.

## Controls

| Action | Keyboard | Touch / mouse |
| --- | --- | --- |
| Start or replay | Space or Enter | Tap the screen |
| Open or close menu | Esc | MENU / CLOSE button |
| Rankings and hazard guide | R / H while menu is open | Menu tabs |
| Change lane | A/D or Left/Right | Tap left/right side of road |
| Brake | Hold S or Down | Hold BRAKE button |
| Scan Boost | Hold B | Hold SCAN BOOST button |
| Mute | M | — |
| Fullscreen | F11 | — |
| Quit | Ctrl+Shift+Q | — |

On the results screen, type three letters and press Enter or click **SAVE SCORE** to save a qualifying Top 10 score. Backspace edits the entry. The game returns to the attract screen after 20 seconds. Qualifying scores not entered before timeout are saved as `AAA`.

Hidden booth admin shortcut: **Ctrl+Shift+R** opens a confirmation to clear local scores. Scores are stored in `%LOCALAPPDATA%\RoadSensePatrol\leaderboard.json` and survive restarts. A missing or invalid leaderboard file starts with an empty board.

## Booth settings

Edit `settings.json` beside the executable:

- `boothSeed`: set to an integer for the same route for every player; use `null` for randomized routes.
- `fullscreenOnStart`: set to `true` for a fullscreen booth display.
- `startingLives`: default 3.
- `baseSpeed`, `speedIncreasePerSecond`, `maxSpeed`: tune the endless speed curve.
- `prizeScore`: score target, default 5000.
- `showPrizeTarget`: set to `true` only when the booth actually offers a prize.

Game scoring values, multiplier cap, hazard timing, and difficulty progression are in `GameConfig.cs` and `GameModel.cs`. The default speed is 205 and rises by 2.1 per second of survival, reaching 331 after a minute and capping at 520. Brake, scan, and rough road temporarily reduce effective movement speed.

## Booth test checklist

- Play until all three lives are gone with A/D, S, and B; check rising speed, cars, trucks, warnings, score chain, hits, crash animation, pickups, results, and replay.
- Check Left/Right and Down arrow controls.
- On a touch display, tap the road and hold both on-screen buttons. The Top 10 entry requires a keyboard.
- Save a score, restart the app, and verify the Top 10 persists.
- Leave results untouched for 20 seconds and verify return to attract mode.
- Test F11 fullscreen, mute, and hidden admin reset on the booth PC.
