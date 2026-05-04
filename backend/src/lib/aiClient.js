const AI_SERVER_URL = process.env.AI_SERVER_URL;

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function notifyAiEvent(eventType, payload) {
  if (!AI_SERVER_URL) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${AI_SERVER_URL}/analyze/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: eventType,
        event_time: payload.eventTime ?? payload.reportedAt ?? undefined,
        pincode: payload.pincode ?? null,
        district: payload.district ?? null,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        quantity: Number(payload.quantity || 1),
        intensity: payload.intensity ?? null,
        payload,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return await safeJson(response);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAiAlerts() {
  if (!AI_SERVER_URL) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${AI_SERVER_URL}/alerts`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return await safeJson(response);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAiZones() {
  if (!AI_SERVER_URL) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${AI_SERVER_URL}/zones`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return await safeJson(response);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
