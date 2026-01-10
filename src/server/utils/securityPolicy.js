const parseNumber = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const MIN_PASSWORD_LENGTH = Math.max(parseNumber(process.env.PASSWORD_MIN_LENGTH, 8), 8);
const PASSWORD_HISTORY_LIMIT = Math.max(parseNumber(process.env.PW_HISTORY_LIMIT, 5), 1);
const PASSWORD_EXPIRATION_DAYS = Math.max(parseNumber(process.env.PASSWORD_EXPIRATION_DAYS, 60), 30);
const PASSWORD_REMINDER_DAYS = Math.max(parseNumber(process.env.PASSWORD_REMINDER_DAYS, 5), 1);
const MAX_FAILED_ATTEMPTS = Math.max(parseNumber(process.env.AUTH_MAX_FAILED_ATTEMPTS, 5), 3);
const LOCKOUT_MINUTES = parseNumber(process.env.AUTH_LOCKOUT_MINUTES, 30);
const SESSION_TIMEOUT_MINUTES_DEFAULT = Math.max(parseNumber(process.env.SESSION_TIMEOUT_MINUTES_DEFAULT, 10), 10);
const SESSION_TIMEOUT_MINUTES_MIN = Math.max(parseNumber(process.env.SESSION_TIMEOUT_MINUTES_MIN, 10), 5);
const SESSION_TIMEOUT_MINUTES_MAX = Math.max(parseNumber(process.env.SESSION_TIMEOUT_MINUTES_MAX, 480), SESSION_TIMEOUT_MINUTES_DEFAULT);

const PASSWORD_COMPLEXITY_REGEX = new RegExp(
  `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[\\W_]).{${MIN_PASSWORD_LENGTH},}$`
);

const calculatePasswordExpiry = (baseDate = new Date()) => {
  const date = new Date(baseDate);
  if (Number.isNaN(date.getTime())) {
    return new Date(Date.now() + PASSWORD_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
  }
  return new Date(date.getTime() + PASSWORD_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
};

module.exports = {
  securityPolicy: {
    MIN_PASSWORD_LENGTH,
    PASSWORD_HISTORY_LIMIT,
    PASSWORD_EXPIRATION_DAYS,
    PASSWORD_REMINDER_DAYS,
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_MINUTES,
    SESSION_TIMEOUT_MINUTES_DEFAULT,
    SESSION_TIMEOUT_MINUTES_MIN,
    SESSION_TIMEOUT_MINUTES_MAX,
    PASSWORD_COMPLEXITY_REGEX
  },
  parseNumber,
  calculatePasswordExpiry,
  isPasswordComplex: (password) => PASSWORD_COMPLEXITY_REGEX.test(password || '')
};
