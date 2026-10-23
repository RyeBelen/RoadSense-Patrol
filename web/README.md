# RoadSense Patrol 3D

[Play the hosted game](https://roadsense-patrol-3d-emooy9-37db86-149-56-107-207.sslip.io)

A browser version of the original RoadSense Patrol arcade game. The coastal road, patrol car, traffic, pickups, and hazards are Three.js meshes with perspective cameras, lighting, and shadows. Assets are generated locally in the renderer, so there are no external model downloads or runtime CDN dependencies. Fonts are bundled with the build.

## Develop

Use Node.js 22 or later. From this directory:

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Browser checks cover keyboard driving, scanner controls, pause/resume, persisted rankings, and phone layouts in both orientations:

```sh
npx playwright install chromium --only-shell
npm run test:e2e
```

Set `PATROL_TEST_URL` to an already running deployment URL to run the same checks against production. Tests use isolated browser storage. `npm run format` formats the app source.

The development server listens on port 5173 by default. Production output is `dist/`. No environment variables or backend are needed.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Start | Enter or Space | Start patrol |
| Steer | A/D or Left/Right | Left/right buttons |
| Accelerate | Hold W or Up | Hold Boost |
| Brake | Hold S or Down | Hold Brake |
| Scan all lanes | Hold B | Hold Scan |
| Switch chase/hood camera | C | Camera button |
| Pause/resume | Escape | Pause/Resume |
| Mute | M | Sound button |
| Full screen | F | Full screen, where supported |

Changing tabs or losing window focus pauses the run and clears held controls. The graphics selector offers a performance mode with a lower render resolution and no shadows. Reduced-motion preferences disable menu motion and collision camera shake.

## Gameplay

You start with three lives. Change lanes around major potholes and traffic. Brake or steer around minor potholes, road patches, and speed humps. Patches slow the car and subtract points; other unprotected road-hazard hits cost a life. Traffic collisions cost a life, with a short recovery period to prevent multiple simultaneous hits.

Normal radar marks hazards in the current lane. Scan Boost reveals all lanes farther ahead and doubles clean-hazard points. Releasing it starts a three-second cooldown. Depleting it starts a five-second cooldown and requires releasing the button before reuse. Energy recharges while scanning is inactive.

Blue shield pickups protect against a road-hazard hit. Green repair pickups clear the next hazard. Gold signal pickups widen radar for five seconds. Every three clean hazards raise the multiplier, up to ×8. Cars arrive first, then swerving motorcycles and trucks. Speed and hazard density increase over time.

At the end of a run, save three initials to the local Top 10 board. Scores and graphics/audio preferences use browser storage and survive reloads. Rankings are per browser, not shared online. If storage is unavailable, play still works and a failed save is reported.

Road hazards and scanner detections are simulated. The game does not run the RoadSense AI model or connect to the iOS app.

## Code

- `src/game.ts` owns the seeded route, movement, collisions, scoring, scanner, pickups, and run state. It has no DOM or rendering dependencies.
- `src/world.ts` builds the 3D meshes and handles cameras, lighting, scenery, and visual effects. Collision positions come from the gameplay model.
- `src/main.ts` connects keyboard/pointer controls, menus, HUD, audio, and the frame loop.
- `src/storage.ts` validates persisted rankings and tolerates unavailable or corrupt storage.
- `src/game.test.ts` covers the gameplay state transitions, collision rules, cooldown timing, frame-rate consistency, route extension, and rankings.

The read-only `window.__patrol()` diagnostic returns the current run state and render counts for browser QA. It cannot modify the game.

## Deployment

The Docker build context is the repository root, and the Dockerfile is `web/Dockerfile`.

```sh
docker build -f web/Dockerfile -t roadsense-patrol-3d .
docker run --rm -p 8080:8080 roadsense-patrol-3d
```

The image builds the app with Node.js, then serves it with unprivileged Nginx on port **8080**. `/health` returns `200 ok`. Hashed assets get immutable caching; the HTML is revalidated. The container has a health check.

In Dokploy:

1. Create the **RoadSense Patrol 3D** project and a production application.
2. Connect `https://github.com/clouddddd34/RoadSense-Patrol.git`, branch `main`, build path `/`.
3. Select Dockerfile builds, path `web/Dockerfile`, context `.`.
4. Attach the web domain to port `8080` and enable HTTPS with Let's Encrypt.
5. Deploy the committed source. Verify `/health` and play a run in the deployed browser version.

Credentials belong in the existing Dokploy CLI configuration, never in source files or the web bundle. Deploy again after pushing updates to `main`. The original Windows game remains in the repository root.
