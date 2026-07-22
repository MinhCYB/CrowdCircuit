import { describe, expect, it } from "vitest";
import {
  SPEC_VERSION,
  SampleContractSchema,
  type SampleContract,
} from "../src/index.js";

describe("@crowdcircuit/contracts foundation", () => {
  it("exports the correct SPEC_VERSION constant", () => {
    expect(SPEC_VERSION).toBe("0.1");
  });

  it("parses valid sample contract data successfully", () => {
    const validData = {
      id: "sample_123",
      timestamp: 1784705000000,
      active: true,
    };

    const parsed: SampleContract = SampleContractSchema.parse(validData);
    expect(parsed).toEqual(validData);
    expect(parsed.id).toBe("sample_123");
    expect(parsed.timestamp).toBe(1784705000000);
    expect(parsed.active).toBe(true);
  });

  it("rejects invalid sample contract data", () => {
    const invalidInputs = [
      {},
      { id: "", timestamp: 100, active: true },
      { id: "test", timestamp: -5, active: true },
      { id: "test", timestamp: 1.5, active: true },
      { id: "test", timestamp: 100, active: "not_a_boolean" },
    ];

    for (const input of invalidInputs) {
      expect(() => SampleContractSchema.parse(input)).toThrow();
    }
  });
});
