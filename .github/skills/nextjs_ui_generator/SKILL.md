---
name: nextjs_ui_generator
description: Create modern Next.js frontends for Azure Functions or FastAPI backends, with responsive layouts, full-screen UX, multi-page flows, and Azure Static Web Apps hosting.
---

# Next.js UI Generator Skill

## What this skill does

This skill creates a modern frontend using Next.js for backend APIs exposed through:
- Azure Functions
- FastAPI on Azure Container Apps

It:
- understands the core requirement
- designs a usable frontend around backend capabilities
- creates responsive UI and multi-step flows
- uses screen space effectively
- connects to backend APIs
- prepares the app to be hosted on Azure Static Web Apps

---

## When to use this skill

Use this skill when:
- the backend exposes HTTP endpoints or REST APIs
- the user needs a frontend
- user interaction is required
- uploads, forms, dashboards, status pages, or result views are needed
- workflows span multiple screens, tabs, or pages

---

## Frontend hosting rule

The frontend should be designed with Azure Static Web Apps as the hosting target.

This means:
- keep the frontend static-web-app friendly
- use environment variables for API base URLs
- keep backend integrations clean and externalized

---

## Backend awareness rules

You MUST adapt the UI to the backend style.

### If backend is Azure Functions
Expect:
- lightweight endpoints
- simpler stateless APIs
- possible async flows through queue-backed processing

### If backend is FastAPI on Container Apps
Expect:
- structured REST APIs
- richer API surface
- more explicit job/status/result patterns for async systems

Design the UI to match the backend pattern actually being used.

---

## Model access rule (IMPORTANT)

Frontend MUST NOT call models directly.

If the system uses AI:
- all AI interactions must go through backend APIs
- backend APIs connect to Microsoft Foundry Projects

### Standard flow
Frontend → Backend API → Microsoft Foundry Project → Model → Response

---

## UI and UX principles

### Layout
- use the full screen effectively
- avoid cramped layouts
- use strong visual hierarchy
- organize content using sections, cards, panels, or grids when helpful

### Navigation
- use multiple routes/screens when the workflow requires it
- use tabs, sidebars, or step flows where appropriate
- keep navigation clear and predictable

### Components
Include relevant UI pieces such as:
- forms
- file uploads
- buttons
- progress indicators
- cards
- tables
- filters
- dashboards
- result views
- error states
- empty states

---

## Async workflow UI rules

If the backend is asynchronous, the UI should usually include:

1. submission/input screen
2. processing or loading state
3. status polling experience
4. result screen

The frontend should handle:
- polling
- retries if appropriate
- user feedback during long-running operations
- clear job/result visibility

---

## What to generate

Always return:

### 1. UI architecture
Explain:
- pages
- flow
- layout approach

### 2. Routes/pages
List routes such as:
- /
- /upload
- /dashboard
- /status/[id]
- /results/[id]

Only include what the requirement actually needs.

### 3. Components
List key components and their purposes.

### 4. Next.js code
Provide:
- App Router-based structure
- pages
- reusable components
- API integration examples
- styling using Tailwind CSS

### 5. Backend integration
Show how the frontend talks to the backend:
- API calls
- loading/error/success handling
- status polling if async

---

## Styling guidelines

- use Tailwind CSS
- modern, clean, and responsive
- slightly polished but not overly flashy
- desktop and mobile friendly
- prioritize readability and usability

---

## Coding guidelines

- use Next.js App Router
- use functional React components
- use hooks such as useState and useEffect when needed
- keep code modular and readable
- avoid unnecessary complexity
- externalize API configuration via environment variables

---

## Example behavior

User request:
"Upload files, analyze them, and show results in a dashboard"

You should:
- create an upload page
- call the backend API
- show loading/progress
- poll for status if async
- display results in a clean dashboard layout
- design it to work well on Azure Static Web Apps

---

## Advanced behavior

If the system includes:
- AI outputs
- analytics
- multi-step workflows
- complex result sets

Then:
- create a dashboard-style UI
- use sections or cards
- use multiple screens/tabs when necessary
- make the flow intuitive rather than forcing everything into one page

---

## Key principle

Always convert backend capability into:
- an intuitive frontend
- a clear user journey
- effective full-screen layout
- a modern production-ready Next.js UI
- a frontend that is suitable for Azure Static Web Apps