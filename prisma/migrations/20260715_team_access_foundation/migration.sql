CREATE TABLE IF NOT EXISTS public.account_memberships_v2 (
  id serial PRIMARY KEY,
  manager_id integer NOT NULL UNIQUE,
  account_id varchar(255) NOT NULL,
  team_role varchar(50) NOT NULL,
  access_scope varchar(30) NOT NULL DEFAULT 'all_locations',
  status varchar(20) NOT NULL DEFAULT 'active',
  account_holder boolean NOT NULL DEFAULT false,
  invited_by integer NULL,
  invited_at timestamptz NULL,
  accepted_at timestamptz NULL,
  revoked_at timestamptz NULL,
  last_active_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_memberships_v2_account_status
  ON public.account_memberships_v2(account_id, status);

CREATE INDEX IF NOT EXISTS idx_account_memberships_v2_manager_status
  ON public.account_memberships_v2(manager_id, status);

CREATE TABLE IF NOT EXISTS public.account_member_locations_v2 (
  id serial PRIMARY KEY,
  membership_id integer NOT NULL,
  restaurant_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_account_member_locations_v2_membership_restaurant
    UNIQUE (membership_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_account_member_locations_v2_membership_id
  ON public.account_member_locations_v2(membership_id);

CREATE INDEX IF NOT EXISTS idx_account_member_locations_v2_restaurant_id
  ON public.account_member_locations_v2(restaurant_id);

CREATE TABLE IF NOT EXISTS public.team_invitations_v2 (
  id serial PRIMARY KEY,
  account_id varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  team_role varchar(50) NOT NULL,
  access_scope varchar(30) NOT NULL DEFAULT 'all_locations',
  status varchar(20) NOT NULL DEFAULT 'pending',
  invite_token varchar(120) NOT NULL UNIQUE,
  invited_by integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz NULL,
  accepted_at timestamptz NULL,
  expires_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_v2_account_status
  ON public.team_invitations_v2(account_id, status);

CREATE INDEX IF NOT EXISTS idx_team_invitations_v2_email_status
  ON public.team_invitations_v2(email, status);

CREATE TABLE IF NOT EXISTS public.team_invitation_locations_v2 (
  id serial PRIMARY KEY,
  invitation_id integer NOT NULL,
  restaurant_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_team_invitation_locations_v2_invitation_restaurant
    UNIQUE (invitation_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_team_invitation_locations_v2_invitation_id
  ON public.team_invitation_locations_v2(invitation_id);

CREATE INDEX IF NOT EXISTS idx_team_invitation_locations_v2_restaurant_id
  ON public.team_invitation_locations_v2(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_managers_email
  ON public.managers(email);

INSERT INTO public.account_memberships_v2 (
  manager_id,
  account_id,
  team_role,
  access_scope,
  status,
  account_holder,
  invited_by,
  invited_at,
  accepted_at,
  last_active_at,
  created_at,
  updated_at
)
SELECT
  m.id,
  CASE
    WHEN lower(trim(m.email)) = 'romeo-adorapos@fohboh.ai' THEN 'C001'
    ELSE 'mgr:' || lower(trim(m.email))
  END AS account_id,
  CASE
    WHEN lower(trim(m.role)) IN ('admin', 'owner', 'restaurant owner', 'manager') THEN 'Owner'
    WHEN lower(trim(m.role)) = 'viewer' THEN 'Read-only'
    ELSE 'Owner'
  END AS team_role,
  'all_locations' AS access_scope,
  CASE
    WHEN COALESCE(m.active, true) = true THEN 'active'
    ELSE 'revoked'
  END AS status,
  CASE
    WHEN lower(trim(m.role)) IN ('admin', 'owner', 'restaurant owner', 'manager', 'viewer') THEN true
    ELSE false
  END AS account_holder,
  m.created_by,
  m.created_at,
  m.created_at,
  NULL,
  COALESCE(m.created_at, now()),
  COALESCE(m.updated_at, now())
FROM public.managers m
WHERE lower(trim(m.role)) NOT IN ('superadmin', 'super admin', 'wgs manager')
  AND NOT EXISTS (
    SELECT 1
    FROM public.account_memberships_v2 am
    WHERE am.manager_id = m.id
  );
