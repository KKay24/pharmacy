// This legacy utility previously called Sequelize `sync()` and offered a
// destructive `--replace` mode against PostgreSQL. It is intentionally retired:
// production schema changes must run through migrations and production data must
// not be overwritten from a local SQLite file.
console.error(
  'Inventory SQLite-to-PostgreSQL sync is disabled. Run `npm run migrate` against PostgreSQL and use a reviewed, one-time data migration plan instead.'
);
process.exitCode = 1;
