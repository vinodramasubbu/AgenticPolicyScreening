import json
import os
from datetime import datetime, timezone
from typing import Any, Dict

import azure.durable_functions as df
import azure.functions as func
from azure.identity.aio import DefaultAzureCredential
from agent_framework.azure import AzureAIClient
from dotenv import load_dotenv

load_dotenv(override=False)

app = df.DFApp(http_auth_level=func.AuthLevel.ANONYMOUS)

ALLOWED_STATE_CODES = {"MA", "ME", "NH", "NY", "NJ", "DE", "MD", "VA", "NV", "SC", "GA", "FL"}
ALLOWED_PRODUCT_TYPES = {"term_life", "whole_life", "universal_life"}
ALLOWED_OCCUPATION_CLASSES = {"low", "medium", "high"}
ALLOWED_CREDIT_BANDS = {"excellent", "good", "fair", "poor"}


def _parse_maybe_json(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_policy_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(payload)
    normalized["region"] = str(payload.get("region", "")).strip().upper()
    normalized["productType"] = str(payload.get("productType", "")).strip().lower()
    normalized["occupationClass"] = str(payload.get("occupationClass", "")).strip().lower()
    normalized["creditBand"] = str(payload.get("creditBand", "")).strip().lower()
    normalized["hasChronicCondition"] = bool(payload.get("hasChronicCondition", False))
    return normalized


def _validate_policy_payload(payload: Dict[str, Any]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    required_fields = [
        "applicantName",
        "age",
        "requestedCoverage",
        "annualIncome",
        "smoker",
        "priorClaims",
        "region",
        "productType",
        "policyTermYears",
        "occupationClass",
        "creditBand",
        "debtToIncomeRatio",
    ]
    missing = [field for field in required_fields if field not in payload or payload.get(field) in {None, ""}]
    if missing:
        errors.append(f"Missing required fields: {', '.join(missing)}")
        return errors, warnings

    age = _to_int(payload.get("age"))
    prior_claims = _to_int(payload.get("priorClaims"))
    policy_term = _to_int(payload.get("policyTermYears"))
    requested_coverage = _to_float(payload.get("requestedCoverage"))
    annual_income = _to_float(payload.get("annualIncome"))
    bmi = _to_float(payload.get("bmi")) if payload.get("bmi") not in {None, ""} else None
    dti = _to_float(payload.get("debtToIncomeRatio"))

    if age is None or age < 18 or age > 85:
        errors.append("age must be between 18 and 85")
    if prior_claims is None or prior_claims < 0 or prior_claims > 30:
        errors.append("priorClaims must be between 0 and 30")
    if policy_term is None or policy_term not in {10, 15, 20, 25, 30}:
        errors.append("policyTermYears must be one of 10, 15, 20, 25, 30")
    if requested_coverage is None or requested_coverage < 50000 or requested_coverage > 5000000:
        errors.append("requestedCoverage must be between 50000 and 5000000")
    if annual_income is None or annual_income < 10000:
        errors.append("annualIncome must be at least 10000")
    if dti is None or dti < 0 or dti > 1:
        errors.append("debtToIncomeRatio must be between 0 and 1")

    region = str(payload.get("region", "")).strip().upper()
    if region not in ALLOWED_STATE_CODES:
        errors.append(f"region must be one of: {', '.join(sorted(ALLOWED_STATE_CODES))}")

    product_type = str(payload.get("productType", "")).strip().lower()
    if product_type not in ALLOWED_PRODUCT_TYPES:
        errors.append("productType must be one of: term_life, whole_life, universal_life")

    occupation_class = str(payload.get("occupationClass", "")).strip().lower()
    if occupation_class not in ALLOWED_OCCUPATION_CLASSES:
        errors.append("occupationClass must be one of: low, medium, high")

    credit_band = str(payload.get("creditBand", "")).strip().lower()
    if credit_band not in ALLOWED_CREDIT_BANDS:
        errors.append("creditBand must be one of: excellent, good, fair, poor")

    if bmi is not None and (bmi < 15 or bmi > 60):
        errors.append("bmi must be between 15 and 60 when provided")

    if annual_income and requested_coverage and annual_income > 0:
        coverage_multiple = requested_coverage / annual_income
        if coverage_multiple > 12:
            warnings.append("coverage_to_income_multiple_above_12")

    return errors, warnings


@app.route(route="orchestrators/policy-screening", methods=["POST"])
@app.durable_client_input(client_name="client")
async def start_policy_screening(req: func.HttpRequest, client: df.DurableOrchestrationClient):
    try:
        payload = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Request body must be valid JSON."}),
            status_code=400,
            mimetype="application/json",
        )

    payload = _normalize_policy_payload(payload)
    errors, warnings = _validate_policy_payload(payload)
    if errors:
        return func.HttpResponse(
            json.dumps({"error": "Validation failed.", "validationErrors": errors}),
            status_code=400,
            mimetype="application/json",
        )

    payload["submittedAtUtc"] = datetime.now(timezone.utc).isoformat()
    payload["validationWarnings"] = warnings
    instance_id = await client.start_new("PolicyScreeningOrchestrator", client_input=payload)

    return client.create_check_status_response(req, instance_id)


@app.route(route="cases/pending", methods=["GET"])
@app.durable_client_input(client_name="client")
async def get_pending_cases(req: func.HttpRequest, client: df.DurableOrchestrationClient):
    try:
        statuses = await client.get_status_all()
    except TypeError:
        statuses = await client.get_status_all(None, None, None, False)

    pending_cases = []
    for status in statuses or []:
        custom_status = _parse_maybe_json(status.custom_status)
        input_payload = _parse_maybe_json(status.input_)

        if not isinstance(custom_status, dict):
            continue

        phase = custom_status.get("phase")
        runtime = status.runtime_status.name if status.runtime_status else "Unknown"
        if phase != "awaiting_underwriter_approval" or runtime not in {"Running", "Pending"}:
            continue

        recommendation = custom_status.get("recommendation") or {}
        if not isinstance(recommendation, dict):
            recommendation = {}

        applicant_name = None
        if isinstance(input_payload, dict):
            applicant_name = input_payload.get("applicantName")

        pending_cases.append(
            {
                "instanceId": status.instance_id,
                "runtimeStatus": runtime,
                "createdTime": status.created_time.isoformat() if status.created_time else None,
                "lastUpdatedTime": status.last_updated_time.isoformat() if status.last_updated_time else None,
                "applicantName": applicant_name,
                "recommendation": {
                    "backendRecommendation": recommendation.get("backendRecommendation"),
                    "compositeScore": recommendation.get("compositeScore"),
                },
            }
        )

    pending_cases.sort(key=lambda x: x.get("lastUpdatedTime") or "", reverse=True)
    return func.HttpResponse(json.dumps({"count": len(pending_cases), "cases": pending_cases}), mimetype="application/json")


@app.route(route="cases/{instance_id}/status", methods=["GET"])
@app.durable_client_input(client_name="client")
async def get_case_status(req: func.HttpRequest, client: df.DurableOrchestrationClient):
    instance_id = req.route_params.get("instance_id")
    if not instance_id:
        return func.HttpResponse(
            json.dumps({"error": "Missing instance id."}),
            status_code=400,
            mimetype="application/json",
        )

    status = await client.get_status(instance_id)
    if status is None:
        return func.HttpResponse(
            json.dumps({"error": "Case not found."}),
            status_code=404,
            mimetype="application/json",
        )

    body = {
        "instanceId": status.instance_id,
        "runtimeStatus": status.runtime_status.name,
        "createdTime": status.created_time.isoformat() if status.created_time else None,
        "lastUpdatedTime": status.last_updated_time.isoformat() if status.last_updated_time else None,
        "input": status.input_,
        "customStatus": status.custom_status,
        "output": status.output,
    }

    return func.HttpResponse(json.dumps(body), mimetype="application/json")


@app.route(route="cases/{instance_id}/decision", methods=["POST"])
@app.durable_client_input(client_name="client")
async def submit_underwriter_decision(req: func.HttpRequest, client: df.DurableOrchestrationClient):
    instance_id = req.route_params.get("instance_id")
    if not instance_id:
        return func.HttpResponse(
            json.dumps({"error": "Missing instance id."}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        decision_payload = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Request body must be valid JSON."}),
            status_code=400,
            mimetype="application/json",
        )

    decision = str(decision_payload.get("decision", "")).strip().lower()
    if decision not in {"approve", "reject"}:
        return func.HttpResponse(
            json.dumps({"error": "decision must be 'approve' or 'reject'."}),
            status_code=400,
            mimetype="application/json",
        )

    status = await client.get_status(instance_id)
    if status is None:
        return func.HttpResponse(
            json.dumps({"error": "Case not found."}),
            status_code=404,
            mimetype="application/json",
        )

    if status.runtime_status.name not in {"Running", "Pending"}:
        return func.HttpResponse(
            json.dumps({"error": f"Case is not active. Current status: {status.runtime_status.name}"}),
            status_code=409,
            mimetype="application/json",
        )

    event_data = {
        "decision": decision,
        "notes": str(decision_payload.get("notes", "")).strip(),
        "underwriter": str(decision_payload.get("underwriter", "Lead Underwriter")).strip() or "Lead Underwriter",
        "timestampUtc": datetime.now(timezone.utc).isoformat(),
    }

    await client.raise_event(instance_id, "UnderwriterDecision", event_data)

    return func.HttpResponse(
        json.dumps(
            {
                "message": "Decision submitted. Case state will update shortly.",
                "instanceId": instance_id,
            }
        ),
        status_code=202,
        mimetype="application/json",
    )


@app.route(route="cases/{instance_id}/chat", methods=["POST"])
@app.durable_client_input(client_name="client")
async def chat_case_recommendation(req: func.HttpRequest, client: df.DurableOrchestrationClient):
    instance_id = req.route_params.get("instance_id")
    if not instance_id:
        return func.HttpResponse(
            json.dumps({"error": "Missing instance id."}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Request body must be valid JSON."}),
            status_code=400,
            mimetype="application/json",
        )

    question = str(body.get("question", "")).strip()
    if not question:
        return func.HttpResponse(
            json.dumps({"error": "question is required."}),
            status_code=400,
            mimetype="application/json",
        )

    status = await client.get_status(instance_id)
    if status is None:
        return func.HttpResponse(
            json.dumps({"error": "Case not found."}),
            status_code=404,
            mimetype="application/json",
        )

    input_payload = _parse_maybe_json(status.input_)
    custom_status = _parse_maybe_json(status.custom_status)
    output_payload = _parse_maybe_json(status.output)

    if not isinstance(input_payload, dict):
        input_payload = {}
    if not isinstance(custom_status, dict):
        custom_status = {}
    if not isinstance(output_payload, dict):
        output_payload = {}

    recommendation = custom_status.get("recommendation")
    if not isinstance(recommendation, dict):
        recommendation = {}

    if not recommendation and isinstance(output_payload, dict):
        recommendation = {
            "backendRecommendation": output_payload.get("backendRecommendation"),
            "compositeScore": output_payload.get("compositeScore"),
            "recommendedPremiumFactor": output_payload.get("recommendedPremiumFactor"),
            "pricingRecommendation": output_payload.get("pricingRecommendation"),
        }

    if not recommendation.get("backendRecommendation"):
        return func.HttpResponse(
            json.dumps(
                {
                    "error": "Recommendation is not available yet for this case.",
                    "instanceId": instance_id,
                    "runtimeStatus": status.runtime_status.name if status.runtime_status else "Unknown",
                }
            ),
            status_code=409,
            mimetype="application/json",
        )

    case_context = {
        "instanceId": status.instance_id,
        "runtimeStatus": status.runtime_status.name if status.runtime_status else "Unknown",
        "phase": custom_status.get("phase"),
        "policyInput": input_payload,
        "recommendation": recommendation,
        "finalOutput": output_payload,
    }

    credential = DefaultAzureCredential()
    try:
        async with AzureAIClient(
            project_endpoint=os.getenv("FOUNDRY_PROJECT_ENDPOINT"),
            model_deployment_name=os.getenv("FOUNDRY_MODEL_DEPLOYMENT_NAME"),
            credential=credential,
        ).as_agent(
            name="UnderwriterQnAAgent",
            instructions="""You are an underwriting assistant.
Only answer from the provided case context.
Do not invent facts or use external assumptions.
If information is missing in the context, explicitly say what is missing.
Keep responses concise and practical for underwriters.""",
        ) as agent:
            prompt = (
                "Case context (JSON):\n"
                f"{json.dumps(case_context, default=str)}\n\n"
                f"Question: {question}\n\n"
                "Answer in plain language and reference the exact context values used."
            )
            response = await agent.run(prompt)
            answer = response.final_response if hasattr(response, "final_response") else str(response)
    except Exception:
        answer = (
            "I could not reach the AI model right now. "
            "Based on available case data, review recommendation, composite score, and pricing recommendation fields in the case context."
        )

    return func.HttpResponse(
        json.dumps(
            {
                "instanceId": instance_id,
                "answer": answer,
                "groundedFields": [
                    "policyInput",
                    "recommendation.backendRecommendation",
                    "recommendation.compositeScore",
                    "recommendation.pricingRecommendation",
                    "runtimeStatus",
                    "phase",
                ],
            }
        ),
        mimetype="application/json",
    )


@app.orchestration_trigger(context_name="context")
def PolicyScreeningOrchestrator(context: df.DurableOrchestrationContext):
    policy = context.get_input()

    context.set_custom_status(
        {
            "phase": "screening",
            "progress": 10,
            "message": "Running multi-agent screening activities.",
            "steps": [
                {"name": "Risk assessment", "status": "running"},
                {"name": "Fraud check", "status": "running"},
                {"name": "Medical review", "status": "running"},
                {"name": "Compliance check", "status": "running"},
            ],
        }
    )

    screening_tasks = [
        context.call_activity("RiskAssessmentActivity", policy),
        context.call_activity("FraudCheckActivity", policy),
        context.call_activity("MedicalReviewActivity", policy),
        context.call_activity("ComplianceCheckActivity", policy),
    ]

    risk_result, fraud_result, medical_result, compliance_result = yield context.task_all(screening_tasks)

    context.set_custom_status(
        {
            "phase": "aggregating",
            "progress": 70,
            "message": "Aggregating screening outputs into recommendation.",
            "steps": [
                {"name": "Risk assessment", "status": "completed"},
                {"name": "Fraud check", "status": "completed"},
                {"name": "Medical review", "status": "completed"},
                {"name": "Compliance check", "status": "completed"},
            ],
            "screening": {
                "risk": risk_result,
                "fraud": fraud_result,
                "medical": medical_result,
                "compliance": compliance_result,
            },
        }
    )

    recommendation = yield context.call_activity(
        "AggregateRecommendationActivity",
        {
            "policy": policy,
            "risk": risk_result,
            "fraud": fraud_result,
            "medical": medical_result,
            "compliance": compliance_result,
        },
    )

    context.set_custom_status(
        {
            "phase": "awaiting_underwriter_approval",
            "progress": 90,
            "message": "Awaiting underwriter decision.",
            "recommendation": recommendation,
        }
    )

    underwriter_decision = yield context.wait_for_external_event("UnderwriterDecision")

    final_result = yield context.call_activity(
        "FinalizeCaseActivity",
        {
            "policy": policy,
            "recommendation": recommendation,
            "underwriterDecision": underwriter_decision,
        },
    )

    context.set_custom_status(
        {
            "phase": "completed",
            "progress": 100,
            "message": "Case completed.",
            "finalDecision": final_result,
        }
    )

    return final_result


@app.activity_trigger(input_name="policy")
async def RiskAssessmentActivity(policy: Dict[str, Any]):
    """
    Risk Assessment agent evaluates policy risk based on age, coverage, income, and claims history.
    Uses Foundry model for intelligent assessment.
    """
    credential = DefaultAzureCredential()
    async with AzureAIClient(
        project_endpoint=os.getenv("FOUNDRY_PROJECT_ENDPOINT"),
        model_deployment_name=os.getenv("FOUNDRY_MODEL_DEPLOYMENT_NAME"),
        credential=credential,
    ).as_agent(
        name="RiskAssessmentAgent",
        instructions="""You are an insurance underwriting risk assessment agent. 
Analyze the policy details provided and assess the overall risk level.
Consider: applicant age, requested coverage amount vs annual income, and prior claims history.
Respond with a JSON object containing: riskScore (0-100), riskBand (low/medium/high), and a brief summary.""",
    ) as agent:
        prompt = f"""Evaluate this insurance policy for risk:
- Applicant Age: {policy.get('age')}
- Requested Coverage: ${policy.get('requestedCoverage'):,}
- Annual Income: ${policy.get('annualIncome'):,}
- Prior Claims: {policy.get('priorClaims')}

Provide risk assessment as JSON."""
        response = await agent.run(prompt)
        assessment_text = response.final_response if hasattr(response, "final_response") else str(response)
        
        try:
            if "```json" in assessment_text:
                json_str = assessment_text.split("```json")[1].split("```")[0].strip()
            elif "{" in assessment_text:
                json_str = assessment_text[assessment_text.index("{"):assessment_text.rindex("}")+1]
            else:
                json_str = assessment_text
            assessment = json.loads(json_str)
        except (json.JSONDecodeError, ValueError):
            score = 50 + min(int(policy.get("priorClaims", 0)) * 10, 30)
            band = "low" if score < 55 else "medium" if score < 75 else "high"
            assessment = {"riskScore": score, "riskBand": band, "summary": f"Risk band is {band}"}
    
    return {
        "agent": "RiskAssessmentAgent",
        "riskScore": assessment.get("riskScore", 50),
        "riskBand": assessment.get("riskBand", "medium"),
        "summary": assessment.get("summary", "Risk assessment completed."),
    }


@app.activity_trigger(input_name="policy")
async def FraudCheckActivity(policy: Dict[str, Any]):
    """
    Fraud Detection agent identifies suspicious patterns and risk indicators.
    Uses Foundry model for intelligent fraud screening.
    """
    credential = DefaultAzureCredential()
    async with AzureAIClient(
        project_endpoint=os.getenv("FOUNDRY_PROJECT_ENDPOINT"),
        model_deployment_name=os.getenv("FOUNDRY_MODEL_DEPLOYMENT_NAME"),
        credential=credential,
    ).as_agent(
        name="FraudCheckAgent",
        instructions="""You are an insurance fraud detection agent. 
Analyze the policy application for fraud indicators and suspicious patterns.
Consider: claim frequency, unusual coverage requests, geographic anomalies, applicant consistency.
Respond with a JSON object containing: flags (list of risk indicators), flagCount, and summary.""",
    ) as agent:
        prompt = f"""Screen this insurance application for fraud:
- Applicant: {policy.get('applicantName')}
- Prior Claims: {policy.get('priorClaims')}
- Region: {policy.get('region')}
- Coverage Requested: ${policy.get('requestedCoverage'):,}
- Income Level: ${policy.get('annualIncome'):,}

Identify any fraud indicators as JSON (flags list, count, summary)."""
        response = await agent.run(prompt)
        assessment_text = response.final_response if hasattr(response, "final_response") else str(response)
        
        try:
            if "```json" in assessment_text:
                json_str = assessment_text.split("```json")[1].split("```")[0].strip()
            elif "{" in assessment_text:
                json_str = assessment_text[assessment_text.index("{"):assessment_text.rindex("}")+1]
            else:
                json_str = assessment_text
            assessment = json.loads(json_str)
        except (json.JSONDecodeError, ValueError):
            flags = ["high_claim_frequency"] if int(policy.get("priorClaims", 0)) >= 4 else []
            assessment = {"flags": flags, "flagCount": len(flags), "summary": "Fraud screening completed."}
    
    return {
        "agent": "FraudCheckAgent",
        "flags": assessment.get("flags", []),
        "flagCount": assessment.get("flagCount", 0),
        "summary": assessment.get("summary", "No major fraud indicators."),
    }


@app.activity_trigger(input_name="policy")
async def MedicalReviewActivity(policy: Dict[str, Any]):
    """
    Medical Review agent evaluates health factors and risk profiling.
    Uses Foundry model for intelligent medical assessment.
    """
    credential = DefaultAzureCredential()
    async with AzureAIClient(
        project_endpoint=os.getenv("FOUNDRY_PROJECT_ENDPOINT"),
        model_deployment_name=os.getenv("FOUNDRY_MODEL_DEPLOYMENT_NAME"),
        credential=credential,
    ).as_agent(
        name="MedicalReviewAgent",
        instructions="""You are an insurance medical underwriting agent. 
Assess the health profile and medical risk factors.
Consider: applicant age, smoking status, coverage type, and typical health risk patterns for age group.
Respond with a JSON object containing: medicalScore (0-100), medicalBand (standard/elevated), and summary.""",
    ) as agent:
        prompt = f"""Evaluate the medical profile for this insurance applicant:
- Age: {policy.get('age')}
- Smoker: {policy.get('smoker')}
- Coverage Type: Life Insurance
- Requested Coverage: ${policy.get('requestedCoverage'):,}

Provide medical assessment as JSON with score, band, and summary."""
        response = await agent.run(prompt)
        assessment_text = response.final_response if hasattr(response, "final_response") else str(response)
        
        try:
            if "```json" in assessment_text:
                json_str = assessment_text.split("```json")[1].split("```")[0].strip()
            elif "{" in assessment_text:
                json_str = assessment_text[assessment_text.index("{"):assessment_text.rindex("}")+1]
            else:
                json_str = assessment_text
            assessment = json.loads(json_str)
        except (json.JSONDecodeError, ValueError):
            medical_score = 30 + (20 if policy.get("smoker") else 0) + (10 if int(policy.get("age", 0)) > 55 else 0)
            band = "standard" if medical_score < 45 else "elevated"
            assessment = {"medicalScore": medical_score, "medicalBand": band, "summary": f"Medical profile is {band}."}
    
    return {
        "agent": "MedicalReviewAgent",
        "medicalScore": assessment.get("medicalScore", 30),
        "medicalBand": assessment.get("medicalBand", "standard"),
        "summary": assessment.get("summary", "Medical review completed."),
    }


@app.activity_trigger(input_name="policy")
async def ComplianceCheckActivity(policy: Dict[str, Any]):
    """
    Compliance agent verifies regulatory requirements and jurisdiction eligibility.
    Uses Foundry model for intelligent compliance evaluation.
    """
    credential = DefaultAzureCredential()
    async with AzureAIClient(
        project_endpoint=os.getenv("FOUNDRY_PROJECT_ENDPOINT"),
        model_deployment_name=os.getenv("FOUNDRY_MODEL_DEPLOYMENT_NAME"),
        credential=credential,
    ).as_agent(
        name="ComplianceAgent",
        instructions="""You are an insurance compliance and regulatory agent. 
Verify jurisdiction eligibility and compliance requirements.
Consider: regional regulatory frameworks and the only approved state codes (MA, ME, NH, NY, NJ, DE, MD, VA, NV, SC, GA, FL).
Respond with a JSON object containing: compliant (boolean), and summary.""",
    ) as agent:
        prompt = f"""Check compliance status for this insurance policy:
- Applicant Region: {policy.get('region')}
- Coverage Amount: ${policy.get('requestedCoverage'):,}
- Approved State Codes: MA, ME, NH, NY, NJ, DE, MD, VA, NV, SC, GA, FL

Assess regulatory compliance as JSON."""
        response = await agent.run(prompt)
        assessment_text = response.final_response if hasattr(response, "final_response") else str(response)
        
        try:
            if "```json" in assessment_text:
                json_str = assessment_text.split("```json")[1].split("```")[0].strip()
            elif "{" in assessment_text:
                json_str = assessment_text[assessment_text.index("{"):assessment_text.rindex("}")+1]
            else:
                json_str = assessment_text
            assessment = json.loads(json_str)
        except (json.JSONDecodeError, ValueError):
            allowed_regions = {"MA", "ME", "NH", "NY", "NJ", "DE", "MD", "VA", "NV", "SC", "GA", "FL"}
            region = str(policy.get("region", "")).strip().upper()
            compliant = region in allowed_regions
            assessment = {"compliant": compliant, "summary": "State compliance check passed." if compliant else "State code is not in approved underwriting jurisdictions."}
    
    return {
        "agent": "ComplianceAgent",
        "compliant": assessment.get("compliant", True),
        "summary": assessment.get("summary", "Compliance check completed."),
    }


@app.activity_trigger(input_name="payload")
async def AggregateRecommendationActivity(payload: Dict[str, Any]):
    """
    Decision Aggregation agent synthesizes all screening results into an underwriting recommendation.
    Uses Foundry model for intelligent multi-factor decision-making.
    """
    risk = payload["risk"]
    fraud = payload["fraud"]
    medical = payload["medical"]
    compliance = payload["compliance"]
    policy = payload["policy"]
    
    credential = DefaultAzureCredential()
    async with AzureAIClient(
        project_endpoint=os.getenv("FOUNDRY_PROJECT_ENDPOINT"),
        model_deployment_name=os.getenv("FOUNDRY_MODEL_DEPLOYMENT_NAME"),
        credential=credential,
    ).as_agent(
        name="DecisionAggregationAgent",
        instructions="""You are an insurance underwriting decision aggregation agent. 
Synthesize all screening assessments (risk, fraud, medical, compliance) into a final underwriting recommendation.
The recommendation must be one of: approve, manual_review, or decline.
Respond with a JSON object containing:
- backendRecommendation
- compositeScore (0-100)
- rationale (list)
- recommendedPremiumFactor
- pricingRecommendation { suggestedAnnualPremium, riskLoadPct, discountsPct, baseRatePerThousand }""",
    ) as agent:
        screening_summary = f"""Aggregate the following screening assessments into an underwriting decision:

RISK ASSESSMENT:
- Risk Band: {risk.get('riskBand')}
- Risk Score: {risk.get('riskScore')}
- Summary: {risk.get('summary')}

FRAUD CHECK:
- Flags Found: {fraud.get('flagCount')}
- Flags: {', '.join(fraud.get('flags', [])) if fraud.get('flags') else 'None'}
- Summary: {fraud.get('summary')}

MEDICAL REVIEW:
- Medical Band: {medical.get('medicalBand')}
- Medical Score: {medical.get('medicalScore')}
- Summary: {medical.get('summary')}

COMPLIANCE:
- Compliant: {compliance.get('compliant')}
- Summary: {compliance.get('summary')}

POLICY DETAILS:
- Requested Coverage: ${policy.get('requestedCoverage')}
- Annual Income: ${policy.get('annualIncome')}
- Product Type: {policy.get('productType')}
- Policy Term: {policy.get('policyTermYears')} years
- Occupation Class: {policy.get('occupationClass')}
- Credit Band: {policy.get('creditBand')}
- Debt-to-Income Ratio: {policy.get('debtToIncomeRatio')}
- BMI: {policy.get('bmi')}
- Chronic Condition: {policy.get('hasChronicCondition')}

Synthesize into a recommendation (approve/manual_review/decline) with reasoning."""
        
        response = await agent.run(screening_summary)
        assessment_text = response.final_response if hasattr(response, "final_response") else str(response)
        
        try:
            if "```json" in assessment_text:
                json_str = assessment_text.split("```json")[1].split("```")[0].strip()
            elif "{" in assessment_text:
                json_str = assessment_text[assessment_text.index("{"):assessment_text.rindex("}")+1]
            else:
                json_str = assessment_text
            assessment = json.loads(json_str)
        except (json.JSONDecodeError, ValueError):
            composite_score = (
                float(risk.get("riskScore", 50)) * 0.5
                + float(medical.get("medicalScore", 30)) * 0.3
                + float(fraud.get("flagCount", 0)) * 10
                + (0 if compliance.get("compliant", True) else 30)
            )
            if not compliance.get("compliant", True):
                recommendation = "decline"
            elif composite_score < 55:
                recommendation = "approve"
            elif composite_score < 75:
                recommendation = "manual_review"
            else:
                recommendation = "decline"
            
            assessment = {
                "compositeScore": round(composite_score, 2),
                "backendRecommendation": recommendation,
                "rationale": [risk.get("summary"), fraud.get("summary"), medical.get("summary"), compliance.get("summary")],
                "recommendedPremiumFactor": 1.0 if recommendation == "approve" else 1.25 if recommendation == "manual_review" else 1.75
            }

    requested_coverage = float(policy.get("requestedCoverage", 0) or 0)
    base_rate_per_thousand = 3.2
    risk_load_pct = max(0.0, min((float(assessment.get("compositeScore", 50)) - 40.0) * 0.7, 55.0))
    discounts_pct = 8.0 if str(policy.get("creditBand", "")).lower() in {"excellent", "good"} else 0.0

    if str(assessment.get("backendRecommendation", "manual_review")) == "decline":
        suggested_annual_premium = None
    else:
        base_premium = (requested_coverage / 1000.0) * base_rate_per_thousand
        suggested_annual_premium = round(base_premium * (1 + risk_load_pct / 100.0) * (1 - discounts_pct / 100.0), 2)

    pricing_recommendation = assessment.get("pricingRecommendation")
    if not isinstance(pricing_recommendation, dict):
        pricing_recommendation = {
            "suggestedAnnualPremium": suggested_annual_premium,
            "riskLoadPct": round(risk_load_pct, 2),
            "discountsPct": round(discounts_pct, 2),
            "baseRatePerThousand": base_rate_per_thousand,
        }
    
    return {
        "agent": "DecisionAggregationAgent",
        "compositeScore": assessment.get("compositeScore", 50),
        "backendRecommendation": assessment.get("backendRecommendation", "manual_review"),
        "rationale": assessment.get("rationale", []),
        "recommendedPremiumFactor": assessment.get("recommendedPremiumFactor", 1.0),
        "pricingRecommendation": pricing_recommendation,
    }


@app.activity_trigger(input_name="payload")
def FinalizeCaseActivity(payload: Dict[str, Any]):
    policy = payload.get("policy", {})
    recommendation = payload.get("recommendation", {})
    decision = payload.get("underwriterDecision", {})

    if isinstance(policy, str):
        try:
            policy = json.loads(policy)
        except json.JSONDecodeError:
            policy = {}

    if isinstance(recommendation, str):
        try:
            recommendation = json.loads(recommendation)
        except json.JSONDecodeError:
            recommendation = {}

    if isinstance(decision, str):
        try:
            decision = json.loads(decision)
        except json.JSONDecodeError:
            decision = {"decision": decision}

    decision_value = str(decision.get("decision", "reject")).strip().lower()
    approved = decision_value == "approve"

    return {
        "policyId": f"POL-{abs(hash(policy.get('applicantName', 'anon'))) % 999999:06d}",
        "applicantName": policy.get("applicantName"),
        "underwriter": decision.get("underwriter", "Lead Underwriter"),
        "underwriterDecision": decision_value,
        "underwriterNotes": decision.get("notes", ""),
        "decisionTimestampUtc": decision.get("timestampUtc"),
        "backendRecommendation": recommendation.get("backendRecommendation", "manual_review"),
        "compositeScore": recommendation.get("compositeScore"),
        "recommendedPremiumFactor": recommendation.get("recommendedPremiumFactor"),
        "pricingRecommendation": recommendation.get("pricingRecommendation"),
        "finalStatus": "approved" if approved else "rejected",
    }
