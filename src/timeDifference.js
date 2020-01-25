export default class TimeDifference {
  constructor(date) {
    const now = Date.now();

    const diffMs = now - date.valueOf();
    if (diffMs < 0) throw new Error("Can't be in the future");
    this.daysAgo = Math.floor(diffMs / 1000 / 3600 / 24);
  }

  toString() {
    return `${this.daysAgo} Days ago`;
  }
}
