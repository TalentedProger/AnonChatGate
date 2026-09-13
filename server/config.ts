/**
 * Server Configuration Constants
 * 
 * Централизованная конфигурация для всех серверных модулей.
 * Все magic numbers вынесены сюда с документацией.
 */

// ============================================
// Rate Limiting Configuration
// ============================================

/**
 * Rate limiting для WebSocket сообщений
 */
export const RATE_LIMIT = {
  /** Максимум сообщений в окне (10 сообщений) */
  MESSAGE_LIMIT: 10,
  /** Размер окна в миллисекундах (10 секунд) */
  WINDOW_MS: 10_000,
} as const;

/**
 * Rate limiting для API эндпоинтов
 */
export const API_RATE_LIMIT = {
  /** General API budget per authenticated user (5 minutes). */
  WINDOW_MS: 5 * 60 * 1000,
  MAX_REQUESTS: 600,
  /** Login budget is IP-based and intentionally allows a 100-user campus NAT. */
  AUTH_WINDOW_MS: 15 * 60 * 1000,
  AUTH_MAX_REQUESTS: 300,
  /** Refresh/logout requests are isolated by the signed refresh-token user ID. */
  REFRESH_WINDOW_MS: 15 * 60 * 1000,
  REFRESH_MAX_REQUESTS: 60,
  /** Image decoding is CPU-intensive, so uploads have a separate user budget. */
  UPLOAD_WINDOW_MS: 60 * 60 * 1000,
  UPLOAD_MAX_REQUESTS: 30,
} as const;

export const TELEGRAM_WEBHOOK = {
  /** Webhook requests accepted per minute after secret validation. */
  WINDOW_MS: 60 * 1000,
  MAX_REQUESTS: 600,
  /** Telegram Bot API allows 1-256 characters from this alphabet. */
  SECRET_PATTERN: /^[A-Za-z0-9_-]{32,256}$/,
} as const;

// ============================================
// Message Configuration
// ============================================

/**
 * Конфигурация сообщений
 */
export const MESSAGE = {
  /** Максимальный размер WebSocket сообщения в байтах (100KB) */
  MAX_SIZE_BYTES: 100 * 1024,
  /** Максимальная длина текста сообщения в символах */
  MAX_LENGTH: 1000,
  /** Количество сообщений по умолчанию при загрузке */
  DEFAULT_LIMIT: 50,
  /** Максимальное количество сообщений за один запрос */
  MAX_LIMIT: 100,
} as const;

// ============================================
// Authentication Configuration
// ============================================

/**
 * Конфигурация аутентификации
 */
export const AUTH = {
  /** Время жизни initData в секундах (24 часа) */
  INIT_DATA_MAX_AGE_SECONDS: 86400,
  /** Время жизни access token в миллисекундах (15 минут) */
  ACCESS_TOKEN_LIFETIME_MS: 15 * 60 * 1000,
  /** Время жизни refresh token в миллисекундах (7 дней) */
  REFRESH_TOKEN_LIFETIME_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

// ============================================
// WebSocket Configuration
// ============================================

/**
 * Конфигурация WebSocket
 */
export const WEBSOCKET = {
  /** Минимальный интервал между broadcast онлайн-пользователей (1 секунда) */
  BROADCAST_THROTTLE_MS: 1000,
  /** Таймаут пинга для keepalive (30 секунд) */
  PING_INTERVAL_MS: 30_000,
} as const;

// ============================================
// Upload Configuration
// ============================================

/**
 * Конфигурация загрузки файлов
 */
export const UPLOAD = {
  /** Максимальный размер файла в байтах (5MB) */
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  /** Максимальное количество фото в массиве */
  MAX_PHOTOS: 5,
  /** Разрешенные MIME-типы */
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
} as const;

// ============================================
// Statistics Configuration
// ============================================

/**
 * Конфигурация статистики
 */
export const STATISTICS = {
  /** Количество топ-пользователей по умолчанию */
  DEFAULT_TOP_USERS: 10,
  /** Количество новостей по умолчанию */
  DEFAULT_NEWS_LIMIT: 5,
} as const;

// ============================================
// Server Configuration
// ============================================

/**
 * Конфигурация сервера
 */
export const SERVER = {
  /** Порт сервера по умолчанию */
  DEFAULT_PORT: 3000,
  /** Имя глобальной комнаты */
  GLOBAL_ROOM_NAME: 'Global Chat',
} as const;

/**
 * Проверка обязательных переменных окружения
 */
export function validateEnv(): void {
  const required = ['DATABASE_URL', 'TELEGRAM_BOT_TOKEN', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
