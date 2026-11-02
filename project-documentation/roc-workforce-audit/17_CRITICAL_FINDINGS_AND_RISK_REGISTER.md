# 17 Critical Findings and Risk Register

| ID | Finding | Severity | Mitigation |
| :--- | :--- | :--- | :--- |
| CF-01 | Public Read on Employee Directory | **HIGH** | Restrict `read` to `get` with phone-number verification in Security Rules. |
| CF-02 | AI-Simulated Solver | **MEDIUM** | Deploy a formal OR-Tools Python microservice for large-scale rosters. |
| CF-03 | Missing CSRF on Meta Webhooks | **LOW** | (If applicable) Verify Meta signature on incoming WhatsApp webhooks. |
