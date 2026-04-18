import {
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  Globe,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";
import adminDashboardImage from "./assets/landing-admin-dashboard.svg";
import gpsVerificationImage from "./assets/landing-gps-verification.svg";
import onlineAttendanceImage from "./assets/landing-online-attendance.svg";
import studentStepsImage from "./assets/landing-student-steps.svg";
import smartAttendanceLogo from "./assets/smart-attendance-logo.svg";

const heroImage = onlineAttendanceImage;
const classroomImage = adminDashboardImage;
const studentImage = studentStepsImage;
const gpsImage = gpsVerificationImage;

const stats = [
  { label: "Institutions", value: "1,000+" },
  { label: "Attendance Records", value: "500K+" },
  { label: "Accuracy Rate", value: "99.9%" },
  { label: "System Uptime", value: "24/7" },
];

const features = [
  {
    icon: Camera,
    title: "Live Selfie Verification",
    text: "Each student submits attendance using a live selfie to improve identity validation.",
  },
  {
    icon: MapPin,
    title: "GPS Location Control",
    text: "Attendance is accepted within the approved classroom, hall, or campus zone.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Reports",
    text: "Lecturers and admins monitor submissions instantly with export-ready attendance reports.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Account Access",
    text: "Users sign in securely while records stay controlled, organized, and professional.",
  },
];

const steps = [
  {
    title: "Create Session",
    desc: "The lecturer creates an attendance session with time, link, and location settings.",
    image: gpsImage,
  },
  {
    title: "Students Submit Online",
    desc: "Students open the link, capture a live selfie, verify location, and submit attendance.",
    image: studentImage,
  },
  {
    title: "Track and Export Records",
    desc: "Attendance is stored securely and can be reviewed or exported as Excel and PDF reports.",
    image: classroomImage,
  },
];

const plans = [
  {
    name: "Monthly Plan",
    price: "TZS 25,000",
    duration: "per month",
    badge: "",
    features: ["Full attendance dashboard", "Selfie and GPS attendance", "Excel and PDF export", "Mobile-friendly access"],
  },
  {
    name: "Quarterly Plan",
    price: "TZS 70,000",
    duration: "for 3 months",
    featured: true,
    badge: "Most Popular",
    features: ["Everything in Monthly", "Priority support", "Better value for institutions", "Advanced reporting tools"],
  },
  {
    name: "Annual Plan",
    price: "TZS 180,000",
    duration: "per year",
    badge: "Best Value",
    features: ["Everything in Quarterly", "Highest savings", "Long-term institutional use", "Premium setup support"],
  },
];

function GlowOrb({ className }: { className?: string }) {
  return <div className={`absolute rounded-full blur-3xl ${className}`} />;
}

function FeatureCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/8 p-6 backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.10]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_35%)] opacity-0 transition duration-300 group-hover:opacity-100" />
      <div className="relative">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 shadow-[0_12px_30px_rgba(34,211,238,0.25)]">
          <Icon className="h-6 w-6 text-white" />
        </div>
        <h4 className="text-xl font-bold text-white">{title}</h4>
        <p className="mt-3 leading-7 text-slate-300">{text}</p>
      </div>
    </div>
  );
}

function PricingCard({ plan }: { plan: (typeof plans)[number] }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border p-8 backdrop-blur-2xl transition duration-300 hover:-translate-y-2 ${
        plan.featured
          ? "border-cyan-300/30 bg-gradient-to-br from-blue-600/30 via-slate-900/80 to-cyan-400/20 shadow-[0_25px_90px_rgba(34,211,238,0.18)]"
          : "border-white/10 bg-white/7"
      }`}
    >
      {plan.badge && (
        <div
          className={`absolute right-5 top-5 rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-normal ${
            plan.featured ? "bg-white text-slate-900" : "bg-cyan-400/20 text-cyan-200"
          }`}
        >
          {plan.badge}
        </div>
      )}

      <h4 className="text-2xl font-bold">{plan.name}</h4>
      <div className="mt-5">
        <div className="text-4xl font-black tracking-tight">{plan.price}</div>
        <div className="mt-2 text-sm text-slate-300">{plan.duration}</div>
      </div>

      <ul className="mt-8 space-y-4">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-3 text-slate-200">
            <CheckCircle2 className="h-5 w-5 text-cyan-300" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <a
        href="/login"
        className={`mt-8 inline-flex w-full items-center justify-center rounded-lg px-5 py-4 font-semibold transition ${
          plan.featured
            ? "bg-white text-slate-900 hover:bg-slate-100"
            : "bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:opacity-95"
        }`}
      >
        Get Started
      </a>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#06111f] text-white">
      <div className="pointer-events-none fixed inset-0">
        <GlowOrb className="-left-24 top-10 h-72 w-72 bg-blue-600/25" />
        <GlowOrb className="right-[-80px] top-40 h-[26rem] w-[26rem] bg-cyan-500/20" />
        <GlowOrb className="bottom-[-120px] left-[35%] h-96 w-96 bg-indigo-500/20" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_25%,transparent_75%,rgba(255,255,255,0.02))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_35%)]" />
      </div>

      <header className="relative z-20">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <img src={smartAttendanceLogo} alt="Smart Attendance logo" className="h-14 w-14 rounded-lg bg-white object-contain p-1" />
            <div>
              <h1 className="text-xl font-bold tracking-normal">Smart Attendance</h1>
              <p className="text-xs text-slate-300">Premium Digital Attendance Platform</p>
            </div>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-slate-200 hover:text-white">Features</a>
            <a href="#how-it-works" className="text-sm text-slate-200 hover:text-white">How It Works</a>
            <a href="#pricing" className="text-sm text-slate-200 hover:text-white">Pricing</a>
            <a href="#contact" className="text-sm text-slate-200 hover:text-white">Contact</a>
          </div>

          <a href="/login" className="rounded-lg border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur-xl transition hover:bg-white/20">
            Login
          </a>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-10 lg:grid-cols-2 lg:px-8 lg:pt-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-white/6 px-4 py-2 text-sm text-cyan-300 backdrop-blur-xl">
            <Sparkles className="h-4 w-4" />
            Built for colleges, institutes, and universities
          </div>

          <h2 className="max-w-3xl text-5xl font-black leading-tight tracking-normal md:text-6xl xl:text-7xl">
            The Premium Way
            <span className="block bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              To Manage Attendance
            </span>
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Transform attendance into a secure digital experience with live selfie verification, GPS-based classroom validation, real-time dashboards, and export-ready reports.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <a href="/login" className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 px-6 py-4 font-semibold text-white shadow-[0_20px_70px_rgba(37,99,235,0.35)] transition hover:scale-[1.02]">
              Login to Start Free Trial
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </a>
            <a href="#pricing" className="rounded-lg border border-white/10 bg-white/5 px-6 py-4 font-semibold text-white backdrop-blur-xl transition hover:bg-white/10">
              View Plans
            </a>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {["Fast mobile attendance flow", "Accurate location validation", "Secure account access", "Professional Excel and PDF reports"].map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/6 px-4 py-4 text-sm text-slate-200 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-cyan-300" />
                  <span>{item}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-8 rounded-lg bg-gradient-to-br from-blue-500/25 to-cyan-400/20 blur-3xl" />
          <div className="relative rounded-lg border border-white/10 bg-white/8 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <div className="rounded-lg border border-white/10 bg-slate-900/85 p-5">
              <div className="grid gap-4">
                <div className="relative min-h-[340px] overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 p-6">
                  <img src={heroImage} alt="African students using smartphones in class" className="absolute inset-0 h-full w-full object-cover opacity-45" />
                  <div className="absolute inset-0 bg-slate-950/50" />
                  <div className="relative flex h-full min-h-[292px] flex-col justify-between">
                    <div className="max-w-lg">
                      <p className="text-sm font-semibold text-cyan-300">Premium Attendance Experience</p>
                      <h3 className="mt-3 text-3xl font-black leading-tight">
                        Students Submit Attendance Online In Class
                      </h3>
                      <p className="mt-4 text-sm leading-7 text-slate-300">
                        Students use their phones to verify attendance with a live selfie and location confirmation while lecturers monitor submissions from a professional admin dashboard.
                      </p>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      {[
                        { icon: Smartphone, label: "Mobile Check-In" },
                        { icon: Camera, label: "Live Selfie" },
                        { icon: MapPin, label: "GPS Verified" },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={item.label} className="rounded-lg border border-white/10 bg-white/8 p-4 backdrop-blur-xl">
                            <Icon className="mb-3 h-5 w-5 text-cyan-300" />
                            <p className="text-sm font-semibold">{item.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { icon: Lock, text: "Protected records" },
                    { icon: Globe, text: "Accessible anywhere" },
                    { icon: Zap, text: "Fast submission flow" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.text} className="rounded-lg border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-xl">
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-cyan-300" />
                          <span className="text-sm text-slate-200">{item.text}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-10 lg:px-8">
        <div className="grid gap-4 md:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className="rounded-lg border border-white/10 bg-white/6 p-6 text-center backdrop-blur-xl">
              <div className="text-3xl font-black text-cyan-300">{item.value}</div>
              <div className="mt-2 text-sm text-slate-300">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-normal text-cyan-300">Premium Features</p>
          <h3 className="mt-3 text-4xl font-black">Everything You Need In One Platform</h3>
          <p className="mt-4 text-slate-300">Built for institutions that need secure, accurate, and modern attendance management.</p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="rounded-lg border border-white/10 bg-white/6 p-8 backdrop-blur-2xl md:p-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-normal text-cyan-300">How It Works</p>
            <h3 className="mt-3 text-4xl font-black">Simple Flow, Powerful Results</h3>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="relative overflow-hidden rounded-lg border border-white/10 bg-slate-950/40">
                <img src={step.image} alt={step.title} className="h-44 w-full object-cover opacity-85" />
                <div className="p-7">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 font-black text-white">
                    {i + 1}
                  </div>
                  <h4 className="text-2xl font-bold">{step.title}</h4>
                  <p className="mt-4 leading-7 text-slate-300">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-lg border border-white/10 bg-slate-950/60 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-normal text-cyan-300">Admin Dashboard Preview</p>
                <h4 className="mt-1 text-2xl font-black">Submitted Attendance Records</h4>
              </div>
              <div className="rounded-lg bg-cyan-400/20 px-4 py-2 text-sm font-black text-cyan-200">Live Reports</div>
            </div>
            <div className="overflow-hidden rounded-lg border border-white/10">
              <div className="grid grid-cols-4 bg-white/10 px-4 py-3 text-xs font-black uppercase text-slate-200">
                <span>Name</span>
                <span>Reg Number</span>
                <span>Location</span>
                <span>Status</span>
              </div>
              {[
                ["Amina Joseph", "BIS/23/014", "Verified in class", "Submitted"],
                ["Kelvin Mushi", "ICT/22/091", "Verified in class", "Submitted"],
                ["Neema Ally", "EDU/24/038", "Verified in class", "Submitted"],
              ].map((row) => (
                <div key={row[1]} className="grid grid-cols-4 border-t border-white/10 px-4 py-3 text-sm text-slate-300">
                  <span className="font-bold text-white">{row[0]}</span>
                  <span>{row[1]}</span>
                  <span>{row[2]}</span>
                  <span className="font-bold text-cyan-300">{row[3]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-normal text-cyan-300">Pricing</p>
          <h3 className="mt-3 text-4xl font-black">Flexible Plans For Every Institution</h3>
          <p className="mt-4 text-slate-300">Choose a package that matches your needs and start your free trial today.</p>
        </div>
        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <PricingCard key={plan.name} plan={plan} />
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-20 lg:px-8">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-gradient-to-r from-blue-600/25 via-slate-900/80 to-cyan-500/20 p-10 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-14">
          <div className="grid items-center gap-8 lg:grid-cols-[1.3fr,0.7fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-cyan-300">Start Free</p>
              <h3 className="mt-3 text-4xl font-black leading-tight">Ready To Modernize Attendance In Your Institution?</h3>
              <p className="mt-4 max-w-2xl text-slate-300">
                Login now, start your free trial, and experience a premium attendance workflow designed for real institutions and real classrooms.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <a href="/login" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-4 font-semibold text-slate-900 transition hover:bg-slate-100">
                Login to Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </a>
              <a href="#contact" className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/6 px-6 py-4 font-semibold text-white backdrop-blur-xl transition hover:bg-white/10">
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="relative z-10 border-t border-white/10">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-2 lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <img src={smartAttendanceLogo} alt="Smart Attendance logo" className="h-14 w-14 rounded-lg bg-white object-contain p-1" />
              <div>
                <h4 className="text-xl font-bold">Smart Attendance</h4>
                <p className="text-sm text-slate-300">A premium digital attendance solution for modern institutions.</p>
              </div>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">
              Built to help colleges, institutes, and universities improve attendance accuracy, security, and reporting with a professional digital workflow.
            </p>
            <div className="mt-6 space-y-2 text-sm font-semibold text-slate-300">
              <p>Phone: <a href="tel:+255794128543" className="text-cyan-300 hover:underline">0794 128 543</a></p>
              <p>Phone: <a href="tel:+255624500935" className="text-cyan-300 hover:underline">0624 500 935</a></p>
              <p>Email: <a href="mailto:muhengastationary@gmail.com" className="text-cyan-300 hover:underline">muhengastationary@gmail.com</a></p>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h5 className="font-semibold text-white">Platform</h5>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                <li>Features</li>
                <li>Pricing</li>
                <li>Free Trial</li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-white">Support</h5>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                <li><a href="tel:+255794128543" className="hover:text-cyan-300">0794 128 543</a></li>
                <li><a href="tel:+255624500935" className="hover:text-cyan-300">0624 500 935</a></li>
                <li><a href="mailto:muhengastationary@gmail.com" className="hover:text-cyan-300">Email Support</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-white">Access</h5>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                <li>Login</li>
                <li>Start Free Trial</li>
                <li>Contact Support</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-6 py-5 text-center text-sm text-slate-500">
          Copyright © 2026 Smart Attendance. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
