import json
import logging
from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from fastapi import Request

from app.models.user import AuditLog, ExportLog, ScrapingJob

logger = logging.getLogger("google-business-backend")

def log_audit_event(
    db: Session,
    actor_email: str,
    action: str,
    user_id: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> AuditLog:
    """Records an administrative audit log event to MySQL."""
    try:
        details_str = json.dumps(details, default=str) if details else None
        audit = AuditLog(
            user_id=user_id,
            actor_email=actor_email,
            action=action,
            target_type=target_type,
            target_id=target_id,
            ip_address=ip_address,
            details_json=details_str
        )
        db.add(audit)
        db.commit()
        return audit
    except Exception as e:
        logger.error(f"Failed to record audit log: {e}")
        db.rollback()
        return None

def log_export_event(
    db: Session,
    export_type: str,
    record_count: int,
    file_name: str,
    file_format: str = "CSV",
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    ip_address: Optional[str] = None
) -> ExportLog:
    """Records a data export log event to MySQL."""
    try:
        export_log = ExportLog(
            user_id=user_id,
            user_email=user_email or "public_user@session",
            export_type=export_type,
            record_count=record_count,
            file_name=file_name,
            file_format=file_format,
            ip_address=ip_address
        )
        db.add(export_log)
        db.commit()
        return export_log
    except Exception as e:
        logger.error(f"Failed to record export log: {e}")
        db.rollback()
        return None

def log_scraping_job(
    db: Session,
    job_type: str,
    query_or_url: str,
    status: str = "COMPLETED",
    results_count: int = 0,
    error_message: Optional[str] = None,
    duration_ms: int = 0,
    user_id: Optional[str] = None
) -> ScrapingJob:
    """Records a scraping job execution record to MySQL."""
    try:
        job = ScrapingJob(
            user_id=user_id,
            job_type=job_type,
            query_or_url=query_or_url,
            status=status,
            results_count=results_count,
            error_message=error_message,
            duration_ms=duration_ms
        )
        db.add(job)
        db.commit()
        return job
    except Exception as e:
        logger.error(f"Failed to record scraping job log: {e}")
        db.rollback()
        return None
