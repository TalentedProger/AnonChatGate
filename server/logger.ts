import pino from 'pino';

/**
 * Структурированный logger на основе pino
 * 
 * Features:
 * - Pretty printing в development режиме
 * - JSON формат в production для парсинга
 * - Настраиваемый уровень логирования через LOG_LEVEL env
 * - Безопасное логирование (автоматическое скрытие sensitive данных)
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  
  // Pretty printing в dev режиме для удобства чтения
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
      singleLine: false,
    }
  } : undefined,

  // Базовые настройки для production
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },

  // Скрываем sensitive данные
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      '*.password',
      '*.token',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]'
  },

  // Добавляем timestamp в production
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

/**
 * Helper для логирования HTTP запросов
 */
export function logRequest(method: string, path: string, userId?: number, duration?: number) {
  logger.info({
    type: 'http_request',
    method,
    path,
    userId,
    duration,
  }, `${method} ${path}`);
}

/**
 * Helper для логирования WebSocket событий
 */
export function logWebSocket(event: string, userId?: number, data?: any) {
  logger.info({
    type: 'websocket',
    event,
    userId,
    ...data,
  }, `WebSocket: ${event}`);
}

/**
 * Helper для логирования ошибок
 */
export function logError(error: Error, context?: any) {
  logger.error({
    type: 'error',
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    ...context,
  }, error.message);
}

/**
 * Helper для логирования аутентификации
 */
export function logAuth(action: string, userId?: number, success: boolean = true, error?: string) {
  const level = success ? 'info' : 'warn';
  logger[level]({
    type: 'auth',
    action,
    userId,
    success,
    error,
  }, `Auth: ${action} - ${success ? 'success' : 'failed'}`);
}

/**
 * Helper для логирования database операций
 */
export function logDatabase(operation: string, table: string, duration?: number, error?: Error) {
  if (error) {
    logger.error({
      type: 'database',
      operation,
      table,
      duration,
      error: error.message,
    }, `DB Error: ${operation} on ${table}`);
  } else {
    logger.debug({
      type: 'database',
      operation,
      table,
      duration,
    }, `DB: ${operation} on ${table}`);
  }
}

// Экспортируем также как default для удобства
export default logger;
