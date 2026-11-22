import assert from "node:assert/strict";
import { test } from "node:test";
import { createFormatter } from "next-intl";
import { calendarDate, dayKey, daysBetween, nextOccurrence, yearsSince } from "../src/lib/format";

function withServerZone(timeZone: string, run: () => void) {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

for (const serverZone of ["Asia/Makassar", "UTC", "America/Los_Angeles", "Pacific/Kiritimati"]) {
  test(`anniversary labels keep their calendar date with server in ${serverZone}`, () => withServerZone(serverZone, () => {
    for (const familyZone of ["Asia/Jakarta", "Asia/Makassar", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      const format = createFormatter({ locale: "en", timeZone: familyZone });
      const original = calendarDate("1998-09-25", familyZone);
      const next = nextOccurrence("1998-09-25", true, new Date("2026-11-22T03:00:00Z"), familyZone)!;
      assert.equal(format.dateTime(original, { dateStyle: "long" }), "September 25, 1998");
      assert.equal(format.dateTime(next, { month: "long", day: "numeric" }), "September 25");
      assert.equal(dayKey(next, familyZone), "2027-09-25");
      assert.equal(yearsSince("1998-09-25", next, familyZone), 29);
    }
  }));

  test(`today and tomorrow follow the family zone with server in ${serverZone}`, () => withServerZone(serverZone, () => {
    const now = new Date("2026-11-21T16:30:00Z");
    const jakarta = nextOccurrence("2002-11-22", true, now, "Asia/Jakarta")!;
    const makassar = nextOccurrence("2002-11-22", true, now, "Asia/Makassar")!;
    assert.equal(daysBetween(now, jakarta, "Asia/Jakarta"), 1);
    assert.equal(daysBetween(now, makassar, "Asia/Makassar"), 0);
    assert.equal(yearsSince("2002-11-22", makassar, "Asia/Makassar"), 24);
  }));

  test(`year boundaries stay in the family calendar with server in ${serverZone}`, () => withServerZone(serverZone, () => {
    const now = new Date("2027-01-01T03:00:00Z"); // Still December 31 in Los Angeles.
    const next = nextOccurrence("1998-12-31", true, now, "America/Los_Angeles")!;
    assert.equal(dayKey(next, "America/Los_Angeles"), "2026-12-31");
    assert.equal(daysBetween(now, next, "America/Los_Angeles"), 0);
    assert.equal(yearsSince("1998-12-31", next, "America/Los_Angeles"), 28);
    const newYear = calendarDate("2027-01-01", "Pacific/Kiritimati");
    assert.equal(yearsSince("1998-01-01", newYear, "Pacific/Kiritimati"), 29);
  }));

  test(`a one-time milestone stays visible throughout today with server in ${serverZone}`, () => withServerZone(serverZone, () => {
    const now = new Date("2026-11-22T15:30:00Z");
    const today = nextOccurrence("2026-11-22", false, now, "Asia/Jakarta");
    assert.ok(today);
    assert.equal(daysBetween(now, today, "Asia/Jakarta"), 0);
    assert.equal(nextOccurrence("2026-11-21", false, now, "Asia/Jakarta"), null);
    const tomorrow = nextOccurrence("2026-11-23", false, now, "Asia/Jakarta")!;
    assert.equal(daysBetween(now, tomorrow, "Asia/Jakarta"), 1);
  }));

  test(`day counts survive daylight-saving changes with server in ${serverZone}`, () => withServerZone(serverZone, () => {
    for (const [from, to] of [["2026-03-07", "2026-03-09"], ["2026-10-31", "2026-11-02"]]) {
      const first = calendarDate(from!, "America/New_York");
      const last = calendarDate(to!, "America/New_York");
      assert.equal(daysBetween(first, last, "America/New_York"), 2);
      assert.equal(daysBetween(last, first, "America/New_York"), -2);
    }
  }));

  test(`leap-day milestones retain their existing March 1 rollover with server in ${serverZone}`, () => withServerZone(serverZone, () => {
    const ordinary = nextOccurrence("2000-02-29", true, new Date("2027-02-28T00:00:00Z"), "Asia/Jakarta")!;
    const leap = nextOccurrence("2000-02-29", true, new Date("2028-02-28T00:00:00Z"), "Asia/Jakarta")!;
    assert.equal(dayKey(ordinary, "Asia/Jakarta"), "2027-03-01");
    assert.equal(dayKey(leap, "Asia/Jakarta"), "2028-02-29");
  }));
}
