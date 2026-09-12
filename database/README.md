# Database Architecture & Management

The application uses **MySQL** (default database name: `googlebusinessprofile`, compatible with Laragon, XAMPP, Docker, and standard MySQL 8.0+).

## Tables Overview

| Table Name | Description | Key Relationships |
| :--- | :--- | :--- |
| `google_business_accounts` | Google OAuth 2.0 connected accounts, access & refresh tokens | 1-to-many with `google_business_locations` |
| `google_business_locations` | Synced official Google Business Profile locations | Belongs to `google_business_accounts` |
| `scraped_businesses` | Business data extracted from websites via Playwright | Independent repository |

## Database Scripts

Located in `database/scripts/`:

1. **`schema.sql`**: Full DDL schema creation script with all columns, primary keys, foreign keys, and indexes.
2. **`seed.sql`**: Development fixture data for testing queries and views.

### Running SQL Scripts in MySQL / Laragon

```bash
# Using mysql client
mysql -u root -p googlebusinessprofile < database/scripts/schema.sql
mysql -u root -p googlebusinessprofile < database/scripts/seed.sql
```

## ORM Mapping

- **Python Backend**: Managed by SQLAlchemy declarative models in `backend/app/models/`.
- **Prisma Schema**: Provided in `database/prisma/schema.prisma` for Prisma Studio browsing or Node.js tooling.
