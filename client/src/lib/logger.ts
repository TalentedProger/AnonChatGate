/**
 * Development-only logger utility
 * Logs are suppressed in production
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

const noop = () => {};

const createLogger = (): Logger => {
  if (!isDev) {
    // In production, only allow errors
    return {
      log: noop,
      warn: noop,
      error: (...args) => console.error(...args),
      info: noop,
      debug: noop,
    };
  }

  return {
    log: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
    info: (...args) => console.info(...args),
    debug: (...args) => console.debug(...args),
  };
};

export const logger = createLogger();

// Named export for convenience
export default logger;
