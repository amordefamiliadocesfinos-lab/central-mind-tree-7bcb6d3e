// Real, versioned Núcleo migrations; only the existing disposable auth fixture is mocked.
export const identityBootstrapFiles=[
 'scripts/nucleo-m1-db-test-bootstrap.sql',
 'supabase/migrations/20261111193600_nucleo_m1_schema_capability.sql',
 'supabase/migrations/20261111193601_nucleo_m1_harden_service_role.sql',
 'supabase/migrations/20261111210000_nucleo_m2_source_references.sql',
 'supabase/migrations/20261111222000_nucleo_m3_development_center.sql',
 'supabase/migrations/20261111234500_nucleo_m4_technical_evidence.sql',
 'supabase/migrations/20261112200000_nucleo_v12_ficha_viva_revisoes.sql',
 'supabase/migrations/20261114183000_nucleo_ac01_contributions.sql',
 'supabase/migrations/20261114183100_nucleo_ac01_revoke_inherited_write_grants.sql',
 'docs/architecture/proposals/nucleo_identity_read_candidate.sql',
];
