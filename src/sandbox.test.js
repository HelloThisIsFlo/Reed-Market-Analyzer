import { debugJestSum } from "./sandbox";

test("yo", () => {
  expect(debugJestSum(1, 4)).toBe(5);
});
