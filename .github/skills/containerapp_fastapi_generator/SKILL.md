---
name: containerapp_fastapi_generator
description: Create backend services using Azure Container Apps with FastAPI, supporting REST APIs, async workers, event-driven processing, and optional agent orchestration using Microsoft Agent Framework.
---

# Azure Container App + FastAPI Generator Skill

## What this skill does

This skill creates a container-based backend system using:
- Azure Container Apps
- FastAPI for REST APIs
- optional async/background workers
- optional agent-based orchestration
- Microsoft Foundry Projects for model access

It:
- designs container-based architecture
- generates FastAPI code
- defines API endpoints
- supports async processing with messaging/event services
- supports background workers and jobs
- applies agentic workflows when needed

---

## When to use this skill

Use this skill when:
- the user prefers containers over Functions
- the solution needs long-running execution
- the backend needs custom dependencies or stronger runtime control
- the system should use FastAPI
- the solution includes background workers
- the system includes microservice-like patterns
- async processing should run via worker-style services or jobs in Container Apps

---

## Core architecture patterns

### 1. Synchronous API
Use:
- FastAPI in Azure Container Apps

Flow:
Client → FastAPI API → Response

Use this for:
- standard REST APIs
- request/response flows
- user-driven operations with immediate results

---

### 2. Asynchronous processing
Use async design when the requirement includes:
- long-running jobs
- background processing
- decoupled workflows
- large file or document processing
- status polling patterns
- Durable Task SDK

Possible async infrastructure:
- Azure Service Bus
- Azure Event Hub
- Azure Storage Queue

Flow:
Client → FastAPI API → message/event → worker → result

---

### 3. Background workers and jobs
For async workloads:
- run background worker containers or job-style processing in Azure Container Apps
- poll or consume from:
  - Service Bus
  - Event Hub
  - Storage Queue

Workers should:
- process messages
- call internal services or AI/model layers
- store or publish results
- update job state if needed

---

## API design rules

Design REST APIs clearly.

Prefer patterns such as:
- POST /submit
- GET /status/{job_id}
- GET /result/{job_id}
- POST /analyze
- GET /health

Use clean request and response models.

---

## Agent orchestration rules

If the requirement includes:
- multi-step workflows
- AI reasoning
- dynamic decisions
- multiple tools or services
- complex pipelines

Then:
- use Microsoft Agent Framework
- use Semantic Kernel or Foundry Agents
- define clear roles for each agent
- ensure the API layer and orchestration layer are separated appropriately

### Possible agent roles
- API Agent
- Orchestrator Agent
- Analysis Agent
- Decision Agent
- Integration Agent
- Storage Agent

### Execution model
- FastAPI acts as entry point
- orchestrator coordinates the workflow when needed
- worker services may execute agent-driven steps asynchronously

---

## Model integration (IMPORTANT)

If AI or model usage is required:

- use Microsoft Foundry Projects as the model provider
- do NOT directly call raw model APIs
- do NOT hardcode model credentials
- do NOT allow frontend to call the model directly

### Standard model pattern
FastAPI / Worker → Microsoft Foundry Project → Model → Response

### Agent systems
- all agents must use Foundry for inference
- Foundry acts as the centralized model layer

---

## What to generate

Always return:

### 1. Architecture
Explain the components and flow.

### 2. API design
List:
- routes
- methods
- request models
- response models

### 3. FastAPI code
Provide:
- main app
- routes
- Pydantic models
- service logic
- async handling where appropriate

### 4. Background worker code
If async applies, provide:
- polling or consumption logic
- job handling flow
- result handling

### 5. Agent design
If applicable, describe:
- agents
- responsibilities
- orchestration flow

### 6. Infrastructure overview
Explain:
- Container Apps setup
- scaling behavior
- worker/API separation
- queue/event integration if used

---

## Coding guidelines

- use FastAPI best practices
- use async/await where appropriate
- use Pydantic for validation
- keep code modular
- include basic error handling
- keep model access separate and reusable
- avoid unnecessary complexity

---

## Example behavior

User request:
"Create an API that processes large documents, uses AI to extract insights, and returns results later"

You should:
- use FastAPI for API layer
- use Service Bus or another suitable async mechanism
- create worker logic in Container Apps
- route model calls through Microsoft Foundry Projects
- use agent orchestration only if the workflow is clearly multi-step
- return a job ID and status/result endpoints

---

## Key principle

Always translate requirements into:
- a scalable container-based backend
- clear REST API design
- async processing when needed
- Microsoft Foundry-based model access when AI is involved
- agent-driven orchestration when complexity requires it
- production-ready FastAPI implementation on Azure Container Apps


# Primary References
Always prioritize the patterns and best practices found at these official URLs:
- [Create an app with Durable Task SDKs and Durable Task Scheduler](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-task-scheduler/quickstart-portable-durable-task-sdks?tabs=windows&pivots=python)
- [Durable task extension for micrsooft agent framework](https://github.com/Azure-Samples/durable-task-extension-for-agent-framework/tree/main/samples/python/azure-container-apps/agentic-travel-planner/api)
- [Durable Task Scheduler](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-task-scheduler/durable-task-scheduler)
- [Host a Durable Task SDK app on Azure Container Apps](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-task-scheduler/quickstart-container-apps-durable-task-sdk?pivots=python)
- [Task hubs - Durable Task SDK](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-task-hubs?tabs=csharp%2Cportal&pivots=durable-task-sdks)