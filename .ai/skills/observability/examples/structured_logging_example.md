# Example: Structured JSON Logging

Use libraries like `structlog` to automatically format logs as JSON with contextual data.

## Setup and Usage

```python
import structlog
import sys
import logging

# Configure structlog to output JSON
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.dict_tracebacks,
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)

def process_payment(user_id: str, amount: float):
    # Bind context to the logger for this operation
    log = logger.bind(user_id=user_id, amount=amount)
    
    log.info("payment_started")
    
    try:
        # Simulate payment processing
        if amount > 1000:
            raise ValueError("Amount exceeds limit")
            
        log.info("payment_successful", transaction_id="txn_12345")
    except Exception as e:
        # Log the exception with context
        log.error("payment_failed", error=str(e), exc_info=True)

# Output:
# {"user_id": "u_987", "amount": 50.0, "event": "payment_started", "level": "info", "logger": "__main__", "timestamp": "..."}
# {"user_id": "u_987", "amount": 50.0, "transaction_id": "txn_12345", "event": "payment_successful", "level": "info", ...}
process_payment("u_987", 50.0)
```
