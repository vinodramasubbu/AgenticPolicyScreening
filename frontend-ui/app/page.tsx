"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IntakePayload, startCase } from "@/lib/api";

type OccupationProfile = "office" | "service" | "healthcare" | "transport" | "construction" | "public_safety";

type IntakeFormValues = {
  applicantName: string;
  age: number;
  requestedCoverage: number;
  annualIncome: number;
  smoker: boolean;
  priorClaims: number;
  region: string;
  productType: IntakePayload["productType"];
  policyTermYears: IntakePayload["policyTermYears"];
  creditBand: IntakePayload["creditBand"];
  bmiInput: string;
  hasChronicCondition: boolean;
  monthlyDebtPayments: number;
  occupationProfile: OccupationProfile;
};

const ALLOWED_STATES = ["MA", "ME", "NH", "NY", "NJ", "DE", "MD", "VA", "NV", "SC", "GA", "FL"];

const initialValues: IntakeFormValues = {
  applicantName: "",
  age: 35,
  requestedCoverage: 500000,
  annualIncome: 90000,
  smoker: false,
  priorClaims: 0,
  region: "MA",
  productType: "term_life",
  policyTermYears: 20,
  creditBand: "good",
  bmiInput: "26",
  hasChronicCondition: false,
  monthlyDebtPayments: 2200,
  occupationProfile: "office"
};

function mapOccupationProfileToClass(profile: OccupationProfile): IntakePayload["occupationClass"] {
  switch (profile) {
    case "office":
      return "low";
    case "service":
    case "healthcare":
    case "transport":
      return "medium";
    case "construction":
    case "public_safety":
      return "high";
    default:
      return "medium";
  }
}

function computeDebtToIncomeRatio(annualIncome: number, monthlyDebtPayments: number): number {
  const monthlyIncome = annualIncome / 12;
  if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) {
    return 0;
  }

  const rawRatio = monthlyDebtPayments / monthlyIncome;
  const clamped = Math.max(0, Math.min(1, rawRatio));
  return Number(clamped.toFixed(2));
}

export default function IntakePage() {
  const [form, setForm] = useState<IntakeFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const computedDti = computeDebtToIncomeRatio(form.annualIncome, form.monthlyDebtPayments);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload: IntakePayload = {
        applicantName: form.applicantName,
        age: form.age,
        requestedCoverage: form.requestedCoverage,
        annualIncome: form.annualIncome,
        smoker: form.smoker,
        priorClaims: form.priorClaims,
        region: form.region,
        productType: form.productType,
        policyTermYears: form.policyTermYears,
        occupationClass: mapOccupationProfileToClass(form.occupationProfile),
        creditBand: form.creditBand,
        debtToIncomeRatio: computedDti,
        bmi: form.bmiInput === "" ? undefined : Number(form.bmiInput),
        hasChronicCondition: form.hasChronicCondition
      };

      const { instanceId } = await startCase(payload);
      router.push(`/cases/${instanceId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col justify-center px-4 py-4 lg:px-8 lg:py-6">
      <div className="mb-5 flex gap-2">
        <Link href="/" className="rounded-full bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white">
          Intake
        </Link>
        <Link href="/underwriter" className="rounded-full bg-[#e6deca] px-4 py-2 text-sm font-semibold text-[#1f2a22]">
          Pending Decisions
        </Link>
      </div>
      <div className="rounded-3xl border border-[#d8cfbc] bg-[#f8f4ea]/90 p-5 shadow-xl lg:p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-[#0f766e]">Durable Multi-Agent Insurance Workflow</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight">Policy Intake and AI Screening</h1>
        <p className="mt-4 max-w-2xl text-[#5e5a52]">
          Submit a policy request. Durable Functions orchestrates multiple screening agents, then pauses for
          underwriter approval before finalizing the case.
        </p>

        <form className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1">
            Applicant name
            <input
              className="rounded-lg border border-[#c9bfa8] bg-white p-3"
              value={form.applicantName}
              onChange={(e) => setForm((v) => ({ ...v, applicantName: e.target.value }))}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            State code
            <select
              className="rounded-lg border border-[#c9bfa8] bg-white p-3"
              value={form.region}
              onChange={(e) => setForm((v) => ({ ...v, region: e.target.value }))}
            >
              {ALLOWED_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            Product type
            <select
              className="rounded-lg border border-[#c9bfa8] bg-white p-3"
              value={form.productType}
              onChange={(e) => setForm((v) => ({ ...v, productType: e.target.value as IntakePayload["productType"] }))}
            >
              <option value="term_life">Term life</option>
              <option value="whole_life">Whole life</option>
              <option value="universal_life">Universal life</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            Policy term (years)
            <select
              className="rounded-lg border border-[#c9bfa8] bg-white p-3"
              value={form.policyTermYears}
              onChange={(e) => setForm((v) => ({ ...v, policyTermYears: Number(e.target.value) as IntakePayload["policyTermYears"] }))}
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={25}>25</option>
              <option value={30}>30</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            Age
            <input
              type="number"
              min={18}
              className="rounded-lg border border-[#c9bfa8] bg-white p-3"
              value={form.age}
              onChange={(e) => setForm((v) => ({ ...v, age: Number(e.target.value) }))}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            Prior claims
            <input
              type="number"
              min={0}
              className="rounded-lg border border-[#c9bfa8] bg-white p-3"
              value={form.priorClaims}
              onChange={(e) => setForm((v) => ({ ...v, priorClaims: Number(e.target.value) }))}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            What best describes the applicant occupation?
            <select
              className="rounded-lg border border-[#c9bfa8] bg-white p-3"
              value={form.occupationProfile}
              onChange={(e) => setForm((v) => ({ ...v, occupationProfile: e.target.value as OccupationProfile }))}
            >
              <option value="office">Office / Tech / Education</option>
              <option value="service">Retail / Hospitality / Service</option>
              <option value="healthcare">Healthcare / Clinical</option>
              <option value="transport">Transport / Field Operations</option>
              <option value="construction">Construction / Heavy Industry</option>
              <option value="public_safety">Public Safety / Emergency Response</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            Requested coverage
            <input
              type="number"
              min={10000}
              step={1000}
              className="rounded-lg border border-[#c9bfa8] bg-white p-3"
              value={form.requestedCoverage}
              onChange={(e) => setForm((v) => ({ ...v, requestedCoverage: Number(e.target.value) }))}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            Annual income
            <input
              type="number"
              min={1000}
              step={1000}
              className="rounded-lg border border-[#c9bfa8] bg-white p-3"
              value={form.annualIncome}
              onChange={(e) => setForm((v) => ({ ...v, annualIncome: Number(e.target.value) }))}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            Credit band
            <select
              className="rounded-lg border border-[#c9bfa8] bg-white p-3"
              value={form.creditBand}
              onChange={(e) => setForm((v) => ({ ...v, creditBand: e.target.value as IntakePayload["creditBand"] }))}
            >
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            Monthly debt payments (USD)
            <input
              type="number"
              min={0}
              step={50}
              className="rounded-lg border border-[#c9bfa8] bg-white p-3"
              value={form.monthlyDebtPayments}
              onChange={(e) => setForm((v) => ({ ...v, monthlyDebtPayments: Number(e.target.value) }))}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            Calculated debt-to-income ratio
            <input
              className="rounded-lg border border-[#c9bfa8] bg-[#f6f2e7] p-3"
              value={computedDti}
              readOnly
            />
          </label>

          <label className="flex flex-col gap-1">
            BMI (optional)
            <input
              type="number"
              min={15}
              max={60}
              step={0.1}
              className="rounded-lg border border-[#c9bfa8] bg-white p-3"
              value={form.bmiInput}
              onChange={(e) => setForm((v) => ({ ...v, bmiInput: e.target.value }))}
            />
          </label>

          <label className="xl:col-span-2 flex items-center gap-2 rounded-lg bg-[#efe7d6] p-3">
            <input
              type="checkbox"
              checked={form.smoker}
              onChange={(e) => setForm((v) => ({ ...v, smoker: e.target.checked }))}
            />
            Applicant is a smoker
          </label>

          <label className="xl:col-span-2 flex items-center gap-2 rounded-lg bg-[#efe7d6] p-3">
            <input
              type="checkbox"
              checked={Boolean(form.hasChronicCondition)}
              onChange={(e) => setForm((v) => ({ ...v, hasChronicCondition: e.target.checked }))}
            />
            Applicant has chronic condition history
          </label>

          <div className="xl:col-span-4 mt-1 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#0f766e] px-5 py-3 font-semibold text-white transition hover:bg-[#0c5f59] disabled:opacity-60"
            >
              {submitting ? "Starting workflow..." : "Start Durable Screening"}
            </button>
            {error && <p className="text-sm text-[#9a3412]">{error}</p>}
          </div>
        </form>
      </div>
    </main>
  );
}
