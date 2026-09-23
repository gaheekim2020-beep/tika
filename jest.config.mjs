import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  moduleNameMapper: {
    "^@/shared/(.*)$": "<rootDir>/src/shared/$1",
    "^@/server/(.*)$": "<rootDir>/src/server/$1",
    "^@/client/(.*)$": "<rootDir>/src/client/$1",
    "^@/app/(.*)$": "<rootDir>/app/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

export default createJestConfig(config);
