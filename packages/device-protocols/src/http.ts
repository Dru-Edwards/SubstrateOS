import type { DruOSDevice, DruOSDeviceContext } from './index';

/**
 * HTTP Device (/dev/http)
 * Provides HTTP client capabilities to the guest
 */

export interface HttpDeviceOptions {
  allowedDomains?: string[];
  blockedDomains?: string[];
  timeout?: number;
  maxSize?: number;
}

interface HttpRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

interface HttpResponse {
  id: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: any;
  error?: string;
}

class HttpDevice implements DruOSDevice {
  readonly name = '/dev/http';
  private context: DruOSDeviceContext | null = null;
  private options: HttpDeviceOptions;
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();
  private pendingRequests = new Map<string, AbortController>();

  constructor(options: HttpDeviceOptions = {}) {
    this.options = {
      timeout: options.timeout || 10000,
      maxSize: options.maxSize || 10 * 1024 * 1024, // 10MB default
      allowedDomains: options.allowedDomains || ['*'],
      blockedDomains: options.blockedDomains || []
    };
  }

  init(context: DruOSDeviceContext): void {
    this.context = context;
    console.log('[HTTP] Device initialized');
  }

  async handleMessage(data: ArrayBuffer | Uint8Array): Promise<void> {
    try {
      // Decode request from guest
      const message = this.decoder.decode(data);
      const request = JSON.parse(message) as HttpRequest;
      
      // Validate request
      if (!this.validateRequest(request)) {
        await this.sendError(request.id, 'Invalid request');
        return;
      }
      
      // Check domain restrictions
      const url = new URL(request.url);
      if (!this.isDomainAllowed(url.hostname)) {
        await this.sendError(request.id, `Domain not allowed: ${url.hostname}`);
        return;
      }
      
      // Perform HTTP request
      const response = await this.performRequest(request);
      
      // Send response back to guest
      await this.sendResponse(response);
      
    } catch (error) {
      console.error('[HTTP] Request failed:', error);
      
      // Try to extract request ID for error response
      try {
        const message = this.decoder.decode(data);
        const { id } = JSON.parse(message);
        await this.sendError(id, error instanceof Error ? error.message : 'Request failed');
      } catch {
        // Can't parse request, log error only
        console.error('[HTTP] Could not send error response');
      }
    }
  }

  private validateRequest(request: HttpRequest): boolean {
    if (!request.id || !request.method || !request.url) {
      return false;
    }
    
    try {
      new URL(request.url);
      return true;
    } catch {
      return false;
    }
  }

  private isDomainAllowed(hostname: string): boolean {
    // Check blocked list first
    for (const blocked of this.options.blockedDomains || []) {
      if (this.matchesDomain(hostname, blocked)) {
        return false;
      }
    }
    
    // Check allowed list
    const allowed = this.options.allowedDomains || ['*'];
    if (allowed.includes('*')) {
      return true;
    }
    
    for (const pattern of allowed) {
      if (this.matchesDomain(hostname, pattern)) {
        return true;
      }
    }
    
    return false;
  }

  private matchesDomain(hostname: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      return hostname === suffix || hostname.endsWith('.' + suffix);
    }
    return hostname === pattern;
  }

  private async performRequest(request: HttpRequest): Promise<HttpResponse> {
    const abortController = new AbortController();
    this.pendingRequests.set(request.id, abortController);
    
    // Setup timeout
    const timeout = request.timeout || this.options.timeout || 10000;
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);
    
    try {
      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method: request.method,
        signal: abortController.signal,
        headers: request.headers || {}
      };
      
      // Add body if present (not for GET/HEAD)
      if (request.body && !['GET', 'HEAD'].includes(request.method)) {
        if (typeof request.body === 'object') {
          fetchOptions.body = JSON.stringify(request.body);
          fetchOptions.headers = {
            'Content-Type': 'application/json',
            ...fetchOptions.headers
          };
        } else {
          fetchOptions.body = request.body;
        }
      }
      
      // Perform fetch
      const response = await fetch(request.url, fetchOptions);
      
      // Check response size
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > (this.options.maxSize || 10485760)) {
        throw new Error('Response too large');
      }
      
      // Extract headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      // Read response body
      let body: any;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        body = await response.json();
      } else if (contentType.includes('text/')) {
        body = await response.text();
      } else {
        // For binary data, convert to base64 for now
        // TODO: Use ArrayBuffer transfer for efficiency
        const buffer = await response.arrayBuffer();
        body = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      }
      
      return {
        id: request.id,
        status: response.status,
        statusText: response.statusText,
        headers,
        body
      };
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
      throw new Error('Unknown error');
      
    } finally {
      clearTimeout(timeoutId);
      this.pendingRequests.delete(request.id);
    }
  }

  private async sendResponse(response: HttpResponse): Promise<void> {
    if (!this.context) return;
    
    const message = JSON.stringify(response);
    this.context.sendToGuest(this.encoder.encode(message));
  }

  private async sendError(id: string, error: string): Promise<void> {
    const response: HttpResponse = {
      id,
      status: 0,
      statusText: 'Error',
      headers: {},
      error
    };
    
    await this.sendResponse(response);
  }

  // Cancel all pending requests
  cleanup(): void {
    this.pendingRequests.forEach(controller => controller.abort());
    this.pendingRequests.clear();
  }
}

export function httpDevice(options?: HttpDeviceOptions): DruOSDevice {
  return new HttpDevice(options);
}

/**
 * Guest-side protocol specification:
 * 
 * To make an HTTP request from the guest:
 * 1. Format request as JSON:
 *    {
 *      "id": "req-123",
 *      "method": "GET",
 *      "url": "https://api.example.com/data",
 *      "headers": { "Accept": "application/json" }
 *    }
 * 
 * 2. Write to /dev/http
 * 
 * 3. Read response:
 *    {
 *      "id": "req-123",
 *      "status": 200,
 *      "statusText": "OK",
 *      "headers": { "content-type": "application/json" },
 *      "body": { "data": "..." }
 *    }
 * 
 * Example C implementation (guest):
 * ```c
 * typedef struct {
 *     char* id;
 *     int status;
 *     char* body;
 * } http_response_t;
 * 
 * http_response_t* http_get(const char* url) {
 *     int fd = open("/dev/http", O_RDWR);
 *     if (fd < 0) return NULL;
 *     
 *     char request[1024];
 *     char id[32];
 *     snprintf(id, sizeof(id), "req-%d", rand());
 *     snprintf(request, sizeof(request),
 *              "{\"id\":\"%s\",\"method\":\"GET\",\"url\":\"%s\"}",
 *              id, url);
 *     
 *     write(fd, request, strlen(request));
 *     
 *     // Read response
 *     char response_buf[8192];
 *     int n = read(fd, response_buf, sizeof(response_buf));
 *     close(fd);
 *     
 *     if (n <= 0) return NULL;
 *     
 *     // Parse JSON response (simplified)
 *     http_response_t* response = malloc(sizeof(http_response_t));
 *     // ... parse JSON ...
 *     
 *     return response;
 * }
 * ```
 */
