import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StoreContactPage from "./StoreContactPage";
import { useStore } from "../../context/StoreContext";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }),
  { virtual: true }
);

jest.mock("../../context/StoreContext", () => ({
  useStore: jest.fn(),
}));

jest.mock("../../components/store/StoreToast", () => ({
  showToast: jest.fn(),
}));

describe("StoreContactPage (Customer Support Form)", () => {
  const apiFetch = jest.fn();

  beforeEach(() => {
    apiFetch.mockReset();
    useStore.mockReturnValue({ apiFetch });
  });

  test("defaults to Zambia (+260), validates on blur, allows blank optional email, and submits E.164 phone", async () => {
    apiFetch.mockResolvedValueOnce({ success: true, inquiry: { id: 9 } });

    render(<StoreContactPage />);

    const submitButton = screen.getByRole("button", { name: /Send Message/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByLabelText("Country code")).toHaveValue("ZM");

    const nameInput = screen.getByLabelText("Your Name");
    const phoneInput = screen.getByLabelText("Phone Number");
    const emailInput = screen.getByLabelText(/Email Address/i);
    const messageInput = screen.getByLabelText("Message");

    fireEvent.change(nameInput, { target: { value: "Mutale Banda" } });
    fireEvent.blur(nameInput);
    expect(screen.getByLabelText("Valid name")).toBeInTheDocument();

    // Reject invalid phone on blur
    fireEvent.change(phoneInput, { target: { value: "12345" } });
    fireEvent.blur(phoneInput);
    expect(screen.getByText(/Enter a valid Zambian number/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    // Accept valid local Zambian number and normalize to E.164
    fireEvent.change(phoneInput, { target: { value: "0966 444 333" } });
    fireEvent.blur(phoneInput);
    expect(screen.getByLabelText("Valid phone number")).toBeInTheDocument();

    // Optional email left blank keeps form valid once message is filled
    fireEvent.blur(emailInput);
    fireEvent.change(messageInput, { target: { value: "Checking delivery times to Kitwe." } });
    fireEvent.blur(messageInput);
    expect(submitButton).toBeEnabled();

    fireEvent.click(submitButton);

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/support/inquiries",
        expect.objectContaining({ method: "POST" })
      )
    );
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({
      name: "Mutale Banda",
      phone: "+260966444333",
      email: "",
      message: "Checking delivery times to Kitwe.",
    });
    expect(await screen.findByText("Message Sent!")).toBeInTheDocument();
  });

  test("rejects malformed email and supports international country codes", async () => {
    apiFetch.mockResolvedValueOnce({ success: true, inquiry: { id: 10 } });

    render(<StoreContactPage />);

    const submitButton = screen.getByRole("button", { name: /Send Message/i });
    fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "Grace Phiri" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Order question" } });

    // Switch to South Africa (+27) and enter valid ZA number
    fireEvent.change(screen.getByLabelText("Country code"), { target: { value: "ZA" } });
    const phoneInput = screen.getByLabelText("Phone Number");
    fireEvent.change(phoneInput, { target: { value: "082 123 4567" } });
    fireEvent.blur(phoneInput);
    expect(screen.getByText(/Verified format: \+27821234567/i)).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/Email Address/i);
    fireEvent.change(emailInput, { target: { value: "invalid@" } });
    fireEvent.blur(emailInput);
    expect(screen.getByText(/Enter a valid email address/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    fireEvent.change(emailInput, { target: { value: " grace@mediquick.co.zm " } });
    fireEvent.blur(emailInput);
    expect(emailInput).toHaveValue("grace@mediquick.co.zm");
    expect(submitButton).toBeEnabled();

    fireEvent.click(submitButton);

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({
      phone: "+27821234567",
      email: "grace@mediquick.co.zm",
    });
  });
});
