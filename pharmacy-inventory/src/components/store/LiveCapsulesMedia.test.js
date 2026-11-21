import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import LiveCapsulesMedia, { DEFAULT_CAPSULES_VIDEO_SRC } from "./LiveCapsulesMedia";

describe("LiveCapsulesMedia", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      writable: true,
      value: jest.fn(() => Promise.resolve()),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  it("renders a muted infinitely looping video that autoplays when active", () => {
    render(<LiveCapsulesMedia isActive />);

    const video = screen.getByTestId("live-capsules-media");
    expect(video.tagName).toBe("VIDEO");
    expect(video).toHaveAttribute("src", DEFAULT_CAPSULES_VIDEO_SRC);
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("data-playing", "true");
    expect(video).toHaveClass("is-playing");
    expect(video.muted).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("pauses video playback when inactive", () => {
    render(<LiveCapsulesMedia isActive={false} />);

    const video = screen.getByTestId("live-capsules-media");
    expect(video).toHaveAttribute("data-playing", "false");
    expect(video).toHaveClass("is-paused");
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });
});
