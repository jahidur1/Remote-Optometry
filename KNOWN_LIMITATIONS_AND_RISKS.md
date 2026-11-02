
# Known Limitations and Risks

## 1. Technical Debt
- **Solver Environment**: Currently simulated via Genkit flow; transition to full Python Cloud Run service is required for production quotas > 200 staff.
- **Contention Risk**: The single-document FCFS lock is optimized for <500 concurrent users. Larger clusters will require sharded quotas.
- **Grid Virtualization**: The roster review workspace lacks virtualization, which may cause UI lag with 1,000+ employees.

## 2. Institutional Risks
- **Meta API Approval**: WhatsApp templates require Meta approval. Delays in template white-listing will block shift briefings.
- **Phone Connectivity**: OTP delivery depends on regional SMS gateways. Areas with poor network coverage may experience login latency.

## 3. Mitigation Strategies
- Implement "Bulk Provisioning" to reduce SMS costs for initial onboarding.
- Cache shift masters in `localStorage` to reduce Firestore reads on repetitive dashboard loads.
