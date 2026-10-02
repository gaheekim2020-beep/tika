import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // __tests__/helpers/의 헬퍼 파일(.test가 아닌 파일)이 테스트로 실행되지 않도록 *.test.* 파일만 테스트로 본다
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
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
