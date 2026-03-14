const VALID_LEVELS = new Set(["debug", "info", "warn", "error", "fatal"]);

const DEFAULTS = {
  lvl: "info",
  msg: "(no message)",
  device: {
    id: "unknown-device",
    region: "unknown-region",
    battery: null,
  },
  latency_ms: null,
  meta: {
    retries: 0,
    last_ok: null,
  },
};

/**
 * Validates that all required fields are present and well-typed.
 * Throws a descriptive error on the first violation found.
 * @param {object} record - The normalized log record.
 */
function validate(record) {
  if (!record.ts || isNaN(Date.parse(record.ts))) {
    throw new Error(`Invalid or missing timestamp: ${JSON.stringify(record.ts)}`);
  }
  if (!VALID_LEVELS.has(record.lvl)) {
    throw new Error(`Unrecognized log level: ${JSON.stringify(record.lvl)}`);
  }
  if (typeof record.device.id !== "string" || record.device.id.trim() === "") {
    throw new Error("device.id must be a non-empty string");
  }
  if (typeof record.device.region !== "string" || record.device.region.trim() === "") {
    throw new Error("device.region must be a non-empty string");
  }
  if (
    record.device.battery !== null &&
    (typeof record.device.battery !== "number" ||
      record.device.battery < 0 ||
      record.device.battery > 1)
  ) {
    throw new Error(`device.battery must be a float in [0, 1], got: ${record.device.battery}`);
  }
  if (
    record.latency_ms !== null &&
    (!Number.isInteger(record.latency_ms) || record.latency_ms < 0)
  ) {
    throw new Error(`latency_ms must be a non-negative integer, got: ${record.latency_ms}`);
  }
  if (typeof record.meta.retries !== "number" || record.meta.retries < 0) {
    throw new Error(`meta.retries must be a non-negative number, got: ${record.meta.retries}`);
  }
  if (
    record.meta.last_ok !== null &&
    isNaN(Date.parse(record.meta.last_ok))
  ) {
    throw new Error(`meta.last_ok must be a valid ISO timestamp, got: ${record.meta.last_ok}`);
  }
}

/**
 * Normalizes a raw edge-device heartbeat log fragment into a typed schema record.
 * Coerces latency_ms to integer, fills safe defaults, and validates before returning.
 *
 * @param {object} raw - Raw inbound log object (e.g., from JSON.parse).
 * @returns {{ ts: string, lvl: string, msg: string, device: { id: string, region: string, battery: number|null }, latency_ms: number|null, meta: { retries: number, last_ok: string|null } }}
 */
export function normalizeEdgeHeartbeatLog(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Input must be a non-null, non-array object");
  }

  const rawDevice =
    raw.device !== null && typeof raw.device === "object" && !Array.isArray(raw.device)
      ? raw.device
      : {};

  const rawMeta =
    raw.meta !== null && typeof raw.meta === "object" && !Array.isArray(raw.meta)
      ? raw.meta
      : {};

  const rawLatency = raw.latency_ms;
  const coercedLatency =
    rawLatency === undefined || rawLatency === null
      ? DEFAULTS.latency_ms
      : (() => {
          const parsed = parseInt(rawLatency, 10);
          return isNaN(parsed) ? DEFAULTS.latency_ms : parsed;
        })();

  const record = {
    ts:
      typeof raw.ts === "string" && raw.ts.trim() !== ""
        ? raw.ts.trim()
        : new Date().toISOString(),
    lvl:
      typeof raw.lvl === "string" && VALID_LEVELS.has(raw.lvl.toLowerCase())
        ? raw.lvl.toLowerCase()
        : DEFAULTS.lvl,
    msg: typeof raw.msg === "string" && raw.msg.trim() !== "" ? raw.msg.trim() : DEFAULTS.msg,
    device: {
      id:
        typeof rawDevice.id === "string" && rawDevice.id.trim() !== ""
          ? rawDevice.id.trim()
          : DEFAULTS.device.id,
      region:
        typeof rawDevice.region === "string" && rawDevice.region.trim() !== ""
          ? rawDevice.region.trim()
          : DEFAULTS.device.region,
      battery:
        typeof rawDevice.battery === "number" &&
        rawDevice.battery >= 0 &&
        rawDevice.battery <= 1
          ? rawDevice.battery
          : DEFAULTS.device.battery,
    },
    latency_ms: coercedLatency,
    meta: {
      retries:
        typeof rawMeta.retries === "number" && rawMeta.retries >= 0
          ? rawMeta.retries
          : DEFAULTS.meta.retries,
      last_ok:
        typeof rawMeta.last_ok === "string" && !isNaN(Date.parse(rawMeta.last_ok))
          ? rawMeta.last_ok
          : DEFAULTS.meta.last_ok,
    },
  };

  validate(record);
  return record;
}
