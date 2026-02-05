#!/bin/bash

echo "🗄️  Creating database..."
# You may need to adjust the user/password here based on your PostgreSQL setup
docker exec local_pgdb createdb -U YOUR_USER remoteclaudecode 2>/dev/null || echo "Database may already exist"

echo "📦 Running database migrations..."
npx drizzle-kit push

echo "✅ Setup complete!"
echo ""
echo "🚀 To start the app, run:"
echo "   npm run dev"
