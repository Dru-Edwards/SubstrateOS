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

/**
 * /dev/ai0 - AI Assistant Device
 * 
 * Provides AI capabilities to guest VMs through a simple chat interface.
 * This is a stub implementation that can be extended with real AI APIs.
 */

import { DruOSDevice, DruOSDeviceContext } from './index.js';

export interface AIRequest {
  id: string | number;
  op: 'CHAT' | 'COMPLETE' | 'ANALYZE';
  prompt: string;
  context?: {
    template?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  };
  options?: {
    maxTokens?: number;
    temperature?: number;
    model?: string;
  };
}

export interface AIResponse {
  id: string | number;
  ok: boolean;
  op: 'CHAT' | 'COMPLETE' | 'ANALYZE';
  reply?: string;
  error?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * AI device implementation
 */
export class AIDevice implements DruOSDevice {
  name = '/dev/ai0';
  private context?: DruOSDeviceContext;
  private sessionHistory: Map<string, string[]> = new Map();
  private requestCount = 0;
  
  constructor(private options?: {
    provider?: 'stub' | 'openai' | 'anthropic';
    apiKey?: string;
    defaultModel?: string;
  }) {
    this.options = {
      provider: 'stub',
      defaultModel: 'stub-echo',
      ...options
    };
  }

  async init(context: DruOSDeviceContext): Promise<void> {
    this.context = context;
    console.log(`[${this.name}] AI device initialized (provider: ${this.options?.provider})`);
  }

  async read(offset: number, length: number): Promise<ArrayBuffer> {
    // Not used for this device
    return new ArrayBuffer(0);
  }

  async write(data: ArrayBuffer): Promise<number> {
    try {
      // Decode the request
      const decoder = new TextDecoder();
      const requestStr = decoder.decode(data);
      const request: AIRequest = JSON.parse(requestStr);
      
      this.requestCount++;
      
      // Log the request
      console.log(`[${this.name}] Request #${this.requestCount}:`, request.op, request.prompt?.substring(0, 50));
      
      // Process the request
      let response: AIResponse;
      
      switch (request.op) {
        case 'CHAT':
          response = await this.handleChat(request);
          break;
        
        case 'COMPLETE':
          response = await this.handleComplete(request);
          break;
        
        case 'ANALYZE':
          response = await this.handleAnalyze(request);
          break;
        
        default:
          response = {
            id: request.id,
            ok: false,
            op: request.op,
            error: `Unknown operation: ${request.op}`
          };
      }
      
      // Send response back
      const encoder = new TextEncoder();
      const responseBuffer = encoder.encode(JSON.stringify(response));
      
      if (this.context) {
        this.context.sendToGuest?.(responseBuffer);
      }
      
      return data.byteLength;
    } catch (err) {
      console.error(`[${this.name}] Error processing request:`, err);
      
      // Send error response
      const errorResponse: AIResponse = {
        id: 0,
        ok: false,
        op: 'CHAT',
        error: err instanceof Error ? err.message : 'Unknown error'
      };
      
      const encoder = new TextEncoder();
      const responseBuffer = encoder.encode(JSON.stringify(errorResponse));
      
      if (this.context) {
        this.context.sendToGuest?.(responseBuffer);
      }
      
      return 0;
    }
  }

  private async handleChat(request: AIRequest): Promise<AIResponse> {
    const sessionId = request.context?.sessionId || 'default';
    
    // Get or create session history
    if (!this.sessionHistory.has(sessionId)) {
      this.sessionHistory.set(sessionId, []);
    }
    const history = this.sessionHistory.get(sessionId)!;
    
    // Add user message to history
    history.push(`User: ${request.prompt}`);
    
    // Generate response based on provider
    let reply: string;
    
    if (this.options?.provider === 'stub') {
      // Stub implementation with context-aware responses
      reply = this.generateStubResponse(request.prompt, request.context);
    } else {
      // TODO: Implement real AI provider integration
      reply = `[${this.options?.provider}] integration not yet implemented. Echo: ${request.prompt}`;
    }
    
    // Add AI response to history
    history.push(`AI: ${reply}`);
    
    // Keep history size manageable
    if (history.length > 20) {
      history.splice(0, 2);
    }
    
    return {
      id: request.id,
      ok: true,
      op: 'CHAT',
      reply: reply,
      usage: {
        promptTokens: request.prompt.length,
        completionTokens: reply.length,
        totalTokens: request.prompt.length + reply.length
      }
    };
  }

  private async handleComplete(request: AIRequest): Promise<AIResponse> {
    // Simple completion for stub
    const completion = this.generateCompletion(request.prompt);
    
    return {
      id: request.id,
      ok: true,
      op: 'COMPLETE',
      reply: completion,
      usage: {
        promptTokens: request.prompt.length,
        completionTokens: completion.length,
        totalTokens: request.prompt.length + completion.length
      }
    };
  }

  private async handleAnalyze(request: AIRequest): Promise<AIResponse> {
    // Simple analysis for stub
    const analysis = this.generateAnalysis(request.prompt);
    
    return {
      id: request.id,
      ok: true,
      op: 'ANALYZE',
      reply: analysis,
      usage: {
        promptTokens: request.prompt.length,
        completionTokens: analysis.length,
        totalTokens: request.prompt.length + analysis.length
      }
    };
  }

  private generateStubResponse(prompt: string, context?: any): string {
    const lowerPrompt = prompt.toLowerCase();
    
    // Template-specific responses
    if (context?.template === 'ai-sandbox') {
      if (lowerPrompt.includes('help')) {
        return 'I can help you with:\n' +
               '1. Running shell commands safely\n' +
               '2. Analyzing code and logs\n' +
               '3. Debugging issues\n' +
               '4. Writing scripts\n' +
               'What would you like to do?';
      }
      
      if (lowerPrompt.includes('command') || lowerPrompt.includes('run')) {
        return 'To run a command safely, I would:\n' +
               '1. Check if the command is in the allowed list\n' +
               '2. Validate parameters\n' +
               '3. Execute with resource limits\n' +
               '4. Return the output\n' +
               'Example: `ls -la /home`';
      }
    }
    
    // General responses
    if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi')) {
      return 'Hello! I\'m the DruOS AI assistant. How can I help you today?';
    }
    
    if (lowerPrompt.includes('what') && lowerPrompt.includes('can')) {
      return 'I can help with various tasks:\n' +
             '- Answer questions about DruOS\n' +
             '- Assist with Linux commands\n' +
             '- Help debug issues\n' +
             '- Provide code examples\n' +
             'What would you like to know?';
    }
    
    if (lowerPrompt.includes('file') || lowerPrompt.includes('directory')) {
      return 'For file operations, you can use:\n' +
             '- `ls` to list files\n' +
             '- `cat` to read files\n' +
             '- `echo > file` to create files\n' +
             '- `/dev/store0` for persistent storage';
    }
    
    if (lowerPrompt.includes('network') || lowerPrompt.includes('http')) {
      return 'DruOS provides network access through /dev/http:\n' +
             '- Make HTTP requests from guest to host\n' +
             '- Domain whitelisting for security\n' +
             '- JSON request/response protocol\n' +
             'Example: `http GET https://api.example.com`';
    }
    
    // Default echo with enhancement
    return `I understand you're asking about: "${prompt}"\n` +
           'This is a stub AI response. In production, this would connect to a real AI service.\n' +
           'Try asking about files, commands, or the network.';
  }

  private generateCompletion(prompt: string): string {
    // Simple completion based on common patterns
    const completions: Record<string, string> = {
      'function': ' myFunction() {\n  // Implementation here\n}',
      'class': ' MyClass {\n  constructor() {\n    // Initialize\n  }\n}',
      'import': ' { Module } from \'module-name\';',
      'const': ' myVariable = ',
      'if': ' (condition) {\n  // Code here\n}',
      'for': ' (let i = 0; i < length; i++) {\n  // Loop body\n}'
    };
    
    for (const [key, completion] of Object.entries(completions)) {
      if (prompt.toLowerCase().includes(key)) {
        return prompt + completion;
      }
    }
    
    return prompt + ' // Auto-completed';
  }

  private generateAnalysis(prompt: string): string {
    // Simple analysis
    const lines = prompt.split('\n');
    const wordCount = prompt.split(/\s+/).length;
    const hasCode = /[{}();]/.test(prompt);
    const hasError = /error|exception|fail/i.test(prompt);
    
    let analysis = '## Analysis Results\n\n';
    
    analysis += `**Input Summary:**\n`;
    analysis += `- Lines: ${lines.length}\n`;
    analysis += `- Words: ${wordCount}\n`;
    analysis += `- Type: ${hasCode ? 'Code' : 'Text'}\n`;
    
    if (hasError) {
      analysis += '\n**Potential Issues Detected:**\n';
      analysis += '- Error keywords found in input\n';
      analysis += '- Suggestion: Check error logs and stack traces\n';
    }
    
    if (hasCode) {
      analysis += '\n**Code Analysis:**\n';
      analysis += '- Language: JavaScript/TypeScript (detected)\n';
      analysis += '- Structure: Function/Class definitions found\n';
    }
    
    analysis += '\n**Recommendations:**\n';
    analysis += '1. Review the implementation\n';
    analysis += '2. Add error handling\n';
    analysis += '3. Include tests\n';
    
    return analysis;
  }

  async ioctl(request: number, arg: ArrayBuffer): Promise<ArrayBuffer> {
    // Not used for this device
    return new ArrayBuffer(0);
  }

  async destroy(): Promise<void> {
    console.log(`[${this.name}] AI device destroyed`);
    this.sessionHistory.clear();
  }

  async handleMessage(message: ArrayBuffer): Promise<void> {
    // Handle async messages if needed
    await this.write(message);
  }
}

/**
 * Factory function for creating AI device
 */
export function createAIDevice(options?: {
  provider?: 'stub' | 'openai' | 'anthropic';
  apiKey?: string;
  defaultModel?: string;
}): AIDevice {
  return new AIDevice(options);
}

// Convenience export
export const aiDevice = createAIDevice;
