export type IntakePayload = {
  applicantName: string;
  age: number;
  requestedCoverage: number;
  annualIncome: number;
  smoker: boolean;
  priorClaims: number;
  region: string;
  productType: "term_life" | "whole_life" | "universal_life";
  policyTermYears: 10 | 15 | 20 | 25 | 30;
  occupationClass: "low" | "medium" | "high";
  creditBand: "excellent" | "good" | "fair" | "poor";
  debtToIncomeRatio: number;
  bmi?: number;
  hasChronicCondition?: boolean;
};

export type CaseStatus = {
  instanceId: string;
  runtimeStatus: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  input?: Record<string, unknown> | string;
  customStatus?: {
    phase?: string;
    progress?: number;
    message?: string;
    steps?: { name: string; status: string }[];
    recommendation?: {
      backendRecommendation?: string;
      compositeScore?: number;
      rationale?: string[];
      recommendedPremiumFactor?: number;
      pricingRecommendation?: {
        suggestedAnnualPremium?: number | null;
        riskLoadPct?: number;
        discountsPct?: number;
        baseRatePerThousand?: number;
      };
    };
    finalDecision?: Record<string, unknown>;
  };
  output?: Record<string, unknown>;
};

export type PendingCase = {
  instanceId: string;
  runtimeStatus: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  applicantName?: string;
  recommendation?: {
    backendRecommendation?: string;
    compositeScore?: number;
  };
};

export type CaseChatResponse = {
  instanceId: string;
  answer: string;
  groundedFields?: string[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:7071/api";

export async function startCase(payload: IntakePayload): Promise<{ instanceId: string }> {
  const response = await fetch(`${API_BASE}/orchestrators/policy-screening`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Unable to start case: ${response.status}`);
  }

  const data = await response.json();
  const instanceId = data.instanceId || data.id;

  if (!instanceId) {
    throw new Error("Backend did not return an orchestration instance ID.");
  }

  return { instanceId };
}

export async function getCaseStatus(instanceId: string): Promise<CaseStatus> {
  const response = await fetch(`${API_BASE}/cases/${instanceId}/status`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to fetch case status: ${response.status}`);
  }

  return response.json();
}

export async function getPendingCases(): Promise<PendingCase[]> {
  const response = await fetch(`${API_BASE}/cases/pending`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to fetch pending cases: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data.cases) ? data.cases : [];
}

export async function submitDecision(instanceId: string, decision: "approve" | "reject", notes: string): Promise<void> {
  const response = await fetch(`${API_BASE}/cases/${instanceId}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, notes, underwriter: "Senior Underwriter" })
  });

  if (!response.ok) {
    throw new Error(`Unable to submit decision: ${response.status}`);
  }
}

export async function askCaseQuestion(instanceId: string, question: string): Promise<CaseChatResponse> {
  const response = await fetch(`${API_BASE}/cases/${instanceId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });

  if (!response.ok) {
    let detail = `Unable to ask question: ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error) {
        detail = errorBody.error;
      }
    } catch {
      // ignore json parse errors for non-json error responses
    }
    throw new Error(detail);
  }

  return response.json();
}
