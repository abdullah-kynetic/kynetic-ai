# REF (Vapi-based): SOURCE TEMPLATE 05 — Facebook Ad Form speed-to-lead pipeline (Vapi) + SolarShift voice prompt — closest match to our build (uploaded Oct 5, 2026)

_Twenty note `b219c3d0`, created 2026-10-05, updated 2026-10-14. Exported 2026-11-12._

Uploaded by Abdullah Oct 5, 2026. **The closest existing match to task 3.5 (outbound speed-to-lead).** Full pipeline on Vapi (not Retell): form submit → writes lead to sheet → PRE-CALL qualification gate (homeowner status, bill size) — disqualified leads are deleted, never dialed — qualified leads get phone-normalized and called immediately → polls call status every 30s until ended → post-call analyzer outputs only "proceed"/"stop" with explicit disqualifying criteria → updates the sheet. Note: the "Proceed or Not?" switch node in this JSON has empty/stub conditions as uploaded — it doesn't actually route on the analyzer's text output in this copy. The voice prompt (Nick, SolarShift solar advisor) is the actual calling agent for this exact pipeline — same leadName variable, same qualification criteria, two full example conversations (book / graceful exit). Saved word for word.

**Adopt the pattern, not the backend:** pre-call qualify → normalize → call → poll → post-call classify → write, but swap Google Sheets for Twenty and keep Cal.com (already working) instead of Google Calendar. See the build plan note for the open question on what our own pre-call gate should check, since our leads are typically already owner-gated upstream.

---

## VOICE AGENT PROMPT (Nick, SolarShift)

```
# Role
- You are a Nick, a friendly solar advisor calling on behalf of SolarShift, a trusted residential solar installation company
- Your job is to quickly confirm the lead's interest, qualify their situation, and either book a free solar assessment or schedule a callback.

# Specifics
• Confirm Identity — Verify you're speaking with {{leadName}} and that they submitted a request for solar information within the last few minutes
• Gauge Interest — Ask if now is a good time to discuss their solar inquiry; if not, offer to schedule a callback
• Qualify Situation — Confirm they own their home, ask about average monthly electric bill range, and check if they've explored solar before
• Present Value — Briefly mention SolarShift's $0 down financing and typical savings (thirty to fifty percent on electric bills)
• Outcome Routing — If interested and qualified, offer to book a free assessment with a solar consultant; if not ready, offer to send information via text or email
• Objection Handling — Address common concerns about cost, roof suitability, and installation time with reassurance and data
• Close Next Step — Secure commitment to calendar booking, callback, or information follow-up before ending the call

# Context
• SolarShift specializes in residential solar with transparent pricing, local installation teams, and financing that requires no money down
• Leads are warm; they submitted a Facebook form requesting solar information within the last hour
• Average call duration is sixty to ninety seconds; efficiency is important but never rushed
• Homeowners often have concerns about upfront cost, roof damage, and energy savings accuracy

# Examples

**Example 1 — Interested & Ready to Book**
Agent: Hi, is this Sarah?
Lead: Yes, speaking.
Agent: Great! I'm calling from SolarShift. You just requested info about going solar. Is now an okay time to chat for a minute?
Lead: Sure, yeah.
Agent: Perfect. So you own your home in the nine two one zero one area, right?
Lead: Yep, we do.
Agent: Awesome. What's your monthly electric bill run you, roughly?
Lead: Usually around one eighty, sometimes two hundred.
Agent: Got it. So with a bill like that, most folks save thirty to fifty percent with our system, and we've got zero down financing. Have you looked into solar before?
Lead: A little, but never seriously.
Agent: Makes sense. I can get you a free assessment this week—takes about thirty minutes, and our consultant will show you exact savings for your roof. Does Thursday or Friday work better?
Lead: Thursday's good.
Agent: Perfect, I'm booking you in. You'll get a text confirmation in a sec. Sound good?
Lead: Yep, thanks!

**Example 2 — Not Interested / Disqualified**
Agent: Hi, is this John?
Lead: Yeah.
Agent: I'm calling from SolarShift about the solar info you requested. Now a good time?
Lead: Oh, I was just looking. I'm renting, so probably not for me.
Agent: Totally understand. If you end up buying in the future, we're here. Want me to send you some info for down the road?
Lead: Nah, I'm good.
Agent: No worries. Have a great day, John!

# Tone & Style
• Conversational and warm; use contractions and natural phrasing like "you're all set" or "makes sense"
• Mirror the lead's energy—if they're enthusiastic, match it; if brief, stay concise
• Speak numbers as words (e.g., "one eighty" for $180, "nine two one zero one" for zip code)
• Use micro-confirmations ("got it," "perfect," "awesome") to build rapport
• Never mention AI, algorithms, tokens, processing time, or technical backend details

# Notes
• If the lead says they're renting or their bill is under one hundred dollars, politely exit without pushing
• Do not ask for sensitive information like social security numbers or credit scores on this call
• If lead asks about pricing, explain that exact cost depends on roof size and energy needs, covered in the free assessment
• Avoid overpromising savings; stick to "typically thirty to fifty percent" language
• Always confirm the lead received the form submission; if they seem confused, verify it's the right person
```

---

## n8n Facebook Ad Form.json

```json
{
  "name": "n8n Facebook Ad Form",
  "nodes": [
    {"parameters": {"method": "POST", "url": "https://api.vapi.ai/call", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "sendHeaders": true, "headerParameters": {"parameters": [{"name": "Content-Type", "value": "application/json"}]}, "sendBody": true, "specifyBody": "json", "jsonBody": "={\n    \"assistantId\": \"f3878cf8-526a-48d5-9251-43cb6adfaa03\",\n    \"phoneNumberId\": \"983993c0-5094-4e21-85c3-47130498e6c6\",\n    \"customer\": {\n      \"number\": \"{{ $json.formattedPhone }}\",\n      \"name\": \"{{ $('Create Lead').item.json.fullName }}\"\n  },\n  \"assistantOverrides\": {\n    \"variableValues\": {\n      \"leadName\": \"{{ $('Create Lead').item.json.fullName }}\"\n    }\n  }\n}", "options": {}}, "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [800, -528], "id": "a0060417-ce03-41d7-babe-4b1ec04baaa7", "name": "Place Call", "credentials": {"httpBearerAuth": {"id": "YxeSoIaHwualmdUx", "name": "Vapi Default Private Key"}}},
    {"parameters": {"promptType": "define", "text": "=Transcript: {{ $json.transcript }}\n\n\nSummary: {{ $json.summary }}", "options": {"systemMessage": "# Role\n\nYou are a post-call quality analyst for SolarShift. Your job is to review completed voice agent call transcripts and summaries to determine whether the sales team should proceed with follow-up or stop all outreach to that lead.\n\n# Specifics\n\n• Read the provided call summary and full transcript carefully\n• Identify outcome indicators such as appointment booked, callback scheduled, expressed interest, objections raised, or disqualification factors\n• Evaluate lead sentiment and engagement level based on conversational tone and responses\n• Check for disqualifying factors: renter status, monthly bill under one hundred dollars, explicit disinterest, wrong number, or hostile reaction\n• Determine if meaningful forward progress was made (booking, callback agreement, information request accepted)\n• Output your decision using ONLY the word \"proceed\" or \"stop\" with no additional text, explanation, or punctuation\n\n# Context\n\n• SolarShift's sales team needs clear binary guidance on whether to continue pursuing a lead\n• \"Proceed\" means the lead has potential value and should receive follow-up\n• \"Stop\" means the lead is disqualified or uninterested and should be removed from active outreach\n• Ambiguous or incomplete calls where the lead agreed to receive information should default to \"proceed\"\n• Leads who explicitly said \"not interested\" or have disqualifying factors must result in \"stop\"\n\n# Tools\n\n• analyzeSentiment, extractKeyPhrases, detectAppointment\n\n# Tone & Style\n• Objective and evidence-based; rely solely on transcript content and summary\n• Apply consistent decision criteria across all reviews\n• When outcome is unclear or lead is ambivalent but didn't explicitly decline, default to \"proceed\"\n• Never inject assumptions or read intent beyond what the lead explicitly stated\n• Prioritize respecting lead preferences; if they said no, honor it with \"stop\"\n\n# Notes\n• Output must be lowercase and contain no punctuation, spaces, or additional characters\n• Leads who hung up mid-call without clear disqualification should result in \"proceed\" for one retry attempt\n• Wrong number scenarios trigger \"stop\"\n• Hostile or abusive leads must result in \"stop\" regardless of technical qualification\n• If appointment was booked or callback scheduled, always output \"proceed\"\n• If lead is disqualified (renter, low bill, not interested), always output \"stop\""}}, "type": "@n8n/n8n-nodes-langchain.agent", "typeVersion": 2.2, "position": [1696, -512], "id": "fdda0f7f-3f75-4390-9b7b-698511be23d5", "name": "End of Call Analyzer"},
    {"parameters": {"model": "gpt-4.1-nano", "options": {}}, "type": "@n8n/n8n-nodes-langchain.lmChatAzureOpenAi", "typeVersion": 1, "position": [1776, -288], "id": "7b31e30a-555f-49b0-b0ef-414ad45ece73", "name": "Azure OpenAI Chat Model1", "credentials": {"azureOpenAiApi": {"id": "lIPmwZWz5YaGbNql", "name": "Azure Open AI"}}},
    {"parameters": {"operation": "delete", "documentId": {"__rl": true, "value": "1k0bQwKOeGHCS_PMmh72nUvVYDKXsw4KSL9s0bnel_8s", "mode": "list", "cachedResultName": "Facebook Ads Lead Storage"}, "sheetName": {"__rl": true, "value": "gid=0", "mode": "list", "cachedResultName": "Sheet1"}, "startIndex": "={{ $json.row_number }}"}, "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.7, "position": [800, -720], "id": "31aa0940-6a9d-4943-8bfd-812e682e45ed", "name": "Delete Lead", "credentials": {"googleSheetsOAuth2Api": {"id": "nlRVxJW4ageqGOBj", "name": "aakodir833@gmail.com"}}},
    {"parameters": {"formTitle": "Get Your Free Solar Savings Assessment | SolarShift", "formDescription": "Fill out a form and see if you qualify for a free solar savings assessment!", "formFields": {"values": [{"fieldLabel": "Full Name", "requiredField": true}, {"fieldLabel": "Phone Number", "placeholder": "(555) 123-4567", "requiredField": true}, {"fieldLabel": "Do you own your home?", "fieldType": "dropdown", "fieldOptions": {"values": [{"option": "Yes"}, {"option": "No"}]}, "requiredField": true}, {"fieldLabel": "Average Monthly Electric Bill", "fieldType": "dropdown", "fieldOptions": {"values": [{"option": "Under $100"}, {"option": "$100-$150"}, {"option": "$150-$200"}, {"option": "Over $200"}]}, "requiredField": true}]}, "options": {"appendAttribution": false, "respondWithOptions": {"values": {"formSubmittedText": "Thanks for filling this form out. We'll get back to you soon!"}}}}, "type": "n8n-nodes-base.formTrigger", "typeVersion": 2.3, "position": [-128, -624], "id": "ebd4b32d-1d84-4e6c-8e70-a7926c131884", "name": "New Form Submitted", "webhookId": "3349072b-d443-467b-a65f-1010b1361fac"},
    {"parameters": {"rules": {"values": [{"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 2}, "conditions": [{"leftValue": "", "rightValue": "", "operator": {"type": "string", "operation": "equals"}, "id": "555c9e77-8ce3-4192-8c18-364b0fca040e"}], "combinator": "and"}, "renameOutput": true, "outputKey": "Proceed"}, {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 2}, "conditions": [{"id": "f78289b9-cb19-4b81-9dc9-51dfb36d973a", "leftValue": "", "rightValue": "", "operator": {"type": "string", "operation": "equals", "name": "filter.operator.equals"}}], "combinator": "and"}, "renameOutput": true, "outputKey": "Stop"}]}, "options": {}}, "type": "n8n-nodes-base.switch", "typeVersion": 3.3, "position": [2048, -512], "id": "1edf50a0-f1cd-495a-b3bf-03e2dc31afe6", "name": "Proceed or Not?"},
    {"parameters": {"operation": "update", "documentId": {"__rl": true, "value": "1k0bQwKOeGHCS_PMmh72nUvVYDKXsw4KSL9s0bnel_8s", "mode": "list", "cachedResultName": "Facebook Ads Lead Storage"}, "sheetName": {"__rl": true, "value": "gid=0", "mode": "list", "cachedResultName": "Sheet1"}, "columns": {"mappingMode": "defineBelow", "value": {"status": "Opportunity", "phoneNumber": "={{ $('Create Lead').item.json.phoneNumber }}"}, "matchingColumns": ["phoneNumber"]}, "options": {}}, "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.7, "position": [2272, -608], "id": "2864bc72-32d4-46b5-a2a8-88e6ee6f6455", "name": "Create Opportunity", "credentials": {"googleSheetsOAuth2Api": {"id": "nlRVxJW4ageqGOBj", "name": "aakodir833@gmail.com"}}},
    {"parameters": {"operation": "delete", "documentId": {"__rl": true, "value": "1k0bQwKOeGHCS_PMmh72nUvVYDKXsw4KSL9s0bnel_8s", "mode": "list", "cachedResultName": "Facebook Ads Lead Storage"}, "sheetName": {"__rl": true, "value": "gid=0", "mode": "list", "cachedResultName": "Sheet1"}, "startIndex": "={{ $json.row_number }}"}, "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.7, "position": [2496, -416], "id": "040a2dc7-31a4-4eb2-8062-b2a2e7077092", "name": "Remove Lead", "credentials": {"googleSheetsOAuth2Api": {"id": "nlRVxJW4ageqGOBj", "name": "aakodir833@gmail.com"}}},
    {"parameters": {"rules": {"values": [{"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 2}, "conditions": [{"leftValue": "={{ $json.status }}", "rightValue": "in-progress", "operator": {"type": "string", "operation": "equals"}, "id": "3364319f-e622-4d3c-bd10-ee3bbdda542e"}], "combinator": "and"}, "renameOutput": true, "outputKey": "In Progress"}, {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 2}, "conditions": [{"id": "eb1a119d-4452-4334-b1dc-374ef5086ce8", "leftValue": "={{ $json.status }}", "rightValue": "ended", "operator": {"type": "string", "operation": "equals", "name": "filter.operator.equals"}}], "combinator": "and"}, "renameOutput": true, "outputKey": "Call Ended"}]}, "options": {"fallbackOutput": "none"}}, "type": "n8n-nodes-base.switch", "typeVersion": 3.2, "position": [1472, -528], "id": "4b1d6dba-a98e-48a8-bdc4-7f05fad5aed7", "name": "In Progress/Ended?1"},
    {"parameters": {"amount": 30}, "type": "n8n-nodes-base.wait", "typeVersion": 1.1, "position": [1024, -528], "id": "8fb2ebce-e67e-4b20-9eaf-c751c9b2409b", "name": "Wait 30 Seconds1"},
    {"parameters": {"url": "=https://api.vapi.ai/call/{{ $('Place Call').item.json.id }}", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "options": {}}, "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1248, -528], "id": "117bd50b-d07e-4a2c-89c6-828d46ef1bef", "name": "Fetch Call Details1", "retryOnFail": true, "waitBetweenTries": 5000, "credentials": {"httpBearerAuth": {"id": "YxeSoIaHwualmdUx", "name": "Vapi Default Private Key"}}},
    {"parameters": {"rules": {"values": [{"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 2}, "conditions": [{"leftValue": "={{ $json['Average Monthly Electric Bill'] }}", "rightValue": "Under $100", "operator": {"type": "string", "operation": "equals"}, "id": "49c9ead2-b518-4c6d-8a03-66bb23bd82ff"}], "combinator": "and"}, "renameOutput": true, "outputKey": "Under $100 - Not Qualified"}, {"conditions": {"options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 2}, "conditions": [{"id": "e12e9ba3-5c66-4050-8529-e70d72042287", "leftValue": "={{ $json['Do you own your home?'] }}", "rightValue": "No", "operator": {"type": "string", "operation": "equals", "name": "filter.operator.equals"}}], "combinator": "and"}, "renameOutput": true, "outputKey": "Not a Homeowner - Not Qualified"}]}, "options": {"fallbackOutput": "extra"}}, "type": "n8n-nodes-base.switch", "typeVersion": 3.3, "position": [352, -640], "id": "283b48e9-abdf-4df4-a692-4d0b654e8d4b", "name": "Switch1"},
    {"parameters": {"operation": "append", "documentId": {"__rl": true, "value": "1k0bQwKOeGHCS_PMmh72nUvVYDKXsw4KSL9s0bnel_8s", "mode": "list", "cachedResultName": "Facebook Ads Lead Storage"}, "sheetName": {"__rl": true, "value": "gid=0", "mode": "list", "cachedResultName": "Sheet1"}, "columns": {"mappingMode": "defineBelow", "value": {"fullName": "={{ $json['Full Name'] }}", "phoneNumber": "={{ $json['Phone Number'] }}", "homeowner?": "={{ $json['Do you own your home?'] }}", "spending": "={{ $json['Average Monthly Electric Bill'] }}", "dateTimeAdded": "={{ $now.toFormat(\"cccc, LLLL d',' yyyy, h:mm a\") }}", "status": "Lead"}, "matchingColumns": ["phoneNumber"]}, "options": {}}, "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.7, "position": [128, -624], "id": "d1bd87e6-e859-48ec-b90d-909378f78b68", "name": "Create Lead", "credentials": {"googleSheetsOAuth2Api": {"id": "nlRVxJW4ageqGOBj", "name": "aakodir833@gmail.com"}}},
    {"parameters": {"documentId": {"__rl": true, "value": "1k0bQwKOeGHCS_PMmh72nUvVYDKXsw4KSL9s0bnel_8s", "mode": "list", "cachedResultName": "Facebook Ads Lead Storage"}, "sheetName": {"__rl": true, "value": "gid=0", "mode": "list", "cachedResultName": "Sheet1"}, "filtersUI": {"values": [{"lookupColumn": "phoneNumber", "lookupValue": "={{ $('Create Lead').item.json.phoneNumber }}"}]}, "options": {}}, "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.7, "position": [576, -720], "id": "22c3eacc-4793-4eba-9d9a-d04463b395e4", "name": "Find Lead", "credentials": {"googleSheetsOAuth2Api": {"id": "nlRVxJW4ageqGOBj", "name": "aakodir833@gmail.com"}}},
    {"parameters": {"jsCode": "// n8n Code Node: Format phone numbers into +1XXXXXXXXXX\nconst inputNumber = $json.phone || $json.phoneNumber || $json.number || \"\";\nlet digits = inputNumber.replace(/\\D/g, \"\");\nif (digits.length === 10) {\n  digits = \"1\" + digits;\n} else if (digits.length > 11) {\n  digits = digits.slice(-11);\n} else if (digits.length < 10) {\n  throw new Error(`Invalid phone number: ${inputNumber}`);\n}\nconst formattedNumber = `+${digits}`;\nreturn [{\n  formattedPhone: formattedNumber,\n  originalInput: inputNumber,\n}];"}, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [576, -528], "id": "71d00914-b6f3-4ea0-96f7-68b2ba81b46a", "name": "Format Phone Number"},
    {"parameters": {"documentId": {"__rl": true, "value": "1k0bQwKOeGHCS_PMmh72nUvVYDKXsw4KSL9s0bnel_8s", "mode": "list", "cachedResultName": "Facebook Ads Lead Storage"}, "sheetName": {"__rl": true, "value": "gid=0", "mode": "list", "cachedResultName": "Sheet1"}, "filtersUI": {"values": [{"lookupColumn": "phoneNumber", "lookupValue": "={{ $('Create Lead').item.json.phoneNumber }}"}]}, "options": {}}, "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.7, "position": [2272, -416], "id": "c0f00d9b-b070-433c-a0cc-e9ef12727007", "name": "Get Lead", "credentials": {"googleSheetsOAuth2Api": {"id": "nlRVxJW4ageqGOBj", "name": "aakodir833@gmail.com"}}}
  ],
  "connections": {
    "Place Call": {"main": [[{"node": "Wait 30 Seconds1", "type": "main", "index": 0}]]},
    "Azure OpenAI Chat Model1": {"ai_languageModel": [[{"node": "End of Call Analyzer", "type": "ai_languageModel", "index": 0}]]},
    "New Form Submitted": {"main": [[{"node": "Create Lead", "type": "main", "index": 0}]]},
    "End of Call Analyzer": {"main": [[{"node": "Proceed or Not?", "type": "main", "index": 0}]]},
    "Proceed or Not?": {"main": [[{"node": "Create Opportunity", "type": "main", "index": 0}], [{"node": "Get Lead", "type": "main", "index": 0}]]},
    "In Progress/Ended?1": {"main": [[{"node": "Wait 30 Seconds1", "type": "main", "index": 0}], [{"node": "End of Call Analyzer", "type": "main", "index": 0}]]},
    "Wait 30 Seconds1": {"main": [[{"node": "Fetch Call Details1", "type": "main", "index": 0}]]},
    "Fetch Call Details1": {"main": [[{"node": "In Progress/Ended?1", "type": "main", "index": 0}]]},
    "Switch1": {"main": [[{"node": "Find Lead", "type": "main", "index": 0}], [{"node": "Find Lead", "type": "main", "index": 0}], [{"node": "Format Phone Number", "type": "main", "index": 0}]]},
    "Create Lead": {"main": [[{"node": "Switch1", "type": "main", "index": 0}]]},
    "Find Lead": {"main": [[{"node": "Delete Lead", "type": "main", "index": 0}]]},
    "Format Phone Number": {"main": [[{"node": "Place Call", "type": "main", "index": 0}]]},
    "Get Lead": {"main": [[{"node": "Remove Lead", "type": "main", "index": 0}]]}
  }
}
```
