# REF: SOURCE TEMPLATE 04 — post-call one-word classifier updating a Google Sheets lead list (n8n JSON) (uploaded Oct 5, 2026)

_Twenty note `f499ab65`, created 2026-10-05, updated 2026-10-14. Exported 2026-11-12._

Uploaded by Abdullah Oct 5, 2026. The cleanest version of "classify the call, then write only the classification" — transcript in, one word out ("Booked"/"unsuccessful"), matched to a sheet row by phone number. Saved word for word.

---

```json
{
  "name": "update google sheets lead list",
  "nodes": [
    {"parameters": {"httpMethod": "POST", "path": "abcbaab8-b2ee-4e34-8176-cab626dded35", "responseMode": "responseNode", "options": {}}, "type": "n8n-nodes-base.webhook", "typeVersion": 2.1, "position": [-48, 16], "id": "c57f1c01-bfd0-42b3-b45d-2dd975d038d4", "name": "Webhook", "webhookId": "abcbaab8-b2ee-4e34-8176-cab626dded35"},
    {"parameters": {"options": {}}, "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.4, "position": [704, 16], "id": "44050ae3-16ed-4f3f-be31-bb5d860a1856", "name": "Respond to Webhook"},
    {"parameters": {"promptType": "define", "text": "={{ $json.body.call.transcript }}", "options": {"systemMessage": "=Your job is to look at the transcript of the conversation and determine the outcome of the call. \n\nfor e.g: of a lead has booked a call successfully then update the google sheet to booked, if the conversation has not resulted in a booked appointment then update the google sheet to unsuccessful. \n\nYou must call the Google Sheets tool and successfully update the status of the Google Sheets with your one-word output. \n\noutput: \n\nYour output must be only on 1 word based on your analysis. Only \"Booked\" for a successfull booked appointemnt or \"unsuccessful\" for a anything that is not as booked appointment"}}, "type": "@n8n/n8n-nodes-langchain.agent", "typeVersion": 3, "position": [224, 16], "id": "03200571-187f-4eb9-90e7-0e3f25911aaf", "name": "AI Agent"},
    {"parameters": {"operation": "update", "documentId": {"__rl": true, "value": "1ZUTFBu9wChraR0Bry10M1XFktSYJJX7W7eIAiqe7Inw", "mode": "list", "cachedResultName": "lead sheet", "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1ZUTFBu9wChraR0Bry10M1XFktSYJJX7W7eIAiqe7Inw/edit?usp=drivesdk"}, "sheetName": {"__rl": true, "value": "gid=0", "mode": "list", "cachedResultName": "Sheet1", "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1ZUTFBu9wChraR0Bry10M1XFktSYJJX7W7eIAiqe7Inw/edit#gid=0"}, "columns": {"mappingMode": "defineBelow", "value": {"Status": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Status__using_to_match_', ``, 'string') }}", "phone number": "={{ $json.body.call.retell_llm_dynamic_variables.user_phone }}"}, "matchingColumns": ["phone number"], "schema": [{"id": "name", "displayName": "name", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": true}, {"id": "phone number", "displayName": "phone number", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": false}, {"id": "address", "displayName": "address", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": true}, {"id": "property_type", "displayName": "property_type", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": true}, {"id": "Status", "displayName": "Status", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true, "removed": false}, {"id": "row_number", "displayName": "row_number", "required": false, "defaultMatch": false, "display": true, "type": "number", "canBeUsedToMatch": true, "readOnly": true, "removed": true}], "attemptToConvertTypes": false, "convertFieldsToString": false}, "options": {}}, "type": "n8n-nodes-base.googleSheetsTool", "typeVersion": 4.7, "position": [448, 240], "id": "2123919a-7d26-4515-ba3c-0c42330b29e5", "name": "Update row in sheet in Google Sheets", "credentials": {"googleSheetsOAuth2Api": {"id": "QfliuNNzXU2oOQVf", "name": "Google Sheets account"}}},
    {"parameters": {"model": {"__rl": true, "mode": "list", "value": "gpt-4.1-mini"}, "builtInTools": {}, "options": {}}, "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi", "typeVersion": 1.3, "position": [96, 224], "id": "9e3da061-1cb9-46be-aca3-15673251b953", "name": "OpenAI Chat Model", "credentials": {"openAiApi": {"id": "3PtkfukQGczG7pho", "name": "OpenAi account 3"}}}
  ],
  "connections": {
    "Webhook": {"main": [[{"node": "AI Agent", "type": "main", "index": 0}]]},
    "Update row in sheet in Google Sheets": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]},
    "OpenAI Chat Model": {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]},
    "AI Agent": {"main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]}
  }
}
```
