import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Tests use the frozen placeholder seed and campus in tests/fixtures, not the demo seed.
    alias: [
      { find: "@/data/seed/events.json", replacement: path.resolve(import.meta.dirname, "tests/fixtures/seed-events.json") },
      { find: "@/data/seed/test-events.json", replacement: path.resolve(import.meta.dirname, "tests/fixtures/seed-test-events.json") },
      { find: "@/data/seed/student.json", replacement: path.resolve(import.meta.dirname, "tests/fixtures/seed-student.json") },
      { find: "@/lib/brand", replacement: path.resolve(import.meta.dirname, "tests/fixtures/brand.ts") },
      { find: "@", replacement: path.resolve(import.meta.dirname) },
      { find: "server-only", replacement: path.resolve(import.meta.dirname, "tests/server-only-stub.ts") },
    ],
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    environment: "node",
  },
});
