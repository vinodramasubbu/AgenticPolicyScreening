# Backend: Durable Functions + Foundry Agents (Python)

This backend exposes a complete policy screening and underwriter workflow using Durable Functions and AI agents.

## Core Capabilities
- Durable orchestration with DTS state backend
- Realistic intake validation and normalization
- Parallel screening agents (risk, fraud, medical, compliance)
- Aggregated recommendation with pricing recommendation output
- Underwriter decision external-event resume flow
- Case-specific Q&A endpoint for recommendation explanations

## Architecture Diagram
```mermaid
flowchart TD
    S[Start Case API<br/>POST /orchestrators/policy-screening] --> O[PolicyScreeningOrchestrator]
    O --> A1[RiskAssessmentActivity]
    O --> A2[FraudCheckActivity]
    O --> A3[MedicalReviewActivity]
    O --> A4[ComplianceCheckActivity]
    A1 --> AGG[AggregateRecommendationActivity]
    A2 --> AGG
    A3 --> AGG
    A4 --> AGG
    AGG --> WAIT[wait_for_external_event<br/>UnderwriterDecision]
    WAIT --> FIN[FinalizeCaseActivity]
    FIN --> OUT[Final Output]

    Q[Chat API<br/>POST /cases/{id}/chat] --> CS[Load Durable Case Status]
    CS --> QA[UnderwriterQnAAgent]

    O -. persisted state .- DTS[Durable Task Scheduler]
```

## Intake Model and Validation
The intake endpoint validates and normalizes inputs before orchestration starts.

Required fields include:
- applicantName
- age
- requestedCoverage
- annualIncome
- smoker
- priorClaims
- region
- productType
- policyTermYears
- occupationClass
- creditBand
- debtToIncomeRatio

Key constraints:
- Allowed state codes: MA, ME, NH, NY, NJ, DE, MD, VA, NV, SC, GA, FL
- Allowed productType: term_life, whole_life, universal_life
- Allowed occupationClass: low, medium, high
- Allowed creditBand: excellent, good, fair, poor
- age 18-85
- policyTermYears in 10, 15, 20, 25, 30
- requestedCoverage 50,000-5,000,000
- debtToIncomeRatio 0-1

Warnings produced:
- `coverage_to_income_multiple_above_12`

## API Endpoints
- `POST /api/orchestrators/policy-screening`
- `GET /api/cases/pending`
- `GET /api/cases/{instanceId}/status`
- `POST /api/cases/{instanceId}/decision`
- `POST /api/cases/{instanceId}/chat`

## Case Chat Endpoint
`POST /api/cases/{instanceId}/chat` accepts:
```json
{ "question": "Why is this case manual_review?" }
```

Response includes:
- `answer`
- `groundedFields`
- `instanceId`

The answer is grounded on Durable case data (`input`, recommendation, runtime status, phase, output).

## Local Setup
1. Copy settings template and set Foundry values.
```powershell
Copy-Item .env.template local.settings.json
```

2. Run Azurite.
```powershell
docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite
```

3. Run DTS emulator.
```powershell
docker run -p 8080:8080 -p 8082:8082 mcr.microsoft.com/dts/dts-emulator:latest
```

4. Install dependencies and start Functions.
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
func start
```

## Notes
- All screening and recommendation activities are async and use Foundry-backed agents.
- If model output parsing fails, deterministic fallback logic is used.
- DTS dashboard: `http://localhost:8082`
