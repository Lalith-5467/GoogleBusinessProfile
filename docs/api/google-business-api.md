# API Reference: Google Business Profile Module

Base route: `/api/google-business`

## Endpoints

### 1. Connection & OAuth Status
- **Method**: `GET`
- **Endpoint**: `/api/google-business/status`
- **Description**: Returns the current OAuth 2.0 connection state, account information, and total count of stored business locations.
- **Response**:
  ```json
  {
    "is_connected": true,
    "account_id": "accounts/12345",
    "account_name": "My Business Account",
    "email": "owner@example.com",
    "connection_status": "CONNECTED",
    "total_locations": 15,
    "auth_url_available": true
  }
  ```

### 2. Google OAuth URL Generation
- **Method**: `GET`
- **Endpoint**: `/api/google-business/auth/url`
- **Description**: Generates Google OAuth 2.0 authorization consent URL for connecting a Google account.

### 3. Sync Locations from Google
- **Method**: `POST`
- **Endpoint**: `/api/google-business/sync`
- **Description**: Synchronizes business locations from the official Google Business Profile API into MySQL.

### 4. List Business Locations
- **Method**: `GET`
- **Endpoint**: `/api/google-business/locations`
- **Query Parameters**:
  - `page` (integer, default: 1)
  - `page_size` (integer, default: 25)
  - `search` (string, optional)

### 5. Export CSV
- **Method**: `GET`
- **Endpoint**: `/api/google-business/export`
- **Description**: Streams RFC-4180 compliant CSV file (`google_businesses.csv`) containing location records.

### 6. Delete Location Record
- **Method**: `DELETE`
- **Endpoint**: `/api/google-business/locations/{id}`
- **Description**: Removes location from MySQL database.
