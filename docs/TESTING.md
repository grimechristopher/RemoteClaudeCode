# Testing Guide

This guide provides comprehensive testing procedures for the RemoteClaudeCode application, covering database connectivity, bidirectional sync, Nextcloud MCP integration, security, and application functionality.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Connectivity Tests](#database-connectivity-tests)
3. [Bidirectional Sync Tests](#bidirectional-sync-tests)
4. [Nextcloud MCP Integration Tests](#nextcloud-mcp-integration-tests)
5. [Security and Firewall Tests](#security-and-firewall-tests)
6. [Application Functionality Tests](#application-functionality-tests)
7. [Troubleshooting](#troubleshooting)
8. [CI/CD Integration](#cicd-integration)

## Prerequisites

Before running tests, ensure you have:

- Docker and Docker Compose installed
- Access to the test environment
- Test credentials configured in `.env.test`
- Node.js and npm installed for integration tests

```bash
# Install test dependencies
npm install --save-dev jest supertest

# Copy test environment template
cp .env.example .env.test
```

## Database Connectivity Tests

### Test 1: Basic PostgreSQL Connection

**Purpose:** Verify the application can connect to PostgreSQL

```bash
# Start the database
docker-compose up -d postgres

# Test connection
docker-compose exec postgres psql -U claudecode -d claudecode -c "SELECT version();"
```

**Expected Result:** PostgreSQL version information displayed

**Troubleshooting:**
- If connection fails, check `POSTGRES_HOST` in `.env`
- Verify firewall rules allow port 5432
- Check container logs: `docker-compose logs postgres`

### Test 2: Database Schema Validation

**Purpose:** Ensure all required tables and indexes exist

```bash
# Check tables
docker-compose exec postgres psql -U claudecode -d claudecode -c "\dt"

# Verify schema
docker-compose exec postgres psql -U claudecode -d claudecode -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public';"
```

**Expected Tables:**
- `jobs`
- `messages`
- `conversations`
- `sync_status`
- `audit_logs`

### Test 3: Database Performance

**Purpose:** Verify query performance under load

```bash
# Run performance test
npm run test:db-performance
```

**Acceptance Criteria:**
- Simple queries: < 50ms
- Complex joins: < 200ms
- Bulk inserts: < 1s for 1000 records

## Bidirectional Sync Tests

### Test 4: Local to Nextcloud Sync

**Purpose:** Verify data syncs from local DB to Nextcloud

**Test Steps:**

1. Create a test job in local database:

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Sync Job",
    "status": "pending",
    "data": {"test": true}
  }'
```

2. Trigger sync:

```bash
curl -X POST http://localhost:3000/api/sync/trigger
```

3. Verify in Nextcloud:

```bash
# Check Nextcloud file exists
docker-compose exec nextcloud-mcp ls -la /data/claudecode/jobs/
```

**Expected Result:** Job file appears in Nextcloud within 30 seconds

### Test 5: Nextcloud to Local Sync

**Purpose:** Verify data syncs from Nextcloud to local DB

**Test Steps:**

1. Create a file in Nextcloud:

```bash
docker-compose exec nextcloud-mcp bash -c '
  echo "{\"title\":\"Nextcloud Test Job\",\"status\":\"pending\"}" > /data/claudecode/jobs/test_$(date +%s).json
'
```

2. Wait for sync cycle (or trigger manually)

3. Verify in local database:

```bash
curl http://localhost:3000/api/jobs | jq '.[] | select(.title=="Nextcloud Test Job")'
```

**Expected Result:** Job appears in local database within 60 seconds

### Test 6: Conflict Resolution

**Purpose:** Test conflict handling when same record modified in both locations

**Test Steps:**

1. Create job in both locations with same ID but different data
2. Trigger sync
3. Verify conflict resolution follows configured strategy

```javascript
// test/sync-conflicts.test.js
describe('Conflict Resolution', () => {
  it('should use last-write-wins strategy', async () => {
    // Create job locally
    const localJob = await createJob({ id: 'test-1', title: 'Local Version', updated_at: '2024-01-01' });

    // Create same job in Nextcloud (newer timestamp)
    await createNextcloudJob({ id: 'test-1', title: 'Nextcloud Version', updated_at: '2024-01-02' });

    // Trigger sync
    await triggerSync();

    // Verify Nextcloud version won
    const result = await getJob('test-1');
    expect(result.title).toBe('Nextcloud Version');
  });
});
```

**Expected Result:** Newer version (by timestamp) wins; conflict logged in audit table

### Test 7: Sync Error Handling

**Purpose:** Verify graceful handling of sync failures

**Test Steps:**

1. Stop Nextcloud container:

```bash
docker-compose stop nextcloud-mcp
```

2. Trigger sync:

```bash
curl -X POST http://localhost:3000/api/sync/trigger
```

3. Check error handling:

```bash
# Check logs
docker-compose logs app | grep "sync error"

# Verify retry mechanism
curl http://localhost:3000/api/sync/status
```

**Expected Result:**
- Error logged but application remains stable
- Sync retries according to configured policy
- Failed items queued for retry

## Nextcloud MCP Integration Tests

### Test 8: MCP Server Connectivity

**Purpose:** Verify the Nextcloud MCP server is accessible

```bash
# Test MCP health endpoint
curl http://localhost:8080/health

# Test MCP capabilities
curl http://localhost:8080/capabilities
```

**Expected Result:** JSON response with server capabilities

### Test 9: File Operations via MCP

**Purpose:** Test CRUD operations through MCP

```javascript
// test/mcp-integration.test.js
describe('MCP File Operations', () => {
  it('should create file in Nextcloud', async () => {
    const response = await mcpClient.writeFile({
      path: '/claudecode/test.json',
      content: JSON.stringify({ test: true })
    });
    expect(response.success).toBe(true);
  });

  it('should read file from Nextcloud', async () => {
    const content = await mcpClient.readFile({
      path: '/claudecode/test.json'
    });
    expect(JSON.parse(content).test).toBe(true);
  });

  it('should list directory contents', async () => {
    const files = await mcpClient.listDirectory({
      path: '/claudecode/'
    });
    expect(files).toContain('test.json');
  });

  it('should delete file', async () => {
    const response = await mcpClient.deleteFile({
      path: '/claudecode/test.json'
    });
    expect(response.success).toBe(true);
  });
});
```

### Test 10: MCP Authentication

**Purpose:** Verify MCP authentication mechanisms

```bash
# Test with invalid credentials
curl -H "Authorization: Bearer invalid_token" http://localhost:8080/api/files

# Test with valid credentials
curl -H "Authorization: Bearer $(cat .mcp-token)" http://localhost:8080/api/files
```

**Expected Result:** Invalid token rejected (401), valid token accepted

### Test 11: MCP Performance

**Purpose:** Test MCP throughput and latency

```bash
# Run performance test
npm run test:mcp-performance
```

**Acceptance Criteria:**
- File read: < 100ms for 1MB file
- File write: < 200ms for 1MB file
- Directory listing: < 50ms for 100 files

## Security and Firewall Tests

### Test 12: Port Accessibility

**Purpose:** Verify only intended ports are exposed

```bash
# Scan ports from external host
nmap -p 1-10000 <server-ip>

# Expected open ports:
# - 3000 (app)
# - 8080 (MCP)
# - 5432 (PostgreSQL - should be firewalled from external)
```

**Expected Result:**
- Application port accessible
- MCP port accessible (if configured)
- Database port NOT accessible from external networks

### Test 13: Authentication Requirements

**Purpose:** Verify all endpoints require authentication

```bash
# Test without auth token
curl http://localhost:3000/api/jobs

# Test with invalid token
curl -H "Authorization: Bearer invalid" http://localhost:3000/api/jobs

# Test with valid token
curl -H "Authorization: Bearer $(cat .auth-token)" http://localhost:3000/api/jobs
```

**Expected Result:** Unauthorized requests return 401

### Test 14: SQL Injection Prevention

**Purpose:** Verify input sanitization

```javascript
// test/security.test.js
describe('SQL Injection Prevention', () => {
  it('should sanitize malicious input', async () => {
    const maliciousInput = "'; DROP TABLE jobs; --";

    const response = await request(app)
      .post('/api/jobs')
      .send({ title: maliciousInput })
      .expect(201);

    // Verify table still exists
    const tables = await db.query("SELECT * FROM jobs");
    expect(tables).toBeDefined();
  });
});
```

### Test 15: Rate Limiting

**Purpose:** Verify rate limiting protects against abuse

```bash
# Send rapid requests
for i in {1..100}; do
  curl http://localhost:3000/api/jobs &
done
wait

# Check for rate limit responses
curl -v http://localhost:3000/api/jobs 2>&1 | grep "429"
```

**Expected Result:** After threshold, requests receive 429 Too Many Requests

## Application Functionality Tests

### Test 16: Job Creation and Retrieval

**Purpose:** Test core job management functionality

```bash
# Create job
JOB_ID=$(curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Job","status":"pending"}' | jq -r '.id')

# Retrieve job
curl http://localhost:3000/api/jobs/$JOB_ID

# List all jobs
curl http://localhost:3000/api/jobs
```

**Expected Result:** Job created and retrievable

### Test 17: Job Status Updates

**Purpose:** Test job lifecycle management

```bash
# Update job status
curl -X PATCH http://localhost:3000/api/jobs/$JOB_ID \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}'

# Verify update
curl http://localhost:3000/api/jobs/$JOB_ID | jq '.status'
```

**Expected Result:** Status updated successfully

### Test 18: Message Threading

**Purpose:** Test message association with jobs

```bash
# Add message to job
curl -X POST http://localhost:3000/api/jobs/$JOB_ID/messages \
  -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Test message"}'

# Retrieve messages
curl http://localhost:3000/api/jobs/$JOB_ID/messages
```

**Expected Result:** Message associated with job

### Test 19: Error Handling

**Purpose:** Verify graceful error handling

```bash
# Test invalid job ID
curl http://localhost:3000/api/jobs/invalid-id

# Test missing required fields
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{}'

# Test malformed JSON
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d 'invalid json'
```

**Expected Result:** Appropriate error responses (400, 404, etc.)

### Test 20: End-to-End Workflow

**Purpose:** Test complete user workflow

```javascript
// test/e2e.test.js
describe('End-to-End Workflow', () => {
  it('should complete full job lifecycle', async () => {
    // Create job
    const job = await createJob({ title: 'E2E Test' });
    expect(job.status).toBe('pending');

    // Add message
    const message = await addMessage(job.id, 'Start processing');
    expect(message.job_id).toBe(job.id);

    // Update status
    await updateJob(job.id, { status: 'in_progress' });

    // Sync to Nextcloud
    await triggerSync();
    await waitForSync();

    // Verify in Nextcloud
    const ncFile = await readNextcloudFile(`/jobs/${job.id}.json`);
    expect(JSON.parse(ncFile).status).toBe('in_progress');

    // Complete job
    await updateJob(job.id, { status: 'completed' });

    // Verify final state
    const finalJob = await getJob(job.id);
    expect(finalJob.status).toBe('completed');
  });
});
```

## Troubleshooting

### Database Connection Issues

**Problem:** Cannot connect to PostgreSQL

**Solutions:**
1. Check container status: `docker-compose ps`
2. Verify credentials in `.env`
3. Check firewall rules: `sudo ufw status`
4. Review logs: `docker-compose logs postgres`

### Sync Failures

**Problem:** Data not syncing between local and Nextcloud

**Solutions:**
1. Check sync status: `curl http://localhost:3000/api/sync/status`
2. Verify Nextcloud MCP is running: `docker-compose ps nextcloud-mcp`
3. Check sync logs: `docker-compose logs app | grep sync`
4. Manually trigger sync: `curl -X POST http://localhost:3000/api/sync/trigger`

### MCP Connection Issues

**Problem:** Cannot connect to Nextcloud MCP

**Solutions:**
1. Verify MCP container is running: `docker-compose ps nextcloud-mcp`
2. Check MCP logs: `docker-compose logs nextcloud-mcp`
3. Test MCP endpoint: `curl http://localhost:8080/health`
4. Verify network connectivity: `docker-compose exec app ping nextcloud-mcp`

### Performance Issues

**Problem:** Slow query or sync performance

**Solutions:**
1. Check database indexes: `EXPLAIN ANALYZE <query>`
2. Monitor resource usage: `docker stats`
3. Review slow query log
4. Optimize sync batch sizes in configuration

### Authentication Errors

**Problem:** 401 Unauthorized responses

**Solutions:**
1. Verify token is valid: `curl -H "Authorization: Bearer $(cat .auth-token)" http://localhost:3000/api/health`
2. Check token expiration
3. Regenerate token if needed
4. Verify environment variables are loaded

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: claudecode_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run unit tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost:5432/claudecode_test

      - name: Run integration tests
        run: npm run test:integration

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-commit Hooks

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run lint
npm run test:quick
```

### Test Coverage Requirements

Maintain minimum coverage thresholds:

```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

## Additional Resources

- [Database Schema Documentation](./DATABASE.md)
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

## Contributing

When adding new features, please:

1. Write tests that cover the new functionality
2. Ensure all existing tests pass
3. Update this testing guide with new test cases
4. Maintain test coverage above 80%

For questions or issues with testing, please open an issue on GitHub.
