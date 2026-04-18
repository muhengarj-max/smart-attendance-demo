import { useMemo, useState } from "react";
import { getSnippePaymentStatus, startSnippeMobilePayment } from "./snippePayments";

type PricingPlan = {
  id: string;
  name: string;
  amount: number;
  price: string;
  duration: string;
  description: string;
  features: string[];
  button: string;
  popular: boolean;
};

const plans: PricingPlan[] = [
  {
    id: "monthly",
    name: "Monthly Plan",
    amount: 25000,
    price: "TZS 25,000",
    duration: "1 Month",
    description: "Good for trying the system with full access.",
    features: ["Full Smart Attendance access", "Admin dashboard", "Live attendance tracking", "Excel/PDF export"],
    button: "Choose Monthly",
    popular: false,
  },
  {
    id: "quarterly",
    name: "Quarterly Plan",
    amount: 70000,
    price: "TZS 70,000",
    duration: "3 Months",
    description: "Best for schools and lecturers who want better value.",
    features: ["Everything in Monthly", "3 months active subscription", "Priority support", "Better savings"],
    button: "Choose Quarterly",
    popular: true,
  },
  {
    id: "annual",
    name: "Annual Plan",
    amount: 180000,
    price: "TZS 180,000",
    duration: "12 Months",
    description: "Best long-term package for institutions and serious users.",
    features: ["Everything in Quarterly", "1 year active subscription", "Highest savings", "Best for institutions"],
    button: "Choose Annual",
    popular: false,
  },
];

const splitName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstname: parts[0] || "Customer",
    lastname: parts.slice(1).join(" ") || "Account",
  };
};

export default function PricingSection({
  currentAdmin,
  onPaymentStarted,
}: {
  currentAdmin?: { id: number; username: string };
  onPaymentStarted?: () => void;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState("quarterly");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState(currentAdmin?.username || "");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || plans[1],
    [selectedPlanId],
  );

  const payForPlan = async (plan: PricingPlan) => {
    if (!phoneNumber.trim()) {
      window.showPrettyMessage?.("Enter your mobile money phone number.", "warning");
      return;
    }

    if (!email.trim()) {
      window.showPrettyMessage?.("Enter your email address before payment.", "warning");
      return;
    }

    const { firstname, lastname } = splitName(customerName);
    setLoadingPlanId(plan.id);

    try {
      const result = await startSnippeMobilePayment({
        amount: plan.amount,
        planId: plan.id,
        phoneNumber,
        firstname,
        lastname,
        email,
        userId: currentAdmin?.id ? String(currentAdmin.id) : undefined,
      });

      const reference = result.payment?.reference;
      if (reference) {
        setPaymentReference(reference);
      }
      window.showPrettyMessage?.(
        reference
          ? `Payment started. Check your phone and enter your PIN. Reference: ${reference}`
          : "Payment started. Check your phone and enter your PIN.",
        "success",
      );
      onPaymentStarted?.();
    } catch (error) {
      window.showPrettyMessage?.(error instanceof Error ? error.message : "Payment failed to start.", "danger");
    } finally {
      setLoadingPlanId(null);
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentReference) return;
    setCheckingStatus(true);
    try {
      const payment = await getSnippePaymentStatus(paymentReference);
      if (payment?.status === "completed") {
        window.showPrettyMessage?.("Payment confirmed. Your package is active now.", "success");
        window.setTimeout(() => window.location.reload(), 1200);
        return;
      }
      window.showPrettyMessage?.(`Payment status: ${payment?.status || "pending"}.`, "info");
    } catch (error) {
      window.showPrettyMessage?.(error instanceof Error ? error.message : "Could not check payment status.", "danger");
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <section className="bg-[#0f172a] px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <p className="text-sm font-bold uppercase tracking-normal text-cyan-300">Mobile Money Payment</p>
          <h2 className="mt-3 text-4xl font-bold md:text-5xl">Smart Attendance Pricing</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 md:text-lg">
            Choose the package that fits your school, lecturer, or institution.
          </p>
        </div>

        <div className="mb-8 grid gap-4 rounded-lg border border-white/10 bg-white/8 p-5 md:grid-cols-3">
          <label className="block">
            <span className="text-sm font-bold text-slate-100">Mobile money number</span>
            <input
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="255712345678"
              className="mt-2 w-full rounded-lg border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-100">Customer name</span>
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Full name"
              className="mt-2 w-full rounded-lg border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-100">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="customer@email.com"
              type="email"
              className="mt-2 w-full rounded-lg border border-white/15 bg-white px-4 py-3 text-slate-950 outline-none focus:border-cyan-300"
            />
          </label>
        </div>

        {paymentReference && (
          <div className="mb-8 rounded-lg border border-emerald-300/40 bg-emerald-950/35 p-4">
            <p className="text-sm text-emerald-100">
              Payment request sent. Enter your mobile money PIN, then check status.
            </p>
            <button
              type="button"
              onClick={checkPaymentStatus}
              disabled={checkingStatus}
              className="mt-3 rounded-lg bg-emerald-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-60"
            >
              {checkingStatus ? "Checking..." : "Check payment status"}
            </button>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isSelected = selectedPlan.id === plan.id;
            const isLoading = loadingPlanId === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-lg border p-8 shadow-2xl transition duration-300 hover:-translate-y-1 ${
                  plan.popular
                    ? "border-cyan-300 bg-cyan-950/40"
                    : isSelected
                      ? "border-emerald-300 bg-emerald-950/25"
                      : "border-white/10 bg-white/5"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-lg bg-cyan-400 px-4 py-1 text-sm font-semibold text-slate-950 shadow-lg">
                    Most Popular
                  </span>
                )}

                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <p className="mt-3 text-3xl font-extrabold text-cyan-300">{plan.price}</p>
                <p className="mt-1 text-sm text-slate-300">{plan.duration}</p>
                <p className="mt-4 text-sm leading-6 text-slate-300">{plan.description}</p>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-slate-200">
                      <span className="mt-0.5 text-emerald-300">OK</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    void payForPlan(plan);
                  }}
                  disabled={Boolean(loadingPlanId)}
                  className={`mt-8 w-full rounded-lg px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    plan.popular
                      ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                      : "bg-white text-slate-950 hover:bg-slate-200"
                  }`}
                >
                  {isLoading ? "Starting payment..." : plan.button}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
