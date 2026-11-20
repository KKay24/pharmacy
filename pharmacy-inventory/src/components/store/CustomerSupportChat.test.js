import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CustomerSupportChat from "./CustomerSupportChat";
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

describe("MediQuick Smart Assistant (CustomerSupportChat)", () => {
  const apiFetch = jest.fn();

  beforeEach(() => {
    apiFetch.mockReset();
    window.sessionStorage.clear();
    useStore.mockReturnValue({ apiFetch, storeUser: null });
  });

  test("opens on Medical AI tab with educational disclaimer, suggested questions, and verified catalogue cards", async () => {
    apiFetch.mockResolvedValueOnce({
      sessionId: "sess-12345678",
      reply: "Paracetamol 500mg Tablets is currently in stock at ZMW 22.00.",
      emergency: false,
      recommendPharmacist: false,
      products: [
        {
          id: 5,
          name: "Paracetamol 500mg Tablets",
          strength: "500mg",
          dosage: "Tablet",
          price: 22,
          inStock: true,
          prescriptionRequired: false,
          url: "/product/5",
        },
      ],
      verifiedAlternatives: [],
    });

    render(<CustomerSupportChat />);
    fireEvent.click(screen.getByRole("button", { name: "Open pharmacy support chat" }));

    expect(screen.getByText(/educational information only/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /medical ai/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /pharmacy support/i })).toHaveAttribute("aria-selected", "false");

    fireEvent.click(screen.getByRole("button", { name: "Do you have Paracetamol in stock?" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/ai/chat",
        expect.objectContaining({ method: "POST" })
      )
    );

    expect(await screen.findByText(/Paracetamol 500mg Tablets is currently in stock/i)).toBeInTheDocument();
    const productLink = screen.getByRole("link", { name: /Paracetamol 500mg Tablets/i });
    expect(productLink).toHaveAttribute("href", "/product/5");
    expect(screen.getByText("In Stock")).toBeInTheDocument();
  });

  test("displays urgent emergency alert and supports consented transfer to Pharmacy Support", async () => {
    apiFetch.mockResolvedValueOnce({
      sessionId: "sess-emerg-1234",
      reply: "Please seek immediate emergency medical attention right away.",
      emergency: true,
      recommendPharmacist: true,
      products: [],
      verifiedAlternatives: [],
    });

    render(<CustomerSupportChat />);
    fireEvent.click(screen.getByRole("button", { name: "Open pharmacy support chat" }));

    fireEvent.change(screen.getByLabelText("Ask Medical AI"), {
      target: { value: "I have chest pain" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send AI message" }));

    expect(await screen.findByText(/Urgent Medical Safety Notice/i)).toBeInTheDocument();

    // Transfer to Pharmacy Support with explicit consent
    fireEvent.click(screen.getByRole("button", { name: "Talk to a Pharmacist" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Support" }));

    expect(screen.getByRole("tab", { name: /pharmacy support/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Message").value).toContain("I have chest pain");
  });

  test("transfers to Pharmacy Support without copying AI chat context when consent is not checked", async () => {
    apiFetch.mockResolvedValueOnce({
      sessionId: "sess-noconsent-1",
      reply: "Our pharmacist can advise on suitable doses for your needs.",
      emergency: false,
      recommendPharmacist: true,
      products: [],
      verifiedAlternatives: [],
    });

    render(<CustomerSupportChat />);
    fireEvent.click(screen.getByRole("button", { name: "Open pharmacy support chat" }));

    fireEvent.change(screen.getByLabelText("Ask Medical AI"), {
      target: { value: "Private health question" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send AI message" }));

    expect(await screen.findByText(/Our pharmacist can advise/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Talk to a Pharmacist" }));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Continue to Support" }));

    expect(screen.getByRole("tab", { name: /pharmacy support/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  test("shows an error alert and quick switch to Pharmacy Support when Medical AI fails", async () => {
    apiFetch.mockRejectedValueOnce(new Error("AI assistant is temporarily unavailable"));

    render(<CustomerSupportChat />);
    fireEvent.click(screen.getByRole("button", { name: "Open pharmacy support chat" }));

    fireEvent.change(screen.getByLabelText("Ask Medical AI"), {
      target: { value: "Do you stock ibuprofen?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send AI message" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("AI assistant is temporarily unavailable");
    fireEvent.click(screen.getByRole("button", { name: /Message Pharmacy Support/i }));
    expect(screen.getByRole("tab", { name: /pharmacy support/i })).toHaveAttribute("aria-selected", "true");
  });

  test("submits a support message through the existing inquiry API on the Pharmacy Support tab", async () => {
    apiFetch.mockResolvedValue({ success: true, inquiry: { id: 17 } });
    render(<CustomerSupportChat />);

    fireEvent.click(screen.getByRole("button", { name: "Open pharmacy support chat" }));
    fireEvent.click(screen.getByRole("tab", { name: /pharmacy support/i }));

    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Pat Customer" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+260 97 000 0000" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Can you help me find a product?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/support/inquiries",
        expect.objectContaining({ method: "POST" })
      )
    );
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({
      name: "Pat Customer",
      phone: "+260970000000",
      message: "Can you help me find a product?",
    });
    expect(await screen.findByText(/Your message has been sent to the pharmacy team/)).toBeInTheDocument();
  });

  test("validates Zambian phone and optional email on blur, disables invalid submission, and normalizes local ZM numbers", async () => {
    apiFetch.mockResolvedValue({ success: true, inquiry: { id: 22 } });
    render(<CustomerSupportChat />);

    fireEvent.click(screen.getByRole("button", { name: "Open pharmacy support chat" }));
    fireEvent.click(screen.getByRole("tab", { name: /pharmacy support/i }));

    const sendButton = screen.getByRole("button", { name: "Send message" });
    expect(sendButton).toBeDisabled();
    expect(screen.getByLabelText("Country code")).toHaveValue("ZM");

    const nameInput = screen.getByLabelText("Your name");
    const phoneInput = screen.getByLabelText("Phone number");
    const emailInput = screen.getByLabelText(/Email/i);
    const messageInput = screen.getByLabelText("Message");

    fireEvent.change(nameInput, { target: { value: "Chanda Mwale" } });
    fireEvent.blur(nameInput);

    // Invalid phone shows inline error on blur and keeps submit disabled
    fireEvent.change(phoneInput, { target: { value: "09712" } });
    fireEvent.blur(phoneInput);
    expect(screen.getByText(/Enter a valid Zambian number/i)).toBeInTheDocument();
    expect(sendButton).toBeDisabled();

    // Local Zambian number becomes valid with green indicator & E.164 preview
    fireEvent.change(phoneInput, { target: { value: "0977 123 456" } });
    fireEvent.blur(phoneInput);
    expect(screen.getByLabelText("Valid phone number")).toBeInTheDocument();
    expect(screen.getByText(/Verified format: \+260977123456/i)).toBeInTheDocument();

    // Malformed optional email disables submit and displays red error on blur
    fireEvent.change(messageInput, { target: { value: "Do you stock Panadol?" } });
    fireEvent.change(emailInput, { target: { value: "bad-email@nodomain" } });
    fireEvent.blur(emailInput);
    expect(screen.getByText(/Enter a valid email address/i)).toBeInTheDocument();
    expect(sendButton).toBeDisabled();

    // Valid email with whitespace trims on blur and enables submit
    fireEvent.change(emailInput, { target: { value: "  chanda@example.com  " } });
    fireEvent.blur(emailInput);
    expect(emailInput).toHaveValue("chanda@example.com");
    expect(screen.getByLabelText("Valid email")).toBeInTheDocument();
    expect(sendButton).toBeEnabled();

    fireEvent.click(sendButton);

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/support/inquiries",
        expect.objectContaining({ method: "POST" })
      )
    );
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({
      name: "Chanda Mwale",
      phone: "+260977123456",
      email: "chanda@example.com",
      message: "Do you stock Panadol?",
    });
  });

  test("keeps the support message available and reports API errors", async () => {
    apiFetch.mockRejectedValue(new Error("Service unavailable"));
    render(<CustomerSupportChat />);

    fireEvent.click(screen.getByRole("button", { name: "Open pharmacy support chat" }));
    fireEvent.click(screen.getByRole("tab", { name: /pharmacy support/i }));

    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Pat Customer" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+260 97 000 0000" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Please call me." } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
    expect(screen.getByLabelText("Message")).toHaveValue("Please call me.");
  });
});
