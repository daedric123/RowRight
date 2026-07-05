-- ============================================================
-- 003_add_member_profile_fields.sql
-- Adds full_name and email columns to team_members so coaches
-- can see who is requesting to join without needing access to
-- auth.users (which is not readable via the anon key).
-- Safe to run multiple times — uses IF NOT EXISTS.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- ============================================================

alter table team_members
  add column if not exists full_name text,
  add column if not exists email     text;
