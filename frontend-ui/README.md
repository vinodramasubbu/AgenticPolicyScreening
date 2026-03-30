# Frontend: Insurance Underwriting Console (Next.js)

This frontend provides a practical underwriting experience for the Durable backend.

## Screens
- `/` Intake form with user-friendly questions
	- technical fields are computed in UI before API submit
	- uses wider desktop layout to reduce scrolling
- `/underwriter` Pending Decisions queue
	- list of all pending cases
	- recommendation and pricing context
	- full input context for selected case
	- approve/reject actions
	- built-in AI chat to ask questions about recommendation
- `/cases/[id]` Case detail timeline and status view

## UI Flow Diagram
```mermaid
flowchart LR
	I[Intake Page] -->|Start case| B[(Durable Backend)]
	B --> U[Underwriter Queue]
	U -->|Select case| D[Recommendation + Inputs + Pricing]
	D -->|Approve/Reject| B
	D -->|Ask AI question| C[Case Chat Panel]
	C -->|POST /cases/{id}/chat| B
```

## Key Frontend Behaviors
- Converts simple user inputs into backend payload fields:
	- occupation profile -> occupationClass
	- annual income + monthly debt -> debtToIncomeRatio
- Polls pending queue and selected case status
- Keeps decision panel visible in wide layouts (sticky action panel)
- Handles backend validation and error messages

## Local Run
1. Configure API base URL.
```powershell
Copy-Item .env.local.sample .env.local
```

2. Install and run.
```powershell
npm install
npm run dev
```

UI URL:
- `http://localhost:3000`

Expected backend URL:
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:7071/api`
