import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

describe("PasswordStrengthMeter", () => {
  it("renders nothing for an empty password", () => {
    const { container } = render(<PasswordStrengthMeter password="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the 'at least 8 characters' hint for a too-short password", () => {
    render(<PasswordStrengthMeter password="Ab1" />);
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
  });

  it("labels a strong password without a hint suffix", () => {
    render(<PasswordStrengthMeter password="Password1!" />);
    expect(screen.getByText("Strong password")).toBeInTheDocument();
  });

  it("labels a fair password with an improvement hint", () => {
    render(<PasswordStrengthMeter password="Password1" />);
    expect(screen.getByText(/Fair password — add an uppercase letter, number or symbol/)).toBeInTheDocument();
  });
});
