import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Camera,
  CheckCircle2,
  Layers3,
  MapPin,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

const heroImage =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1800&q=80";
const classroomImage =
  "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80";
const studentImage =
  "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1200&q=80";
const reportsImage =
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80";

const plans = [
  {
    name: "Monthly Plan",
    price: "TZS 25,000",
    duration: "/ Month",
    description: "For short-term use and quick setup.",
    features: ["Full dashboard access", "Online attendance sessions", "Excel and PDF export", "Email support"],
  },
  {
    name: "Quarterly Plan",
    price: "TZS 70,000",
    duration: "/ 3 Months",
    description: "For colleges, institutes, and university departments.",
    features: ["Everything in Monthly", "Priority support", "Advanced reporting", "Better savings"],
    featured: true,
  },
  {
    name: "Annual Plan",
    price: "TZS 180,000",
    duration: "/ Year",
    description: "For institutions ready for long-term reliability.",
    features: ["Everything in Quarterly", "Best annual savings", "Premium support", "Institution-ready setup"],
  },
];

const steps = [
  {
    icon: Camera,
    title: "Selfie Verification",
    text: "Students submit attendance with a live selfie from their phone.",
    image: studentImage,
  },
  {
    icon: MapPin,
    title: "GPS Location Check",
    text: "Attendance is accepted from the approved class location.",
    image: classroomImage,
  },
  {
    icon: BarChart3,
    title: "Instant Reports",
    text: "Lecturers download clean Excel and PDF reports anytime.",
    image: reportsImage,
  },
];

const trustItems = ["Easy to use", "Secure records", "Mobile ready", "Fast reports"];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600">
              <BadgeCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black">Smart Attendance</h1>
              <p className="text-xs text-slate-500">Secure. Fast. Professional.</p>
            </div>
          </a>

          <div className="hidden items-center gap-7 md:flex">
            <a href="#features" className="text-sm font-semibold text-slate-700 hover:text-teal-700">Features</a>
            <a href="#how-it-works" className="text-sm font-semibold text-slate-700 hover:text-teal-700">How It Works</a>
            <a href="#pricing" className="text-sm font-semibold text-slate-700 hover:text-teal-700">Pricing</a>
            <a href="#contact" className="text-sm font-semibold text-slate-700 hover:text-teal-700">Contact</a>
          </div>

          <a href="/login" className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700">
            Login
          </a>
        </nav>
      </header>

      <main>
        <section className="relative min-h-[88vh] overflow-hidden">
          <img src={heroImage} alt="Students using smartphones in class" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-slate-950/55" />
          <div className="relative mx-auto flex min-h-[88vh] max-w-7xl items-center px-5 py-20 lg:px-8">
            <div className="max-w-2xl text-white">
              <p className="inline-flex rounded-lg bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur">
                Digital attendance for colleges, institutes, and universities
              </p>
              <h2 className="mt-6 text-5xl font-black leading-tight md:text-6xl">
                Modern Attendance Made Easy
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/85">
                Run attendance sessions with selfie verification, GPS location checks, and clean reports from one dashboard.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="/login" className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-6 py-4 font-black text-slate-950 hover:bg-teal-300">
                  Start Free Trial
                  <ArrowRight className="h-5 w-5" />
                </a>
                <a href="#pricing" className="rounded-lg border border-white/45 bg-white/10 px-6 py-4 font-black text-white backdrop-blur hover:bg-white/20">
                  View Pricing
                </a>
              </div>
              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {trustItems.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-lg bg-white/12 px-4 py-3 backdrop-blur">
                    <CheckCircle2 className="h-5 w-5 text-teal-300" />
                    <span className="text-sm font-bold">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-slate-50 px-5 py-16 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-4">
            {[
              ["Live selfie verification", Camera],
              ["GPS classroom validation", MapPin],
              ["Mobile attendance flow", Smartphone],
              ["Secure admin dashboard", ShieldCheck],
            ].map(([label, Icon]) => {
              const FeatureIcon = Icon as typeof Camera;
              return (
                <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <FeatureIcon className="h-7 w-7 text-teal-600" />
                  <p className="mt-4 font-black text-slate-900">{String(label)}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="how-it-works" className="px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase text-teal-700">How It Works</p>
            <h3 className="mt-3 text-4xl font-black">Simple, Accurate, Professional</h3>
            <p className="mt-4 text-slate-600">A smooth flow for lecturers, administrators, and students.</p>
          </div>

          <div className="mx-auto mt-12 grid max-w-7xl gap-6 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <img src={step.image} alt={step.title} className="h-52 w-full object-cover" />
                  <div className="p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-100">
                      <Icon className="h-6 w-6 text-teal-700" />
                    </div>
                    <p className="mt-5 text-sm font-black text-teal-700">Step {index + 1}</p>
                    <h4 className="mt-1 text-xl font-black">{step.title}</h4>
                    <p className="mt-3 leading-7 text-slate-600">{step.text}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="pricing" className="bg-slate-950 px-5 py-20 text-white lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase text-teal-300">Pricing Plans</p>
            <h3 className="mt-3 text-4xl font-black">Choose Your Plan</h3>
            <p className="mt-4 text-slate-300">Flexible packages for classes, departments, and institutions.</p>
          </div>

          <div className="mx-auto mt-12 grid max-w-7xl gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.name} className={`rounded-lg border p-7 ${plan.featured ? "border-teal-300 bg-teal-600 text-slate-950" : "border-white/15 bg-white/8"}`}>
                {plan.featured && <p className="mb-4 rounded-lg bg-slate-950 px-3 py-1 text-center text-xs font-black uppercase text-white">Most Popular</p>}
                <h4 className="text-2xl font-black">{plan.name}</h4>
                <p className="mt-5">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className={plan.featured ? "ml-2 text-slate-800" : "ml-2 text-slate-300"}>{plan.duration}</span>
                </p>
                <p className={`mt-4 leading-7 ${plan.featured ? "text-slate-900" : "text-slate-300"}`}>{plan.description}</p>
                <ul className="mt-7 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-semibold">{feature}</span>
                    </li>
                  ))}
                </ul>
                <a href="/login" className={`mt-8 inline-flex w-full items-center justify-center rounded-lg px-5 py-3 font-black ${plan.featured ? "bg-slate-950 text-white hover:bg-slate-800" : "bg-white text-slate-950 hover:bg-teal-100"}`}>
                  Get Started
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="px-5 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-8 rounded-lg border border-slate-200 bg-slate-50 p-8 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm font-black uppercase text-teal-700">Start Today</p>
              <h3 className="mt-3 text-4xl font-black">Manage Attendance the Smart Way</h3>
              <p className="mt-4 max-w-2xl leading-7 text-slate-600">
                Start with a free trial, create attendance sessions, and keep records clean with professional reports.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <a href="/login" className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 py-4 font-black text-white hover:bg-teal-700">
                Login and Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </a>
              <a href="#contact" className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-4 font-black text-slate-900 hover:bg-white">
                Contact Support
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="border-t border-slate-200 bg-white px-5 py-10 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600">
                <Layers3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h4 className="font-black">Smart Attendance</h4>
                <p className="text-sm text-slate-500">Digital attendance for modern institutions.</p>
              </div>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600">
              Built for fast attendance capture, secure records, and reports your institution can rely on.
            </p>
          </div>
          <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
            <a href="#features" className="font-bold hover:text-teal-700">Features</a>
            <a href="#pricing" className="font-bold hover:text-teal-700">Pricing</a>
            <a href="/login" className="font-bold hover:text-teal-700">Login</a>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-7xl border-t border-slate-200 pt-5 text-sm text-slate-500">
          Copyright © 2026 Smart Attendance. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
