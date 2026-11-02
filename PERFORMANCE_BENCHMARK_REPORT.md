
# Performance & Scalability Report

## 1. Benchmarking Results (Fictional Data)
| Metric | 120 Employees | 500 Employees | 1,000 Employees |
| :--- | :--- | :--- | :--- |
| **Login Latency** | 1.2s | 1.2s | 1.3s |
| **FCFS Trans. Latency** | 180ms | 450ms | 820ms (Est.) |
| **Solver Generation** | 4s | 12s | 28s |
| **Excel Export** | <1s | 2s | 5s |

## 2. Scalability Analysis
- **Firestore Contention**: During a 1,000-user FCFS burst, the single `weekoff_configs` document may see high contention. Recommendation: For >1,000 simultaneous users, implement a distributed counter or sharded config.
- **UI Rendering**: Large table rendering uses optimized DOM nodes. 1,000 rows in the Roster Review grid may require virtualized scrolling in future versions.

**Recommended Cluster Size**: 100 - 500 professionals per ROC Node.
