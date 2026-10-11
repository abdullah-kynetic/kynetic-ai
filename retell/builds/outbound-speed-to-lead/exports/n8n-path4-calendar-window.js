const root = $input.first().json;
const b = (root.body !== undefined && root.body !== null) ? root.body : root;
const args = (b && b.arguments && typeof b.arguments === 'object') ? b.arguments : b;
const la = $now.setZone('America/Los_Angeles');
let pref = String((args && args.preferred_date) || '').trim();
if (!/^\d{4}-\d{2}-\d{2}$/.test(pref)) pref = '';
let tod = String((args && args.time_of_day) || 'any').trim().toLowerCase();
if (tod !== 'morning' && tod !== 'afternoon') tod = 'any';
return [{ json: { start: la.toFormat('yyyy-MM-dd'), end: la.plus({ days: 14 }).toFormat('yyyy-MM-dd'), pref, tod } }];
