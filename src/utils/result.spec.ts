import { describe, it, expect } from 'vitest';
import { createResult, createErrorResult } from './result';

describe('result utilities', () => {
  describe('createResult', () => {
    it('should create a successful result with a value', () => {
      const value = { id: 1, name: 'test' };
      const result = createResult(value);

      expect(result.hasError()).toBe(false);
      expect('value' in result && result.value).toEqual(value);
    });

    it('should create a result with primitive values', () => {
      const stringResult = createResult('hello');
      expect(stringResult.hasError()).toBe(false);
      expect('value' in stringResult && stringResult.value).toBe('hello');

      const numberResult = createResult(42);
      expect(numberResult.hasError()).toBe(false);
      expect('value' in numberResult && numberResult.value).toBe(42);

      const boolResult = createResult(true);
      expect(boolResult.hasError()).toBe(false);
      expect('value' in boolResult && boolResult.value).toBe(true);
    });

    it('should create a result with null or undefined', () => {
      const nullResult = createResult(null);
      expect(nullResult.hasError()).toBe(false);
      expect('value' in nullResult && nullResult.value).toBe(null);

      const undefinedResult = createResult(undefined);
      expect(undefinedResult.hasError()).toBe(false);
      expect('value' in undefinedResult && undefinedResult.value).toBe(undefined);
    });

    it('should not have error property on success result', () => {
      const result = createResult('success');
      expect(result.hasError()).toBe(false);
      expect('error' in result).toBe(false);
    });
  });

  describe('createErrorResult', () => {
    it('should create an error result from Error instance', () => {
      const error = new Error('Something went wrong');
      const result = createErrorResult(error);

      expect(result.hasError()).toBe(true);
      if (result.hasError()) {
        expect(result.error).toBe(error);
        expect(result.error.message).toBe('Something went wrong');
      }
    });

    it('should create an error result from string', () => {
      const result = createErrorResult('Error message');

      expect(result.hasError()).toBe(true);
      if (result.hasError()) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('Error message');
      }
    });

    it('should create an error result from object', () => {
      const errorObj = { code: 500, message: 'Server error' };
      const result = createErrorResult(errorObj);

      expect(result.hasError()).toBe(true);
      if (result.hasError()) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe(JSON.stringify(errorObj));
      }
    });

    it('should create an error result from primitive values', () => {
      const numberResult = createErrorResult(404);
      expect(numberResult.hasError()).toBe(true);
      if (numberResult.hasError()) {
        expect(numberResult.error.message).toBe('404');
      }

      const boolResult = createErrorResult(false);
      expect(boolResult.hasError()).toBe(true);
      if (boolResult.hasError()) {
        expect(boolResult.error.message).toBe('false');
      }
    });

    it('should create an error result from null or undefined', () => {
      const nullResult = createErrorResult(null);
      expect(nullResult.hasError()).toBe(true);
      if (nullResult.hasError()) {
        expect(nullResult.error.message).toBe('null');
      }

      const undefinedResult = createErrorResult(undefined);
      expect(undefinedResult.hasError()).toBe(true);
      if (undefinedResult.hasError()) {
        // JSON.stringify(undefined) returns undefined, so empty string is used
        expect(undefinedResult.error).toBeInstanceOf(Error);
      }
    });

    it('should not have value property on error result', () => {
      const result = createErrorResult(new Error('test'));
      expect(result.hasError()).toBe(true);
      expect('value' in result).toBe(false);
    });

    it('should handle custom Error subclasses', () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: number,
        ) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const customError = new CustomError('Custom error occurred', 123);
      const result = createErrorResult(customError);

      expect(result.hasError()).toBe(true);
      if (result.hasError()) {
        expect(result.error).toBe(customError);
        expect(result.error.message).toBe('Custom error occurred');
        expect(result.error.name).toBe('CustomError');
      }
    });
  });
});
