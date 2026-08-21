\set ON_ERROR_STOP on

SELECT current_database() = 'financeai' AS correct_database,
       pg_get_userbyid(datdba) = current_user AS database_owner
FROM pg_database
WHERE datname = current_database()
\gset

\if :correct_database
\else
  DO $$ BEGIN RAISE EXCEPTION 'refusing to bootstrap any database except financeai'; END $$;
\endif
\if :database_owner
\else
  DO $$ BEGIN RAISE EXCEPTION 'bootstrap must run as the owner of database financeai'; END $$;
\endif

BEGIN;

-- Omitted SUPERUSER, REPLICATION, and BYPASSRLS attributes use PostgreSQL's
-- safe false defaults; an RDS master cannot alter those attributes later.
SELECT format('CREATE ROLE %I WITH LOGIN INHERIT NOCREATEDB NOCREATEROLE', role_name)
FROM (VALUES ('financeai_runtime'), ('financeai_migrator')) AS roles(role_name)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = role_name)
\gexec

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_roles
    WHERE rolname IN ('financeai_runtime', 'financeai_migrator')
      AND (rolsuper OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION
      'application role has SUPERUSER, REPLICATION, or BYPASSRLS; bootstrap cannot safely revoke it';
  END IF;
END
$$;

ALTER ROLE financeai_runtime WITH
  LOGIN INHERIT NOCREATEDB NOCREATEROLE;
ALTER ROLE financeai_migrator WITH
  LOGIN INHERIT NOCREATEDB NOCREATEROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_roles
      WHERE rolname IN ('financeai_runtime', 'financeai_migrator')) <> 2 OR EXISTS (
    SELECT FROM pg_roles
    WHERE rolname IN ('financeai_runtime', 'financeai_migrator')
      AND (NOT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR
           rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'application role attributes are broader than intended';
  END IF;
END
$$;

-- Neither application role may inherit privileges from another role.
SELECT format('REVOKE %I FROM %I', granted.rolname, member.rolname)
FROM pg_auth_members memberships
JOIN pg_roles granted ON granted.oid = memberships.roleid
JOIN pg_roles member ON member.oid = memberships.member
WHERE member.rolname IN ('financeai_runtime', 'financeai_migrator')
ORDER BY member.rolname, granted.rolname
\gexec

REVOKE ALL PRIVILEGES ON DATABASE financeai FROM PUBLIC;
REVOKE ALL PRIVILEGES ON DATABASE financeai FROM financeai_runtime, financeai_migrator;
GRANT CONNECT ON DATABASE financeai TO financeai_runtime, financeai_migrator;

-- PostgreSQL 15 normally makes pg_database_owner the public-schema owner.
-- Preserve that ownership and grant only the capabilities each role needs.
REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM financeai_runtime, financeai_migrator;
GRANT USAGE ON SCHEMA public TO financeai_runtime;
GRANT USAGE, CREATE ON SCHEMA public TO financeai_migrator;

-- Temporarily SET ROLE so grants and default privileges are issued by the
-- owner of Prisma-created objects, then remove the bootstrap user's membership.
SELECT format('GRANT %I TO %I', 'financeai_migrator', current_user)
\gexec
SET ROLE financeai_migrator;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM financeai_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO financeai_runtime;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM financeai_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM financeai_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO financeai_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM financeai_runtime;

SELECT 'REVOKE ALL PRIVILEGES ON TABLE public._prisma_migrations FROM financeai_runtime'
WHERE to_regclass('public._prisma_migrations') IS NOT NULL
\gexec

RESET ROLE;
SELECT format('REVOKE %I FROM %I', 'financeai_migrator', current_user)
\gexec
COMMIT;

-- Reviewable ownership and effective-privilege evidence. Empty table output is
-- expected before the first migration; rerun this file after migrate deploy.
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
       rolreplication, rolbypassrls
FROM pg_roles
WHERE rolname IN ('financeai_runtime', 'financeai_migrator')
ORDER BY rolname;

SELECT role_name,
       has_database_privilege(role_name, 'financeai', 'CONNECT') AS connect,
       has_database_privilege(role_name, 'financeai', 'CREATE') AS create_database,
       has_database_privilege(role_name, 'financeai', 'TEMPORARY') AS temporary,
       has_schema_privilege(role_name, 'public', 'USAGE') AS schema_usage,
       has_schema_privilege(role_name, 'public', 'CREATE') AS schema_create
FROM (VALUES ('financeai_runtime'), ('financeai_migrator')) AS roles(role_name)
ORDER BY role_name;

SELECT n.nspname AS schema_name, pg_get_userbyid(n.nspowner) AS owner
FROM pg_namespace n
WHERE n.nspname = 'public';

SELECT c.relname AS object_name, c.relkind AS object_type,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'i', 'I', 'S', 'v', 'm')
ORDER BY c.relkind, c.relname;

SELECT c.relname AS table_name,
       pg_get_userbyid(c.relowner) AS owner,
       has_table_privilege('financeai_runtime', c.oid, 'SELECT') AS runtime_select,
       has_table_privilege('financeai_runtime', c.oid, 'INSERT') AS runtime_insert,
       has_table_privilege('financeai_runtime', c.oid, 'UPDATE') AS runtime_update,
       has_table_privilege('financeai_runtime', c.oid, 'DELETE') AS runtime_delete,
       has_table_privilege('financeai_runtime', c.oid, 'TRUNCATE') AS runtime_truncate
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

SELECT owner.rolname AS object_creator, n.nspname AS schema_name,
       defaults.defaclobjtype AS object_type, defaults.defaclacl AS access_control_list
FROM pg_default_acl defaults
JOIN pg_roles owner ON owner.oid = defaults.defaclrole
LEFT JOIN pg_namespace n ON n.oid = defaults.defaclnamespace
WHERE owner.rolname = 'financeai_migrator'
ORDER BY n.nspname, defaults.defaclobjtype;

SELECT member.rolname AS member, granted.rolname AS inherited_role
FROM pg_auth_members memberships
JOIN pg_roles granted ON granted.oid = memberships.roleid
JOIN pg_roles member ON member.oid = memberships.member
WHERE member.rolname IN ('financeai_runtime', 'financeai_migrator')
ORDER BY member.rolname, granted.rolname;
