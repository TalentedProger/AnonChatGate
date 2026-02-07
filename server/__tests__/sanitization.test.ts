import { describe, it, expect } from 'vitest';
import validator from 'validator';

// These functions are copied from routes.ts for testing
// In production, consider extracting them to a separate module

function sanitizeText(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  
  // Escape HTML special characters
  let sanitized = validator.escape(input);
  
  // Remove script patterns
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized || undefined;
}

function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  const trimmed = url.trim();
  
  // Check if valid URL
  if (!validator.isURL(trimmed, { 
    protocols: ['http', 'https'],
    require_protocol: true 
  })) {
    return null;
  }
  
  return trimmed;
}

describe('Sanitization Functions', () => {
  describe('sanitizeText', () => {
    it('should return undefined for null or undefined input', () => {
      expect(sanitizeText(null)).toBeUndefined();
      expect(sanitizeText(undefined)).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(sanitizeText('')).toBeUndefined();
    });

    it('should escape HTML special characters', () => {
      const input = '<div>Test</div>';
      const result = sanitizeText(input);
      
      expect(result).not.toContain('<div>');
      expect(result).not.toContain('</div>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should escape and neutralize script tags', () => {
      const maliciousInputs = [
        '<script>alert("XSS")</script>Hello',
        'Test<script src="evil.js"></script>',
        '<SCRIPT>alert(1)</SCRIPT>Normal text'
      ];

      maliciousInputs.forEach(input => {
        const result = sanitizeText(input);
        expect(result).toBeDefined();
        // Script tags should be escaped (< becomes &lt;, > becomes &gt;)
        // This makes them harmless even if the word "script" appears
        expect(result).not.toContain('<script');
        expect(result).not.toContain('<SCRIPT');
        expect(result?.toLowerCase()).not.toContain('<script');
      });
    });

    it('should remove javascript: protocol', () => {
      const maliciousInputs = [
        'javascript:alert(1)',
        'Click here: javascript:void(0)',
        'JAVASCRIPT:alert("XSS")'
      ];

      maliciousInputs.forEach(input => {
        const result = sanitizeText(input);
        expect(result).toBeDefined();
        expect(result?.toLowerCase()).not.toContain('javascript:');
      });
    });

    it('should remove event handlers', () => {
      const maliciousInputs = [
        'Text onclick=alert(1)',
        'onmouseover=alert(1) text',
        'ONLOAD=malicious()'
      ];

      maliciousInputs.forEach(input => {
        const result = sanitizeText(input);
        expect(result).toBeDefined();
        expect(result?.toLowerCase()).not.toMatch(/on\w+\s*=/);
      });
    });

    it('should normalize whitespace', () => {
      const inputs = [
        '  extra   spaces  ',
        'line\n\nbreaks\n',
        'tab\t\tcharacters',
        '  mixed   \n\t  whitespace  '
      ];

      inputs.forEach(input => {
        const result = sanitizeText(input);
        expect(result).toBeDefined();
        // Should have single spaces and be trimmed
        expect(result).not.toMatch(/\s{2,}/);
        expect(result).not.toMatch(/^\s|\s$/);
      });
    });

    it('should preserve safe text', () => {
      const safeInputs = [
        'Hello World',
        'Test 123',
        'User_name-123',
        'Имя пользователя' // Cyrillic
      ];

      safeInputs.forEach(input => {
        const result = sanitizeText(input);
        expect(result).toBeDefined();
        // Should not be empty after sanitization
        expect(result).toBeTruthy();
      });
    });

    it('should handle special characters safely', () => {
      const result = sanitizeText('Test & "quotes" <brackets>');
      
      expect(result).toBeDefined();
      expect(result).toContain('&amp;'); // & escaped
      expect(result).toContain('&quot;'); // " escaped
      expect(result).toContain('&lt;'); // < escaped
      expect(result).toContain('&gt;'); // > escaped
    });

    it('should return undefined for whitespace-only input', () => {
      const whitespaceInputs = ['   ', '\n\n', '\t\t', '  \n  \t  '];
      
      whitespaceInputs.forEach(input => {
        const result = sanitizeText(input);
        expect(result).toBeUndefined();
      });
    });
  });

  describe('sanitizeUrl', () => {
    it('should return null for null or undefined input', () => {
      expect(sanitizeUrl(null)).toBeNull();
      expect(sanitizeUrl(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(sanitizeUrl('')).toBeNull();
    });

    it('should accept valid HTTP URLs', () => {
      const validUrls = [
        'http://example.com',
        'http://example.com/path',
        'http://example.com/path?query=value',
        'http://subdomain.example.com'
      ];

      validUrls.forEach(url => {
        const result = sanitizeUrl(url);
        expect(result).toBe(url);
      });
    });

    it('should accept valid HTTPS URLs', () => {
      const validUrls = [
        'https://example.com',
        'https://example.com/path',
        'https://example.com:8080/path',
        'https://api.example.com/v1/endpoint'
      ];

      validUrls.forEach(url => {
        const result = sanitizeUrl(url);
        expect(result).toBe(url);
      });
    });

    it('should reject URLs without protocol', () => {
      const invalidUrls = [
        'example.com',
        'www.example.com',
        '//example.com',
        'example.com/path'
      ];

      invalidUrls.forEach(url => {
        const result = sanitizeUrl(url);
        expect(result).toBeNull();
      });
    });

    it('should reject non-HTTP(S) protocols', () => {
      const invalidUrls = [
        'ftp://example.com',
        'file:///etc/passwd',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'tel:+1234567890',
        'mailto:test@example.com'
      ];

      invalidUrls.forEach(url => {
        const result = sanitizeUrl(url);
        expect(result).toBeNull();
      });
    });

    it('should reject malformed URLs', () => {
      const invalidUrls = [
        'not a url',
        'http://',
        'https://',
        'http://.',
        'http://..',
        'http://../',
        'http://?',
        'http://??',
        'http://foo.bar?q=Spaces should be encoded'
      ];

      invalidUrls.forEach(url => {
        const result = sanitizeUrl(url);
        expect(result).toBeNull();
      });
    });

    it('should trim whitespace from URLs', () => {
      const urlsWithWhitespace = [
        '  https://example.com  ',
        '\thttps://example.com\t',
        ' https://example.com '
      ];

      urlsWithWhitespace.forEach(url => {
        const result = sanitizeUrl(url);
        expect(result).toBe('https://example.com');
      });
    });

    it('should handle international domain names', () => {
      const internationalUrls = [
        'https://münchen.de',
        'https://москва.рф'
      ];

      // These might or might not be accepted depending on validator configuration
      // Just verify the function doesn't crash
      internationalUrls.forEach(url => {
        const result = sanitizeUrl(url);
        expect(result === null || typeof result === 'string').toBe(true);
      });
    });

    it('should accept URLs with ports', () => {
      const urlsWithPorts = [
        'http://example.com:8080',
        'https://example.com:3000'
      ];

      urlsWithPorts.forEach(url => {
        const result = sanitizeUrl(url);
        expect(result).toBe(url);
      });
      
      // Note: localhost URLs might not be accepted by validator.isURL
      // depending on configuration - test separately if needed
    });

    it('should accept URLs with query parameters', () => {
      const urlsWithParams = [
        'https://example.com?param=value',
        'https://example.com?param1=value1&param2=value2',
        'https://example.com/path?query=test#anchor'
      ];

      urlsWithParams.forEach(url => {
        const result = sanitizeUrl(url);
        expect(result).toBe(url);
      });
    });
  });
});
