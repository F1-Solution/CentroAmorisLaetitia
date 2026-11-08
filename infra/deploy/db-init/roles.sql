-- Ruoli del database (1F-W4 T6g). Si esegue a ogni avvio dello stack, come superutente, dal
-- servizio `db-init`: crea o riallinea i tre ruoli, le loro password e i loro privilegi.
-- Variabili psql (le passa il Compose, mai scritte qui): owner_pw, app_pw, backup_pw.
--
--   amoris_owner  proprietario del database e degli oggetti; lo usano `migrate` e il ripristino.
--   amoris_app    ruolo dell'API: solo SELECT, INSERT, UPDATE, DELETE e le sequenze; niente DDL.
--   amoris_backup ruolo del backup: sola lettura di ogni tabella e sequenza.
\set ON_ERROR_STOP on

SELECT current_database() AS db \gset

SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'amoris_owner') AS missing \gset
\if :missing
  CREATE ROLE amoris_owner LOGIN;
\endif
SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'amoris_app') AS missing \gset
\if :missing
  CREATE ROLE amoris_app LOGIN;
\endif
SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'amoris_backup') AS missing \gset
\if :missing
  CREATE ROLE amoris_backup LOGIN;
\endif

ALTER ROLE amoris_owner WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'owner_pw';
ALTER ROLE amoris_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'app_pw';
ALTER ROLE amoris_backup WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'backup_pw';

-- Il backup legge tutto con il ruolo predefinito di sola lettura, senza diventare proprietario di nulla.
GRANT pg_read_all_data TO amoris_backup;

ALTER DATABASE :"db" OWNER TO amoris_owner;
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO amoris_app, amoris_backup;

-- Lo schema `public` lo possiede il proprietario del database: nessun altro vi crea oggetti.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO amoris_app;

-- Privilegi sugli oggetti già presenti (per esempio dopo un ripristino fatto da un altro ruolo).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO amoris_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO amoris_app;

-- Privilegi sugli oggetti che il proprietario creerà con le migrazioni future o con un ripristino.
ALTER DEFAULT PRIVILEGES FOR ROLE amoris_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO amoris_app;
ALTER DEFAULT PRIVILEGES FOR ROLE amoris_owner IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO amoris_app;
