-- Add composite indexes for measurement queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_measurements_user_timestamp" 
ON "measurements" ("user_id", "timestamp" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_measurements_user_synced" 
ON "measurements" ("user_id", "synced_to_fysora");

-- Add index for client portrait queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_client_portraits_user_active" 
ON "client_portraits" ("user_id", "is_active");

-- Add index for audit logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_logs_user_action" 
ON "audit_logs" ("user_id", "action", "timestamp" DESC);

-- Add index for organization members
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_org_members_user_role" 
ON "organization_members" ("user_id", "role");

-- Add GIN index for JSONB data (if using PostgreSQL)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_measurements_data" 
ON "measurements" USING GIN ("data");
