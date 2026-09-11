const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(process.env.HOME, '.glogercfg');
const AUTH_PAGE = "https://dev-aemni.github.io/gloger";
const RENDER_BACKEND = "https://gloger.onrender.com";

// 1. Function to trigger Login Flow from CLI
function loginCLI() {
  return new Promise((resolve) => {
    // Start temporary local loopback server
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:8989');
      const apiKey = url.searchParams.get('apiKey');
      const email = url.searchParams.get('email');

      if (apiKey) {
        // Save auth key locally
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ apiKey, email }));
        
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end('CLI Authenticated');
        
        console.log(`\nSuccessfully logged in as: ${email}`);
        server.close();
        resolve(apiKey);
      }
    });

    server.listen(8989, () => {
      const loginUrl = `${AUTH_PAGE}?callback=http://localhost:8989/callback`;
      console.log(`Opening browser to authenticate: ${loginUrl}`);
      
      // Open Android Browser via Termux
      exec(`termux-open-url "${loginUrl}"`);
    });
  });
}

// 2. Check token limit from CLI
async function checkTokens(apiKey) {
  const res = await fetch(`${RENDER_BACKEND}/api/cli/balance`, {
    headers: { 'x-api-key': apiKey }
  });
  const data = await res.json();
  console.log(`Live Tokens Remaining: ${data.tokensRemaining.toLocaleString()}`);
}

// Main execution flow
(async () => {
  let apiKey;
  if (fs.existsSync(CONFIG_FILE)) {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE));
    apiKey = config.apiKey;
    console.log(`Using cached session for: ${config.email}`);
  } else {
    apiKey = await loginCLI();
  }

  await checkTokens(apiKey);
})();
