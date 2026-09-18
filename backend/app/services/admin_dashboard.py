import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.user import User, SubscriptionPlan, AuditLog, ExportLog, ScrapingJob
from app.models.business import GoogleBusinessLocation
from app.models.scraped_business import ScrapedBusiness

class AdminDashboardService:

    @staticmethod
    def get_dashboard_stats(db: Session) -> Dict[str, Any]:
        """Calculates real, live aggregated statistics across all MySQL tables."""
        total_users = db.query(User).count()
        active_users = db.query(User).filter(User.status == "ACTIVE").count()
        inactive_users = db.query(User).filter(User.status == "INACTIVE").count()
        suspended_users = db.query(User).filter(User.status == "SUSPENDED").count()
        total_admins = db.query(User).filter(User.role.in_(["SUPER_ADMIN", "ADMIN"])).count()

        google_locations_count = db.query(GoogleBusinessLocation).count()
        scraped_businesses_count = db.query(ScrapedBusiness).count()
        total_businesses = google_locations_count + scraped_businesses_count

        total_scraping_jobs = db.query(ScrapingJob).count()
        successful_jobs = db.query(ScrapingJob).filter(ScrapingJob.status == "COMPLETED").count()
        failed_jobs = db.query(ScrapingJob).filter(ScrapingJob.status == "FAILED").count()
        running_jobs = db.query(ScrapingJob).filter(ScrapingJob.status == "RUNNING").count()

        total_exports = db.query(ExportLog).count()

        # Recent registrations (last 5)
        recent_users_records = db.query(User).order_by(desc(User.created_at)).limit(5).all()
        recent_registrations = [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "status": u.status,
                "created_at": u.created_at.isoformat() if u.created_at else None
            }
            for u in recent_users_records
        ]

        # Recent scraping activity (last 5)
        recent_jobs_records = db.query(ScrapingJob).order_by(desc(ScrapingJob.created_at)).limit(5).all()
        recent_scraping_activity = [
            {
                "id": j.id,
                "job_type": j.job_type,
                "query_or_url": j.query_or_url,
                "status": j.status,
                "results_count": j.results_count,
                "duration_ms": j.duration_ms,
                "created_at": j.created_at.isoformat() if j.created_at else None
            }
            for j in recent_jobs_records
        ]

        return {
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": inactive_users,
            "suspended_users": suspended_users,
            "total_admins": total_admins,
            "total_businesses": total_businesses,
            "google_locations_count": google_locations_count,
            "scraped_businesses_count": scraped_businesses_count,
            "total_scraping_jobs": total_scraping_jobs,
            "successful_jobs": successful_jobs,
            "failed_jobs": failed_jobs,
            "running_jobs": running_jobs,
            "total_exports": total_exports,
            "recent_registrations": recent_registrations,
            "recent_scraping_activity": recent_scraping_activity
        }

    @staticmethod
    def get_analytics(db: Session) -> Dict[str, Any]:
        """Provides database-driven trend analysis and category/city breakdowns."""
        # Categories breakdown from scraped businesses
        cat_rows = db.query(
            ScrapedBusiness.primary_category,
            func.count(ScrapedBusiness.id).label("count")
        ).filter(ScrapedBusiness.primary_category != None)\
         .group_by(ScrapedBusiness.primary_category)\
         .order_by(desc("count"))\
         .limit(8).all()

        categories_breakdown = [
            {"category": row[0] or "Uncategorized", "count": row[1]}
            for row in cat_rows if row[0]
        ]

        # Cities breakdown
        city_rows = db.query(
            ScrapedBusiness.city,
            func.count(ScrapedBusiness.id).label("count")
        ).filter(ScrapedBusiness.city != None)\
         .group_by(ScrapedBusiness.city)\
         .order_by(desc("count"))\
         .limit(8).all()

        cities_breakdown = [
            {"city": row[0] or "Unknown", "count": row[1]}
            for row in city_rows if row[0]
        ]

        # User growth over last 7 days
        now = datetime.datetime.utcnow()
        user_growth = []
        for i in range(6, -1, -1):
            day_start = (now - datetime.timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + datetime.timedelta(days=1)
            count = db.query(User).filter(User.created_at >= day_start, User.created_at < day_end).count()
            user_growth.append({
                "date": day_start.strftime("%b %d"),
                "count": count
            })

        # Scraping trends over last 7 days
        scraping_trends = []
        for i in range(6, -1, -1):
            day_start = (now - datetime.timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + datetime.timedelta(days=1)
            completed = db.query(ScrapingJob).filter(
                ScrapingJob.created_at >= day_start,
                ScrapingJob.created_at < day_end,
                ScrapingJob.status == "COMPLETED"
            ).count()
            failed = db.query(ScrapingJob).filter(
                ScrapingJob.created_at >= day_start,
                ScrapingJob.created_at < day_end,
                ScrapingJob.status == "FAILED"
            ).count()
            scraping_trends.append({
                "date": day_start.strftime("%b %d"),
                "completed": completed,
                "failed": failed,
                "total": completed + failed
            })

        # Export trends over last 7 days
        export_trends = []
        for i in range(6, -1, -1):
            day_start = (now - datetime.timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + datetime.timedelta(days=1)
            count = db.query(ExportLog).filter(
                ExportLog.created_at >= day_start,
                ExportLog.created_at < day_end
            ).count()
            export_trends.append({
                "date": day_start.strftime("%b %d"),
                "count": count
            })

        return {
            "user_growth": user_growth,
            "scraping_trends": scraping_trends,
            "export_trends": export_trends,
            "categories_breakdown": categories_breakdown,
            "cities_breakdown": cities_breakdown
        }
