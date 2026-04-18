import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Camera,
  CheckCircle2,
  Globe,
  Layers3,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";
import smartAttendanceLogo from "./assets/smart-attendance-logo.svg";

const heroImage =
  "https://source.unsplash.com/1800x1100/?african-university-students,classroom,smartphones";
const classroomImage =
  "https://source.unsplash.com/1200x800/?african-students,classroom,smartphones";
const studentImage =
  "https://source.unsplash.com/1200x800/?african-student,university,phone,selfie";
const gpsImage =
  "https://source.unsplash.com/1200x800/?african-campus,students,smartphone,location";
const reportsImage =
  "https://source.unsplash.com/1200x800/?analytics-dashboard,admin,reports,laptop";

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
    text: "Lecturers and admins monitor submissions instantly with export-ready reports.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Account Access",
    text: "Every user signs in securely while attendance records stay organized and protected.",
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
    image: reportsImage,
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

function FeatureCard({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-teal-300">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-600">
        <Icon className="h-6 w-6 text-white" />
      </div>
      <h4 className="text-xl font-black text-slate-950">{title}</h4>
      <p className="mt-3 leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function PricingCard({ plan }: { plan: (typeof plans)[number] }) {
  return (
    <div
      className={`relative border p-8 shadow-sm transition hover:-translate-y-1 ${
        plan.featured ? "border-teal-500 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-950"
      }`}
    >
      {plan.badge && (
        <div
          className={`mb-5 inline-flex rounded-lg px-3 py-1 text-xs font-black uppercase ${
            plan.featured ? "bg-white text-teal-700" : "bg-teal-100 text-teal-700"
          }`}
        >
          {plan.badge}
        </div>
      )}

      <h4 className="text-2xl font-black">{plan.name}</h4>
      <div className="mt-5">
        <div className="text-4xl font-black">{plan.price}</div>
        <div className={`mt-2 text-sm ${plan.featured ? "text-white/80" : "text-slate-500"}`}>{plan.duration}</div>
      </div>

      <ul className="mt-8 space-y-4">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-3">
            <CheckCircle2 className={`h-5 w-5 ${plan.featured ? "text-white" : "text-teal-600"}`} />
            <span className="font-semibold">{feature}</span>
          </li>
        ))}
      </ul>

      <a
        href="/login"
        className={`mt-8 inline-flex w-full items-center justify-center rounded-lg px-5 py-4 font-black transition ${
          plan.featured ? "bg-white text-teal-700 hover:bg-slate-100" : "bg-slate-950 text-white hover:bg-teal-700"
        }`}
      >
        Get Started
      </a>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-white text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <img src={smartAttendanceLogo} alt="Smart Attendance logo" className="h-12 w-12 rounded-lg object-contain" />
            <div>
              <h1 className="text-xl font-black">Smart Attendance</h1>
              <p className="text-xs text-slate-500">Premium Digital Attendance Platform</p>
            </div>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-bold text-slate-700 hover:text-teal-700">Features</a>
            <a href="#how-it-works" className="text-sm font-bold text-slate-700 hover:text-teal-700">How It Works</a>
            <a href="#pricing" className="text-sm font-bold text-slate-700 hover:text-teal-700">Pricing</a>
            <a href="#contact" className="text-sm font-bold text-slate-700 hover:text-teal-700">Contact</a>
          </div>

          <a href="/login" className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-teal-700">
            Login
          </a>
        </nav>
      </header>

      <main>
        <section className="relative min-h-[88vh] overflow-hidden">
          <img src={heroImage} alt="Students using smartphones in class" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-slate-950/60" />
          <div className="relative mx-auto grid min-h-[88vh] max-w-7xl items-center gap-10 px-5 py-20 lg:grid-cols-2 lg:px-8">
            <div className="text-white">
              <div className="mb-5 inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-bold text-teal-100 backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Built for colleges, institutes, and universities
              </div>

              <h2 className="max-w-3xl text-5xl font-black leading-tight md:text-6xl xl:text-7xl">
                The Premium Way To Manage Attendance
              </h2>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/85">
                Transform attendance into a secure digital experience with live selfie verification, GPS classroom validation, real-time dashboards, and export-ready reports.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <a href="/login" className="group inline-flex items-center gap-2 rounded-lg bg-teal-500 px-6 py-4 font-black text-slate-950 transition hover:bg-teal-300">
                  Login to Start Free Trial
                  <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                </a>

                <a href="#pricing" className="rounded-lg border border-white/40 bg-white/10 px-6 py-4 font-black text-white backdrop-blur transition hover:bg-white/20">
                  View Plans
                </a>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {["Fast mobile attendance flow", "Accurate location validation", "Secure account access", "Professional Excel and PDF reports"].map((item) => (
                  <div key={item} className="rounded-lg bg-white/12 px-4 py-4 text-sm font-bold text-white backdrop-blur">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-teal-300" />
                      <span>{item}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-white/15 bg-white/12 p-4 shadow-2xl backdrop-blur">
              <div className="bg-slate-950/80 p-4">
                <div className="relative min-h-[330px] overflow-hidden">
                  <img src={classroomImage} alt="Classroom attendance preview" className="absolute inset-0 h-full w-full object-cover opacity-60" />
                  <div className="absolute inset-0 bg-slate-950/55" />
                  <div className="relative flex min-h-[330px] flex-col justify-between p-6">
                    <div className="max-w-lg">
                      <p className="text-sm font-bold text-teal-300">Premium Attendance Experience</p>
                      <h3 className="mt-3 text-3xl font-black leading-tight text-white">
                        Students Submit Attendance Online In Class
                      </h3>
                      <p className="mt-4 text-sm leading-7 text-white/80">
                        Students use phones to verify attendance with a live selfie and location confirmation while lecturers monitor submissions from the dashboard.
                      </p>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {[
                        { icon: Smartphone, label: "Mobile Check-In" },
                        { icon: Camera, label: "Live Selfie" },
                        { icon: MapPin, label: "GPS Verified" },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={item.label} className="rounded-lg bg-white/12 p-4 backdrop-blur">
                            <Icon className="mb-3 h-5 w-5 text-teal-300" />
                            <p className="text-sm font-black text-white">{item.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[
                    { icon: Lock, text: "Protected records" },
                    { icon: Globe, text: "Accessible anywhere" },
                    { icon: Zap, text: "Fast submission flow" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.text} className="rounded-lg bg-white/10 px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-teal-300" />
                          <span className="text-sm font-bold text-white">{item.text}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-950 px-5 py-10 text-white lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-4">
            {stats.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-white/8 p-6 text-center">
                <div className="text-3xl font-black text-teal-300">{item.value}</div>
                <div className="mt-2 text-sm text-slate-300">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase text-teal-700">Premium Features</p>
            <h3 className="mt-3 text-4xl font-black">Everything You Need In One Platform</h3>
            <p className="mt-4 text-slate-600">Built for institutions that need secure, accurate, and modern attendance management.</p>
          </div>

          <div className="mx-auto mt-14 grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </section>

        <section id="how-it-works" className="bg-slate-50 px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase text-teal-700">How It Works</p>
            <h3 className="mt-3 text-4xl font-black">Simple Flow, Powerful Results</h3>
          </div>

          <div className="mx-auto mt-14 grid max-w-7xl gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <article key={step.title} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <img src={step.image} alt={step.title} className="h-52 w-full object-cover" />
                <div className="p-7">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-600 font-black text-white">
                    {index + 1}
                  </div>
                  <h4 className="text-2xl font-black">{step.title}</h4>
                  <p className="mt-4 leading-7 text-slate-600">{step.desc}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-7xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase text-teal-700">Admin Dashboard Preview</p>
                <h4 className="mt-1 text-2xl font-black text-slate-950">Submitted Attendance Records</h4>
              </div>
              <div className="rounded-lg bg-teal-100 px-4 py-2 text-sm font-black text-teal-700">Live Reports</div>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-4 bg-slate-950 px-4 py-3 text-xs font-black uppercase text-white">
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
                <div key={row[1]} className="grid grid-cols-4 border-t border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <span className="font-bold text-slate-950">{row[0]}</span>
                  <span>{row[1]}</span>
                  <span>{row[2]}</span>
                  <span className="font-bold text-teal-700">{row[3]}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase text-teal-700">Pricing</p>
            <h3 className="mt-3 text-4xl font-black">Flexible Plans For Every Institution</h3>
            <p className="mt-4 text-slate-600">Choose a package that matches your needs and start your free trial today.</p>
          </div>

          <div className="mx-auto mt-14 grid max-w-7xl gap-8 lg:grid-cols-3">
            {plans.map((plan) => (
              <PricingCard key={plan.name} plan={plan} />
            ))}
          </div>
        </section>

        <section className="px-5 pb-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-8 rounded-lg bg-slate-950 p-10 text-white md:grid-cols-[1.3fr_0.7fr] md:p-14">
            <div>
              <p className="text-sm font-black uppercase text-teal-300">Start Free</p>
              <h3 className="mt-3 text-4xl font-black leading-tight">Ready To Modernize Attendance In Your Institution?</h3>
              <p className="mt-4 max-w-2xl text-slate-300">
                Login now, start your free trial, and experience a premium attendance workflow designed for real classrooms.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <a href="/login" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-4 font-black text-slate-950 transition hover:bg-teal-100">
                Login to Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </a>
              <a href="#contact" className="inline-flex items-center justify-center rounded-lg border border-white/20 px-6 py-4 font-black text-white transition hover:bg-white/10">
                Contact Support
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="border-t border-slate-200 px-5 py-12 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-3">
              <img src={smartAttendanceLogo} alt="Smart Attendance logo" className="h-14 w-14 rounded-lg object-contain" />
              <div>
                <h4 className="text-xl font-black">Smart Attendance</h4>
                <p className="text-sm text-slate-500">A premium digital attendance solution for modern institutions.</p>
              </div>
            </div>

            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600">
              Built to help colleges, institutes, and universities improve attendance accuracy, security, and reporting.
            </p>
            <div className="mt-6 space-y-2 text-sm font-semibold text-slate-700">
              <p>Phone: <a href="tel:+255794128543" className="text-teal-700 hover:underline">0794 128 543</a></p>
              <p>Phone: <a href="tel:+255624500935" className="text-teal-700 hover:underline">0624 500 935</a></p>
              <p>Email: <a href="mailto:muhengastationary@gmail.com" className="text-teal-700 hover:underline">muhengastationary@gmail.com</a></p>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h5 className="font-black">Platform</h5>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>Features</li>
                <li>Pricing</li>
                <li>Free Trial</li>
              </ul>
            </div>
            <div>
              <h5 className="font-black">Support</h5>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li><a href="tel:+255794128543" className="hover:text-teal-700">0794 128 543</a></li>
                <li><a href="tel:+255624500935" className="hover:text-teal-700">0624 500 935</a></li>
                <li><a href="mailto:muhengastationary@gmail.com" className="hover:text-teal-700">muhengastationary@gmail.com</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-black">Access</h5>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>Login</li>
                <li>Start Free Trial</li>
                <li>Request Demo</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-7xl border-t border-slate-200 pt-5 text-center text-sm text-slate-500">
          Copyright © 2026 Smart Attendance. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
