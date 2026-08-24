-- Repair only optional references and true owned joins. Required lineage is validated below.
-- Replace the legacy partial index with a real unique constraint so account_id can be an FK target.
DROP INDEX IF EXISTS public.uq_customers_account_id;
ALTER TABLE public.customers
  ADD CONSTRAINT uq_customers_account_id UNIQUE (account_id);

UPDATE public.contract_configs_v2 SET status = 'sealed' WHERE status IS NULL;
ALTER TABLE public.contract_configs_v2 ALTER COLUMN status SET NOT NULL;
UPDATE public.schema_registry_v2 SET status = 'sealed' WHERE status IS NULL;
ALTER TABLE public.schema_registry_v2 ALTER COLUMN status SET NOT NULL;

INSERT INTO public.customers (account_id, name, plan, created_at, updated_at)
SELECT account_id, account_id, 'wgs', now(), now()
FROM (
  SELECT account_id FROM public.restaurant_sentry_state
  UNION SELECT account_id FROM public.caar_reports
  UNION SELECT account_id FROM public.support_tickets_v2
  UNION SELECT account_id FROM public.account_memberships_v2
  UNION SELECT account_id FROM public.team_invitations_v2
  UNION SELECT account_id FROM public.billing_accounts_v2
) accounts
WHERE account_id IS NOT NULL AND btrim(account_id) <> ''
ON CONFLICT (account_id) DO NOTHING;

-- Reattach normalized locations to their canonical account when legacy state provides
-- an unambiguous external-location/account mapping.
WITH location_accounts AS (
  SELECT rss.location_id, min(customer.id) AS customer_id
  FROM public.restaurant_sentry_state rss
  INNER JOIN public.customers customer ON customer.account_id = rss.account_id
  WHERE rss.account_id IS NOT NULL AND btrim(rss.account_id) <> ''
  GROUP BY rss.location_id
  HAVING count(DISTINCT customer.id) = 1
)
UPDATE public.locations_v2 location
SET customer_id = mapping.customer_id
FROM location_accounts mapping
WHERE location.external_id = mapping.location_id
  AND location.customer_id <> mapping.customer_id;

-- Preserve legacy workflow state whose restaurant was administratively deleted by
-- reconstructing the missing parent. Names come from the normalized location when available.
INSERT INTO public.restaurants (id, name, active, created_at, updated_at)
SELECT
  state.restaurant_id,
  coalesce(max(location.name), 'Recovered location ' || state.location_id),
  false,
  coalesce(state.created_at, now()),
  now()
FROM public.restaurant_sentry_state state
LEFT JOIN public.restaurants restaurant ON restaurant.id = state.restaurant_id
LEFT JOIN public.locations_v2 location ON location.external_id = state.location_id
WHERE restaurant.id IS NULL
GROUP BY state.restaurant_id, state.location_id, state.created_at;

SELECT setval(
  pg_get_serial_sequence('public.restaurants', 'id'),
  greatest((SELECT coalesce(max(id), 1) FROM public.restaurants), 1),
  true
);

-- Convert legacy restaurant IDs stored in uploads_v2.location_id to the normalized
-- location IDs used by the rest of the v2 evidence lineage. Only unique mappings move.
WITH upload_location_map AS (
  SELECT state.restaurant_id AS legacy_location_id, min(location.id) AS normalized_location_id
  FROM public.restaurant_sentry_state state
  INNER JOIN public.locations_v2 location ON location.external_id = state.location_id
  GROUP BY state.restaurant_id
  HAVING count(DISTINCT location.id) = 1
)
UPDATE public.uploads_v2 upload
SET location_id = mapping.normalized_location_id
FROM upload_location_map mapping
WHERE upload.location_id = mapping.legacy_location_id
  AND NOT EXISTS (
    SELECT 1 FROM public.locations_v2 current_parent WHERE current_parent.id = upload.location_id
  );

UPDATE public.managers child SET created_by = NULL WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.managers parent WHERE parent.id = child.created_by);
UPDATE public.managers child SET regional_manager_id = NULL WHERE regional_manager_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.managers parent WHERE parent.id = child.regional_manager_id);
UPDATE public.restaurants child SET created_by = NULL WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.managers parent WHERE parent.id = child.created_by);
UPDATE public.restaurant_sentry_state child SET created_by = NULL WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.managers parent WHERE parent.id = child.created_by);
UPDATE public.caar_reports child SET restaurant_id = NULL WHERE restaurant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.restaurants parent WHERE parent.id = child.restaurant_id);
UPDATE public.caar_reports child SET created_by = NULL WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.managers parent WHERE parent.id = child.created_by);
UPDATE public.contract_configs_v2 child SET source_upload_id = NULL WHERE source_upload_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.uploads_v2 parent WHERE parent.id = child.source_upload_id);
UPDATE public.schema_registry_v2 child SET source_upload_id = NULL WHERE source_upload_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.uploads_v2 parent WHERE parent.id = child.source_upload_id);
UPDATE public.uploads_v2 child SET superseded_by = NULL WHERE superseded_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.uploads_v2 parent WHERE parent.id = child.superseded_by);
UPDATE public.loop_b_findings_v2 child SET caar_id = NULL WHERE caar_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.caars_v2 parent WHERE parent.id = child.caar_id);
UPDATE public.system_health_events_v2 child SET caar_id = NULL WHERE caar_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.caars_v2 parent WHERE parent.id = child.caar_id);
UPDATE public.audit_log_v2 child SET customer_id = NULL WHERE customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers parent WHERE parent.id = child.customer_id);
UPDATE public.audit_log_v2 child SET location_id = NULL WHERE location_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.locations_v2 parent WHERE parent.id = child.location_id);
UPDATE public.audit_log_v2 child SET actor_user_id = NULL WHERE actor_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.managers parent WHERE parent.id = child.actor_user_id);
UPDATE public.support_tickets_v2 child SET created_by = NULL WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.managers parent WHERE parent.id = child.created_by);
UPDATE public.support_tickets_v2 child SET resolved_by = NULL WHERE resolved_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.managers parent WHERE parent.id = child.resolved_by);
UPDATE public.access_requests_v2 child SET reviewed_by = NULL WHERE reviewed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.managers parent WHERE parent.id = child.reviewed_by);
UPDATE public.account_memberships_v2 child SET invited_by = NULL WHERE invited_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.managers parent WHERE parent.id = child.invited_by);
UPDATE public.team_invitations_v2 child SET invited_by = NULL WHERE invited_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.managers parent WHERE parent.id = child.invited_by);

DELETE FROM public.account_member_locations_v2 child WHERE NOT EXISTS (SELECT 1 FROM public.account_memberships_v2 parent WHERE parent.id = child.membership_id) OR NOT EXISTS (SELECT 1 FROM public.restaurants parent WHERE parent.id = child.restaurant_id);
DELETE FROM public.team_invitation_locations_v2 child WHERE NOT EXISTS (SELECT 1 FROM public.team_invitations_v2 parent WHERE parent.id = child.invitation_id) OR NOT EXISTS (SELECT 1 FROM public.restaurants parent WHERE parent.id = child.restaurant_id);

ALTER TABLE public.managers ADD CONSTRAINT fk_managers_created_by FOREIGN KEY (created_by) REFERENCES public.managers(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.managers ADD CONSTRAINT fk_managers_regional_manager FOREIGN KEY (regional_manager_id) REFERENCES public.managers(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.restaurants ADD CONSTRAINT fk_restaurants_created_by FOREIGN KEY (created_by) REFERENCES public.managers(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.restaurant_sentry_state ADD CONSTRAINT fk_restaurant_state_restaurant FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.restaurant_sentry_state ADD CONSTRAINT fk_restaurant_state_created_by FOREIGN KEY (created_by) REFERENCES public.managers(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.restaurant_sentry_state ADD CONSTRAINT fk_restaurant_state_account FOREIGN KEY (account_id) REFERENCES public.customers(account_id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.caar_reports ADD CONSTRAINT fk_caar_reports_restaurant FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.caar_reports ADD CONSTRAINT fk_caar_reports_created_by FOREIGN KEY (created_by) REFERENCES public.managers(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.caar_reports ADD CONSTRAINT fk_caar_reports_account FOREIGN KEY (account_id) REFERENCES public.customers(account_id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.locations_v2 ADD CONSTRAINT fk_locations_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.contract_configs_v2 ADD CONSTRAINT fk_contract_location FOREIGN KEY (location_id) REFERENCES public.locations_v2(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.contract_configs_v2 ADD CONSTRAINT fk_contract_sealed_by FOREIGN KEY (sealed_by) REFERENCES public.managers(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.contract_configs_v2 ADD CONSTRAINT fk_contract_source_upload FOREIGN KEY (source_upload_id) REFERENCES public.uploads_v2(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.schema_registry_v2 ADD CONSTRAINT fk_schema_location FOREIGN KEY (location_id) REFERENCES public.locations_v2(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.schema_registry_v2 ADD CONSTRAINT fk_schema_sealed_by FOREIGN KEY (sealed_by) REFERENCES public.managers(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.schema_registry_v2 ADD CONSTRAINT fk_schema_source_upload FOREIGN KEY (source_upload_id) REFERENCES public.uploads_v2(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.uploads_v2 ADD CONSTRAINT fk_upload_location FOREIGN KEY (location_id) REFERENCES public.locations_v2(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.uploads_v2 ADD CONSTRAINT fk_upload_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES public.managers(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.uploads_v2 ADD CONSTRAINT fk_upload_superseded_by FOREIGN KEY (superseded_by) REFERENCES public.uploads_v2(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.cert_runs_v2 ADD CONSTRAINT fk_cert_location FOREIGN KEY (location_id) REFERENCES public.locations_v2(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.cert_runs_v2 ADD CONSTRAINT fk_cert_contract FOREIGN KEY (contract_config_id) REFERENCES public.contract_configs_v2(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.cert_runs_v2 ADD CONSTRAINT fk_cert_triggered_by FOREIGN KEY (triggered_by) REFERENCES public.managers(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.caars_v2 ADD CONSTRAINT fk_caar_cert_run FOREIGN KEY (cert_run_id) REFERENCES public.cert_runs_v2(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.caars_v2 ADD CONSTRAINT fk_caar_location FOREIGN KEY (location_id) REFERENCES public.locations_v2(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.caars_v2 ADD CONSTRAINT fk_caar_superseded_by FOREIGN KEY (superseded_by) REFERENCES public.caars_v2(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.caar_artifacts_v2 ADD CONSTRAINT fk_caar_artifact_caar FOREIGN KEY (caar_id) REFERENCES public.caars_v2(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.rule_citations_v2 ADD CONSTRAINT fk_rule_citation_cert FOREIGN KEY (cert_run_id) REFERENCES public.cert_runs_v2(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.mq6_scores_v2 ADD CONSTRAINT fk_mq6_score_cert FOREIGN KEY (cert_run_id) REFERENCES public.cert_runs_v2(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.loop_b_findings_v2 ADD CONSTRAINT fk_loop_b_location FOREIGN KEY (location_id) REFERENCES public.locations_v2(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.loop_b_findings_v2 ADD CONSTRAINT fk_loop_b_caar FOREIGN KEY (caar_id) REFERENCES public.caars_v2(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.system_health_events_v2 ADD CONSTRAINT fk_health_location FOREIGN KEY (location_id) REFERENCES public.locations_v2(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.system_health_events_v2 ADD CONSTRAINT fk_health_caar FOREIGN KEY (caar_id) REFERENCES public.caars_v2(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.audit_log_v2 ADD CONSTRAINT fk_audit_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.audit_log_v2 ADD CONSTRAINT fk_audit_location FOREIGN KEY (location_id) REFERENCES public.locations_v2(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.audit_log_v2 ADD CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES public.managers(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.support_tickets_v2 ADD CONSTRAINT fk_support_created_by FOREIGN KEY (created_by) REFERENCES public.managers(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.support_tickets_v2 ADD CONSTRAINT fk_support_resolved_by FOREIGN KEY (resolved_by) REFERENCES public.managers(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.support_tickets_v2 ADD CONSTRAINT fk_support_account FOREIGN KEY (account_id) REFERENCES public.customers(account_id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.access_requests_v2 ADD CONSTRAINT fk_access_request_reviewer FOREIGN KEY (reviewed_by) REFERENCES public.managers(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.billing_accounts_v2 ADD CONSTRAINT fk_billing_account_customer FOREIGN KEY (account_id) REFERENCES public.customers(account_id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.payment_methods_v2 ADD CONSTRAINT fk_payment_billing_account FOREIGN KEY (account_id) REFERENCES public.billing_accounts_v2(account_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.billing_statements_v2 ADD CONSTRAINT fk_statement_billing_account FOREIGN KEY (account_id) REFERENCES public.billing_accounts_v2(account_id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.account_memberships_v2 ADD CONSTRAINT fk_membership_manager FOREIGN KEY (manager_id) REFERENCES public.managers(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.account_memberships_v2 ADD CONSTRAINT fk_membership_invited_by FOREIGN KEY (invited_by) REFERENCES public.managers(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.account_memberships_v2 ADD CONSTRAINT fk_membership_account FOREIGN KEY (account_id) REFERENCES public.customers(account_id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.account_member_locations_v2 ADD CONSTRAINT fk_member_location_membership FOREIGN KEY (membership_id) REFERENCES public.account_memberships_v2(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.account_member_locations_v2 ADD CONSTRAINT fk_member_location_restaurant FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.team_invitations_v2 ADD CONSTRAINT fk_team_invitation_account FOREIGN KEY (account_id) REFERENCES public.customers(account_id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.team_invitations_v2 ADD CONSTRAINT fk_team_invitation_invited_by FOREIGN KEY (invited_by) REFERENCES public.managers(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.team_invitation_locations_v2 ADD CONSTRAINT fk_invitation_location_invitation FOREIGN KEY (invitation_id) REFERENCES public.team_invitations_v2(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.team_invitation_locations_v2 ADD CONSTRAINT fk_invitation_location_restaurant FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE NOT VALID;

DO $$
DECLARE constraint_row record;
BEGIN
  FOR constraint_row IN SELECT conrelid::regclass AS table_name, conname FROM pg_constraint WHERE conname LIKE 'fk_%' AND NOT convalidated
  LOOP
    EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', constraint_row.table_name, constraint_row.conname);
  END LOOP;
END $$;
