/*
 * Octoson web haptics.
 *
 * Uses the Web Vibration API where supported.
 *
 * iOS Safari currently does not expose normal web vibration /
 * Taptic Engine control, so this safely becomes a no-op there.
 * Android browsers and supported installed PWAs can vibrate.
 */

export type HapticType =
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "error";

export function haptic(
  type: HapticType = "light"
) {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.vibrate !== "function"
  ) {
    return;
  }

  try {
    switch (type) {
      case "light":
        navigator.vibrate(8);
        break;

      case "medium":
        navigator.vibrate(14);
        break;

      case "heavy":
        navigator.vibrate(24);
        break;

      case "success":
        navigator.vibrate([10, 35, 16]);
        break;

      case "error":
        navigator.vibrate([18, 30, 18]);
        break;
    }
  } catch {
    // Haptics are optional. Never allow them to break UI.
  }
}
