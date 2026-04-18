export type SnippeMobilePaymentInput = {
  amount: number;
  planId: string;
  phoneNumber: string;
  firstname: string;
  lastname: string;
  email: string;
  userId?: string;
};

export const startSnippeMobilePayment = async (input: SnippeMobilePaymentInput) => {
  const response = await fetch("/api/payments/snippe/mobile", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "Could not start mobile money payment");
  }

  return result;
};

export const getSnippePaymentStatus = async (reference: string) => {
  const response = await fetch(`/api/payments/snippe/${encodeURIComponent(reference)}`, { credentials: "include" });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "Could not check payment status");
  }

  return result.payment;
};
