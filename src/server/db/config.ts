/**
 * Database configuration loader
 *
 * Originally read from GoDaddy/Airo's Nomad-injected /local/config.json.
 * That file only exists inside GoDaddy's own container infrastructure, so
 * this now reads from standard environment variables instead — portable
 * across Render, Railway, or any other host.
 *
 * Supports two conventions, checked in this order:
 *   1. A single DATABASE_URL connection string (mysql://user:pass@host:port/db)
 *   2. Discrete DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME variables
 *      (also accepts Railway's MYSQLHOST / MYSQLPORT / MYSQLUSER /
 *      MYSQLPASSWORD / MYSQLDATABASE names, since that's what Railway's
 *      MySQL plugin auto-provides)
 */
import { env } from 'node:process';

export interface DatabaseCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function fromConnectionString(url: string): DatabaseCredentials {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '3306', 10),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
  };
}

export function getDatabaseCredentials(): DatabaseCredentials {
  // 1. Single connection-string style (Railway, Render, most hosts support this)
  const url = env.DATABASE_URL || env.MYSQL_URL;
  if (url) {
    return fromConnectionString(url);
  }

  // 2. Discrete variables — check both generic and Railway-specific names
  const host = env.DB_HOST || env.MYSQLHOST;
  const port = env.DB_PORT || env.MYSQLPORT;
  const user = env.DB_USER || env.MYSQLUSER;
  const password = env.DB_PASSWORD || env.MYSQLPASSWORD;
  const database = env.DB_NAME || env.MYSQLDATABASE;

  if (host && port && user && password && database) {
    return {
      host,
      port: parseInt(port, 10),
      user,
      password,
      database,
    };
  }

  throw new Error(
    'Database configuration not found. Set DATABASE_URL, or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME environment variables.'
  );
}
