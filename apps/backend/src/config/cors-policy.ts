/**
 * CORS policy for SPEC-002-CONTRACTS §8 (S2-T07).
 *
 * FRONTEND_ORIGIN is a comma-separated list of exact origins. Wildcards are
 * never accepted. In production an empty list is a configuration error, so the
 * server fails at startup instead of silently allowing or blocking everything.
 */

export const DEVELOPMENT_DEFAULT_ORIGIN = "http://localhost:5173";

export class CorsConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CorsConfigurationError";
  }
}

function normalizeOrigin(value: string): string {
  if (value.includes("*")) {
    throw new CorsConfigurationError(
      `FRONTEND_ORIGIN must not contain wildcards: "${value}".`,
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CorsConfigurationError(
      `FRONTEND_ORIGIN contains an invalid origin: "${value}".`,
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new CorsConfigurationError(
      `FRONTEND_ORIGIN must use http or https: "${value}".`,
    );
  }

  const hasOnlyOrigin =
    (url.pathname === "/" || url.pathname === "") &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password;
  if (!hasOnlyOrigin || value.replace(/\/$/, "") !== url.origin) {
    throw new CorsConfigurationError(
      `FRONTEND_ORIGIN must contain only scheme, host, and optional port: "${value}".`,
    );
  }

  return url.origin;
}

/**
 * Parses FRONTEND_ORIGIN into the exact list of allowed origins.
 * Throws CorsConfigurationError for any invalid or unsafe configuration.
 */
export function parseFrontendOrigins(
  rawValue: string | undefined,
  nodeEnv: string | undefined,
): string[] {
  const entries = (rawValue ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    if (nodeEnv === "production") {
      throw new CorsConfigurationError(
        "FRONTEND_ORIGIN is required when NODE_ENV is production.",
      );
    }
    return [DEVELOPMENT_DEFAULT_ORIGIN];
  }

  return [...new Set(entries.map(normalizeOrigin))];
}

/** Returns true only for an exact match with a configured origin. */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  return origin !== undefined && allowedOrigins.includes(origin);
}

/**
 * Returns the CORS response headers for a request origin. Disallowed or
 * missing origins receive only `Vary: Origin`, never an allow header.
 */
export function corsHeadersFor(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): Record<string, string> {
  if (!isOriginAllowed(origin, allowedOrigins)) {
    return { Vary: "Origin" };
  }

  return {
    "Access-Control-Allow-Origin": origin as string,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
