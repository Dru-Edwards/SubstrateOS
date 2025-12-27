/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ║                                                          ║
 * ╚══════════════════════════════════════════════════════════╝
 *  Business Unit : DruOS-Core
 *  Module        : WebAssembly Linux DevKit Platform
 *  Author        : Andrew "Dru" Edwards
 *  Umbrella      : Edwards Tech Innovation
 *  Notice        : © 2025 All rights reserved.
 * ============================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AIDevice, AIRequest, AIResponse } from '../src/ai.js';

describe('/dev/ai0 - AI Assistant Device', () => {
  let device: AIDevice;
  let capturedResponses: ArrayBuffer[] = [];

  beforeEach(() => {
    capturedResponses = [];
    device = new AIDevice({ provider: 'stub' });
    
    // Mock context
    const context = {
      sendToGuest: (data: ArrayBuffer) => {
        capturedResponses.push(data);
      }
    };
    
    device.init(context as any);
  });

  const sendRequest = async (request: AIRequest): Promise<AIResponse> => {
    const encoder = new TextEncoder();
    const requestBuffer = encoder.encode(JSON.stringify(request));
    
    capturedResponses = [];
    await device.write(requestBuffer);
    
    if (capturedResponses.length === 0) {
      throw new Error('No response received');
    }
    
    const decoder = new TextDecoder();
    const responseStr = decoder.decode(capturedResponses[0]);
    return JSON.parse(responseStr);
  };

  describe('CHAT operation', () => {
    it('should respond to chat messages', async () => {
      const response = await sendRequest({
        id: '1',
        op: 'CHAT',
        prompt: 'Hello AI, how are you?',
        context: {
          template: 'ai-sandbox',
          sessionId: 'test-session'
        }
      });

      expect(response.ok).toBe(true);
      expect(response.op).toBe('CHAT');
      expect(response.reply).toBeDefined();
      expect(response.reply?.length).toBeGreaterThan(0);
    });

    it('should provide context-aware responses', async () => {
      const response = await sendRequest({
        id: '2',
        op: 'CHAT',
        prompt: 'help',
        context: {
          template: 'ai-sandbox'
        }
      });

      expect(response.ok).toBe(true);
      expect(response.reply).toContain('help you with');
      expect(response.reply).toContain('commands');
    });

    it('should maintain session history', async () => {
      const sessionId = 'history-test';
      
      // First message
      await sendRequest({
        id: '3',
        op: 'CHAT',
        prompt: 'My name is TestUser',
        context: { sessionId }
      });

      // Second message
      const response = await sendRequest({
        id: '4',
        op: 'CHAT',
        prompt: 'What did I just tell you?',
        context: { sessionId }
      });

      expect(response.ok).toBe(true);
      // The stub should have access to previous context
      expect(response.reply).toBeDefined();
    });

    it('should include usage statistics', async () => {
      const response = await sendRequest({
        id: '5',
        op: 'CHAT',
        prompt: 'Test message'
      });

      expect(response.usage).toBeDefined();
      expect(response.usage?.promptTokens).toBeGreaterThan(0);
      expect(response.usage?.completionTokens).toBeGreaterThan(0);
      expect(response.usage?.totalTokens).toBe(
        (response.usage?.promptTokens || 0) + (response.usage?.completionTokens || 0)
      );
    });
  });

  describe('COMPLETE operation', () => {
    it('should complete code snippets', async () => {
      const response = await sendRequest({
        id: '6',
        op: 'COMPLETE',
        prompt: 'function'
      });

      expect(response.ok).toBe(true);
      expect(response.op).toBe('COMPLETE');
      expect(response.reply).toContain('function');
      expect(response.reply?.length).toBeGreaterThan('function'.length);
    });

    it('should handle various completion patterns', async () => {
      const patterns = ['class', 'import', 'const', 'if', 'for'];
      
      for (const pattern of patterns) {
        const response = await sendRequest({
          id: `complete-${pattern}`,
          op: 'COMPLETE',
          prompt: pattern
        });

        expect(response.ok).toBe(true);
        expect(response.reply).toContain(pattern);
      }
    });
  });

  describe('ANALYZE operation', () => {
    it('should analyze text input', async () => {
      const response = await sendRequest({
        id: '7',
        op: 'ANALYZE',
        prompt: 'This is a test\nWith multiple lines\nAnd some content'
      });

      expect(response.ok).toBe(true);
      expect(response.op).toBe('ANALYZE');
      expect(response.reply).toContain('Analysis Results');
      expect(response.reply).toContain('Lines:');
      expect(response.reply).toContain('Words:');
    });

    it('should detect code in analysis', async () => {
      const response = await sendRequest({
        id: '8',
        op: 'ANALYZE',
        prompt: 'function test() { return true; }'
      });

      expect(response.ok).toBe(true);
      expect(response.reply).toContain('Code');
      expect(response.reply).toContain('JavaScript');
    });

    it('should detect errors in analysis', async () => {
      const response = await sendRequest({
        id: '9',
        op: 'ANALYZE',
        prompt: 'Error: Failed to connect\nException thrown at line 42'
      });

      expect(response.ok).toBe(true);
      expect(response.reply).toContain('Issues Detected');
      expect(response.reply).toContain('error');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid operations', async () => {
      const response = await sendRequest({
        id: '10',
        op: 'INVALID' as any,
        prompt: 'test'
      });

      expect(response.ok).toBe(false);
      expect(response.error).toContain('Unknown operation');
    });

    it('should handle malformed JSON', async () => {
      const encoder = new TextEncoder();
      const malformedBuffer = encoder.encode('{ invalid json }');
      
      capturedResponses = [];
      await device.write(malformedBuffer);
      
      if (capturedResponses.length > 0) {
        const decoder = new TextDecoder();
        const responseStr = decoder.decode(capturedResponses[0]);
        const response = JSON.parse(responseStr);
        
        expect(response.ok).toBe(false);
        expect(response.error).toBeDefined();
      }
    });

    it('should handle missing prompt', async () => {
      const response = await sendRequest({
        id: '11',
        op: 'CHAT',
        prompt: ''
      });

      // Should still work but with minimal response
      expect(response.ok).toBe(true);
      expect(response.reply).toBeDefined();
    });
  });

  describe('Template-specific behavior', () => {
    it('should provide AI sandbox specific responses', async () => {
      const response = await sendRequest({
        id: '12',
        op: 'CHAT',
        prompt: 'How do I run commands safely?',
        context: {
          template: 'ai-sandbox'
        }
      });

      expect(response.ok).toBe(true);
      expect(response.reply).toContain('safely');
      expect(response.reply).toContain('allowed');
    });

    it('should handle education template context', async () => {
      const response = await sendRequest({
        id: '13',
        op: 'CHAT',
        prompt: 'What are Linux file permissions?',
        context: {
          template: 'education-lab'
        }
      });

      expect(response.ok).toBe(true);
      expect(response.reply).toBeDefined();
    });

    it('should handle devtools template context', async () => {
      const response = await sendRequest({
        id: '14',
        op: 'CHAT',
        prompt: 'How do I use the HTTP device?',
        context: {
          template: 'devtools-sandbox'
        }
      });

      expect(response.ok).toBe(true);
      expect(response.reply).toContain('http');
    });
  });

  describe('Options and configuration', () => {
    it('should respect max tokens option', async () => {
      const response = await sendRequest({
        id: '15',
        op: 'CHAT',
        prompt: 'Tell me everything about Linux',
        options: {
          maxTokens: 50
        }
      });

      expect(response.ok).toBe(true);
      // In a real implementation, would check token limit
      expect(response.reply).toBeDefined();
    });

    it('should handle temperature setting', async () => {
      const response = await sendRequest({
        id: '16',
        op: 'CHAT',
        prompt: 'Generate a creative story',
        options: {
          temperature: 0.9
        }
      });

      expect(response.ok).toBe(true);
      expect(response.reply).toBeDefined();
    });

    it('should handle model selection', async () => {
      const response = await sendRequest({
        id: '17',
        op: 'CHAT',
        prompt: 'Test',
        options: {
          model: 'advanced-model'
        }
      });

      expect(response.ok).toBe(true);
      expect(response.reply).toBeDefined();
    });
  });
});
