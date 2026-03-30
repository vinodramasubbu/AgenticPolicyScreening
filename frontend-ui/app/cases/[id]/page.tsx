"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CaseStatus, getCaseStatus, submitDecision } from "@/lib/api";

function statusChip(runtimeStatus: string) {
  if (runtimeStatus === "Completed") return "bg-emerald-100 text-emerald-700";
  if (runtimeStatus === "Failed" || runtimeStatus === "Terminated") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const instanceId = params?.id;

  const [status, setStatus] = useState<CaseStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!instanceId) {
      setError("Missing case id in route.");
      return;
    }

    let timer: NodeJS.Timeout | null = null;

    const poll = async () => {
      try {
        const latest = await getCaseStatus(instanceId);
        setStatus(latest);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    };

    poll();
    timer = setInterval(poll, 3000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [instanceId]);

  const awaitingApproval = useMemo(() => {
    return status?.customStatus?.phase === "awaiting_underwriter_approval";
  }, [status]);

  async function decide(decision: "approve" | "reject") {
    if (!instanceId) {
      setError("Missing case id in route.");
      return;
    }

    try {
      setSubmitting(true);
      await submitDecision(instanceId, decision, notes);
      const refreshed = await getCaseStatus(instanceId);
      setStatus(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  const progressValue = Number(status?.customStatus?.progress || 0);

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-6 lg:p-10">
      <div className="mb-5 flex gap-2">
        <Link href="/" className="rounded-full bg-[#e6deca] px-4 py-2 text-sm font-semibold text-[#1f2a22]">
          Intake
        </Link>
        <Link href="/underwriter" className="rounded-full bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white">
          Pending Decisions
        </Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-[#d8cfbc] bg-[#f8f4ea]/90 p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold">Case {instanceId}</h1>
              <p className="text-[#5e5a52]">Durable orchestration status and screening output</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusChip(status?.runtimeStatus || "Pending")}`}>
              {status?.runtimeStatus || "Loading"}
            </span>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm text-[#5e5a52]">
              <span>{status?.customStatus?.message || "Loading current step..."}</span>
              <span>{progressValue}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#e5dbc5]">
              <div className="h-full bg-[#0f766e] transition-all" style={{ width: `${progressValue}%` }} />
            </div>
          </div>

          <div className="mt-6 grid gap-2">
            {(status?.customStatus?.steps || []).map((step) => (
              <div key={step.name} className="flex items-center justify-between rounded-lg border border-[#dccfb7] bg-white p-3 text-sm">
                <span>{step.name}</span>
                <span className="font-semibold capitalize text-[#5e5a52]">{step.status}</span>
              </div>
            ))}
          </div>

          {status?.customStatus?.recommendation && (
            <div className="mt-6 rounded-xl bg-[#efe7d6] p-4">
              <h2 className="text-xl font-semibold">Screening recommendation</h2>
              <p className="mt-1 text-sm text-[#5e5a52]">
                Suggested action: <strong>{status.customStatus.recommendation.backendRecommendation}</strong>
              </p>
              <p className="text-sm text-[#5e5a52]">
                Composite score: <strong>{status.customStatus.recommendation.compositeScore}</strong>
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#4a463f]">
                {(status.customStatus.recommendation.rationale || []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {status?.output && (
            <div className="mt-6 rounded-xl bg-[#e8f6f3] p-4">
              <h2 className="text-xl font-semibold">Final case outcome</h2>
              <pre className="mt-3 overflow-auto rounded-lg bg-white p-3 text-xs">{JSON.stringify(status.output, null, 2)}</pre>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-[#9a3412]">{error}</p>}
        </section>

        <aside className="rounded-2xl border border-[#d8cfbc] bg-[#f8f4ea]/90 p-6">
          <h2 className="text-2xl font-semibold">Underwriter desk</h2>
          <p className="mt-2 text-sm text-[#5e5a52]">
            Approval controls unlock when the durable orchestration reaches the waiting state.
          </p>

          <textarea
            className="mt-4 h-36 w-full rounded-lg border border-[#c9bfa8] bg-white p-3 text-sm"
            placeholder="Optional underwriter notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              disabled={!awaitingApproval || submitting}
              onClick={() => decide("approve")}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={!awaitingApproval || submitting}
              onClick={() => decide("reject")}
              className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reject
            </button>
          </div>

          <p className="mt-4 text-xs text-[#5e5a52]">
            {awaitingApproval
              ? "Workflow is paused and waiting for your decision."
              : "Workflow has not yet reached approval stage or is already completed."}
          </p>
        </aside>
      </div>
    </main>
  );
}
