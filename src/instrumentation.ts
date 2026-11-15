/**
 * Uruchamiane raz przy starcie serwera. Przerywa start, gdy sekret sesji jest
 * pusty, przykladowy albo zbyt krotki — lepiej nie wstac, niz dzialac z nim po cichu.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { requireSessionSecret } = await import("./lib/secrets");

    requireSessionSecret();
  }
}
