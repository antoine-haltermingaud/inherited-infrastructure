// pricefeed — aggregates market prices and serves them to Delta apps.
// Plain Node, no framework. Talks to MySQL (persistent) and Redis (cache).

const http = require('http');

const PORT = process.env.PORT || 3000;

const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER || 'admin';
const DB_PASSWORD = process.env.DB_PASSWORD;
const REDIS_HOST = process.env.REDIS_HOST;

// NOTE: real DB/Redis clients omitted to keep the exercise self-contained.
// Assume standard mysql2 / ioredis usage; connection details come from the
// environment variables above, which are injected by the infrastructure.

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.url === '/prices') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        source: 'cache',
        db: { host: DB_HOST, user: DB_USER },
        redis: { host: REDIS_HOST },
        prices: [{ symbol: 'BTC', price: 67421.5 }],
      })
    );
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`pricefeed listening on :${PORT}`);
});
