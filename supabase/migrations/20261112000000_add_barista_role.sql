-- ============================================================================
-- Migration: 20261112000000_add_barista_role.sql
-- Description: Thêm giá trị 'barista' vào kiểu enum app_role cho vị trí Pha chế (KDS)
-- Idempotent & non-destructive
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum e 
        JOIN pg_type t ON e.enumtypid = t.oid 
        WHERE t.typname = 'app_role' AND e.enumlabel = 'barista'
    ) THEN
        ALTER TYPE public.app_role ADD VALUE 'barista';
    END IF;
END $$;
