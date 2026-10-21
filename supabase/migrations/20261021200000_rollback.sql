-- ==============================================================================
-- GÓC Coffee POS - Rollback Migration for 20261021200000_consolidated_auth_rbac_and_pos.sql
-- ==============================================================================

-- Drop Policies
DROP POLICY IF EXISTS "Data Cleanup Jobs Read" ON public.data_cleanup_jobs;
DROP POLICY IF EXISTS "Staff Profiles Write" ON public.staff_profiles;
DROP POLICY IF EXISTS "Staff Profiles Read" ON public.staff_profiles;
DROP POLICY IF EXISTS "Settings Write" ON public.settings;
DROP POLICY IF EXISTS "Settings Read" ON public.settings;
DROP POLICY IF EXISTS "Tables Delete" ON public.tables;
DROP POLICY IF EXISTS "Tables Manage" ON public.tables;
DROP POLICY IF EXISTS "Tables Update Status" ON public.tables;
DROP POLICY IF EXISTS "Tables Read" ON public.tables;
DROP POLICY IF EXISTS "Categories Write" ON public.categories;
DROP POLICY IF EXISTS "Categories Read" ON public.categories;
DROP POLICY IF EXISTS "Toppings Write" ON public.toppings;
DROP POLICY IF EXISTS "Toppings Read" ON public.toppings;
DROP POLICY IF EXISTS "Menu Items Write" ON public.menu_items;
DROP POLICY IF EXISTS "Menu Items Read" ON public.menu_items;
DROP POLICY IF EXISTS "Payments Insert" ON public.payments;
DROP POLICY IF EXISTS "Payments Read" ON public.payments;
DROP POLICY IF EXISTS "Orders RLS Delete" ON public.orders;
DROP POLICY IF EXISTS "Orders RLS Update" ON public.orders;
DROP POLICY IF EXISTS "Orders RLS Insert" ON public.orders;
DROP POLICY IF EXISTS "Orders RLS Select" ON public.orders;
DROP POLICY IF EXISTS "Audit Logs Read" ON public.audit_logs;
DROP POLICY IF EXISTS "User Roles Read" ON public.user_roles;
DROP POLICY IF EXISTS "Profiles Update Self or Admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Read" ON public.profiles;

-- Drop Functions
DROP FUNCTION IF EXISTS public.admin_hard_delete_sales_data(TEXT[], TEXT, JSONB, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_archive_orders(TEXT[], TEXT);
DROP FUNCTION IF EXISTS public.admin_change_user_role(UUID, public.app_role);
DROP FUNCTION IF EXISTS public.current_vietnam_date();
DROP FUNCTION IF EXISTS public.is_manager_or_admin();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_current_user_role();

-- Note: We do not drop tables or columns to preserve customer operational data.
