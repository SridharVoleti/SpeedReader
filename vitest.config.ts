import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["hosted-app/tests/unit/**/*.test.ts", "container/tests/**/*.test.ts"]
  }
});
