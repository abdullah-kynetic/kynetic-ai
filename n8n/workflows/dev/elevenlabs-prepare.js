// n8n Code node, runOnceForAllItems. No I/O and no secret values in output.
const testPhone = $env.TEST_PHONE;
if (typeof testPhone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(testPhone)) {
  throw new Error('TEST_PHONE must be configured as E.164; no destination fallback');
}
const agentId = $env.DEV_ELEVENLABS_AGENT_ID;
const phoneId = $env.DEV_ELEVENLABS_PHONE_NUMBER_ID;
if (!agentId || !phoneId) throw new Error('DEV agent and phone identifiers must be configured');
return $input.all().map((item) => {
  const lead = item.json.body ?? item.json;
  if (lead.synthetic !== true) throw new Error('Synthetic test leads only');
  if (['FL', 'OK'].includes(String(lead.business_state ?? '').trim().toUpperCase())) {
    throw new Error('Business state is not supported');
  }
  const text = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : fallback;
  // Destination is always server configuration, never a submitted lead phone.
  return { json: {
    synthetic: true,
    dispatch_enabled: false,
    booking_mode: 'synthetic_only',
    request: {
      agent_id: agentId,
      agent_phone_number_id: phoneId,
      to_number: testPhone,
      conversation_initiation_client_data: { dynamic_variables: {
        first_name: text(lead.first_name, 'Synthetic Lead'),
        company_name: 'DEV Synthetic Contractor',
        project_type: text(lead.project_type, 'not provided'),
        budget: text(lead.budget, 'not provided'),
        timeline: text(lead.timeline, 'not provided'),
        // Email is optional; never substitute a real recipient.
        email: text(lead.email, '')
      } }
    }
  } };
});
