
# Operational Cost Estimate (Forecast)

## Assumptions
- 120 Employees per ROC cluster.
- Weekly Roster cycles with Daily WhatsApp briefings.
- 1 Device per user (Minimal session re-verification).

## Monthly Forecast (Estimated)
| Service | Quantity | Unit Cost | Total (Est.) |
| :--- | :--- | :--- | :--- |
| **Firebase Auth (SMS)** | ~150 OTPs | ₹0.85 | ₹127.50 |
| **Firestore Read/Write** | ~200k Ops | Free Tier / Low | ₹0.00 |
| **Cloud Run (Solver)** | 100 Exec. | Tier 1 (256MB) | ₹250.00 |
| **WhatsApp Meta API** | 3,600 Msgs | Business Rate | ~₹1,800.00 |
| **Google Cloud Backup** | 10 GB | Std Rate | ₹50.00 |

**Total Estimated Operating Cost**: ~₹2,227.50 / Month / ROC
*Note: This is an architectural estimate based on current regional pricing, not a Firebase/Meta invoice.*
