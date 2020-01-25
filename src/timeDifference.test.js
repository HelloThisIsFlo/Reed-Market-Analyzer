import TimeDifference from './timeDifference'

describe("TimeDifference", () => {
  it("Calculates time difference", () => {
    const mockNow = new Date("2020-01-25T11:01:58.135Z").valueOf()
    const mock2DaysAgo = new Date("2020-01-23")

    jest
      .spyOn(global.Date, "now")
      .mockImplementationOnce(() => mockNow);

    
    const timeDiff = new TimeDifference(mock2DaysAgo)
    expect(timeDiff.daysAgo).toBe(2)
  });

  it("Prints in a human-readable format", () => {
    const timeDiff2DaysAgo = new TimeDifference(new Date("1000-01-01"))
    timeDiff2DaysAgo.daysAgo = 2

    expect(`${timeDiff2DaysAgo}`).toEqual('2 Days ago')
  })

});
