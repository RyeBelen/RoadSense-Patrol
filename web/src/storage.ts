export interface ScoreEntry {
  name: string;
  score: number;
  distance: number;
  date: string;
}
export interface Settings {
  muted: boolean;
  highQuality: boolean;
}
export const SCORE_KEY = "roadsense-patrol-3d-scores-v1";
const SETTINGS_KEY = "roadsense-patrol-3d-settings-v1";
export function loadScores(storage?: Pick<Storage, "getItem">): ScoreEntry[] {
  try {
    const values: unknown = JSON.parse(
      (storage ?? localStorage).getItem(SCORE_KEY) ?? "[]",
    );
    if (!Array.isArray(values)) return [];
    return values
      .filter(
        (value): value is ScoreEntry =>
          !!value &&
          typeof value.name === "string" &&
          /^[A-Z]{3}$/.test(value.name) &&
          Number.isFinite(value.score) &&
          value.score >= 0 &&
          Number.isFinite(value.distance) &&
          value.distance >= 0 &&
          typeof value.date === "string",
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  } catch {
    return [];
  }
}
export function saveScore(
  entry: ScoreEntry,
  storage?: Pick<Storage, "getItem" | "setItem">,
) {
  const scores = loadScores(storage)
    .concat(entry)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  try {
    (storage ?? localStorage).setItem(SCORE_KEY, JSON.stringify(scores));
    return true;
  } catch {
    return false;
  }
}
export function loadSettings(): Settings {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    return {
      muted: value?.muted === true,
      highQuality: value?.highQuality !== false,
    };
  } catch {
    return { muted: false, highQuality: true };
  }
}
export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* Preferences are optional. */
  }
}
