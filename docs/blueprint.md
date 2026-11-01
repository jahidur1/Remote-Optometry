# **App Name**: ROC Workforce — Intelligent Workforce & Shift Management System

## Core Features:

- Shift Master & Quota Management: Configure and manage the six specific shift records and a 7-day exact employee quota matrix for staffing requirements.
- Atomic Weekly-Off Booking: A live first-come-first-served booking system utilizing Firestore transactions to prevent overbooking and manage weekday quotas.
- Mathematical Roster Solver: Utilizes Google OR-Tools CP-SAT as a mathematical solver engine to generate rosters that satisfy hard constraints like quotas and weekly-off protection.
- Gender-Balanced Optimization: An optimization feature that incorporates soft gender targets as optimization objectives for shift distribution using the mathematical engine.
- Constraint Interpretation Tool: A generative AI tool used to help administrators understand scheduling conflicts, summarize complex constraints, and explain solver results.
- Employee Self-Service Portal: A dedicated interface for employees to view published rosters, book weekly-offs, and submit shift-change requests.
- Automated WhatsApp Notifications: Integration with Meta WhatsApp Cloud API to automatically distribute daily shift alerts to the workforce.
- Audit Logging & Reporting: Maintain immutable audit trails of all sensitive actions and export workforce metrics in Excel and CSV formats.

## Style Guidelines:

- Professional palette featuring deep navy (#001F3F), electric blue (#0074D9), and subtle teal accents (#39CCCC).
- Support for a clean light theme and a high-contrast polished dark theme.
- Highly readable sans-serif typography with consistent vertical rhythm for complex data tables.
- Responsive design with a persistent Admin sidebar on desktop and a mobile-optimized bottom navigation for employees.
- Clean, enterprise-standard icons representing workforce status, administrative tools, and optical scheduling elements.
- Subtle micro-interactions, skeleton loading states, and smooth transitions for state changes.