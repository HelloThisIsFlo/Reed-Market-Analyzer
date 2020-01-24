import { debugJestSum, removeAllNulls } from "./sandbox";

test("yo", () => {
  expect(debugJestSum(1, 4)).toBe(5);
});

test("removeAllNulls", () => {
  expect(
    removeAllNulls({
      someVal: true,
      someOtherVal: false,
      anotherValue: 3,
      nowSomeNull: null,
      anotherNull: null,
      finallySomeText: "hello"
    })
  ).toEqual({
    someVal: true,
    someOtherVal: false,
    anotherValue: 3,
    finallySomeText: "hello"
  });
});

test("Length", () => {
  expect(["a", "b"].length).toBe(2);
});
