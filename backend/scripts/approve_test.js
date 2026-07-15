(async () => {
  try {
    const base = 'http://localhost:4000';
    const res = await fetch(base + '/submissions');
    const subs = await res.json();
    console.log('All submissions:', JSON.stringify(subs, null, 2));
    if (!subs || subs.length === 0) {
        console.log('No submissions found; creating a test submission...');
        const create = await fetch(base + '/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_id: 'test-device-1', photo_url: 'https://example.com/test.jpg', latitude: 40.7128, longitude: -74.006, captured_at: new Date().toISOString() }),
        });
        const created = await create.json();
        console.log('Created:', JSON.stringify(created, null, 2));
        subs.push(created);
    }
    const first = subs[0];
    console.log('Approving submission id:', first.id);
    const patch = await fetch(`${base}/submissions/${first.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const patched = await patch.json();
    console.log('Patched:', JSON.stringify(patched, null, 2));
    const approvedRes = await fetch(base + '/submissions');
    const all = await approvedRes.json();
    console.log('After update, submissions:', JSON.stringify(all, null, 2));
  } catch (err) {
    console.error('Error in script:', err);
  }
})();
