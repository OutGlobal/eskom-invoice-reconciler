# Database Backup & Point-in-Time Recovery (PITR) Procedure

## 1. Backup Policies & Frequencies

| Target | Backup Strategy | Retention Period | Storage Location |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Database** | Daily WAL Archiving + Continuous PITR | 30 Days (Rolling) | AWS S3 Multi-AZ (Frankfurt) |
| **Database DDL Schema** | Git Version Control (`supabase/migrations/`) | Permanent | GitHub Enterprise |
| **S3 Storage Buckets** | Cross-Region Bucket Replication | 7 Years | AWS S3 Glacier Deep Archive |

---

## 2. Point-in-Time Recovery (PITR) Execution

### Step 1: Initiate Database Restoration in Supabase
1. Navigate to Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ Database $\rightarrow$ **Backups**.
2. Select **Point in Time Recovery**.
3. Specify the exact target timestamp (UTC) immediately preceding the incident:
   - Example: `2026-09-04T16:45:00Z`
4. Confirm database clone and restoration to target instance.

### Step 2: Storage Bucket Disaster Recovery
To restore soft-deleted storage object versions:
```bash
npx supabase storage cp --recursive sb://invoices-backup/2026-09-04/ sb://invoices/
```

### Step 3: Data Integrity Audit Post-Recovery
Run cryptographic hash chain validation to verify zero data loss or tampering:
```bash
npx tsx src/lib/__tests__/enterprise_security_hardening.test.ts
```
