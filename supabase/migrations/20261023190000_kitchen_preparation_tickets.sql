-- ============================================================================
-- GÓC POS — KITCHEN & BAR PREPARATION TICKET ENGINE MIGRATION
-- Migration Version: 20261023190000_kitchen_preparation_tickets.sql
-- Description: Adds preparation tickets table, order kitchen snapshot items,
-- and store settings for kitchen thermal print workflow.
-- ============================================================================

-- 1. ADD KITCHEN_SENT_ITEMS TO ORDERS TABLE
-- Stores array snapshot of items that have already been printed/sent to bar/kitchen
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'kitchen_sent_items'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN kitchen_sent_items JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. ADD KITCHEN_TICKET_SETTINGS TO STORE_SETTINGS TABLE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'store_settings' 
        AND column_name = 'kitchen_ticket_settings'
    ) THEN
        ALTER TABLE public.store_settings ADD COLUMN kitchen_ticket_settings JSONB NOT NULL DEFAULT '{
            "enabled": true,
            "paper_width": "58mm",
            "prompt_on_save": true,
            "print_mode": "diff",
            "show_table": true,
            "show_order_id": true,
            "show_time": true,
            "show_toppings": true,
            "show_notes": true,
            "show_item_count": true
        }'::jsonb;
    END IF;
END $$;

-- 3. PREPARATION TICKETS TABLE (Lịch sử in phiếu chế biến)
CREATE TABLE IF NOT EXISTS public.preparation_tickets (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    store_id TEXT NOT NULL DEFAULT 'default_store',
    table_id TEXT,
    table_name TEXT,
    ticket_number TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    item_count INTEGER NOT NULL DEFAULT 0,
    print_mode TEXT NOT NULL DEFAULT 'diff' CHECK (print_mode IN ('all', 'diff')),
    printed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    printed_by TEXT,
    printer_type TEXT DEFAULT 'thermal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Fast Ticket Querying
CREATE INDEX IF NOT EXISTS idx_prep_tickets_order_id ON public.preparation_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_prep_tickets_store_id ON public.preparation_tickets(store_id);
CREATE INDEX IF NOT EXISTS idx_prep_tickets_printed_at ON public.preparation_tickets(printed_at);
CREATE INDEX IF NOT EXISTS idx_prep_tickets_ticket_number ON public.preparation_tickets(ticket_number);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.preparation_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow read preparation_tickets for staff and above" ON public.preparation_tickets;
    DROP POLICY IF EXISTS "Allow insert preparation_tickets for active staff" ON public.preparation_tickets;
    DROP POLICY IF EXISTS "Allow delete preparation_tickets for admin" ON public.preparation_tickets;
END $$;

-- Read tickets policy
CREATE POLICY "Allow read preparation_tickets for staff and above"
ON public.preparation_tickets FOR SELECT
TO anon, authenticated
USING (true);

-- Insert tickets policy
CREATE POLICY "Allow insert preparation_tickets for active staff"
ON public.preparation_tickets FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Admin cleanup policy
CREATE POLICY "Allow delete preparation_tickets for admin"
ON public.preparation_tickets FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'manager')
    )
    OR auth.role() = 'service_role'
);
