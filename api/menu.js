const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uvjqhfvxghtrvogdmzxz.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2anFoZnZ4Z2h0cnZvZ2Rtenh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MDY4MTMsImV4cCI6MjEwNzM4MjgxM30.uMQChyviNzD074wWGcBYu77XdKosuJk6sMBMVWBAoa0';

const DEFAULT_ADMIN = {
  salt: "0d657abf77978927",
  hash: "8e0f4d07f3c1c8ff062a9b1effe8cdd7f14dd484a559c4203619c8200a0ef8e9"
};

function getHeaders() {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };
}

module.exports = async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET: Fetch menu and site settings
    if (req.method === 'GET') {
      const endpoint = `${SUPABASE_URL}/rest/v1/orders?id=eq.MENU-CONFIG&select=*`;
      const response = await fetch(endpoint, {
        headers: getHeaders(),
        cache: 'no-store'
      });

      if (!response.ok) {
        return res.status(404).json({ error: 'Not found' });
      }

      const rows = await response.json();
      if (!Array.isArray(rows) || !rows.length || !rows[0].items) {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.status(200).json(rows[0].items);
    }

    // POST: Save menu and settings updates
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) { body = {}; }
      } else if (!body) {
        body = {};
      }

      const { data, hash } = body;
      if (!hash) {
        return res.status(401).json({ error: 'missing_auth' });
      }

      // Check current stored admin password hash
      let currentAdmin = DEFAULT_ADMIN;
      try {
        const getEndpoint = `${SUPABASE_URL}/rest/v1/orders?id=eq.MENU-CONFIG&select=*`;
        const currentRes = await fetch(getEndpoint, {
          headers: getHeaders(),
          cache: 'no-store'
        });
        if (currentRes.ok) {
          const currentRows = await currentRes.json();
          if (Array.isArray(currentRows) && currentRows.length && currentRows[0].items && currentRows[0].items.admin) {
            currentAdmin = currentRows[0].items.admin;
          }
        }
      } catch (err) {
        console.error('Error reading current admin info:', err);
      }

      // Verify password hash
      if (hash !== currentAdmin.hash) {
        return res.status(401).json({ error: 'badpass' });
      }

      // Upsert the updated menu & settings into Supabase
      const upsertEndpoint = `${SUPABASE_URL}/rest/v1/orders`;
      const upsertRes = await fetch(upsertEndpoint, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          id: 'MENU-CONFIG',
          type: 'config',
          room: 'SYSTEM',
          items: data,
          total: 0,
          status: 'active',
          updated_at: new Date().toISOString()
        })
      });

      if (!upsertRes.ok) {
        const errText = await upsertRes.text();
        console.error('Supabase upsert menu config error:', upsertRes.status, errText);
        return res.status(upsertRes.status).json({ error: 'Failed to save menu config to database' });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('api/menu handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
