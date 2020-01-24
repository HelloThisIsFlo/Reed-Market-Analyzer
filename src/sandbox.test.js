import { removeAllNulls } from "./sandbox";

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
