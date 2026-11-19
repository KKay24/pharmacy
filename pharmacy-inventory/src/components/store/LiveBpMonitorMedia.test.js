import React from "react";
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import LiveBpMonitorMedia from "./LiveBpMonitorMedia";

describe("LiveBpMonitorMedia", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("animates live blood pressure measurement from inflating to measuring to complete reading", () => {
    render(<LiveBpMonitorMedia isActive />);

    const svg = screen.getByTestId("live-bp-monitor");
    expect(svg).toHaveAttribute("data-phase", "inflating");
    expect(svg).toHaveAttribute("data-sys", "18");
    expect(svg).toHaveAttribute("data-dia", "--");
    expect(svg).toHaveAttribute("data-pulse", "--");

    // Advance one inflation step (150ms) -> pressure climbs
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(svg).toHaveAttribute("data-phase", "inflating");
    expect(svg).toHaveAttribute("data-sys", "42");

    // Advance through remaining 8 inflation steps -> enters measuring phase
    for (let i = 0; i < 8; i += 1) {
      act(() => {
        jest.advanceTimersByTime(150);
      });
    }
    expect(svg).toHaveAttribute("data-phase", "measuring");
    expect(svg).toHaveAttribute("data-sys", "164");

    // Advance through 9 deflation/measuring steps (200ms each) -> settles on complete reading
    for (let i = 0; i < 9; i += 1) {
      act(() => {
        jest.advanceTimersByTime(200);
      });
    }
    expect(svg).toHaveAttribute("data-phase", "complete");
    expect(svg).toHaveAttribute("data-sys", "120");
    expect(svg).toHaveAttribute("data-dia", "80");
    expect(svg).toHaveAttribute("data-pulse", "72");
  });

  it("pauses timer when inactive", () => {
    render(<LiveBpMonitorMedia isActive={false} />);

    const svg = screen.getByTestId("live-bp-monitor");
    expect(svg).toHaveAttribute("data-sys", "18");

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(svg).toHaveAttribute("data-sys", "18");
  });
});
