import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}

if (typeof global.Headers === 'undefined') {
  (global as any).Headers = class Headers {
    _map: Map<string, string>;
    constructor(init: any = {}) {
      this._map = new Map();
      if (init && typeof init === 'object') {
        for (const [k, v] of Object.entries(init)) {
          this.set(k as string, v as string);
        }
      }
    }
    set(key: string, value: string) {
      this._map.set(String(key).toLowerCase(), String(value));
    }
    get(key: string) {
      return this._map.get(String(key).toLowerCase()) ?? null;
    }
    has(key: string) {
      return this._map.has(String(key).toLowerCase());
    }
  };
}

if (typeof global.Request === 'undefined') {
  (global as any).Request = class Request {
    url: string;
    method: string;
    headers: any;
    constructor(input: any = '', init: any = {}) {
      this.url = typeof input === 'string' ? input : String(input?.url || '');
      this.method = init.method || 'GET';
      this.headers = init.headers instanceof (global as any).Headers ? init.headers : new (global as any).Headers(init.headers || {});
    }
  };
}

if (typeof global.Response === 'undefined') {
  (global as any).Response = class Response {
    _body: any;
    body: any;
    status: number;
    headers: any;
    ok: boolean;
    constructor(body: any = null, init: any = {}) {
      this._body = body;
      this.body = body;
      this.status = init.status || 200;
      this.headers = init.headers instanceof (global as any).Headers ? init.headers : new (global as any).Headers(init.headers || {});
      this.ok = this.status >= 200 && this.status < 300;
    }
    static json(data: any, init: any = {}) {
      const body = JSON.stringify(data);
      const headers = init.headers instanceof (global as any).Headers ? init.headers : new (global as any).Headers(init.headers || {});
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
      return new (global as any).Response(body, { ...init, headers });
    }
    async json() {
      if (typeof this._body === 'string') return JSON.parse(this._body);
      return this._body;
    }
    async text() {
      if (typeof this._body === 'string') return this._body;
      return JSON.stringify(this._body);
    }
  };
}
