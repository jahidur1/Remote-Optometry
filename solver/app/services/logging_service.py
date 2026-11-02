import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("solver-service")

class SolverLogger:
    @staticmethod
    def log_request(request_id: str, week_id: str, employee_count: int):
        logger.info(f"REQUEST_ID={request_id} | WEEK_ID={week_id} | EMPLOYEES={employee_count} | ACTION=SOLVE_START")

    @staticmethod
    def log_result(request_id: str, status: str, duration_ms: float):
        logger.info(f"REQUEST_ID={request_id} | STATUS={status} | DURATION_MS={duration_ms:.2f} | ACTION=SOLVE_END")
