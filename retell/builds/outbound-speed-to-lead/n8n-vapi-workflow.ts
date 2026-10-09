import { workflow, node, trigger, sticky, placeholder, newCredential, ifElse, expr } from '@n8n/workflow-sdk';

const twentyCred = { id: '41C04qbmnbi0GI2P', name: 'Twenty account' };
const gmailCred = { id: 'dil4wMogas9aOWKP', name: 'Abdullah Kynetic account' };
const clientAccountId = '56b85831-d0fd-4f0a-a9b7-e96956278bb8';
const vapiAssistantId = '8e51e8d6-a34e-4443-ab1f-a004d72dd73d';

const intakeForm = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: {
    name: 'Roof Inspection Request Form',
    parameters: {
      authentication: 'none',
      formTitle: 'Get a free roof inspection | Kynetic Roofing',
      formDescription: 'Tell us about your roof and our AI assistant will call you in about a minute.',
      formFields: {
        values: [
          { fieldLabel: 'Full name', fieldName: 'full_name', fieldType: 'text', requiredField: true },
          { fieldLabel: 'Phone number', fieldName: 'phone', fieldType: 'text', placeholder: '(541) 555-0123', requiredField: true },
          { fieldLabel: 'ZIP code', fieldName: 'zip', fieldType: 'text', requiredField: true },
          { fieldLabel: 'Do you own the property?', fieldName: 'owns', fieldType: 'dropdown', fieldOptions: { values: [{ option: 'Yes' }, { option: 'No' }] }, requiredField: true },
          { fieldLabel: "What's going on with your roof?", fieldName: 'issue', fieldType: 'dropdown', fieldOptions: { values: [{ option: 'Leak' }, { option: 'Storm or hail damage' }, { option: 'Need a replacement quote' }, { option: 'Just looking' }] }, requiredField: true },
          { fieldLabel: 'How soon do you want it looked at?', fieldName: 'timeline', fieldType: 'dropdown', fieldOptions: { values: [{ option: 'As soon as possible' }, { option: 'Within 2 weeks' }, { option: 'Within 3 months' }, { option: 'Just exploring' }] }, requiredField: true },
          { fieldLabel: 'Consent to be called', fieldName: 'consent', fieldType: 'checkbox', fieldOptions: { values: [{ option: 'By submitting this form, I agree that Kynetic Roofing and its AI assistant may call me at the number I entered about my request, using an artificial or AI generated voice. Calls may be recorded. I understand consent is not a condition of any purchase.' }] }, requiredField: true }
        ]
      },
      options: {
        appendAttribution: false,
        respondWithOptions: { values: { formSubmittedText: 'Thanks. Our AI assistant will call you in about a minute.' } }
      }
    }
  },
  output: [{ full_name: 'Test Lead', phone: '(541) 555-0123', zip: '97702', owns: 'Yes', issue: 'Leak', timeline: 'As soon as possible', consent: ['By submitting this form, I agree'] }]
});

const normalizeLead = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalize Lead',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const out = [];
const ownsMap = { 'Yes': 'YES', 'No': 'NO' };
const issueMap = { 'Leak': 'LEAK', 'Storm or hail damage': 'STORM_OR_HAIL', 'Need a replacement quote': 'REPLACEMENT_QUOTE', 'Just looking': 'JUST_LOOKING' };
const issueSpoken = { 'LEAK': 'a leak', 'STORM_OR_HAIL': 'storm or hail damage', 'REPLACEMENT_QUOTE': 'a replacement quote', 'JUST_LOOKING': 'just looking' };
const timelineMap = { 'As soon as possible': 'ASAP', 'Within 2 weeks': 'TWO_WEEKS', 'Within 3 months': 'THREE_MONTHS', 'Just exploring': 'EXPLORING' };
const timelineSpoken = { 'ASAP': 'as soon as possible', 'TWO_WEEKS': 'within 2 weeks', 'THREE_MONTHS': 'within 3 months', 'EXPLORING': 'just exploring' };
for (const item of $input.all()) {
  const f = item.json;
  const fullName = String(f.full_name || '').trim();
  let digits = String(f.phone || '').replace(/\\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  const phoneValid = digits.length === 10;
  const consentList = Array.isArray(f.consent) ? f.consent : (f.consent ? [f.consent] : []);
  const owns = ownsMap[f.owns] || 'UNKNOWN';
  const issue = issueMap[f.issue] || null;
  const timeline = timelineMap[f.timeline] || null;
  out.push({ json: {
    fullName,
    firstName: fullName.split(' ')[0] || 'there',
    phoneDigits: digits,
    phoneE164: phoneValid ? '+1' + digits : '',
    phoneValid,
    zip: String(f.zip || '').trim(),
    consent: consentList.length > 0,
    consentText: consentList.length > 0 ? String(consentList[0]) : '',
    ownsProperty: owns,
    ownsSpoken: owns === 'NO' ? 'no' : 'yes',
    issueType: issue,
    issueSpoken: issueSpoken[issue] || 'a roof issue',
    timeline,
    timelineSpoken: timelineSpoken[timeline] || 'soon',
    submittedAt: new Date().toISOString()
  } });
}
return out;`
    }
  },
  output: [{ fullName: 'Test Lead', firstName: 'Test', phoneDigits: '5415550123', phoneE164: '+15415550123', phoneValid: true, zip: '97702', consent: true, consentText: 'By submitting this form', ownsProperty: 'YES', ownsSpoken: 'yes', issueType: 'LEAK', issueSpoken: 'a leak', timeline: 'ASAP', timelineSpoken: 'as soon as possible', submittedAt: '2026-10-09T20:00:00.000Z' }]
});

const checkDuplicate = node({
  type: '@blackswampai/n8n-nodes-twentycrm.twenty',
  version: 1,
  config: {
    name: 'Check Recent Duplicate',
    alwaysOutputData: true,
    parameters: {
      resource: 'record',
      operation: 'getMany',
      objectApiName: { __rl: true, mode: 'apiName', value: 'endCustomer' },
      returnAll: false,
      limit: 1,
      options: {
        filter: expr('and(phones.primaryPhoneNumber[eq]:"{{ $json.phoneDigits }}",formSubmittedAt[gte]:"{{ $now.minus({ hours: 24 }).toUTC().toISO() }}")')
      }
    },
    credentials: { twentyApi: twentyCred }
  },
  output: [{}]
});

const lightGate = ifElse({
  version: 2.3,
  config: {
    name: 'Light Gate Passes?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          { leftValue: expr("{{ $('Normalize Lead').item.json.phoneValid }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } },
          { leftValue: expr("{{ $('Normalize Lead').item.json.consent }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } },
          { leftValue: expr('{{ $json.id ? "duplicate" : "new" }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'new' }
        ],
        combinator: 'and'
      }
    }
  }
});

const createLead = node({
  type: '@blackswampai/n8n-nodes-twentycrm.twenty',
  version: 1,
  config: {
    name: 'Create Lead in Twenty',
    parameters: {
      resource: 'record',
      operation: 'create',
      objectApiName: { __rl: true, mode: 'apiName', value: 'endCustomer' },
      inputMode: 'json',
      jsonInput: expr('{{ JSON.stringify({ name: $("Normalize Lead").item.json.fullName, fullName: $("Normalize Lead").item.json.fullName, phones: { primaryPhoneNumber: $("Normalize Lead").item.json.phoneDigits, primaryPhoneCountryCode: "US", primaryPhoneCallingCode: "+1" }, location: $("Normalize Lead").item.json.zip, leadSource: "WEB_FORM", consentText: $("Normalize Lead").item.json.consentText, consentAt: $("Normalize Lead").item.json.submittedAt, formSubmittedAt: $("Normalize Lead").item.json.submittedAt, leadStatus: "NEW", attemptCount: 0, callOptOut: false, ownsProperty: $("Normalize Lead").item.json.ownsProperty, issueType: $("Normalize Lead").item.json.issueType, timeline: $("Normalize Lead").item.json.timeline, clientAccountId: "56b85831-d0fd-4f0a-a9b7-e96956278bb8" }) }}')
    },
    credentials: { twentyApi: twentyCred }
  },
  output: [{ id: 'lead-id-123' }]
});

const logNotDialed = node({
  type: '@blackswampai/n8n-nodes-twentycrm.twenty',
  version: 1,
  config: {
    name: 'Log Submission Not Dialed',
    parameters: {
      resource: 'record',
      operation: 'create',
      objectApiName: { __rl: true, mode: 'apiName', value: 'endCustomer' },
      inputMode: 'json',
      jsonInput: expr('{{ JSON.stringify({ name: $("Normalize Lead").item.json.fullName, fullName: $("Normalize Lead").item.json.fullName, phones: { primaryPhoneNumber: $("Normalize Lead").item.json.phoneDigits, primaryPhoneCountryCode: "US", primaryPhoneCallingCode: "+1" }, location: $("Normalize Lead").item.json.zip, leadSource: "WEB_FORM", consentText: $("Normalize Lead").item.json.consentText, consentAt: $("Normalize Lead").item.json.consent ? $("Normalize Lead").item.json.submittedAt : null, formSubmittedAt: $("Normalize Lead").item.json.submittedAt, leadStatus: "DISQUALIFIED", attemptCount: 0, callOptOut: false, ownsProperty: $("Normalize Lead").item.json.ownsProperty, issueType: $("Normalize Lead").item.json.issueType, timeline: $("Normalize Lead").item.json.timeline, clientAccountId: "56b85831-d0fd-4f0a-a9b7-e96956278bb8" }) }}')
    },
    credentials: { twentyApi: twentyCred }
  },
  output: [{ id: 'lead-id-456' }]
});

const firstCallHours = ifElse({
  version: 2.3,
  config: {
    name: 'Inside Calling Hours (First Call)?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          { leftValue: expr('{{ $now.setZone("America/Los_Angeles").hour }}'), operator: { type: 'number', operation: 'gte' }, rightValue: 9 },
          { leftValue: expr('{{ $now.setZone("America/Los_Angeles").hour }}'), operator: { type: 'number', operation: 'lt' }, rightValue: 20 }
        ],
        combinator: 'and'
      }
    }
  }
});

const queueLead = node({
  type: '@blackswampai/n8n-nodes-twentycrm.twenty',
  version: 1,
  config: {
    name: 'Queue Lead for Morning Call',
    parameters: {
      resource: 'record',
      operation: 'update',
      objectApiName: { __rl: true, mode: 'apiName', value: 'endCustomer' },
      recordId: expr('{{ $("Create Lead in Twenty").item.json.id }}'),
      inputMode: 'json',
      jsonInput: expr('{{ JSON.stringify({ leadStatus: "NO_ANSWER", attemptCount: 0, nextAttemptAt: $now.setZone("America/Los_Angeles").plus({ days: $now.setZone("America/Los_Angeles").hour >= 9 ? 1 : 0 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO() }) }}')
    },
    credentials: { twentyApi: twentyCred }
  },
  output: [{ id: 'lead-id-123' }]
});

const callSettings = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Call Settings',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'cs-assistant', name: 'assistantId', value: vapiAssistantId, type: 'string' },
          { id: 'cs-phone', name: 'phoneNumberId', value: placeholder('Vapi phone number ID (add after testing)'), type: 'string' },
          { id: 'cs-company', name: 'companyName', value: 'Kynetic Roofing', type: 'string' },
          { id: 'cs-agentname', name: 'agentName', value: 'Alex', type: 'string' }
        ]
      }
    }
  },
  output: [{ id: 'lead-id-123', assistantId: vapiAssistantId, phoneNumberId: 'phone-id', companyName: 'Kynetic Roofing', agentName: 'Alex' }]
});

const alertCallFailed = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Alert Call Failed',
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: 'abdullah@kyneticai.com',
      subject: 'Outbound Speed to Lead (Vapi): call could not be placed',
      emailType: 'text',
      message: expr('A Vapi call failed to start. Lead record: {{ $("Call Settings").item.json.id }}. Error: {{ $json.error?.message ?? $json.message ?? "unknown" }}'),
      options: { appendAttribution: false }
    },
    credentials: { gmailOAuth2: gmailCred }
  },
  output: [{ id: 'msg-1' }]
});

const placeCall = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Place Vapi Call',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: 'https://api.vapi.ai/call',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ assistantId: $json.assistantId, phoneNumberId: $json.phoneNumberId, customer: { number: $("Normalize Lead").item.json.phoneE164, name: $("Normalize Lead").item.json.firstName }, assistantOverrides: { variableValues: { first_name: $("Normalize Lead").item.json.firstName, company_name: $json.companyName, agent_name: $json.agentName, service_type: "roof inspection", lead_source: "web form", owns_property: $("Normalize Lead").item.json.ownsSpoken, issue_type: $("Normalize Lead").item.json.issueSpoken, timeline: $("Normalize Lead").item.json.timelineSpoken, twenty_id: $json.id, attempt: 1 }, metadata: { twenty_id: $json.id, attempt: 1 } } }) }}'),
      options: {}
    },
    credentials: { httpHeaderAuth: newCredential('Vapi API (outbound)') }
  },
  output: [{ id: 'vapi-call-id', status: 'queued' }]
});

const markCalling = node({
  type: '@blackswampai/n8n-nodes-twentycrm.twenty',
  version: 1,
  config: {
    name: 'Mark Lead Calling',
    parameters: {
      resource: 'record',
      operation: 'update',
      objectApiName: { __rl: true, mode: 'apiName', value: 'endCustomer' },
      recordId: expr('{{ $("Call Settings").item.json.id }}'),
      inputMode: 'json',
      jsonInput: expr('{{ JSON.stringify({ leadStatus: "CALLING", firstRingAt: $now.toUTC().toISO(), lastContact: $now.toUTC().toISO(), attemptCount: 1 }) }}')
    },
    credentials: { twentyApi: twentyCred }
  },
  output: [{ id: 'lead-id-123' }]
});

const vapiWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Vapi End-of-Call Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'outbound-vapi-eoc-5b8e1d90c3a7',
      authentication: 'headerAuth',
      responseMode: 'onReceived'
    },
    credentials: { httpHeaderAuth: newCredential('Vapi webhook secret') }
  },
  output: [{ headers: {}, body: { message: { type: 'end-of-call-report' } } }]
});

const normalizeResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalize Call Result',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const out = [];
for (const item of $input.all()) {
  const root = item.json.body ?? item.json;
  const msg = root.message ?? root;
  const call = msg.call ?? {};
  const meta = call.metadata ?? {};
  const vars = (call.assistantOverrides && call.assistantOverrides.variableValues) || {};
  const sos = (msg.artifact && msg.artifact.structuredOutputs) || (call.artifact && call.artifact.structuredOutputs) || null;
  let so = null;
  if (sos) {
    const vals = Array.isArray(sos) ? sos : Object.values(sos);
    const hit = vals.find(v => v && v.result && v.result.outcome);
    so = hit ? hit.result : null;
  }
  const ended = msg.endedReason ?? call.endedReason ?? '';
  const outcome = (so && so.outcome) ? so.outcome : (ended === 'voicemail' ? 'voicemail' : 'no_answer');
  const analysis = msg.analysis ?? {};
  out.push({ json: {
    event: msg.type ?? '',
    callId: call.id ?? '',
    leadId: meta.twenty_id ?? vars.twenty_id ?? '',
    attempt: Number(meta.attempt ?? vars.attempt ?? 1),
    outcome,
    callbackTime: (so && so.callback_time) ? so.callback_time : '',
    bookedSlot: (so && so.booked_slot) ? so.booked_slot : '',
    summary: analysis.summary ?? msg.summary ?? '',
    notes: (so && so.notes) ? so.notes : (so ? '' : 'No structured outcome. endedReason: ' + ended),
    endedReason: ended
  } });
}
return out;`
    }
  },
  output: [{ event: 'end-of-call-report', callId: 'c1', leadId: 'lead-id-123', attempt: 1, outcome: 'booked', callbackTime: '', bookedSlot: 'Monday, October 12, 2026 at 10:00 AM', summary: 'Booked.', notes: 'Roof leak.', endedReason: 'customer-ended-call' }]
});

const finalEvent = ifElse({
  version: 2.3,
  config: {
    name: 'End-of-Call Report With Lead?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          { leftValue: expr('{{ $json.event }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'end-of-call-report' },
          { leftValue: expr('{{ $json.leadId }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }
        ],
        combinator: 'and'
      }
    }
  }
});

const logInteraction = node({
  type: '@blackswampai/n8n-nodes-twentycrm.twenty',
  version: 1,
  config: {
    name: 'Log Call Interaction',
    parameters: {
      resource: 'record',
      operation: 'create',
      objectApiName: { __rl: true, mode: 'apiName', value: 'customerInteraction' },
      inputMode: 'json',
      jsonInput: expr('{{ JSON.stringify({ name: "Speed to lead call (Vapi): " + $json.outcome, interactionType: "SPEED_TO_LEAD", channel: "VOICE", outcome: $json.outcome.toUpperCase(), retellCallId: $json.callId, summary: ("[Vapi] " + $json.summary + " " + $json.notes).trim(), callbackTime: $json.callbackTime, bookedSlot: $json.bookedSlot, occurredAt: $now.toUTC().toISO(), endCustomerId: $json.leadId, clientAccountId: "56b85831-d0fd-4f0a-a9b7-e96956278bb8" }) }}')
    },
    credentials: { twentyApi: twentyCred }
  },
  output: [{ id: 'interaction-1' }]
});

const updateLeadAfterCall = node({
  type: '@blackswampai/n8n-nodes-twentycrm.twenty',
  version: 1,
  config: {
    name: 'Update Lead After Call',
    parameters: {
      resource: 'record',
      operation: 'update',
      objectApiName: { __rl: true, mode: 'apiName', value: 'endCustomer' },
      recordId: expr('{{ $("Normalize Call Result").item.json.leadId }}'),
      inputMode: 'json',
      jsonInput: expr('{{ JSON.stringify({ leadStatus: ({ booked: "BOOKED", callback_requested: "CALLBACK", not_interested: "NOT_INTERESTED", disqualified: "DISQUALIFIED", wrong_number: "DNC", no_answer: "NO_ANSWER", voicemail: "NO_ANSWER" })[$("Normalize Call Result").item.json.outcome] ?? "NO_ANSWER", lastOutcome: $("Normalize Call Result").item.json.outcome.toUpperCase(), lastContact: $now.toUTC().toISO(), callOptOut: $("Normalize Call Result").item.json.outcome === "wrong_number", nextAttemptAt: (["no_answer", "voicemail"].includes($("Normalize Call Result").item.json.outcome) && $("Normalize Call Result").item.json.attempt < 4) ? $now.plus({ minutes: $("Normalize Call Result").item.json.attempt === 1 ? 5 : ($("Normalize Call Result").item.json.attempt === 2 ? 60 : 1440) }).toUTC().toISO() : null }) }}')
    },
    credentials: { twentyApi: twentyCred }
  },
  output: [{ id: 'lead-id-123' }]
});

const retrySchedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.4,
  config: {
    name: 'Retry Sweeper Every 5 Minutes',
    parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 5 }] } }
  },
  output: [{}]
});

const retryHours = ifElse({
  version: 2.3,
  config: {
    name: 'Inside Calling Hours?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          { leftValue: expr('{{ $now.setZone("America/Los_Angeles").hour }}'), operator: { type: 'number', operation: 'gte' }, rightValue: 9 },
          { leftValue: expr('{{ $now.setZone("America/Los_Angeles").hour }}'), operator: { type: 'number', operation: 'lt' }, rightValue: 20 }
        ],
        combinator: 'and'
      }
    }
  }
});

const findDue = node({
  type: '@blackswampai/n8n-nodes-twentycrm.twenty',
  version: 1,
  config: {
    name: 'Find Leads Due for Retry',
    parameters: {
      resource: 'record',
      operation: 'getMany',
      objectApiName: { __rl: true, mode: 'apiName', value: 'endCustomer' },
      returnAll: false,
      limit: 20,
      options: {
        filter: expr('and(leadStatus[eq]:NO_ANSWER,nextAttemptAt[lte]:"{{ $now.toUTC().toISO() }}",callOptOut[eq]:false)')
      }
    },
    credentials: { twentyApi: twentyCred }
  },
  output: [{ id: 'lead-id-123', name: 'Test Lead', phones: { primaryPhoneNumber: '5415550123' }, ownsProperty: 'YES', issueType: 'LEAK', timeline: 'ASAP', attemptCount: 1 }]
});

const retrySettings = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Retry Call Settings',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'rs-assistant', name: 'assistantId', value: vapiAssistantId, type: 'string' },
          { id: 'rs-phone', name: 'phoneNumberId', value: placeholder('Vapi phone number ID (add after testing)'), type: 'string' }
        ]
      }
    }
  },
  output: [{ id: 'lead-id-123', assistantId: vapiAssistantId, phoneNumberId: 'phone-id', phones: { primaryPhoneNumber: '5415550123' } }]
});

const alertRetryFailed = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Alert Retry Failed',
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: 'abdullah@kyneticai.com',
      subject: 'Outbound Speed to Lead (Vapi): retry call could not be placed',
      emailType: 'text',
      message: expr('A Vapi retry call failed to start. Lead record: {{ $("Retry Call Settings").item.json.id }}. Error: {{ $json.error?.message ?? $json.message ?? "unknown" }}'),
      options: { appendAttribution: false }
    },
    credentials: { gmailOAuth2: gmailCred }
  },
  output: [{ id: 'msg-2' }]
});

const placeRetry = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Place Vapi Retry Call',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: 'https://api.vapi.ai/call',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ assistantId: $json.assistantId, phoneNumberId: $json.phoneNumberId, customer: { number: "+1" + $json.phones.primaryPhoneNumber, name: ($json.name || "there").split(" ")[0] }, assistantOverrides: { variableValues: { first_name: ($json.name || "there").split(" ")[0], company_name: "Kynetic Roofing", agent_name: "Alex", service_type: "roof inspection", lead_source: "web form", owns_property: $json.ownsProperty === "NO" ? "no" : "yes", issue_type: ({ LEAK: "a leak", STORM_OR_HAIL: "storm or hail damage", REPLACEMENT_QUOTE: "a replacement quote", JUST_LOOKING: "just looking" })[$json.issueType] ?? "a roof issue", timeline: ({ ASAP: "as soon as possible", TWO_WEEKS: "within 2 weeks", THREE_MONTHS: "within 3 months", EXPLORING: "just exploring" })[$json.timeline] ?? "soon", twenty_id: $json.id, attempt: ($json.attemptCount ?? 0) + 1 }, metadata: { twenty_id: $json.id, attempt: ($json.attemptCount ?? 0) + 1 } } }) }}'),
      options: {}
    },
    credentials: { httpHeaderAuth: newCredential('Vapi API (outbound)') }
  },
  output: [{ id: 'vapi-call-id', status: 'queued' }]
});

const markRetrying = node({
  type: '@blackswampai/n8n-nodes-twentycrm.twenty',
  version: 1,
  config: {
    name: 'Mark Lead Retrying',
    parameters: {
      resource: 'record',
      operation: 'update',
      objectApiName: { __rl: true, mode: 'apiName', value: 'endCustomer' },
      recordId: expr('{{ $("Retry Call Settings").item.json.id }}'),
      inputMode: 'json',
      jsonInput: expr('{{ JSON.stringify({ leadStatus: "CALLING", attemptCount: ($("Retry Call Settings").item.json.attemptCount ?? 0) + 1, nextAttemptAt: null, lastContact: $now.toUTC().toISO() }) }}')
    },
    credentials: { twentyApi: twentyCred }
  },
  output: [{ id: 'lead-id-123' }]
});

const noteForm = sticky('## Path 1: form to first call (Vapi)\nForm stands in for the Meta lead form. Light gate: valid US phone, consent ticked, no submission from the same phone in 24 hours. Outside 9:00 to 20:00 Pacific the lead is queued for the sweeper instead of dialed. Consent wording is a DRAFT until counsel signs off (task 1.4). Before any test call: attach the credential "Vapi API (outbound)" to both Vapi call nodes and fill the Vapi phone number ID in Call Settings and Retry Call Settings.', [], { color: 4 });
const noteWebhook = sticky('## Path 2: Vapi end-of-call report\nSet this production URL as the assistant server URL in Vapi (serverMessages: end-of-call-report). Header auth: credential "Vapi webhook secret" must match the secret on the Vapi assistant. Normalize Call Result reads Vapi message.call.metadata and message.artifact.structuredOutputs; confirm paths against one real payload.', [], { color: 5 });
const noteSweeper = sticky('## Path 3: retry sweeper\nEvery 5 minutes, 9:00 to 20:00 Pacific. Calls leads with NO_ANSWER whose nextAttemptAt has passed (5 minutes, 1 hour, next day; max 4 attempts, D-012). Opt-outs are excluded. The Retell version of this workflow (m2YJwZ1l8DTzyEkw) is untouched and stays the backup.', [], { color: 6 });

placeCall.onError(alertCallFailed);
placeRetry.onError(alertRetryFailed);

export default workflow('outbound-speed-to-lead-vapi', 'Outbound Speed to Lead (Vapi)')
  .add(intakeForm)
  .to(normalizeLead)
  .to(checkDuplicate)
  .to(lightGate
    .onTrue(createLead.to(firstCallHours
      .onTrue(callSettings.to(placeCall.to(markCalling)))
      .onFalse(queueLead)))
    .onFalse(logNotDialed))
  .add(vapiWebhook)
  .to(normalizeResult)
  .to(finalEvent.onTrue(logInteraction.to(updateLeadAfterCall)))
  .add(retrySchedule)
  .to(retryHours.onTrue(findDue.to(retrySettings.to(placeRetry.to(markRetrying)))))
  .add(noteForm)
  .add(noteWebhook)
  .add(noteSweeper);
