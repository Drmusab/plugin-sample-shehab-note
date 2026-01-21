import { describe, it, expect } from "vitest";
import { RecurrenceParser } from "../core/parsers/RecurrenceParser";

describe("RecurrenceParser - ordinal weekday patterns", () => {
  const cases = [
    {
      input: "every 2nd Tuesday",
      rrule: "RRULE:FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2",
    },
    {
      input: "every first Monday",
      rrule: "RRULE:FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1",
    },
    {
      input: "every last Friday",
      rrule: "RRULE:FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1",
    },
    {
      input: "every 3rd Wednesday of the month",
      rrule: "RRULE:FREQ=MONTHLY;BYDAY=WE;BYSETPOS=3",
    },
  ];

  it("parses ordinal weekday inputs into monthly rrules", () => {
    cases.forEach(({ input, rrule }) => {
      const result = RecurrenceParser.parse(input);
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe("monthly");
      expect(result.frequency.interval).toBe(1);
      expect(result.frequency.rruleString).toBe(rrule);
    });
  });

  it("rejects invalid ordinal weekday inputs", () => {
    const invalidInputs = [
      "every Tuesday sometimes",
      "every secondish Monday",
      "every 5th Friday",
    ];

    invalidInputs.forEach((input) => {
      const result = RecurrenceParser.parse(input);
      expect(result.isValid).toBe(false);
      expect(result.frequency.rruleString).toBeUndefined();
    });
  });

  it("reports helpful errors for ordinal weekday validation", () => {
    const ordinalError = RecurrenceParser.parse("every 5th Friday");
    expect(ordinalError.isValid).toBe(false);
    expect(ordinalError.error).toContain("first, second, third, fourth, or last");
  });
});
