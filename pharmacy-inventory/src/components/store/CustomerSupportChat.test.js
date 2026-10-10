import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CustomerSupportChat from "./CustomerSupportChat";
import { useStore } from "../../context/StoreContext";

jest.mock("../../context/StoreContext", () => ({
  useStore: jest.fn(),
}));

describe("CustomerSupportChat", () => {
  const apiFetch = jest.fn();

  beforeEach(() => {
    apiFetch.mockReset();
    useStore.mockReturnValue({ apiFetch });
  });

  test("submits a support message through the existing inquiry API", async () => {
    apiFetch.mockResolvedValue({ success: true, inquiry: { id: 17 } });
    render(<CustomerSupportChat />);

    fireEvent.click(screen.getByRole("button", { name: "Open pharmacy support chat" }));
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Pat Customer" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+260 97 000 0000" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Can you help me find a product?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/support/inquiries",
      expect.objectContaining({ method: "POST" })
    ));
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({
      name: "Pat Customer",
      phone: "+260 97 000 0000",
      message: "Can you help me find a product?",
    });
    expect(await screen.findByText(/Your message has been sent to the pharmacy team/)).toBeInTheDocument();
  });

  test("keeps the message available and reports API errors", async () => {
    apiFetch.mockRejectedValue(new Error("Service unavailable"));
    render(<CustomerSupportChat />);

    fireEvent.click(screen.getByRole("button", { name: "Open pharmacy support chat" }));
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Pat Customer" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+260 97 000 0000" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Please call me." } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
    expect(screen.getByLabelText("Message")).toHaveValue("Please call me.");
  });
});
