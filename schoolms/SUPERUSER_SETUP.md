# Creating a Superuser for Production Database

## Current Database Configuration
- **Database Type**: MongoDB
- **Connection**: Updated to production database
- **Status**: Fresh database (no users yet)

## Methods to Create Superuser

### Method 1: Via API Endpoint (Recommended for First Setup) ✅

The project has a dedicated endpoint: `POST /api/config/superadmin`

This endpoint:
- ✅ Only works if **no superadmin exists yet**
- ✅ Validates email uniqueness
- ✅ Securely hashes passwords (bcryptjs, 12 rounds)
- ✅ Returns clear error messages

**Steps:**

1. **Start the development server:**
```bash
npm run dev
```

2. **Create the superuser using curl or API client:**

```bash
curl -X POST http://localhost:3000/api/config/superadmin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "System Administrator",
    "email": "superadmin@yourcompany.com",
    "password": "YourSecurePassword123!",
    "confirmPassword": "YourSecurePassword123!"
  }'
```

**Expected Response (Success):**
```json
{
  "message": "Superadmin created successfully",
  "user": {
    "id": "...",
    "name": "System Administrator",
    "email": "superadmin@yourcompany.com",
    "role": "SUPERADMIN",
    "isActive": true
  }
}
```

**Expected Response (Error - Superadmin already exists):**
```json
{
  "message": "A superadmin already exists",
  "error": "SUPERADMIN_EXISTS"
}
```

### Method 2: Via UI Setup Page ✅

If you haven't accessed the application yet:

1. Navigate to `http://localhost:3000/config`
2. This will show the configuration page
3. Complete the superadmin creation form
4. You'll be redirected to login with your new credentials

### Method 3: Via Postman/Insomnia

1. Create a new POST request
2. **URL:** `http://localhost:3000/api/config/superadmin`
3. **Headers:** `Content-Type: application/json`
4. **Body (raw JSON):**
```json
{
  "name": "Admin User",
  "email": "admin@example.com",
  "password": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!"
}
```

## User Roles Available

| Role | Permissions | Use Case |
|------|-----------|----------|
| **SUPERADMIN** | Full system access | System administrator |
| **ADMIN** | User & system management | School administrator |
| **STAFF** | Data management | Office staff |
| **TEACHER** | Class & marks management | Teaching staff |
| **STUDENT** | View own data | Students |

## Default Test Credentials (Development)

These were seeded during development:
- **Superadmin**: `superadmin@schoolms.com` / `password123`
- **Admin**: `admin@schoolms.com` / `password123`
- **Staff**: `staff@schoolms.com` / `password123`

For production, create new credentials with strong passwords!

## Verification

After creating the superuser, verify by:

1. **Login with the new credentials:**
   - Navigate to `http://localhost:3000/(auth)/login`
   - Enter your email and password
   - You should be redirected to the dashboard

2. **Verify superadmin access:**
   - Check the user management section at `/dashboard/settings`
   - You should see full system access

3. **Check database directly (optional):**
```javascript
// Using MongoDB client or Prisma Studio
// Should see user with role: "SUPERADMIN"
db.users.findOne({ email: "superadmin@yourcompany.com" })
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "A superadmin already exists" | The database already has a superadmin. Use existing credentials or delete and start fresh |
| "Password does not match" | Ensure `password` and `confirmPassword` are identical |
| "Email already in use" | Try a different email address |
| Connection error | Ensure `npm run dev` is running and database is connected |

## Next Steps

1. ✅ Create superuser with strong credentials
2. Login and verify access
3. Create additional ADMIN users for team members
4. Configure role permissions in System Settings
5. Create STAFF, TEACHER, and STUDENT accounts as needed

---

**Last Updated:** April 27, 2026
**Database:** Production MongoDB
**Status:** Ready for superuser creation
