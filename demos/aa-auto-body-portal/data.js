// DEMO DATA ONLY. Every name, number, car and amount below is made up for a sales demo.
// Phone numbers use the reserved 555-01xx range. Nothing here is a real result.
window.DEMO = {
  today: "Wednesday, Nov 25",
  columns: [
    { id: "dropped",   name: "Dropped off",          text: "we have your {car} and will start the estimate" },
    { id: "estimate",  name: "Estimate",             text: "we are writing up your {car} estimate now" },
    { id: "insurance", name: "Waiting on insurance", text: "we sent your {car} to your insurance and are waiting on approval" },
    { id: "parts",     name: "Parts ordered",        text: "parts for your {car} are ordered" },
    { id: "repair",    name: "In repair",            text: "your {car} is in repair" },
    { id: "paint",     name: "Paint",                text: "your {car} is in the paint booth" },
    { id: "ready",     name: "Ready for pickup",     text: "your {car} is ready for pickup" },
    { id: "picked",    name: "Picked up",            text: "thanks for trusting us with your {car}. A review link is on its way" }
  ],
  jobs: [
    { id: 1,  car: "2026 Honda CR-V",       name: "Lauren",  tech: "Marcos", days: 2,  col: "dropped",   type: "Out-of-pocket", amount: 1450 },
    { id: 2,  car: "2019 Ford F-150",       name: "Jake",    tech: "Luis",   days: 0,  col: "dropped",   type: "Insurance",     amount: 3200 },
    { id: 3,  car: "2022 Honda Accord",     name: "Daniel",  tech: "Robert", days: 1,  col: "estimate",  type: "Out-of-pocket", amount: 780 },
    { id: 4,  car: "2020 Nissan Altima",    name: "Sofia",   tech: "Robert", days: 2,  col: "estimate",  type: "Insurance",     amount: 2150 },
    { id: 5,  car: "2023 Dodge Challenger", name: "Ricardo", tech: "Marcos", days: 4,  col: "insurance", type: "Insurance",     amount: 22000, flag: "Supplement pending" },
    { id: 6,  car: "2018 Chevy Silverado",  name: "Tyler",   tech: "Luis",   days: 6,  col: "insurance", type: "Insurance",     amount: 8400 },
    { id: 7,  car: "2021 Hyundai Elantra",  name: "Ana",     tech: "Dani",   days: 3,  col: "parts",     type: "Insurance",     amount: 3900, flag: "Parts due Fri" },
    { id: 8,  car: "2024 Tesla Model 3",    name: "Brandon", tech: "Marcos", days: 7,  col: "repair",    type: "Insurance",     amount: 11200 },
    { id: 9,  car: "2019 Kia Sorento",      name: "Carmen",  tech: "Dani",   days: 5,  col: "repair",    type: "Out-of-pocket", amount: 2600 },
    { id: 10, car: "2022 Jeep Wrangler",    name: "Chris",   tech: "Edwin",  days: 9,  col: "paint",     type: "Insurance",     amount: 6100 },
    { id: 11, car: "2020 Mazda CX-5",       name: "Valeria", tech: "Luis",   days: 11, col: "ready",     type: "Insurance",     amount: 4300 },
    { id: 12, car: "2017 BMW 3 Series",     name: "Hector",  tech: "Dani",   days: 13, col: "picked",    type: "Out-of-pocket", amount: 5600 }
  ],
  needsYou: [
    { t: "Approve photo quote for 2019 Camry (Isabel)", go: "leads", tag: "Quote" },
    { t: "Call back Ricardo: insurance supplement on the Challenger", go: "jobs", tag: "Insurance" },
    { t: "Approve 2 review replies", go: "reviews", tag: "Reviews" },
    { t: "Parts for Ana's Elantra arrive Friday. Confirm drop-off for paint", go: "calendar", tag: "Parts" }
  ],
  leads: [
    { id: 1, name: "Isabel R.",  car: "2019 Toyota Camry",  src: "photo",  when: "12 min ago", status: "New", photos: 3,
      summary: "Rear bumper cracked and a dented trunk lid after a parking lot hit. Sent 3 photos through the website. Out-of-pocket, wants a price this week.",
      lines: [["Customer", "Hit in a parking lot yesterday. Bumper is cracked, trunk is dented."], ["Auto-reply", "Sorry that happened. Can you send 2 or 3 photos from different angles?"], ["Customer", "Sent 3 photos."]],
      est: [["Rear bumper cover, replace", 420], ["Trunk lid, repair and refinish", 560], ["Paint and blend", 480], ["Labor, 6.5 hrs", 390]], estType: "Out-of-pocket" },
    { id: 2, name: "Marcus T.",  car: "2021 Ford Explorer", src: "ai",     when: "9:42 PM last night", status: "New", photos: 2,
      summary: "After-hours call answered by Maya (AI). Front-right fender hit by another driver, insurance claim filed. Wants a morning estimate. Photos requested by text.",
      lines: [["Maya (AI)", "Thanks for calling AA Auto Body Shop, this is Maya, an AI assistant. How can I help?"], ["Caller", "Someone clipped my front fender on the freeway. I have a claim number."], ["Maya (AI)", "I'm sorry to hear that. Is the car drivable?"], ["Caller", "Yes, it's fine, just ugly."], ["Maya (AI)", "Got it. I'll text you a link for photos and the team will call you in the morning."]] },
    { id: 3, name: "Gabriela M.", car: "2018 Nissan Rogue", src: "missed", when: "Yesterday 6:48 PM", status: "Contacted", photos: 1,
      summary: "Missed call after closing. Automatic text went out in 20 seconds. She replied with a photo of a scratched door and asked about price.",
      lines: [["Auto text", "Sorry we missed your call, this is AA Auto Body Shop. What happened with your car?"], ["Customer", "Someone keyed my door. How much to fix?"], ["Auto text", "Sorry to hear that. Can you send a photo so we can give you a number?"], ["Customer", "Sent 1 photo."]] },
    { id: 4, name: "Dustin K.",   car: "2020 Chevy Tahoe", src: "google", when: "Today 8:15 AM", status: "Contacted", photos: 2,
      summary: "Found the shop on Google Maps (5.0 stars). Hail damage on the hood and roof. Asked for a photo estimate before driving over.",
      lines: [["Customer", "Saw your reviews. I have hail damage on the hood and roof."], ["Robert", "We can help. Send a few photos and we'll get you an estimate today."]] },
    { id: 5, name: "Rosa H.",     car: "2016 Honda Civic", src: "walk",   when: "Today 10:05 AM", status: "Quote sent", photos: 2,
      summary: "Walked in with a crushed front corner. Robert took photos and wrote the estimate on the spot. Deposit link sent.",
      lines: [["Robert", "Quote sent with a deposit link to hold parts."], ["Customer", "Looks good. Let me talk to my husband."]] },
    { id: 6, name: "Andre W.",    car: "2022 Kia Telluride", src: "photo", when: "Today 11:30 AM", status: "Quote sent", photos: 3,
      summary: "Photo quote from the website. Side panel dent and scraped mirror. Quote sent and first follow-up goes out in 1 hour.",
      lines: [["Customer", "Sent 3 photos through the website form."], ["Auto-reply", "Thanks Andre. Your estimate is on the way."]] },
    { id: 7, name: "Patricia L.", car: "2019 Subaru Outback", src: "ai",  when: "Sun 2:10 PM", status: "Booked", photos: 2,
      summary: "Sunday call answered by Maya (AI). Booked a drop-off for Monday at 9:00 AM. Reminder text goes out the day before.",
      lines: [["Maya (AI)", "I can get you on the schedule. Would Monday morning work?"], ["Caller", "Yes, 9 o'clock."], ["Maya (AI)", "You're booked for Monday at 9. You'll get a reminder text the day before."]] },
    { id: 8, name: "Omar S.",     car: "2017 Dodge Charger", src: "google", when: "Mon 4:40 PM", status: "Booked", photos: 2,
      summary: "Found the shop through Google. Front bumper and headlight. Insurance job. Booked for Thursday estimate.",
      lines: [["Customer", "Insurance is covering it. When can I come in?"], ["Robert", "Thursday at 10 works. We'll text you the day before."]] }
  ],
  sources: {
    ai: "AI receptionist call", missed: "Missed-call text", photo: "Website photo quote", walk: "Walk-in", google: "Google"
  },
  quotes: [
    { id: 1, car: "2019 Toyota Camry",    name: "Isabel",  amt: 1850, type: "Out-of-pocket", age: "12 min", sent: 0, state: "Waiting" },
    { id: 2, car: "2022 Kia Telluride",   name: "Andre",   amt: 1240, type: "Out-of-pocket", age: "2 hrs",  sent: 1, state: "Waiting" },
    { id: 3, car: "2016 Honda Civic",     name: "Rosa",    amt: 3900, type: "Out-of-pocket", age: "5 hrs",  sent: 1, state: "Waiting", reply: [1, "Let me talk to my husband and get back to you."] },
    { id: 4, car: "2020 Chevy Tahoe",     name: "Dustin",  amt: 6300, type: "Insurance",     age: "1 day",  sent: 2, state: "Waiting" },
    { id: 5, car: "2018 Nissan Rogue",    name: "Gabriela",amt: 420,  type: "Out-of-pocket", age: "3 days", sent: 3, state: "Waiting", reply: [2, "Can you do it for less?"] },
    { id: 6, car: "2017 Dodge Charger",   name: "Omar",    amt: 5800, type: "Insurance",     age: "5 days", sent: 3, state: "Waiting" },
    { id: 7, car: "2021 Hyundai Elantra", name: "Ana",     amt: 3900, type: "Insurance",     age: "9 days", sent: 4, state: "Accepted", reply: [3, "Yes, let's go ahead."] },
    { id: 8, car: "2023 Dodge Challenger",name: "Ricardo", amt: 22000, type: "Insurance",    age: "14 days",sent: 5, state: "Accepted", reply: [1, "Approved. Bring it in Friday."] }
  ],
  steps: [ ["1 hr", "Sent 'thanks, any questions?'"], ["Day 1", "Sent 'ready to move forward?'"], ["Day 3", "Sent a check-in with the deposit link"], ["Day 7", "Sent 'want me to hold your spot?'"], ["Day 14", "Sent a last friendly nudge"] ],
  week: [
    { d: "Mon 23", ev: [ { t: "9:00 AM", k: "drop", w: "2026 Honda CR-V, Lauren", r: "Reminder text sent Sunday" }, { t: "1:00 PM", k: "pick", w: "2017 BMW 3 Series, Hector" } ] },
    { d: "Tue 24", ev: [ { t: "10:30 AM", k: "est", w: "2020 Nissan Altima, Sofia", r: "Reminder text sent Monday" } ] },
    { d: "Wed 25", today: true, ev: [ { t: "9:00 AM", k: "drop", w: "2019 Ford F-150, Jake", r: "Reminder text sent Tuesday" }, { t: "11:00 AM", k: "est", w: "2022 Honda Accord, Daniel", r: "Reminder text sent Tuesday" }, { t: "4:30 PM", k: "pick", w: "2020 Mazda CX-5, Valeria", r: "Ready text sent" } ] },
    { d: "Thu 26", ev: [ { t: "10:00 AM", k: "est", w: "2017 Dodge Charger, Omar", r: "Reminder goes out today" } ] },
    { d: "Fri 27", ev: [ { t: "8:30 AM", k: "drop", w: "2023 Dodge Challenger (return), Ricardo", r: "Reminder goes out Thursday" }, { t: "2:00 PM", k: "pick", w: "2021 Hyundai Elantra, Ana", r: "Reminder goes out Thursday" } ] }
  ],
  customers: [
    ["Maria G.", "2021 Toyota Camry, bumper", "Jun 2026", 1850, true],
    ["Carlos R.", "2019 Ford Ranger, door", "Aug 2026", 2400, true],
    ["Jennifer P.", "2022 Honda Accord, quarter panel", "Sep 2026", 5100, true],
    ["Luis A.", "2018 Chevy Malibu, scratches", "Mar 2026", 380, false],
    ["Aaliyah B.", "2020 Nissan Sentra, bumper", "Apr 2026", 1320, true],
    ["Hector V.", "2017 BMW 3 Series, front end", "Nov 2026", 5600, false],
    ["Samantha D.", "2023 Tesla Model Y, rear", "Oct 2026", 9800, true],
    ["Miguel T.", "2015 Dodge Ram, bed dent", "Jan 2026", 1100, true],
    ["Brianna C.", "2021 Kia Forte, mirror", "May 2026", 640, false],
    ["Jose F.", "2019 Jeep Cherokee, hood", "Feb 2026", 3750, true],
    ["Natalie O.", "2022 Mazda CX-30, door", "Jul 2026", 2900, false],
    ["Eric N.", "2020 GMC Sierra, tailgate", "Dec 2025", 4200, true]
  ],
  reviews: [
    { n: "Jennifer P.", d: "2 days ago", t: "Edwin and the team made my accident so much less stressful. Car looks brand new and they kept me updated by text the whole time.", draft: "Thank you, Jennifer! We're so glad you felt taken care of. We care about every car like it's our own. Take care out there. Edwin", st: "pending" },
    { n: "Samantha D.", d: "4 days ago", t: "Fair price, great communication, and the paint match is perfect. Highly recommend.", draft: "Samantha, thank you for trusting us with your Tesla! Happy the paint match came out right. See you next time, hopefully not for a repair! Edwin", st: "pending" },
    { n: "Carlos R.", d: "6 days ago", t: "Fast turnaround on my door. Honest people.", draft: "Gracias Carlos! Honest work is what we're about. Edwin", st: "approved" },
    { n: "Aaliyah B.", d: "1 week ago", t: "They answered when no one else would after hours. Booked me the next morning.", draft: "Thank you Aaliyah! We never want you waiting. Glad we could get you in fast. Edwin", st: "approved" }
  ],
  requests: [
    ["Hector V., 2017 BMW 3 Series", "Picked up today. Google review link sent by text", "Sent"],
    ["Valeria, 2020 Mazda CX-5", "Goes out after pickup this afternoon", "Queued"],
    ["Carmen, 2019 Kia Sorento", "Goes out after pickup", "Queued"],
    ["Natalie O., 2022 Mazda CX-30", "Reminder sent after 3 days, no reply yet", "Reminder"]
  ],
  weeks: [ ["Oct 5", 14.2], ["Oct 12", 18.9], ["Oct 19", 11.6], ["Oct 26", 21.4], ["Nov 2", 16.8], ["Nov 9", 23.1], ["Nov 16", 19.7], ["Nov 23", 24.3] ],
  found: [
    ["Google Business Profile", "Claimed and up to date", "ok", "Hours, address, phone, photos and services match."],
    ["Apple Maps", "Needs claiming", "todo", "Not claimed yet. Takes about 10 minutes."],
    ["Yelp", "Info out of date", "warn", "Old hours listed. We fix this once and keep it matching."],
    ["Bing Places", "Claimed", "ok", "Matches Google."],
    ["AI assistants (ChatGPT, Gemini)", "Not optimized yet", "todo", "Make sure the shop shows up when people ask an AI for a body shop in Northwest Dallas."]
  ],
  posts: [
    ["Hail season post (draft)", "Hail damage? We repair hoods, roofs and panels. Send photos for a same-day estimate. AA Auto Body Shop, Dallas.", "Scheduled Mon"],
    ["Before and after: 2022 Jeep Wrangler (draft)", "Fresh paint, same day look. Ask us about paint and body. (Uses a job photo from the board.)", "Ready to approve"]
  ]
};
