/* eslint-disable @typescript-eslint/no-require-imports */
// Custom server for Next.js to run with IISNode
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// Force production mode
const dev = false;
const hostname = 'localhost';

// Handle both numeric port and IISNode named pipe
const portEnv = process.env.PORT || '3000';
const port = isNaN(Number(portEnv)) ? portEnv : parseInt(portEnv, 10);

console.log(`Starting Next.js server in ${dev ? 'development' : 'production'} mode`);
console.log(`Port/Pipe: ${port}`);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      // Clean URL - remove extra spaces and normalize
      const cleanUrl = req.url.trim().replace(/%20/g, ' ').replace(/\s+/g, '');
      const parsedUrl = parse(cleanUrl || '/', true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    const displayPort = typeof port === 'number' ? port : 'named pipe';
    console.log(`> Next.js ready on port/pipe: ${displayPort}`);
    console.log(`> Using .next build directory`);
  });
}).catch((err) => {
  console.error('Failed to start Next.js:', err);
  process.exit(1);
});
