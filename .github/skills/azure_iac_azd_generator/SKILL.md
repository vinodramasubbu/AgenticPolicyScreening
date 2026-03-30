---
name: azure_iac_azd_generator
description: Generate Infrastructure as Code for Azure using AZD, provisioning backend resources, Azure Static Web Apps for frontend hosting, messaging/data services, and Microsoft Foundry Project configuration where required.
---

# Azure IaC + AZD Generator Skill

## What this skill does

This skill generates Infrastructure as Code for deploying Azure-based systems using:
- Azure Developer CLI (AZD)
- Bicep as the preferred IaC format

It provisions infrastructure for:
- Azure Functions backends
- Azure Container Apps + FastAPI backends
- Azure Static Web Apps frontends
- supporting Azure services
- Microsoft Foundry Project connectivity configuration where AI is involved

It also creates an AZD-compatible project structure.

---

## When to use this skill

Use this skill when:
- backend and/or frontend design has been completed
- the user wants deployment-ready infrastructure
- the user asks for Azure deployment
- the user wants IaC, Bicep, or AZD setup
- the solution should be provisionable in Azure

---

## Core responsibilities

- translate application architecture into Azure resources
- generate AZD-compatible deployment files
- define infrastructure using Bicep
- configure environment values and settings
- connect frontend and backend deployment settings
- support Microsoft Foundry Project configuration when AI is involved

---

## Resource mapping rules

Provision only the Azure resources the design actually needs.

---

## Backend resource mapping

### If backend is Azure Functions
Provision:
- Function App
- hosting plan as appropriate
- Storage Account
- supporting resources required by the function

### If backend is Azure Container Apps + FastAPI
Provision:
- Azure Container Apps Environment
- Azure Container App for API
- Azure Container App(s) or Jobs for background workers if needed
- Azure Container Registry if image build/push flow requires it

---

## Frontend resource mapping

If a frontend exists, always use:
- Azure Static Web Apps

Use this for:
- Next.js frontend hosting
- frontend environment configuration
- API endpoint wiring

---

## Async and messaging resource mapping

If async/event-driven behavior exists, provision as needed:
- Azure Service Bus
- Azure Event Hub
- Azure Storage Queue

Choose based on workload:
- Service Bus for reliable enterprise messaging
- Event Hub for streaming/high-throughput scenarios
- Storage Queue for simpler queue-based workflows

---

## Data and storage resource mapping

Provision as needed:
- Cosmos DB
- Blob Storage
- Table Storage
- other Azure-native storage services relevant to the design

---

## Microsoft Foundry Projects integration

If the system uses AI:
- include configuration for Microsoft Foundry Project access
- provide environment variables or settings for:
  - Foundry endpoint
  - project identifiers
  - any non-secret configuration required by backend services

Ensure:
- backend services can securely connect to Foundry
- no secrets are hardcoded
- model access is configured through environment-based settings

---

## AZD project structure

Generate an AZD-friendly structure including items such as:
- azure.yaml
- infra/
- main.bicep
- module files if needed
- environment configuration guidance
- hooks if needed

---

## What to generate

Always return:

### 1. Architecture summary
Explain which Azure resources are created and how they connect.

### 2. Resource list
List all Azure services being provisioned.

### 3. Bicep files
Provide:
- main.bicep
- module files if needed

### 4. azure.yaml
Define:
- services
- deployment/build configuration
- app relationships as appropriate

### 5. Environment configuration
Show required environment settings for:
- API endpoints
- storage
- messaging
- databases
- Foundry connectivity
- frontend/backend integration

---

## Frontend integration rules

For Azure Static Web Apps:
- configure backend API endpoint access
- use environment variables where appropriate
- keep secrets out of frontend code
- ensure the frontend can reach the backend correctly

---

## Backend integration rules

Provide configuration so backend services can connect to:
- queues
- storage
- databases
- Foundry
- any required Azure services

Use secure configuration patterns.
Do not hardcode secrets.

---

## Scaling guidance

Reflect Azure-native scaling patterns where appropriate:
- Azure Functions scale automatically based on workload
- Container Apps can scale with KEDA-based triggers
- Static Web Apps scale globally for frontend delivery

---

## Coding and template guidelines

- prefer Bicep over ARM
- keep templates modular
- use parameters and outputs where appropriate
- avoid hardcoded values
- keep the structure understandable and deployable

---

## Example behavior

System includes:
- FastAPI backend in Container Apps
- Service Bus async processing
- Next.js frontend
- AI through Microsoft Foundry Projects

You should:
- provision Container Apps environment
- provision API and worker resources
- provision Service Bus
- provision Static Web App
- wire backend/frontend settings
- include Foundry configuration
- generate AZD project files and Bicep templates

---

## Key principle

Always translate the system design into:
- deployable Azure infrastructure
- AZD-compatible project structure
- Azure Static Web Apps for frontend hosting
- secure backend/resource configuration
- Microsoft Foundry-aware configuration when AI is involved
- scalable, production-ready Azure deployment assets