import { mysqlTable, int, varchar, text, boolean, timestamp, float } from 'drizzle-orm/mysql-core';

// ─── BetterAuth Tables ────────────────────────────────────────────────────────

// ─── BetterAuth Tables ────────────────────────────────────────────────────────

export const user = mysqlTable('user', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  image: text('image'),
  isAdmin: boolean('is_admin').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const session = mysqlTable('session', {
  id: varchar('id', { length: 36 }).primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const account = mysqlTable('account', {
  id: varchar('id', { length: 36 }).primaryKey(),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: varchar('password', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const verification = mysqlTable('verification', {
  id: varchar('id', { length: 36 }).primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ─── Player Profiles ──────────────────────────────────────────────────────────

export const players = mysqlTable('players', {
  id: int('id').primaryKey().autoincrement(),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  position: varchar('position', { length: 100 }).default('Pitcher'),
  team: varchar('team', { length: 255 }),
  throws: varchar('throws', { length: 10 }).default('R'), // R | L | S
  age: int('age'),
  height: varchar('height', { length: 20 }),
  weight: int('weight'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ─── Pitch Sessions ───────────────────────────────────────────────────────────

export const pitchSessions = mysqlTable('pitch_sessions', {
  id: int('id').primaryKey().autoincrement(),
  playerId: int('player_id')
    .notNull()
    .references(() => players.id, { onDelete: 'cascade' }),
  sessionDate: timestamp('session_date').defaultNow(),
  label: varchar('label', { length: 255 }),
  totalPitches: int('total_pitches').default(0),
  strikes: int('strikes').default(0),
  balls: int('balls').default(0),
  avgVelocity: float('avg_velocity'),
  maxVelocity: float('max_velocity'),
  notes: text('notes'),
  // Session lifecycle: calibrating -> active -> ended
  //   calibrating: created, waiting on a calibration clip + zone corners
  //   active:      zone set, pitch uploads allowed
  //   ended:       locked, no more uploads, report available
  status: varchar('status', { length: 20 }).default('calibrating'),
  // Calibrated strike zone as fractions (0–1) of the video frame
  zoneTop: float('zone_top'),
  zoneBottom: float('zone_bottom'),
  zoneLeft: float('zone_left'),
  zoneRight: float('zone_right'),
  // The clip the zone was calibrated from, plus its dimensions so the
  // fractions above can be mapped back to pixels consistently
  calibrationVideoUrl: text('calibration_video_url'),
  calibrationFrameWidth: int('calibration_frame_width'),
  calibrationFrameHeight: int('calibration_frame_height'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Individual Pitches ───────────────────────────────────────────────────────

// ─── Pitch Video Analyses ─────────────────────────────────────────────────────

export const pitchVideoAnalyses = mysqlTable('pitch_video_analyses', {
  id: int('id').primaryKey().autoincrement(),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  sessionId: int('session_id')
    .references(() => pitchSessions.id, { onDelete: 'cascade' }),
  pitchId: varchar('pitch_id', { length: 36 }).notNull().unique(), // UUID used as RunPod pitch_id
  videoUrl: text('video_url').notNull(),
  status: varchar('status', { length: 20 }).default('pending'), // pending | processing | done | error
  impactType: varchar('impact_type', { length: 20 }),   // mitt | bat | null
  impactFrame: int('impact_frame'),
  ballX: float('ball_x'),
  ballY: float('ball_y'),
  combinedConf: float('combined_conf'),
  flightPath: text('flight_path'),   // JSON array of {x,y} points
  pathPoints: text('path_points'),   // JSON array of {x,y} points
  frameWidth: int('frame_width'),
  frameHeight: int('frame_height'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ─── Individual Pitches ───────────────────────────────────────────────────────

export const pitches = mysqlTable('pitches', {
  id: int('id').primaryKey().autoincrement(),
  sessionId: int('session_id')
    .notNull()
    .references(() => pitchSessions.id, { onDelete: 'cascade' }),
  pitchType: varchar('pitch_type', { length: 50 }), // Fastball, Curveball, Slider, etc.
  velocity: float('velocity'),
  spinRate: int('spin_rate'),
  locationX: float('location_x'), // -1 to 1 (left to right)
  locationY: float('location_y'), // 0 to 1 (bottom to top of zone)
  result: varchar('result', { length: 50 }), // strike, ball, foul, hit, etc.
  count: varchar('count', { length: 10 }), // e.g. "0-0", "1-2"
  pitchNumber: int('pitch_number'),
  createdAt: timestamp('created_at').defaultNow(),
});
