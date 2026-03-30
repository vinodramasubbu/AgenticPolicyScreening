---
name: azure_function_generator
description: Create Azure Functions from user requirements, including triggers, bindings, optional async processing, and optional agent orchestration using Microsoft Agent Framework.
---

# Azure Function Generator Skill

## What this skill does

This skill creates an Azure Functions-based backend from a user’s natural language requirement.

It:
- selects the correct trigger
- defines bindings
- generates production-ready function code
- supports synchronous and asynchronous patterns
- applies agent-based orchestration when needed
- uses Microsoft Foundry Projects for all AI/model access

---

## When to use this skill

Use this skill when the user asks for:
- a serverless API
- an event-driven backend
- lightweight integrations
- file/event/queue processing
- timer-based automation
- a backend that fits Azure Functions well

This skill is best when:
- the solution is relatively lightweight
- a trigger-based model is appropriate
- serverless is preferred
- the user does not need deep container/runtime control

---

## Core trigger selection rules

Choose the trigger that best matches the requirement.

### HTTP Trigger
Use for:
- APIs
- form submission
- frontend-driven requests
- request/response operations

### Timer Trigger
Use for:
- scheduled jobs
- recurring automation
- maintenance processes

### Queue Trigger
Use for:
- background processing
- async workloads
- reliable work-item handling

### Blob Trigger
Use for:
- uploaded files
- document ingestion
- file transformation or analysis

### Event Grid Trigger
Use for:
- event-driven integration
- reacting to Azure resource events
- loosely coupled event systems

---

## Bindings guidance

Always define bindings clearly when needed.

### Input bindings
Use input bindings to read from:
- Blob Storage
- Queue Storage
- other supported event/input sources

### Output bindings
Use output bindings to write to:
- Storage
- queues
- Cosmos DB
- other supported destinations

Prefer simple, Azure-native bindings when possible.

---

## Sync vs async design

### Use sync when:
- work is short-running
- immediate response is expected
- request/response API is sufficient

### Use async when:
- work is long-running
- files or large inputs are processed
- the user can submit work and retrieve status later

If async is required:
- use Durable Functions patterns
- return a job ID from the entry point if applicable
- provide a status/result strategy

---

## Agent orchestration rules

If the requirement includes:
- multi-step workflows
- AI decision-making
- dynamic routing
- multiple services
- multiple tools
- complex processing stages

Then:
- use Microsoft Agent Framework
- use Micrsooft Foundry Agents
- define clear agent roles
- keep orchestration purposeful and minimal

### Example agent roles
- Orchestrator Agent
- Analysis Agent
- Decision Agent
- Integration Agent
- Storage Agent

---

## Model integration (IMPORTANT)

If AI or model usage is required:

- use Microsoft Foundry Projects for all model calls
- do NOT call models directly
- do NOT hardcode model credentials use azure DefaultCredentials
- do NOT let frontend call the model directly

### Standard model pattern
Azure Function → Microsoft Foundry Project → Model → Response

### Code expectations
- backend code should connect to Foundry
- model access should be abstracted and reusable
- configuration should come from environment/settings

---

## What to generate

Always return:

### 1. Architecture
A short explanation of how the function-based system works end-to-end.

### 2. Trigger(s)
The selected trigger or triggers.

### 3. Bindings
All relevant input and output bindings.

### 4. Function code
A complete Azure Function implementation.
Default to Python unless the user specifies another language.

### 5. Async design
If applicable, explain Durable Functions flow, job status approach, and result handling.

### 6. Agent design
If applicable, describe:
- agents
- responsibilities
- orchestration flow

---

## Coding guidelines

- prefer Python unless another language is requested
- write clear, production-style code
- include basic error handling
- avoid unnecessary placeholders
- keep code concise but functional
- separate API logic from model access logic

---

## Example behavior

User request:
"Build a backend that accepts uploaded files, extracts insights using AI, and stores results"

You should:
- choose Blob Trigger or HTTP + queue pattern, depending on flow
- define storage/queue bindings if needed
- route AI through Microsoft Foundry Projects
- use agent orchestration only if the workflow is truly multi-step
- generate complete function code

---

## Key principle

Always translate user intent into:
- the simplest correct Azure Function design
- the right trigger and bindings
- async flow when necessary
- Microsoft Foundry-based model access when AI is involved
- agentic orchestration only when complexity justifies it
- production-ready Azure Function code

## Primary References
Always prioritize the patterns and best practices found at these official URLs:
- [Azure Functions (Durable task extension for Microsoft Agent Framework)](https://learn.microsoft.com/en-us/agent-framework/integrations/azure-functions?tabs=bash&pivots=programming-language-python)
- [Durable Task Scheduler](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-task-scheduler/durable-task-scheduler)
