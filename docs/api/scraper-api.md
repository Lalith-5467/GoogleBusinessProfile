# API Reference: Website Business Scraper Module

Base route: `/api/scraper`

## Endpoints

### 1. Single Company Website Scraping
- **Method**: `POST`
- **Endpoint**: `/api/scraper/company`
- **Payload**:
  ```json
  {
    "url": "https://example.com"
  }
  ```
- **Description**: Uses Playwright Chromium headless engine to extract structured business metadata (Schema.org, Open Graph, meta, phone, address, hours, ratings) and persists to MySQL.

### 2. Bulk Scraping
- **Method**: `POST`
- **Endpoint**: `/api/scraper/bulk`
- **Payload**:
  ```json
  {
    "urls": [
      "https://example1.com",
      "https://example2.com"
    ]
  }
  ```
- **Description**: Concurrently extracts business profiles from a list of URLs with controlled concurrency.

### 3. List Scraped Businesses
- **Method**: `GET`
- **Endpoint**: `/api/scraper/businesses`
- **Query Parameters**:
  - `page` (integer, default: 1)
  - `page_size` (integer, default: 25)
  - `search` (string, optional)
  - `category` (string, optional)

### 4. Count of Scraped Businesses
- **Method**: `GET`
- **Endpoint**: `/api/scraper/count`
- **Description**: Returns live total count of records stored in `scraped_businesses`.

### 5. Export CSV
- **Method**: `GET`
- **Endpoint**: `/api/scraper/export`
- **Description**: Streams RFC-4180 compliant CSV file (`scraped_businesses.csv`).

### 6. Delete Scraped Business
- **Method**: `DELETE`
- **Endpoint**: `/api/scraper/businesses/{id}`
- **Description**: Deletes a specific scraped business record by ID.
