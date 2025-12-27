import { describe, it, expect, beforeEach } from 'vitest';
import { StoreDevice, StoreRequest, StoreResponse } from '../src/store.js';

describe('/dev/store0 - Storage Device', () => {
  let device: StoreDevice;
  let capturedResponses: ArrayBuffer[] = [];

  beforeEach(() => {
    capturedResponses = [];
    device = new StoreDevice({ useLocalStorage: false }); // Use memory backend for tests
    
    // Mock context
    const context = {
      sendToGuest: (data: ArrayBuffer) => {
        capturedResponses.push(data);
      }
    };
    
    device.init(context);
  });

  const sendRequest = async (request: StoreRequest): Promise<StoreResponse> => {
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

  describe('PUT operation', () => {
    it('should store a key-value pair', async () => {
      const response = await sendRequest({
        id: '1',
        op: 'PUT',
        key: 'test-key',
        value: 'test-value'
      });

      expect(response.ok).toBe(true);
      expect(response.op).toBe('PUT');
      expect(response.key).toBe('test-key');
    });

    it('should fail with missing key', async () => {
      const response = await sendRequest({
        id: '2',
        op: 'PUT',
        value: 'test-value'
      });

      expect(response.ok).toBe(false);
      expect(response.error).toContain('Missing key');
    });

    it('should fail with missing value', async () => {
      const response = await sendRequest({
        id: '3',
        op: 'PUT',
        key: 'test-key'
      });

      expect(response.ok).toBe(false);
      expect(response.error).toContain('Missing value');
    });

    it('should overwrite existing values', async () => {
      await sendRequest({
        id: '4',
        op: 'PUT',
        key: 'overwrite-test',
        value: 'initial'
      });

      const response = await sendRequest({
        id: '5',
        op: 'PUT',
        key: 'overwrite-test',
        value: 'updated'
      });

      expect(response.ok).toBe(true);

      const getResponse = await sendRequest({
        id: '6',
        op: 'GET',
        key: 'overwrite-test'
      });

      expect(getResponse.value).toBe('updated');
    });
  });

  describe('GET operation', () => {
    it('should retrieve stored value', async () => {
      await sendRequest({
        id: '7',
        op: 'PUT',
        key: 'retrieve-test',
        value: 'stored-data'
      });

      const response = await sendRequest({
        id: '8',
        op: 'GET',
        key: 'retrieve-test'
      });

      expect(response.ok).toBe(true);
      expect(response.op).toBe('GET');
      expect(response.key).toBe('retrieve-test');
      expect(response.value).toBe('stored-data');
    });

    it('should return null for non-existent key', async () => {
      const response = await sendRequest({
        id: '9',
        op: 'GET',
        key: 'non-existent'
      });

      expect(response.ok).toBe(false);
      expect(response.value).toBe(null);
    });

    it('should fail with missing key', async () => {
      const response = await sendRequest({
        id: '10',
        op: 'GET'
      });

      expect(response.ok).toBe(false);
      expect(response.error).toContain('Missing key');
    });
  });

  describe('LIST operation', () => {
    it('should list all keys', async () => {
      await sendRequest({ id: '11', op: 'PUT', key: 'key1', value: 'val1' });
      await sendRequest({ id: '12', op: 'PUT', key: 'key2', value: 'val2' });
      await sendRequest({ id: '13', op: 'PUT', key: 'key3', value: 'val3' });

      const response = await sendRequest({
        id: '14',
        op: 'LIST'
      });

      expect(response.ok).toBe(true);
      expect(response.keys).toContain('key1');
      expect(response.keys).toContain('key2');
      expect(response.keys).toContain('key3');
      expect(response.keys?.length).toBe(3);
    });

    it('should filter keys by prefix', async () => {
      await sendRequest({ id: '15', op: 'PUT', key: 'app:config', value: 'val1' });
      await sendRequest({ id: '16', op: 'PUT', key: 'app:data', value: 'val2' });
      await sendRequest({ id: '17', op: 'PUT', key: 'user:prefs', value: 'val3' });

      const response = await sendRequest({
        id: '18',
        op: 'LIST',
        prefix: 'app:'
      });

      expect(response.ok).toBe(true);
      expect(response.keys).toContain('app:config');
      expect(response.keys).toContain('app:data');
      expect(response.keys).not.toContain('user:prefs');
      expect(response.keys?.length).toBe(2);
    });

    it('should return empty array when no keys match', async () => {
      const response = await sendRequest({
        id: '19',
        op: 'LIST',
        prefix: 'nonexistent:'
      });

      expect(response.ok).toBe(true);
      expect(response.keys).toEqual([]);
    });
  });

  describe('DELETE operation', () => {
    it('should delete existing key', async () => {
      await sendRequest({
        id: '20',
        op: 'PUT',
        key: 'delete-test',
        value: 'to-be-deleted'
      });

      const deleteResponse = await sendRequest({
        id: '21',
        op: 'DELETE',
        key: 'delete-test'
      });

      expect(deleteResponse.ok).toBe(true);
      expect(deleteResponse.op).toBe('DELETE');

      const getResponse = await sendRequest({
        id: '22',
        op: 'GET',
        key: 'delete-test'
      });

      expect(getResponse.ok).toBe(false);
      expect(getResponse.value).toBe(null);
    });

    it('should return false for non-existent key', async () => {
      const response = await sendRequest({
        id: '23',
        op: 'DELETE',
        key: 'never-existed'
      });

      expect(response.ok).toBe(false);
    });

    it('should fail with missing key', async () => {
      const response = await sendRequest({
        id: '24',
        op: 'DELETE'
      });

      expect(response.ok).toBe(false);
      expect(response.error).toContain('Missing key');
    });
  });

  describe('CLEAR operation', () => {
    it('should remove all keys', async () => {
      await sendRequest({ id: '25', op: 'PUT', key: 'clear1', value: 'val1' });
      await sendRequest({ id: '26', op: 'PUT', key: 'clear2', value: 'val2' });
      await sendRequest({ id: '27', op: 'PUT', key: 'clear3', value: 'val3' });

      const clearResponse = await sendRequest({
        id: '28',
        op: 'CLEAR'
      });

      expect(clearResponse.ok).toBe(true);
      expect(clearResponse.op).toBe('CLEAR');

      const listResponse = await sendRequest({
        id: '29',
        op: 'LIST'
      });

      expect(listResponse.keys).toEqual([]);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid operation', async () => {
      const response = await sendRequest({
        id: '30',
        op: 'INVALID' as any,
        key: 'test'
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
  });

  describe('Data persistence', () => {
    it('should maintain data across operations', async () => {
      // Store multiple values
      await sendRequest({ id: '31', op: 'PUT', key: 'persist1', value: 'data1' });
      await sendRequest({ id: '32', op: 'PUT', key: 'persist2', value: 'data2' });
      await sendRequest({ id: '33', op: 'PUT', key: 'persist3', value: 'data3' });

      // Delete one
      await sendRequest({ id: '34', op: 'DELETE', key: 'persist2' });

      // List should show two keys
      const listResponse = await sendRequest({ id: '35', op: 'LIST', prefix: 'persist' });
      expect(listResponse.keys?.length).toBe(2);
      expect(listResponse.keys).toContain('persist1');
      expect(listResponse.keys).toContain('persist3');

      // Values should be intact
      const get1 = await sendRequest({ id: '36', op: 'GET', key: 'persist1' });
      expect(get1.value).toBe('data1');

      const get3 = await sendRequest({ id: '37', op: 'GET', key: 'persist3' });
      expect(get3.value).toBe('data3');
    });
  });

  describe('Special characters', () => {
    it('should handle keys with special characters', async () => {
      const specialKey = 'user@domain.com:settings';
      const specialValue = '{"theme":"dark","lang":"en"}';

      const putResponse = await sendRequest({
        id: '38',
        op: 'PUT',
        key: specialKey,
        value: specialValue
      });

      expect(putResponse.ok).toBe(true);

      const getResponse = await sendRequest({
        id: '39',
        op: 'GET',
        key: specialKey
      });

      expect(getResponse.value).toBe(specialValue);
    });

    it('should handle Unicode in values', async () => {
      const unicodeValue = '你好世界 🌍 مرحبا بالعالم';

      await sendRequest({
        id: '40',
        op: 'PUT',
        key: 'unicode-test',
        value: unicodeValue
      });

      const response = await sendRequest({
        id: '41',
        op: 'GET',
        key: 'unicode-test'
      });

      expect(response.value).toBe(unicodeValue);
    });
  });
});
