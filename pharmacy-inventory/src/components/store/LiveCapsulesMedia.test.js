import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import LiveCapsulesMedia from "./LiveCapsulesMedia";

describe("LiveCapsulesMedia", () => {
  it("renders the prescription bottle photo with 6 animated spilling capsules when active", () => {
    render(<LiveCapsulesMedia isActive />);

    const svg = screen.getByTestId("live-capsules-media");
    expect(svg).toHaveAttribute("data-playing", "true");
    expect(svg).toHaveClass("is-playing");

    for (let i = 1; i <= 6; i += 1) {
      expect(screen.getByTestId(`live-capsules-media-cap-${i}`)).toBeInTheDocument();
    }
  });

  it("pauses capsule animation when inactive", () => {
    render(<LiveCapsulesMedia isActive={false} />);

    const svg = screen.getByTestId("live-capsules-media");
    expect(svg).toHaveAttribute("data-playing", "false");
    expect(svg).toHaveClass("is-paused");
  });
});
