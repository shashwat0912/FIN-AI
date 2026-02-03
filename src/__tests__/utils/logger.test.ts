import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock console methods
const mockConsole = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
};

// Mock import.meta.env
vi.mock('import.meta', () => ({
  env: {
    DEV: true,
  },
}));

// Import logger after mocking
import { logger } from '../../utils/logger';

describe('Logger Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Replace console methods with mocks
    Object.assign(console, mockConsole);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Logging', () => {
    it('should log info messages', () => {
      logger.info('Test message');

      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('Test error');

      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      logger.warn('Test warning');

      expect(mockConsole.warn).toHaveBeenCalled();
    });

    it('should log debug messages', () => {
      logger.debug('Test debug');

      expect(mockConsole.debug).toHaveBeenCalled();
    });
  });

  describe('Context Handling', () => {
    it('should include context in log messages', () => {
      const context = { userId: '123', action: 'login' };
      logger.info('User action', context);

      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('should handle undefined context', () => {
      logger.info('Message without context');

      expect(mockConsole.info).toHaveBeenCalled();
    });
  });
});
