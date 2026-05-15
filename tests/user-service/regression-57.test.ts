import { isValidPort } from '../src/helpers';

describe('isValidPort function', () => {
  it('should return true for valid port numbers', () => {
    expect(isValidPort(3000)).toBe(true);
    expect(isValidPort(8080)).toBe(true);
    expect(isValidPort(5000)).toBe(true);
  });

  it('should return false for invalid port numbers', () => {
    expect(isValidPort(-1)).toBe(false);
    expect(isValidPort(65536)).toBe(false);
    expect(isValidPort(null)).toBe(false);
    expect(isValidPort(undefined)).toBe(false);
    expect(isValidPort('8080')).toBe(false);
  });
});