# Database Setup and Migrations (Planned Feature)

> **⚠️ FUTURE IMPLEMENTATION**  
> This document describes the planned database migration system and PostgreSQL schema for future story processing features. **This is NOT currently implemented in production.** The current application uses in-memory storage for memories.

## Prerequisites

- PostgreSQL 13+ with pgvector extension
- Node.js 18+
- Environment variables set in `.env` file:
  ```
  DATABASE_URL=postgres://user:password@localhost:5432/vibe_agents
  ENCRYPTION_KEY=64_character_hex_string_for_encryption
  ```

## Planned Migration System

The planned application will use a dual migration approach:

1. **Automatic migrations** - Will run automatically on server startup via `server/database/index.js`
2. **Manual migrations** - Can be run independently using `scripts/run-migration.js`

Both systems will track completed migrations in the `migrations` table to prevent duplicate execution.

## Database Schema

### Core Tables

1. **users**
   - Stores user information linked to Firebase UID
   - Includes email, name, active status, and email verification
   - Tracks creation and update timestamps
   - Indexed on firebase_uid and email for fast lookups

2. **conversations**
   - Organizes messages into conversations
   - Each conversation belongs to a user
   - Includes title, description, archive status, and counters
   - Indexed for efficient filtering of active conversations

3. **encrypted_memories**
   - Stores encrypted memory payloads
   - Linked to conversations and users
   - Includes message IDs for reference

4. **stories**
   - Contains processed stories with vector embeddings
   - Includes metadata like people, places, and events
   - Supports semantic search with pgvector

5. **audit_logs**
   - Tracks user actions for security and debugging
   - Includes IP and user agent information

6. **user_preferences**
   - Stores user-specific settings
   - Uses JSONB for flexible schema

## Running Migrations

### Initial Setup

1. Create a new PostgreSQL database:
   ```bash
   createdb vibe_agents
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database schema:
   ```bash
   npm run migrate
   ```

### Creating New Migrations

To create a new migration:

```bash
npm run db:create-migration add_new_feature
```

This will create a new migration file in the `migrations` directory. Edit this file to include your schema changes.

### Running Migrations

Migrations can be applied in two ways:

#### Automatic (on server start)
Migrations are automatically applied when the server starts up. The `server/database/index.js` module checks for and applies any pending migrations during initialization.

#### Manual (using script)
To manually apply all pending migrations:

```bash
npm run migrate
# or
node scripts/run-migration.js
```

Migrations are run in alphabetical order and tracked in the `migrations` table. Each migration is wrapped in a transaction for safety.

## Database Design Principles

1. **Security**
   - All sensitive data is encrypted at rest
   - User data is strictly isolated
   - Audit logging for all sensitive operations

2. **Performance**
   - Appropriate indexes for common queries
   - Vector indexes for semantic search
   - GIN indexes for array columns

3. **Scalability**
   - Designed for horizontal scaling
   - Efficient query patterns
   - Batch operations where appropriate

## Backup and Recovery

### Creating Backups

```bash
pg_dump -Fc -d vibe_agents > vibe_agents_backup.dump
```

### Restoring from Backup

```bash
pg_restore -d vibe_agents --clean --if-exists vibe_agents_backup.dump
```

## Troubleshooting

### Common Issues

1. **Connection Issues**
   - Verify `DATABASE_URL` is correct
   - Check if PostgreSQL is running
   - Ensure the user has proper permissions

2. **Migration Failures**
   - Check for syntax errors in the migration file
   - Verify all required tables exist
   - Look for constraint violations

3. **Performance Problems**
   - Check for missing indexes
   - Analyze query performance with `EXPLAIN ANALYZE`
   - Monitor database resources

## Monitoring

Key metrics to monitor:
- Query performance
- Connection pool usage
- Disk space
- Replication lag (if applicable)

## Schema Changes

When making schema changes:

1. Create a new migration file in `migrations/` directory
   - Use sequential numbering (0001, 0002, etc.)
   - Use descriptive names (e.g., `0002_add_missing_columns.sql`)
   - Always use IF NOT EXISTS clauses for idempotency
2. Test thoroughly in development
3. Backup production data before applying
4. Consider downtime requirements
5. Document any required application changes

### Migration Best Practices

- **Idempotency**: All migrations should be safe to run multiple times
- **Transactions**: Migrations are automatically wrapped in transactions
- **Rollback strategy**: Keep manual rollback scripts for critical changes
- **Testing**: Test migrations on a copy of production data when possible

For large datasets, consider:
- Online schema changes (ALTER TABLE ... CONCURRENTLY)
- Background migrations for data transformations
- Zero-downtime deployments using blue-green or rolling strategies
