/**
 * Reusable cooldown manager for Discord commands
 */
export class CooldownManager {
  private cooldowns: Map<string, number>;
  private defaultCooldownTime: number;

  /**
   * Create a new cooldown manager
   * @param defaultCooldownMs Default cooldown time in milliseconds
   */
  constructor(defaultCooldownMs: number = 5 * 60 * 1000) {
    this.cooldowns = new Map<string, number>();
    this.defaultCooldownTime = defaultCooldownMs;
  }

  /**
   * Check if a user is on cooldown
   * @param userId Discord user ID
   * @param customCooldownMs Optional custom cooldown time for this check
   * @returns Object with isOnCooldown boolean and timeLeft in minutes
   */
  checkCooldown(
    userId: string,
    customCooldownMs?: number
  ): {
    isOnCooldown: boolean;
    timeLeft: number;
    timeLeftSeconds: number;
  } {
    const now = Date.now();
    const cooldownEnd = this.cooldowns.get(userId);

    if (cooldownEnd && now < cooldownEnd) {
      const timeLeftMs = cooldownEnd - now;
      const timeLeftMinutes = Math.ceil(timeLeftMs / 1000 / 60);
      const timeLeftSeconds = Math.ceil(timeLeftMs / 1000);

      return {
        isOnCooldown: true,
        timeLeft: timeLeftMinutes,
        timeLeftSeconds: timeLeftSeconds,
      };
    }

    return {
      isOnCooldown: false,
      timeLeft: 0,
      timeLeftSeconds: 0,
    };
  }

  /**
   * Set a cooldown for a user
   * @param userId Discord user ID
   * @param customCooldownMs Optional custom cooldown time in milliseconds
   */
  setCooldown(userId: string, customCooldownMs?: number): void {
    const cooldownTime = customCooldownMs || this.defaultCooldownTime;
    const cooldownEnd = Date.now() + cooldownTime;
    this.cooldowns.set(userId, cooldownEnd);
  }

  /**
   * Remove a user's cooldown (admin override)
   * @param userId Discord user ID
   */
  removeCooldown(userId: string): void {
    this.cooldowns.delete(userId);
  }

  /**
   * Clear all cooldowns
   */
  clearAllCooldowns(): void {
    this.cooldowns.clear();
  }

  /**
   * Get remaining cooldown time for a user
   * @param userId Discord user ID
   * @returns Remaining time in milliseconds, or 0 if no cooldown
   */
  getRemainingTime(userId: string): number {
    const now = Date.now();
    const cooldownEnd = this.cooldowns.get(userId);

    if (cooldownEnd && now < cooldownEnd) {
      return cooldownEnd - now;
    }

    return 0;
  }

  /**
   * Clean up expired cooldowns (optional maintenance)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [userId, cooldownEnd] of this.cooldowns.entries()) {
      if (now >= cooldownEnd) {
        this.cooldowns.delete(userId);
      }
    }
  }
}

// Export a default instance with 5-minute cooldown
export const defaultCooldownManager = new CooldownManager(5 * 60 * 1000);

// Export some common cooldown times as constants
export const COOLDOWN_TIMES = {
  THIRTY_SECONDS: 30 * 1000,
  ONE_MINUTE: 60 * 1000,
  TWO_MINUTES: 2 * 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  TEN_MINUTES: 10 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
};
