# Password Management for Support Team

## 📋 Standard Test Password

**Password:** `admin123`  
**Standard Hash:** `$2b$10$UzqeEMr.JzbYp3ZLXoKfD.3trMKBT7YaqkxY1fqqtGzMWdvy2VSfa`

**IMPORTANT:** All test users in development/testing environment use the SAME password hash. This makes it easy for support team to test login and reset passwords.

---

## 🔄 Reset User Password

**⚠️ IMPORTANT:** Script hanya me-reset **non-LDAP users** (UseLDAP = 0).  
**LDAP users** (UseLDAP = 1) authenticate via LDAP service (Active Directory), password mereka **TIDAK di database**.

### Method 1: Via Script (Recommended)

Reset all non-LDAP test users to standard password:
```powershell
cd D:\AOP\portal-csi-github\backend
node scripts/reset-test-users-password.js
```

Reset specific users only (exclude production users):
```powershell
node scripts/reset-test-users-password.js --exclude superadmin admin
```

### Method 2: Direct Database Update

Reset single **non-LDAP** user via SQL:
```sql
UPDATE Users 
SET PasswordHash = '$2b$10$UzqeEMr.JzbYp3ZLXoKfD.3trMKBT7YaqkxY1fqqtGzMWdvy2VSfa',
    UpdatedAt = GETDATE()
WHERE Username = 'username'
  AND UseLDAP = 0  -- Only non-LDAP users
```

Reset all active **non-LDAP** users:
```sql
UPDATE Users 
SET PasswordHash = '$2b$10$UzqeEMr.JzbYp3ZLXoKfD.3trMKBT7YaqkxY1fqqtGzMWdvy2VSfa',
    UpdatedAt = GETDATE()
WHERE IsActive = 1
  AND UseLDAP = 0  -- Skip LDAP users
```

---

## 🔐 LDAP vs Non-LDAP Users

### Non-LDAP Users (UseLDAP = 0)
- **Authentication:** Via database (PasswordHash column)
- **Password Storage:** Hashed in database
- **Can Reset:** ✅ YES - Use script or SQL update
- **Examples:** Test users, demo accounts, local admin

### LDAP Users (UseLDAP = 1)
- **Authentication:** Via LDAP service (Active Directory, etc.)
- **Password Storage:** NOT in database (managed by LDAP server)
- **Can Reset:** ❌ NO - Password must be reset in LDAP/AD server
- **Examples:** Employee accounts synced from Active Directory

### How to Check User Type

```sql
SELECT 
    Username, 
    DisplayName, 
    Role,
    UseLDAP,
    CASE 
        WHEN UseLDAP = 1 THEN 'LDAP (managed by AD)'
        ELSE 'Database (can reset)'
    END AS AuthType
FROM Users 
WHERE IsActive = 1
ORDER BY UseLDAP, Username
```

### Reset Password for LDAP Users

**LDAP users CANNOT be reset in database.** Their passwords are managed by LDAP/AD server.

To reset LDAP user password:
1. Contact IT Admin who manages Active Directory
2. Reset password in AD server
3. User uses new AD password to login to application

---

## 🧪 Testing Workflow

### Scenario: Test Login with Different Users

1. All test users have password: `admin123`
2. Login as any user (admin, itlead2, sinta, etc.)
3. Test functionality
4. If password changed, run reset script to restore

### Scenario: User Password Changed During Testing

1. User changed password during test
2. Need to restore original password
3. Run reset script:
   ```powershell
   node scripts/reset-test-users-password.js
   ```
4. User can login again with `admin123`

### Scenario: Copy Hash for Manual Database Reset

1. Open this file to get standard hash
2. Copy hash: `$2b$10$UzqeEMr.JzbYp3ZLXoKfD.3trMKBT7YaqkxY1fqqtGzMWdvy2VSfa`
3. Update database:
   ```sql
   UPDATE Users SET PasswordHash = '<paste-hash-here>' WHERE Username = 'user'
   ```

---

## 🔑 Generate New Standard Hash (If Needed)

If you need to change the standard password:

```powershell
# Generate new hash for different password
node scripts/reset-test-users-password.js --generate-hash newpassword123

# Copy the generated hash
# Update STANDARD_TEST_HASH constant in reset-test-users-password.js
# Run reset script to apply to all users
node scripts/reset-test-users-password.js
```

---

## ⚠️ Security Notes

1. **SAME HASH FOR ALL USERS** is ONLY for development/testing
2. In production, each user should have UNIQUE hash even with same password
3. bcrypt automatically adds random salt, but we intentionally reuse 1 hash for testing convenience
4. The standard hash works because:
   - All test users use same password (`admin123`)
   - All test users use same hash (pre-generated once)
   - Easy to restore: just copy-paste the hash

---

## 📊 Check Current Password Hashes

Query to see if all users have standard hash:
```sql
SELECT 
    Username, 
    DisplayName, 
    Role,
    CASE 
        WHEN PasswordHash = '$2b$10$UzqeEMr.JzbYp3ZLXoKfD.3trMKBT7YaqkxY1fqqtGzMWdvy2VSfa' 
        THEN 'Standard' 
        ELSE 'Custom' 
    END AS HashType,
    PasswordHash
FROM Users 
WHERE IsActive = 1
ORDER BY Username
```

---

## 🆘 Common Issues

### Issue: User Can't Login After Reset
- **Solution:** Run reset script again to ensure hash is correct
- **Check:** Verify password is exactly `admin123` (case-sensitive)
- **Check:** Verify user is NOT LDAP user (UseLDAP should be 0)

### Issue: Script Says "Skipping X LDAP Users"
- **This is NORMAL:** LDAP users authenticate via LDAP service, not database
- **Their passwords are NOT in database**
- **To reset LDAP user:** Contact AD admin to reset in Active Directory

### Issue: Need to Exclude Specific Users from Reset
- **Solution:** Use `--exclude` flag:
  ```powershell
  node scripts/reset-test-users-password.js --exclude user1 user2
  ```

### Issue: Want Different Password for Testing
- **Solution:** Generate new hash with `--generate-hash` and update script

### Issue: LDAP User Can't Login with admin123
- **This is EXPECTED:** LDAP users use their AD password, not database password
- **Solution:** User must login with their Active Directory password
- **Cannot change:** LDAP passwords are managed in AD, not in application database

---

## 📞 Contact

For questions about password management:
- Check this documentation first
- Run scripts in `backend/scripts/` folder
- Scripts are safe to run multiple times

Last Updated: 2026-04-29
