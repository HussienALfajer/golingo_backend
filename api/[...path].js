// Vercel serverless function handler - catch-all route for NestJS
let handler = null;

module.exports = async (req, res) => {
  // Handle preflight CORS requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    return res.status(200).end();
  }

  try {
    if (!handler) {
      console.log('[Vercel] Loading NestJS app...');
      
      // Import the compiled main module
      const mainModule = require('../dist/main.js');
      
      // Get the handler (default export or named export)
      handler = mainModule.default || mainModule.handler;
      
      if (!handler) {
        throw new Error('No handler found in main module. Available exports: ' + Object.keys(mainModule).join(', '));
      }
      
      console.log('[Vercel] Handler loaded successfully');
    }
    
    // Ensure the URL has the /api prefix for NestJS routing
    const originalUrl = req.url;
    if (!req.url.startsWith('/api')) {
      req.url = '/api' + (req.url === '/' ? '' : req.url);
    }
    
    console.log('[Vercel] Request:', req.method, originalUrl, '->', req.url);
    
    return await handler(req, res);
    
  } catch (error) {
    console.error('[Vercel] Error:', error.message);
    console.error('[Vercel] Stack:', error.stack);
    
    if (!res.headersSent) {
      res.status(500).json({
        statusCode: 500,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
      });
    }
  }
};

