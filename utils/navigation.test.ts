import { getGameScenePath, getHomePath } from './navigation';

describe('Navigation Utilities', () => {
  describe('getGameScenePath', () => {
    it('should return the correct path for non-debug mode', () => {
      expect(getGameScenePath(1, 0)).toBe('/games/domain-ch1/0');
    });

    it('should return the correct path for debug mode', () => {
      expect(getGameScenePath(2, 3, true)).toBe('/debug/games/domain-ch2/3');
    });

    it('should return the correct path for scene index zero in non-debug mode', () => {
      expect(getGameScenePath(5, 0, false)).toBe('/games/domain-ch5/0');
    });

    it('should handle chapter and scene numbers correctly', () => {
      expect(getGameScenePath(10, 15)).toBe('/games/domain-ch10/15');
    });

    it('should handle chapter and scene numbers correctly in debug mode', () => {
      expect(getGameScenePath(7, 1, true)).toBe('/debug/games/domain-ch7/1');
    });
  });

  describe('getHomePath', () => {
    it('should return the correct path for non-debug mode', () => {
      expect(getHomePath()).toBe('/');
    });

    it('should return the correct path for debug mode', () => {
      expect(getHomePath(true)).toBe('/debug/');
    });
  });
});
