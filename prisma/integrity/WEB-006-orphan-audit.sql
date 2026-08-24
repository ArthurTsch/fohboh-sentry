SELECT 'locations_v2.customer_id -> customers.id' AS relationship, count(*) AS orphan_count
FROM public.locations_v2 child LEFT JOIN public.customers parent ON parent.id = child.customer_id WHERE parent.id IS NULL
UNION ALL SELECT 'contract_configs_v2.location_id -> locations_v2.id', count(*) FROM public.contract_configs_v2 child LEFT JOIN public.locations_v2 parent ON parent.id = child.location_id WHERE parent.id IS NULL
UNION ALL SELECT 'schema_registry_v2.location_id -> locations_v2.id', count(*) FROM public.schema_registry_v2 child LEFT JOIN public.locations_v2 parent ON parent.id = child.location_id WHERE parent.id IS NULL
UNION ALL SELECT 'uploads_v2.location_id -> locations_v2.id', count(*) FROM public.uploads_v2 child LEFT JOIN public.locations_v2 parent ON parent.id = child.location_id WHERE parent.id IS NULL
UNION ALL SELECT 'cert_runs_v2.location_id -> locations_v2.id', count(*) FROM public.cert_runs_v2 child LEFT JOIN public.locations_v2 parent ON parent.id = child.location_id WHERE parent.id IS NULL
UNION ALL SELECT 'cert_runs_v2.contract_config_id -> contract_configs_v2.id', count(*) FROM public.cert_runs_v2 child LEFT JOIN public.contract_configs_v2 parent ON parent.id = child.contract_config_id WHERE parent.id IS NULL
UNION ALL SELECT 'caars_v2.cert_run_id -> cert_runs_v2.id', count(*) FROM public.caars_v2 child LEFT JOIN public.cert_runs_v2 parent ON parent.id = child.cert_run_id WHERE parent.id IS NULL
UNION ALL SELECT 'caars_v2.location_id -> locations_v2.id', count(*) FROM public.caars_v2 child LEFT JOIN public.locations_v2 parent ON parent.id = child.location_id WHERE parent.id IS NULL
UNION ALL SELECT 'caar_artifacts_v2.caar_id -> caars_v2.id', count(*) FROM public.caar_artifacts_v2 child LEFT JOIN public.caars_v2 parent ON parent.id = child.caar_id WHERE parent.id IS NULL
UNION ALL SELECT 'rule_citations_v2.cert_run_id -> cert_runs_v2.id', count(*) FROM public.rule_citations_v2 child LEFT JOIN public.cert_runs_v2 parent ON parent.id = child.cert_run_id WHERE parent.id IS NULL
UNION ALL SELECT 'mq6_scores_v2.cert_run_id -> cert_runs_v2.id', count(*) FROM public.mq6_scores_v2 child LEFT JOIN public.cert_runs_v2 parent ON parent.id = child.cert_run_id WHERE parent.id IS NULL
UNION ALL SELECT 'restaurant_sentry_state.restaurant_id -> restaurants.id', count(*) FROM public.restaurant_sentry_state child LEFT JOIN public.restaurants parent ON parent.id = child.restaurant_id WHERE parent.id IS NULL
UNION ALL SELECT 'account_memberships_v2.manager_id -> managers.id', count(*) FROM public.account_memberships_v2 child LEFT JOIN public.managers parent ON parent.id = child.manager_id WHERE parent.id IS NULL
UNION ALL SELECT 'account_member_locations_v2.membership_id -> account_memberships_v2.id', count(*) FROM public.account_member_locations_v2 child LEFT JOIN public.account_memberships_v2 parent ON parent.id = child.membership_id WHERE parent.id IS NULL
UNION ALL SELECT 'account_member_locations_v2.restaurant_id -> restaurants.id', count(*) FROM public.account_member_locations_v2 child LEFT JOIN public.restaurants parent ON parent.id = child.restaurant_id WHERE parent.id IS NULL
UNION ALL SELECT 'team_invitation_locations_v2.invitation_id -> team_invitations_v2.id', count(*) FROM public.team_invitation_locations_v2 child LEFT JOIN public.team_invitations_v2 parent ON parent.id = child.invitation_id WHERE parent.id IS NULL
UNION ALL SELECT 'team_invitation_locations_v2.restaurant_id -> restaurants.id', count(*) FROM public.team_invitation_locations_v2 child LEFT JOIN public.restaurants parent ON parent.id = child.restaurant_id WHERE parent.id IS NULL
ORDER BY relationship;
