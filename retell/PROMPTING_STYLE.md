# Retell voice agent prompting style

House style for every Retell agent prompt we write (Emily, the outbound speed to lead agent, and client agents). Source: Twenty note "SOURCE TEMPLATE 06". Where this file conflicts with a decision in `docs/decisions.md`, the decision wins (for example D-008 voice, D-011 AI disclosure).

## Tone and structure
- Brief the agent like a real employee. Conversational, direct, no corporate speak.
- The agent is just an employee working a job, not an overly enthusiastic bot.
- Use contractions. Keep each rule to ONE line. Number rules and steps.
- Use IF/THEN branching in steps: "IF confirmed, STEP 2".
- Conversation steps carry inline dialogue. The flow IS the example.
- NEVER VOLUNTEER INFORMATION UNLESS EXPLICITLY ASKED. Put this in every prompt.
- CAPITAL LETTERS for critical instructions. If the agent ignores a rule in testing, escalate with caps and stronger wording before adding more words.
- Be super concise. This is a phone call, not a pitch deck. 1 to 2 sentences before expecting input.

## Required structure
1. Role (2 to 3 lines)
2. Personality (specific, use negation, for example "don't sound overly happy about it")
3. Primary objective (one line)
4. Available tool calls
5. Rules (numbered, one line each)
6. Conversation flow (numbered steps, IF/THEN, inline dialogue)
7. Example calls: a FULL start to finish sample conversation for EVERY scenario
8. Error handling (inline or its own section)

## Snippets
- **Phone numbers:** never ask someone to recite a number. Outbound: it is already in a dynamic variable. Confirm "Is this number good for a text?"
- **Email:** spell it back letter by letter. For gmail, yahoo, hotmail say the domain as a word.
- **Addresses:** ask verbally. Confirm once if clear. Text fallback only when spoken spelling would be unclear.
- **Confirmation:** confirm critical info once. Spell back anything that could be misheard. One final full confirmation right before the main action.
- **Speech normalization:** numbers as a human says them ("eight hundred seventy five dollars"). Rd to Road, St to Street, and so on.
- **Fillers:** "use um and uh in every other sentence." Confusion trigger, once: "um, I think I lost you for a second, you there?"
- **Hold on:** if the user says "hold on", reply exactly `NO_RESPONSE_NEEDED`.
- **How are you:** ask it back: "I'm doing alright today. Uh, how are you?"
- **Graceful exit:** one sentence, never push back or ask "are you sure?"
- **Hostile callers:** do not engage. "I apologize for the interruption. Have a great day!" then end_call.
- **Transfer (when added later):** be assertive. "Let me connect you with [name] right now." If it fails, promise a callback within the hour.

## Dynamic variables
- Always put "Current date and time is {{current_time_[TIMEZONE]}}" near the top of any prompt that schedules.
- Outbound agents always get lead context variables: name, source, original interest.
- Other system variables: {{call_id}}, {{direction}}, {{session_duration}}, {{user_number}} / {{from_number}} for inbound.

## Default Retell settings
- Model gpt-4.1. Responsiveness 1.0. Interruption sensitivity 0.8.
- Backchannel always on, frequency 0.8, words ["mm-hmm", "uh-huh"].
- end_call tool always enabled. Denoising noise-and-background-speech-cancellation. End call on silence after 60000 ms. Normalize for speech on.
- Post call analysis always configured, extracting what the prompt collects, model gpt-4.1.
- Voice: the template default is minimax-Nia, but D-008 keeps 11labs-Cimo for our agents.

## Publish and test
- ALWAYS republish after any prompt or settings change, with a 2 word version title ("Fixed Deflection").
- Test critical responses 10 times from the same context. If it fails even 1 of 10, strengthen the prompt at that point.
- Batch simulation for regression, chat API for surgical mid conversation tests.
- Per the Retell tools rule in `KYNETIC_CONTEXT.md`, adding, removing or changing a tool needs explicit approval of that specific change.
