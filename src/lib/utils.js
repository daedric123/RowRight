export const splitToSeconds = (split) => {
  if (typeof split === "number") return split;
  if (split.includes(":")) {
    const [m, s] = split.split(":");
    return parseInt(m) * 60 + parseFloat(s);
  }
  return parseFloat(split);
};

// Parse a user-typed duration into seconds. Accepts "M:SS(.t)" with a colon,
// or bare digits where the last two whole-second digits are seconds and the
// rest are minutes: "730" -> 7:30, "45" -> 0:45, "1230.5" -> 12:30.5.
export const parseTimeInput = (raw) => {
  const str = String(raw ?? "").trim();
  if (!str) return 0;
  if (str.includes(":")) {
    const [m, s] = str.split(":");
    return (parseInt(m) || 0) * 60 + (parseFloat(s) || 0);
  }
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  const whole = Math.floor(num);
  return Math.floor(whole / 100) * 60 + (whole % 100) + (num - whole);
};

// Live-format a duration as the user types, auto-placing the colon before the
// last two whole-second digits: "7" -> "7", "73" -> "73", "730" -> "7:30",
// "4000" -> "40:00". Preserves a trailing decimal for tenths ("730.5" -> "7:30.5").
export const formatTimeInput = (raw) => {
  let v = String(raw ?? "").replace(/[^\d.]/g, "");
  const dot = v.indexOf(".");
  if (dot !== -1) {
    // collapse to a single decimal point
    v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "");
  }
  const [whole = "", frac] = v.split(".");
  let out =
    whole.length >= 3 ? `${whole.slice(0, -2)}:${whole.slice(-2)}` : whole;
  if (v.includes(".")) out += `.${frac ?? ""}`;
  return out;
};

export const secondsToSplit = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, "0")}`;
};

export const fmtTime = (sec) => {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1);
  return `${m}:${s.padStart(4, "0")}`;
};
