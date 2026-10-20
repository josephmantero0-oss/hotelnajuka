const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uvjqhfvxghtrvogdmzxz.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2anFoZnZ4Z2h0cnZvZ2Rtenh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MDY4MTMsImV4cCI6MjEwNzM4MjgxM30.uMQChyviNzD074wWGcBYu77XdKosuJk6sMBMVWBAoa0';

function formatOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type || 'restaurant',
    room: String(row.room || ''),
    items: Array.isArray(row.items) ? row.items : [],
    total: Number(row.total || 0),
    note: row.note || '',
    serviceTitle: row.service_title || '',
    service_title: row.service_title || '',
    status: row.status || 'pending',
    rejectReason: row.reject_reason || '',
    reject_reason: row.reject_reason || '',
    createdAt: row.created_at || new Date().toISOString(),
    created_at: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString()
  };
}

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
    // GET: Fetch live orders
    if (req.method === 'GET') {
      const endpoint = `${SUPABASE_URL}/rest/v1/orders?type=neq.config&select=*&order=created_at.desc&limit=200`;
      const response = await fetch(endpoint, {
        headers: getHeaders(),
        cache: 'no-store'
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Supabase GET orders error:', response.status, errText);
        return res.status(response.status).json({ error: 'Failed to fetch orders from database' });
      }

      const rows = await response.json();
      const orders = Array.isArray(rows) ? rows.map(formatOrder) : [];
      return res.status(200).json({ orders });
    }

    // POST: Create order or update status
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) { body = {}; }
      } else if (!body) {
        body = {};
      }

      const { action } = body;

      // Action: CREATE
      if (action === 'create') {
        const { type, room, items, total, note, serviceTitle, details } = body;
        if (!room) {
          return res.status(400).json({ error: 'Room number is required' });
        }

        const now = new Date().toISOString();
        const shortId = Math.floor(100 + Math.random() * 900);
        const orderId = `ORD-${Date.now().toString().slice(-4)}-${shortId}`;

        const newRow = {
          id: orderId,
          type: type || 'restaurant',
          room: String(room).trim(),
          items: Array.isArray(items) ? items : [],
          total: Number(total || 0),
          note: String(note || details || '').trim(),
          service_title: String(serviceTitle || '').trim(),
          status: 'pending',
          reject_reason: '',
          created_at: now,
          updated_at: now
        };

        const endpoint = `${SUPABASE_URL}/rest/v1/orders`;
        const postRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            ...getHeaders(),
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(newRow)
        });

        if (!postRes.ok) {
          const errText = await postRes.text();
          console.error('Supabase INSERT order error:', postRes.status, errText);
          return res.status(postRes.status).json({ error: 'Failed to insert order into database' });
        }

        const inserted = await postRes.json();
        const createdOrder = Array.isArray(inserted) && inserted.length ? inserted[0] : newRow;

        return res.status(201).json({ success: true, order: formatOrder(createdOrder) });
      }

      // Action: UPDATE STATUS
      if (action === 'update_status') {
        const { orderId, status, rejectReason } = body;
        if (!orderId || !status) {
          return res.status(400).json({ error: 'orderId and status are required' });
        }

        const updateData = {
          status: status,
          updated_at: new Date().toISOString()
        };
        if (rejectReason !== undefined) {
          updateData.reject_reason = String(rejectReason);
        }

        const endpoint = `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`;
        const patchRes = await fetch(endpoint, {
          method: 'PATCH',
          headers: {
            ...getHeaders(),
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updateData)
        });

        if (!patchRes.ok) {
          const errText = await patchRes.text();
          console.error('Supabase UPDATE order error:', patchRes.status, errText);
          return res.status(patchRes.status).json({ error: 'Failed to update order in database' });
        }

        const updated = await patchRes.json();
        const updatedOrder = Array.isArray(updated) && updated.length ? updated[0] : { id: orderId, ...updateData };

        return res.status(200).json({ success: true, order: formatOrder(updatedOrder) });
      }

      return res.status(400).json({ error: 'Invalid action. Supported: create, update_status' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('api/orders handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
