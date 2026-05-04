alter table if exists public.prescription_events
  add column if not exists location_label text,
  add column if not exists location_details jsonb;

alter table if exists public.pharmacy_sales_events
  add column if not exists location_label text,
  add column if not exists location_details jsonb;

alter table if exists public.community_signals
  add column if not exists location_label text,
  add column if not exists location_details jsonb;
