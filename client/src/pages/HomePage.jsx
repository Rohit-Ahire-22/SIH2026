import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart2,
  Bot,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Scan,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import PublicLayout from '../layouts/PublicLayout';

const problemPoints = [
  {
    icon: Clock,
    title: 'Manual inspections are slow',
    description: 'Reviewing every label by hand struggles to keep pace with the volume of packaged commodities entering the market.',
  },
  {
    icon: AlertCircle,
    title: 'Checks are inconsistent',
    description: 'Different reviewers may weigh declarations differently, making results hard to compare across products and batches.',
  },
  {
    icon: FileText,
    title: 'Evidence trails are thin',
    description: 'When an issue is flagged, reproducing and sharing the supporting label evidence is often difficult.',
  },
];

const steps = [
  {
    icon: Upload,
    title: 'Capture or upload the label',
    description: 'Provide one or more images of the product and its label via camera or file upload.',
  },
  {
    icon: FileText,
    title: 'OCR & evidence extraction',
    description: 'The system detects text regions and extracts statutory declarations, each tied back to the source image as evidence.',
  },
  {
    icon: CheckCircle,
    title: '29-clause compliance assessment',
    description: 'Extracted declarations are evaluated against the 29-clause compliance framework, flagging potential non-compliance.',
  },
  {
    icon: Eye,
    title: 'Evidence-backed results',
    description: 'Every finding references the captured evidence so reviews stay transparent, reproducible, and auditable.',
  },
  {
    icon: BarChart2,
    title: 'Intelligence & follow-up',
    description: 'Results feed inspection analytics, violation intelligence, nutrition guidance, and complaint workflows.',
  },
];

const capabilities = [
  {
    icon: Scan,
    title: 'Smart package & label scanning',
    description: 'Capture product labels from camera or image uploads to begin an automated assessment.',
  },
  {
    icon: FileText,
    title: 'OCR & evidence extraction',
    description: 'Extract statutory declarations from label images and retain the pixel-level evidence behind every field.',
  },
  {
    icon: LayoutDashboard,
    title: '29-clause compliance analysis',
    description: 'Systematic evaluation of extracted fields against the 29-clause compliance framework with clear pass / review / fail signals.',
  },
  {
    icon: ShieldCheck,
    title: 'Legal Metrology compliance assessment',
    description: 'A structured assessment pipeline for packaged-commodity label declarations under the Legal Metrology framework.',
  },
  {
    icon: MapPin,
    title: 'Inspection & violation intelligence',
    description: 'Aggregated analytics and map views that surface patterns, regions, or product categories worth investigation.',
  },
  {
    icon: Activity,
    title: 'Nutrition comparison & recommendations',
    description: 'Extract nutrition information from labels, compare it, and surface guidance for better choices.',
  },
  {
    icon: MessageCircle,
    title: 'Complaint & issue reporting',
    description: 'A structured workflow for submitting, tracking, and reviewing issues about products, labels, or assessments.',
  },
  {
    icon: Bot,
    title: 'AI compliance assistant',
    description: 'An interactive assistant grounded in your assessment data to explain results, features, and context on every page.',
  },
];

const techPillars = [
  { icon: FileText, title: 'OCR & field extraction', description: 'Label regions are transcribed with OCR and mapped to declaration fields for structured review.' },
  { icon: Eye, title: 'Evidence-first extraction', description: 'Each extracted value keeps a reference to its source crop, so nothing is asserted without evidence.' },
  { icon: LayoutDashboard, title: 'Rules engine', description: 'Deterministic checks across the 29-clause framework produce an explainable assessment.' },
  { icon: Bot, title: 'AI assistant', description: 'Generative answers are grounded in the specific product, assessment, or page you are viewing.' },
  { icon: BarChart2, title: 'Inspection intelligence', description: 'Dashboard analytics and violation maps turn raw assessments into actionable patterns.' },
  { icon: Activity, title: 'Nutrition intelligence', description: 'Label nutrition data is extracted for comparison, guidance, and recommendations.' },
];

const evidencePoints = [
  { icon: Eye, title: 'Reproducible', description: 'A reviewer can reopen any assessment and see exactly which label crop supported each field.' },
  { icon: CheckCircle, title: 'Transparent', description: 'Pass, review, and fail signals are each accompanied by a reason and supporting evidence.' },
  { icon: FileText, title: 'Auditable', description: 'Images and extracted fields are stored together so the full review trail persists for follow-up.' },
];

const impactPoints = [
  { icon: Clock, title: 'Faster inspections', description: 'OCR-driven extraction reduces manual transcription and speeds up routine assessments.' },
  { icon: ShieldCheck, title: 'More consistent assessments', description: 'The same rules apply to every product, reducing subjectivity across reviewers.' },
  { icon: Eye, title: 'A stronger evidence trail', description: 'Visual proof is captured automatically, making follow-up and reviews reliable.' },
  { icon: MapPin, title: 'Actionable intelligence', description: 'Trends and hotspots surface early, helping teams focus inspection effort where it matters.' },
];

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="mb-10 max-w-3xl">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{eyebrow}</p>
      )}
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
      {description && <p className="mt-3 text-base text-slate-600">{description}</p>}
    </div>
  );
}

function HomePage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-600 text-white shadow-lg">
        <div className="px-6 py-14 sm:px-12 sm:py-16">
          <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
            SIH 2026 &middot; Problem Statement SIH26034
          </span>
          <h1 className="mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            SIH 2026 &mdash; Packaged Commodity Compliance Intelligence
          </h1>
          <p className="mt-5 max-w-2xl text-base text-emerald-100 sm:text-lg">
            An AI-assisted platform that scans packaged-commodity labels, extracts statutory
            declarations with OCR, and assesses them against a 29-clause Legal Metrology
            compliance framework &mdash; every finding backed by image evidence.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50"
            >
              <Scan size={18} /> Start Inspection
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Create Account
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:text-white"
            >
              Sign In <ArrowRight size={16} />
            </Link>
          </div>
          <p className="mt-6 text-xs text-emerald-200/80">
            Assessments are AI-assisted and advisory &mdash; this platform is not an official
            government filing system.
          </p>
        </div>
      </section>

      {/* Problem */}
      <section className="py-12 sm:py-16">
        <SectionHeading
          eyebrow="The challenge"
          title="Verifying labels at scale is hard"
          description="Packaged commodities must carry clear, accurate declarations. Verifying them reliably &mdash; and keeping proof &mdash; is a constant challenge."
        />
        <div className="grid gap-6 sm:grid-cols-3">
          {problemPoints.map((p) => (
            <div key={p.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <p.icon size={22} />
              </div>
              <h3 className="text-base font-semibold text-slate-900">{p.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{p.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How the system works */}
      <section className="pb-12 sm:pb-16">
        <SectionHeading
          eyebrow="How it works"
          title="From label scan to evidence-backed assessment"
          description="A single, repeatable pipeline turns product images into a structured compliance assessment."
        />
        <ol className="grid gap-6 md:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border border-slate-200 bg-white p-6 pt-8 shadow-sm">
              <div className="absolute -top-3 left-6 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                {i + 1}
              </div>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <s.icon size={22} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-xs text-slate-600">{s.description}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Core capabilities */}
      <section className="py-12 sm:py-16">
        <SectionHeading
          eyebrow="Core capabilities"
          title="Everything an inspection workflow needs"
          description="From scanning and extraction to intelligence and follow-up, the platform covers the full assessment lifecycle."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((c) => (
            <div key={c.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-300">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <c.icon size={22} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{c.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{c.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Technology & AI overview */}
      <section className="py-12 sm:py-16">
        <SectionHeading
          eyebrow="Technology & AI"
          title="How intelligence is applied"
          description="The platform combines OCR, evidence-first extraction, a deterministic rules engine, and AI assistance into one assessment pipeline."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {techPillars.map((t) => (
            <div key={t.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-white">
                <t.icon size={22} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{t.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{t.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          AI outputs are assistive. Final compliance determinations should always be confirmed
          against the captured evidence and the applicable rules.
        </div>
      </section>

      {/* Why evidence matters */}
      <section className="py-12 sm:py-16">
        <div className="rounded-2xl bg-slate-900 p-8 text-white shadow-lg sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Why evidence matters</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Reproducible, transparent, auditable</h2>
          <p className="mt-3 max-w-2xl text-base text-slate-300">
            Every extracted declaration stays linked to the label crop it came from &mdash; so any
            review, follow-up, or dispute starts from the same ground truth.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {evidencePoints.map((e) => (
              <div key={e.title} className="rounded-xl bg-slate-800/70 p-6">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                  <e.icon size={22} />
                </div>
                <h3 className="text-sm font-semibold">{e.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{e.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SIH solution and impact */}
      <section className="py-12 sm:py-16">
        <SectionHeading
          eyebrow="SIH 2026 impact"
          title="Built to make inspection workflows faster and fairer"
          description="As a Smart India Hackathon 2026 solution, the platform aims to help scale compliance inspection with consistency and transparency."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {impactPoints.map((i) => (
            <div key={i.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <i.icon size={22} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{i.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{i.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-12 sm:pb-16">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-8 text-center text-white shadow-lg sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to run a compliance assessment?</h2>
          <p className="mx-auto mt-3 max-w-xl text-emerald-100">
            Sign in to start an inspection, or create an account to begin.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50"
            >
              Start Inspection <ArrowRight size={16} />
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export default HomePage;