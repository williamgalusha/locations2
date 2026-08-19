import { env } from "cloudflare:workers";

export const runtime = "edge";

type TripType = "to_airport" | "from_airport" | "general";
type RouteBody = {
  origin?: unknown;
  destination?: unknown;
  eventDateTime?: unknown;
  tripType?: unknown;
  bufferMinutes?: unknown;
  fallbackMinutes?: unknown;
};
type RouteEstimate = {
  driveMinutes: number;
  staticMinutes: number | null;
  trafficDelayMinutes: number | null;
  distanceMiles: number | null;
  source: "google_traffic" | "estimated";
};

function boundedText(value: unknown, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 240) throw new Error(`${label} is required and must be under 240 characters.`);
  return text;
}

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function durationSeconds(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/s$/, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function firstRoute(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const routes = Reflect.get(payload, "routes");
  if (!Array.isArray(routes) || !routes[0] || typeof routes[0] !== "object") return null;
  return routes[0];
}

function googleMapsKey() {
  const value = Reflect.get(env, "GOOGLE_MAPS_API_KEY");
  return typeof value === "string" ? value.trim() : "";
}

async function trafficRoute(origin: string, destination: string, departureTime: Date, fallbackMinutes: number): Promise<RouteEstimate> {
  const apiKey = googleMapsKey();
  if (!apiKey) return { driveMinutes: fallbackMinutes, staticMinutes: null, trafficDelayMinutes: null, distanceMiles: null, source: "estimated" };
  try {
    const requestBody: Record<string, unknown> = {
      origin: { address: origin },
      destination: { address: destination },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      trafficModel: "BEST_GUESS",
      computeAlternativeRoutes: false,
      languageCode: "en-US",
      units: "IMPERIAL",
    };
    if (departureTime.getTime() > Date.now() + 60_000) requestBody.departureTime = departureTime.toISOString();
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) return { driveMinutes: fallbackMinutes, staticMinutes: null, trafficDelayMinutes: null, distanceMiles: null, source: "estimated" };
    const route = firstRoute(await response.json());
    if (!route) return { driveMinutes: fallbackMinutes, staticMinutes: null, trafficDelayMinutes: null, distanceMiles: null, source: "estimated" };
    const duration = durationSeconds(Reflect.get(route, "duration"));
    const staticDuration = durationSeconds(Reflect.get(route, "staticDuration"));
    const distanceMeters = Number(Reflect.get(route, "distanceMeters"));
    if (!duration) return { driveMinutes: fallbackMinutes, staticMinutes: null, trafficDelayMinutes: null, distanceMiles: null, source: "estimated" };
    const driveMinutes = Math.max(1, Math.ceil(duration / 60));
    const staticMinutes = staticDuration ? Math.max(1, Math.ceil(staticDuration / 60)) : null;
    return {
      driveMinutes,
      staticMinutes,
      trafficDelayMinutes: staticMinutes == null ? null : Math.max(0, driveMinutes - staticMinutes),
      distanceMiles: Number.isFinite(distanceMeters) && distanceMeters > 0 ? Number((distanceMeters / 1609.344).toFixed(1)) : null,
      source: "google_traffic",
    };
  } catch {
    return { driveMinutes: fallbackMinutes, staticMinutes: null, trafficDelayMinutes: null, distanceMiles: null, source: "estimated" };
  }
}

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const body: RouteBody = payload && typeof payload === "object" ? payload : {};
    const origin = boundedText(body.origin, "Origin");
    const destination = boundedText(body.destination, "Destination");
    const tripType: TripType = body.tripType === "from_airport" || body.tripType === "general" ? body.tripType : "to_airport";
    const eventDateTime = typeof body.eventDateTime === "string" ? new Date(body.eventDateTime) : new Date(Number.NaN);
    if (!Number.isFinite(eventDateTime.getTime())) throw new Error("Choose a valid flight or arrival date and time.");
    const bufferMinutes = boundedNumber(body.bufferMinutes, tripType === "from_airport" ? 30 : 15, 0, 180);
    const fallbackMinutes = boundedNumber(body.fallbackMinutes, 60, 5, 360);
    const airportLeadMinutes = tripType === "to_airport" ? 120 : 0;
    const arriveBy = tripType === "to_airport" ? new Date(eventDateTime.getTime() - airportLeadMinutes * 60_000) : eventDateTime;
    const initialDeparture = tripType === "from_airport"
      ? new Date(eventDateTime.getTime() + bufferMinutes * 60_000)
      : new Date(arriveBy.getTime() - (fallbackMinutes + bufferMinutes) * 60_000);
    const route = await trafficRoute(origin, destination, initialDeparture, fallbackMinutes);
    const pickupAt = tripType === "from_airport"
      ? new Date(eventDateTime.getTime() + bufferMinutes * 60_000)
      : new Date(arriveBy.getTime() - (route.driveMinutes + bufferMinutes) * 60_000);
    const estimatedDestinationAt = tripType === "from_airport"
      ? new Date(pickupAt.getTime() + route.driveMinutes * 60_000)
      : arriveBy;
    return Response.json({
      origin,
      destination,
      tripType,
      eventDateTime: eventDateTime.toISOString(),
      pickupAt: pickupAt.toISOString(),
      arriveBy: arriveBy.toISOString(),
      estimatedDestinationAt: estimatedDestinationAt.toISOString(),
      airportLeadMinutes,
      bufferMinutes,
      providerConfigured: Boolean(googleMapsKey()),
      ...route,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Pickup time could not be calculated." }, { status: 400 });
  }
}
