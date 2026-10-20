# Alex test scripts (all of them)

Used for the ElevenLabs bake-off, 2026-10-19. Run every script on both agents. Script 1 is the only one that ends in a real booking.

Run each script on **both** `Alex | 11Labs | v1 strict prompt` and `Alex | 11Labs | v2 loose prompt`. Use the same wording each time. Dashboard path: ElevenLabs, blitz account, Agents, pick the agent, Test.

**Before every call**
- The defaults are already set: Abdullah, Kynetic Roofing, a leak, owns the property, as soon as possible.
- Use your own cell number as the text number. Say it the same way each time: "five four one, five five five, zero one two three" (replace with your real one).
- Only Script 1 should end in a real booking. Stop before the final yes in the others. I'll ask before cancelling anything.

## Script 1: normal full call (books)
Alex starts with "Hi, is this Abdullah?"
- You: "Yeah, this is Abdullah."
- *Expect: "This is Alex, an AI assistant from Kynetic Roofing… this call may be recorded. Is now an okay time?"*
- You: "Sure, now's fine."
- *Expect one combined question: "I see you asked about a roof inspection for a leak, you own the property, and you'd like it looked at as soon as possible. Did I get that right?"*
- You: "Yeah, that's right."
- *Expect: offer of a free ~30 minute inspection, then "want me to get you on the calendar?"*
- You: "Yes, get me on the calendar."
- *Expect two real time options.*
- You: "The first one."
- *Expect: "What's the property address?"*
- You: "1420 Northwest Wall Street, Bend."
- *Expect: offers to text the number, or asks which number to use.*
- You: "Yes, text this one." If asked for a number, give yours.
- *Expect: "So that's [day] at [time] at 1420 Northwest Wall Street. Sound right?"*
- You: "Yes."
- *Expect: "One sec, booking that now." then "You're all set. You'll get a text with the details."*
- You: "No, that's all, thanks."

**Pass if:** disclosure after the name check; the combined confirmation is one question; one question per turn; a real time slot; "all set" only after the booking succeeds.

## Script 2: different number for the text
Same as Script 1 until the text question.
- You: "Actually, use a different number."
- Give a second number (a friend's, or a made-up one like "five four one, five five five, nine nine nine nine").
- *Expect a slow digit-by-digit readback.*
- You: "No, the last digits are nine nine nine eight." Then confirm the corrected readback with "Yes."
- At the final confirmation say: "Actually, let me think about it, I'll call back." Then hang up.

**Pass if:** reads the number back slowly, fixes only the wrong part, and doesn't book.

## Script 3: "is this a robot?"
- You: "Yes, speaking." After the disclosure: "Wait, is this a robot?"
- *Expect a straight "Yeah, I'm an AI assistant for Kynetic Roofing."*
- Continue to the offer, then: "Not right now, thanks."

**Pass if:** no denial, no argument, graceful end.

## Script 4: not interested
- You: "Yes, it's Abdullah." → "Not interested, thanks."

**Pass if:** one short sentence, then the call ends. No "are you sure?"

## Script 5: wrong number, don't call again
- You: "No, you've got the wrong number. Don't call again."

**Pass if:** apologizes and ends in one line.

## Script 6: background noise
Play a TV or podcast loudly beside the phone. Answer normally for the name check and disclosure. At the combined confirmation, mumble the answer. Then answer clearly.

**Pass if:** "Sorry, I didn't catch that" once, no guessing, and it doesn't act on words you didn't say.

## Script 7: silence
- You: "Yes, it's Abdullah." Then say nothing for 30 seconds.

**Pass if:** the call ends on its own after about 25 seconds.

## Script 8: talking over
- Let Alex start the disclosure. Cut in mid-sentence: "Hold on, can you give me a second?" Stay silent for 10 seconds. Then: "Okay, go ahead."

**Pass if:** Alex stops, waits, then continues.

## Script 9: form says renter (optional)
This needs the variable changed. Skip it unless you want to test it.

## Order and credits
The Free plan has 15 minutes. Do these first on both agents: **1, 3, 4, 6** (about 8 minutes). Then 2, 5, 7 and 8 once you decide on a paid plan.

When you're done, tell me the agent and the script numbers you ran. I'll pull the transcripts, score them, and report which prompt did better.
