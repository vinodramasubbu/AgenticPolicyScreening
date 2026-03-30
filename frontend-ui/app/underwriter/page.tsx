"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CaseStatus, PendingCase, askCaseQuestion, getCaseStatus, getPendingCases, submitDecision } from "@/lib/api";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type PolicyInput = {
  applicantName?: string;
  age?: number;
  requestedCoverage?: number;
  annualIncome?: number;
  smoker?: boolean;
  priorClaims?: number;
  region?: string;
  productType?: string;
  policyTermYears?: number;
  occupationClass?: string;
  creditBand?: string;
  debtToIncomeRatio?: number;
  bmi?: number;
  hasChronicCondition?: boolean;
  submittedAtUtc?: string;
};

function parsePolicyInput(input: unknown): PolicyInput | null {
  if (!input) return null;

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as unknown;
      return typeof parsed === "object" && parsed !== null ? (parsed as PolicyInput) : null;
    } catch {
      return null;
    }
  }

  if (typeof input === "object") {
    return input as PolicyInput;
  }

  return null;
}

function formatCurrency(value?: number) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default function UnderwriterQueuePage() {
  const [pendingCases, setPendingCases] = useState<PendingCase[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseStatus | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const loadPending = async () => {
      try {
        const cases = await getPendingCases();
        setPendingCases(cases);
        if (!selectedId && cases.length > 0) {
          setSelectedId(cases[0].instanceId);
        }

        if (selectedId && !cases.some((c) => c.instanceId === selectedId)) {
          setSelectedId(cases.length > 0 ? cases[0].instanceId : null);
        }

        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load pending cases");
      }
    };

    loadPending();
    timer = setInterval(loadPending, 5000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedCase(null);
      setChatMessages([]);
      return;
    }

    let timer: NodeJS.Timeout | null = null;
    const loadCase = async () => {
      try {
        const status = await getCaseStatus(selectedId);
        setSelectedCase(status);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load case details");
      }
    };

    loadCase();
    timer = setInterval(loadCase, 3000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [selectedId]);

  const canDecide = useMemo(() => {
    return selectedCase?.customStatus?.phase === "awaiting_underwriter_approval";
  }, [selectedCase]);

  const policyInput = useMemo(() => parsePolicyInput(selectedCase?.input), [selectedCase?.input]);

  async function decide(decision: "approve" | "reject") {
    if (!selectedId) return;

    try {
      setSubmitting(true);
      await submitDecision(selectedId, decision, notes);

      const [cases, status] = await Promise.all([getPendingCases(), getCaseStatus(selectedId)]);
      setPendingCases(cases);
      setSelectedCase(status);

      if (!cases.some((c) => c.instanceId === selectedId)) {
        setSelectedId(cases.length > 0 ? cases[0].instanceId : null);
      }

      setNotes("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendChatQuestion() {
    if (!selectedId) return;
    const question = chatInput.trim();
    if (!question) return;

    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", text: question }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await askCaseQuestion(selectedId, question);
      setChatMessages([...nextMessages, { role: "assistant", text: response.answer }]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to get response.";
      setChatMessages([...nextMessages, { role: "assistant", text: `Error: ${message}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1520px] px-4 py-4 lg:px-8 lg:py-6">
      <div className="mb-5 flex gap-2">
        <Link href="/" className="rounded-full bg-[#e6deca] px-4 py-2 text-sm font-semibold text-[#1f2a22]">
          Intake
        </Link>
        <Link href="/underwriter" className="rounded-full bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white">
          Pending Decisions
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr] xl:grid-cols-[400px_1fr]">
        <aside className="rounded-2xl border border-[#d8cfbc] bg-[#f8f4ea]/90 p-4 xl:p-5">
          <h1 className="text-2xl font-semibold">Underwriter Queue</h1>
          <p className="mt-1 text-sm text-[#5e5a52]">Cases awaiting a human decision</p>

          <div className="mt-4 space-y-2">
            {pendingCases.length === 0 && (
              <p className="rounded-lg bg-white p-3 text-sm text-[#5e5a52]">No pending cases at the moment.</p>
            )}

            {pendingCases.map((item) => (
              <button
                key={item.instanceId}
                onClick={() => setSelectedId(item.instanceId)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedId === item.instanceId
                    ? "border-[#0f766e] bg-[#e8f6f3]"
                    : "border-[#dccfb7] bg-white hover:border-[#b9ad96]"
                }`}
              >
                <p className="text-sm font-semibold text-[#1f2a22]">{item.applicantName || "Unknown applicant"}</p>
                <p className="mt-1 text-xs text-[#5e5a52]">Case: {item.instanceId}</p>
                <p className="mt-1 text-xs text-[#5e5a52]">
                  {item.recommendation?.backendRecommendation || "manual_review"} • Score {item.recommendation?.compositeScore ?? "-"}
                </p>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-[#d8cfbc] bg-[#f8f4ea]/90 p-4 xl:p-5">
          {!selectedCase ? (
            <p className="text-[#5e5a52]">Select a pending case to view full analysis and make a decision.</p>
          ) : (
            <>
              <h2 className="text-3xl font-semibold">Case {selectedCase.instanceId}</h2>
              <p className="mt-1 text-sm text-[#5e5a52]">Review AI analysis and decide approval outcome.</p>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
                <div className="space-y-4">
                  <div className="rounded-xl bg-[#efe7d6] p-4">
                    <h3 className="text-xl font-semibold">Screening recommendation</h3>
                    <p className="mt-1 text-sm text-[#5e5a52]">
                      Suggested action: <strong>{selectedCase.customStatus?.recommendation?.backendRecommendation || "manual_review"}</strong>
                    </p>
                    <p className="text-sm text-[#5e5a52]">
                      Composite score: <strong>{selectedCase.customStatus?.recommendation?.compositeScore ?? "-"}</strong>
                    </p>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#4a463f]">
                      {(selectedCase.customStatus?.recommendation?.rationale || []).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>

                    <div className="mt-4 rounded-lg bg-[#f7f2e5] p-3 text-sm text-[#4a463f]">
                      <p>
                        Suggested annual premium: <strong>{formatCurrency(selectedCase.customStatus?.recommendation?.pricingRecommendation?.suggestedAnnualPremium ?? undefined)}</strong>
                      </p>
                      <p>
                        Risk load: <strong>{selectedCase.customStatus?.recommendation?.pricingRecommendation?.riskLoadPct ?? "-"}%</strong>
                      </p>
                      <p>
                        Discounts: <strong>{selectedCase.customStatus?.recommendation?.pricingRecommendation?.discountsPct ?? "-"}%</strong>
                      </p>
                      <p>
                        Base rate / $1K: <strong>{selectedCase.customStatus?.recommendation?.pricingRecommendation?.baseRatePerThousand ?? "-"}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white p-4">
                    <h3 className="text-xl font-semibold">Policy inputs used for recommendation</h3>
                    {!policyInput ? (
                      <p className="mt-2 text-sm text-[#5e5a52]">No input payload is available for this case.</p>
                    ) : (
                      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                        <p className="rounded-lg bg-[#f6f2e7] p-2">Applicant: <strong>{policyInput.applicantName || "-"}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2">Region: <strong>{policyInput.region || "-"}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2">Product: <strong>{policyInput.productType || "-"}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2">Term years: <strong>{policyInput.policyTermYears ?? "-"}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2">Age: <strong>{policyInput.age ?? "-"}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2">Prior claims: <strong>{policyInput.priorClaims ?? "-"}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2">Requested coverage: <strong>{formatCurrency(policyInput.requestedCoverage)}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2">Annual income: <strong>{formatCurrency(policyInput.annualIncome)}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2">Occupation class: <strong>{policyInput.occupationClass || "-"}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2">Credit band: <strong>{policyInput.creditBand || "-"}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2">Debt-to-income ratio: <strong>{policyInput.debtToIncomeRatio ?? "-"}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2">BMI: <strong>{policyInput.bmi ?? "-"}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2">Smoker: <strong>{typeof policyInput.smoker === "boolean" ? (policyInput.smoker ? "Yes" : "No") : "-"}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2">Chronic condition: <strong>{typeof policyInput.hasChronicCondition === "boolean" ? (policyInput.hasChronicCondition ? "Yes" : "No") : "-"}</strong></p>
                        <p className="rounded-lg bg-[#f6f2e7] p-2 md:col-span-2">Submitted at: <strong>{policyInput.submittedAtUtc || "-"}</strong></p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#d8cfbc] bg-white/80 p-4 xl:sticky xl:top-4 xl:h-fit">
                  <label className="block text-sm font-semibold text-[#1f2a22]">Underwriter notes</label>
                  <textarea
                    className="mt-2 h-32 w-full rounded-lg border border-[#c9bfa8] bg-white p-3 text-sm"
                    placeholder="Add decision rationale"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />

                  <div className="mt-4 grid gap-2">
                    <button
                      disabled={!canDecide || submitting}
                      onClick={() => decide("approve")}
                      className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      disabled={!canDecide || submitting}
                      onClick={() => decide("reject")}
                      className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <Link href={`/cases/${selectedCase.instanceId}`} className="rounded-lg bg-[#e6deca] px-4 py-2 text-center font-semibold text-[#1f2a22]">
                      Open Full Timeline
                    </Link>
                  </div>

                  <div className="mt-5 border-t border-[#e2dac8] pt-4">
                    <h4 className="text-sm font-semibold text-[#1f2a22]">Ask about this recommendation</h4>
                    <p className="mt-1 text-xs text-[#5e5a52]">
                      Example: "Why was this marked manual review?" or "Explain the premium suggestion."
                    </p>

                    <div className="mt-3 max-h-48 space-y-2 overflow-auto rounded-lg bg-[#f8f4ea] p-2">
                      {chatMessages.length === 0 && (
                        <p className="text-xs text-[#7a7368]">No messages yet.</p>
                      )}
                      {chatMessages.map((msg, index) => (
                        <div
                          key={`${msg.role}-${index}`}
                          className={`rounded-md p-2 text-xs ${
                            msg.role === "user" ? "bg-[#e8f6f3] text-[#1f2a22]" : "bg-white text-[#4a463f]"
                          }`}
                        >
                          <p className="mb-1 font-semibold uppercase tracking-wide">{msg.role}</p>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      ))}
                    </div>

                    <textarea
                      className="mt-2 h-20 w-full rounded-lg border border-[#c9bfa8] bg-white p-2 text-sm"
                      placeholder="Ask a question about this case..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <button
                      onClick={sendChatQuestion}
                      disabled={chatLoading || !selectedId}
                      className="mt-2 w-full rounded-lg bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {chatLoading ? "Thinking..." : "Ask AI"}
                    </button>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-[#5e5a52]">
                {canDecide
                  ? "This case is waiting for underwriter approval."
                  : "This case is no longer pending underwriter decision."}
              </p>
            </>
          )}

          {error && <p className="mt-4 text-sm text-[#9a3412]">{error}</p>}
        </section>
      </div>
    </main>
  );
}
