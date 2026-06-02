import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RequestStatusPill } from "../RequestStatusPill-file/RequestStatusPill";

describe("RequestStatusPill", () => {
  it("renders the label inside a status pill with the matching modifier", () => {
    render(<RequestStatusPill status="approved" label="Approved" />);
    const pill = screen.getByText("Approved");
    expect(pill).toHaveClass("request-status", "request-status--approved");
  });

  it("omits the re-request button when no handler is supplied", () => {
    render(<RequestStatusPill status="pending" label="Pending…" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a re-request button when a handler and label are supplied", () => {
    render(
      <RequestStatusPill
        status="denied"
        label="Denied"
        requestAgainLabel="Request Again"
        onRequestAgain={() => undefined}
      />,
    );
    expect(screen.getByText("Denied")).toHaveClass("request-status--denied");
    expect(screen.getByRole("button", { name: "Request Again" })).toBeInTheDocument();
  });

  it("calls onRequestAgain when the button is clicked", () => {
    const onRequestAgain = vi.fn();
    render(
      <RequestStatusPill
        status="denied"
        label="Denied"
        requestAgainLabel="Request Again"
        onRequestAgain={onRequestAgain}
      />,
    );
    screen.getByRole("button", { name: "Request Again" }).click();
    expect(onRequestAgain).toHaveBeenCalledTimes(1);
  });
});
