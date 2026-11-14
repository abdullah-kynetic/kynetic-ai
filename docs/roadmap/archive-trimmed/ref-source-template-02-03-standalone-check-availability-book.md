# REF: SOURCE TEMPLATE 02+03 — standalone check_availability + book_appointment n8n JSONs (uploaded Oct 5, 2026)

_Twenty note `4dc91340`, created 2026-10-05, updated 2026-10-14. Exported 2026-11-12._

Uploaded by Abdullah Oct 5, 2026. Two small standalone n8n workflows, each a non-consolidated single-purpose version of what SOURCE TEMPLATE 01 folds into one router. Architecturally identical to Emily's current pattern (one Retell tool → one n8n webhook each). Saved word for word.

---

## check_availability_4.json
```json
{
  "name": "check availability",
  "nodes": [
    {"parameters": {"httpMethod": "POST", "path": "065b27b3-555f-4cb2-b6f9-c364a13ed41b", "responseMode": "responseNode", "options": {}}, "type": "n8n-nodes-base.webhook", "typeVersion": 2.1, "position": [-64, 0], "id": "2038137f-d6a8-4ef6-9ec9-eb906d0305cd", "name": "Webhook", "webhookId": "065b27b3-555f-4cb2-b6f9-c364a13ed41b"},
    {"parameters": {"promptType": "define", "text": "=Role:\nYou are an appointment availability checker. Your job is to get the customer’s requested time and use the calendar to check availability.\n\nThe current date and time is: {{ $now }} \n\nThe customer’s requested time is: {{ $json.body.args.time }}\n\nCalendar data:\n – Working hours: 8am to 9pm\n – Slot length: 1 hour\n\nBooking Process:\n\nCheck if the customer’s requested time is available using the calendar.\n\nIf the time is available, let the AI model know and confirm.\n\nIf the time is unavailable, suggest up to 2 alternative slots close to the requested time by checking availability again.\n\nIf there are no slots available that day, search the next weekday from the current time and provide alternative slots.\n\nWhen you are calling the check availability tool, ensure you use the customers requested time and the current date and time now to correctly define the start and end date parameters in one hours slots.\n\nResponse & Output:\n\nIf the requested time is available, confirm it by saying something like:\n “The requested time of 10am on June 22nd is available, just to confirm would you like to book this?”\n\nIf the requested time is unavailable, suggest up to 3 alternative times closest to the requested time.\n\nIf no slots exist that day, suggest 3 more times on the next weekday.\n\nYour tone must be natural and conversational.\n\nImportant notes:\n\nYou must not output results in the past. Always check availability in the future using the current time and the requested data.\n\nYour ability to follow these steps precisely is crucial and can impact the business’s reputation.", "options": {}}, "type": "@n8n/n8n-nodes-langchain.agent", "typeVersion": 3, "position": [160, 0], "id": "2207948d-8b7c-42ce-9c10-c08daa082dc1", "name": "AI Agent"},
    {"parameters": {"model": {"__rl": true, "mode": "list", "value": "gpt-4.1-mini"}, "builtInTools": {}, "options": {}}, "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi", "typeVersion": 1.3, "position": [48, 240], "id": "f4b1cd6b-9563-4dad-8658-4e8a41c6d083", "name": "OpenAI Chat Model", "credentials": {"openAiApi": {"id": "B7IiKz8kora90v59", "name": "OpenAi account 2"}}},
    {"parameters": {"resource": "calendar", "calendar": {"__rl": true, "value": "ashtonvoss47@gmail.com", "mode": "list", "cachedResultName": "ashtonvoss47@gmail.com"}, "timeMin": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Start_Time', ``, 'string') }}", "timeMax": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('End_Time', ``, 'string') }}", "options": {}}, "type": "n8n-nodes-base.googleCalendarTool", "typeVersion": 1.3, "position": [352, 224], "id": "a0dfa623-6c64-4ba9-818f-a75e660d5fc1", "name": "Get availability in a calendar in Google Calendar", "credentials": {"googleCalendarOAuth2Api": {"id": "QnCjBMu9d90p1Mi0", "name": "Google Calendar account"}}},
    {"parameters": {"options": {}}, "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.4, "position": [592, 0], "id": "fdd08158-0dcc-4c4c-999d-41aaba9a845c", "name": "Respond to Webhook"}
  ],
  "connections": {
    "Webhook": {"main": [[{"node": "AI Agent", "type": "main", "index": 0}]]},
    "OpenAI Chat Model": {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]},
    "Get availability in a calendar in Google Calendar": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]},
    "AI Agent": {"main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]}
  }
}
```

---

## book_appointment - YT.json
```json
{
  "name": "book_appointment - YT",
  "nodes": [
    {"parameters": {"httpMethod": "POST", "path": "7b282c46-3fcf-4ce5-830a-b642413027ff", "responseMode": "responseNode", "options": {}}, "type": "n8n-nodes-base.webhook", "typeVersion": 2.1, "position": [-16, 0], "id": "759ab5d8-9834-444e-9feb-a34870dfbe7a", "name": "Webhook", "webhookId": "7b282c46-3fcf-4ce5-830a-b642413027ff"},
    {"parameters": {"promptType": "define", "text": "=You are an appointment booking AI agent. Your job is to use the “Create an event in Google Calendar” tool to gather the customer’s details and create an event/booking in the calendar.\n\nThe confirmed time is: {{ $json.body.args.time }}\n\nThe current time is: {{ $now }}\n\nThe appointment duration is one hour. Use the confirmed time as the start time. Then add one hour to the confirmed time to get the end time.\n\nPlease use the confirmed time and the current time to define the start and end date parameters for processing the booking.\n\nIf the event has been scheduled, provide your output in this format:\nOutput:\n “Hey there the appointment at July 18th 2025 for a massage has been scheduled we will see you there”\n\n## Send email\nYou will call the Send Confirmation Email tool to send a confirmation email to the customer letting them know their appointment has been booked. You must only call this tool after you have created an event in the Google Calendar tool.\n\n## Send sms\nYou will call the Send SMS tool to send an SMS to the real estate agent notifying that they have a new viewing appointment booked. You must only call this tool after you have created an event in the Google Calendar tool.", "options": {}}, "type": "@n8n/n8n-nodes-langchain.agent", "typeVersion": 3, "position": [208, 0], "id": "afceb283-9ba0-4411-b100-6b4147f46879", "name": "AI Agent"},
    {"parameters": {"model": {"__rl": true, "mode": "list", "value": "gpt-4.1-mini"}, "builtInTools": {}, "options": {}}, "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi", "typeVersion": 1.3, "position": [0, 240], "id": "aafe5372-d3ee-40a5-a576-7ea8763967b0", "name": "OpenAI Chat Model", "credentials": {"openAiApi": {"id": "el47D6FesUJYpnwT", "name": "OpenAi account"}}},
    {"parameters": {"calendar": {"__rl": true, "value": "ashtonvoss47@gmail.com", "mode": "list", "cachedResultName": "ashtonvoss47@gmail.com"}, "start": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Start', ``, 'string') }}", "end": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('End', ``, 'string') }}", "additionalFields": {"description": "=Address:  {{ $json.body.args.property_address }}\nPhone Number: {{ $json.body.args.phone_number }}\nEmail: {{ $json.body.args.email }}", "summary": "=New Appraisal Appointment for {{ $json.body.args.full_name }} at {{ $json.body.args.property_address }}"}}, "type": "n8n-nodes-base.googleCalendarTool", "typeVersion": 1.3, "position": [192, 240], "id": "ebdae458-fe3c-41b3-93ea-8d81325b486f", "name": "Create an event in Google Calendar", "credentials": {"googleCalendarOAuth2Api": {"id": "fl8TjD7JuX4UqUeH", "name": "Google Calendar account 2"}}},
    {"parameters": {"sendTo": "={{ $json.body.args.email }}", "subject": "Appointment Confirmation for [name] at [time]", "emailType": "text", "message": "=hi {{ $json.body.args.full_name }}\n\nThis is a confirmation message that appraisal appointment has been booked at {{ $json.body.args.time }} at {{ $json.body.args.property_address }}\n\nThanks,\nAshton", "options": {}}, "type": "n8n-nodes-base.gmailTool", "typeVersion": 2.1, "position": [496, 240], "id": "a5a1e319-bbed-49cb-8459-21db8f7be765", "name": "Send a message in Gmail", "webhookId": "a8513820-52cc-4ad2-a053-3dfe7ad0ed93", "credentials": {"gmailOAuth2": {"id": "6ym7pBPC11IQnP7u", "name": "Gmail account"}}},
    {"parameters": {"from": "+14847997020", "to": "=+61413472077", "message": "=Hi Ashton,\n\nThis is a message to remind you that you have a new appraisal appointment for {{ $json.body.args.full_name }} at {{ $json.body.args.time }} at {{ $json.body.args.property_address }} \n\nthanks, ", "options": {}}, "type": "n8n-nodes-base.twilioTool", "typeVersion": 1, "position": [352, 240], "id": "1c9d212b-0714-4d13-b650-4b06e6816e10", "name": "Send an SMS/MMS/WhatsApp message in Twilio", "credentials": {"twilioApi": {"id": "HlF71DPueVQQ7UhI", "name": "Twilio account"}}},
    {"parameters": {"options": {}}, "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.4, "position": [560, 0], "id": "d6c20927-43fd-4396-9754-5358660cc42e", "name": "Respond to Webhook"}
  ],
  "connections": {
    "Webhook": {"main": [[{"node": "AI Agent", "type": "main", "index": 0}]]},
    "OpenAI Chat Model": {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]},
    "Create an event in Google Calendar": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]},
    "Send a message in Gmail": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]},
    "Send an SMS/MMS/WhatsApp message in Twilio": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]},
    "AI Agent": {"main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]}
  }
}
```
