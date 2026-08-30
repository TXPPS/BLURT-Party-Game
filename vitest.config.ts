import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'content/**/*.test.ts'],
    environment: 'node',
    // Deterministic ordering keeps seeded matchmaking/scoring runs reproducible.
    sequence: { shuffle: false },
    reporters: process.env.CI === 'true' ? ['dot'] : ['default'],
  },
});
