#!/usr/bin/env python3
"""Build the BookStack Client Template and run the two-client privacy test.

Run on the VPS:  python3 setup_and_test.py
Asks for an admin API token (Settings > Users > you > API Tokens). Uses only the Python standard library.
Creates the "Client Template" book (admins only), then two dummy clients with one book each,
logs in as client A over the public site and checks that nothing from client B is visible,
then deletes the dummy clients again.
"""
import getpass, http.cookiejar, json, re, secrets, sys, urllib.error, urllib.parse, urllib.request

API = "http://127.0.0.1:3011/api"
SITE = "https://docs.kyneticai.com"
TEMPLATE_PAGES = [
 {
  "name": "Business Profile",
  "markdown": "# Business Profile\n\n> Template. Replace every `[bracket]` when you create a client's space. No real data in the template.\n\n| | |\n|---|---|\n| Business name | [Business name] |\n| Owner | [Owner name] |\n| Niche | [Roofing / other] |\n| Service area | [Cities, ZIP codes, radius] |\n| Hours | [Mon\u2013Fri 8\u20136, emergencies 24/7?] |\n| Website | [URL] |\n| Main phone | [Number] |\n| Google rating | [4.8 from 120 reviews] |\n| Lead sources | [Meta lead ads / website form / other] |\n| Booking calendar | [Cal.com / Google Calendar] |\n\n## Services\n- [Service 1]\n- [Service 2]\n\n## How you want leads handled\n- Who counts as a qualified lead: [owner of the property, inside the service area, ...]\n- What the AI assistant books: [free inspection / estimate]\n- When to send a lead to a person instead: [rules]\n"
 },
 {
  "name": "Contacts",
  "markdown": "# Contacts\n\n> Template. Replace every `[bracket]`.\n\n## Your team\n| Name | Role | Phone | Email | Best for |\n|---|---|---|---|---|\n| [Name] | Owner | [Phone] | [Email] | Approvals, billing |\n| [Name] | [Office manager] | [Phone] | [Email] | Day-to-day questions |\n\n## Kynetic AI\n| Name | Role | Email |\n|---|---|---|\n| Abdullah | Build and support | abdullah@kyneticai.com |\n| Quentin | Account | [Email] |\n\nSupport: we reply within 1 business day.\n"
 },
 {
  "name": "Plan 1 Scope",
  "markdown": "# Plan 1 Scope\n\n> Template. Replace every `[bracket]`.\n\n## What we build\nAn AI speed-to-lead agent for **[Business name]**:\n- Every new lead from **[lead source]** gets a phone call within about 60 seconds, day or night.\n- The assistant introduces itself as an AI assistant calling for [Business name], qualifies the lead, and books a **[free inspection]** on your calendar.\n- If nobody answers, it tries again at 5 minutes, 1 hour and the next day (4 attempts at most).\n- Every call, recording, transcript and booking is logged for you.\n- Your lead form carries consent wording, so every lead has agreed to be called.\n\n## Not included in Plan 1\n- Inbound call answering, review requests, and old-lead reactivation. These are add-ons for later.\n\n## Price and billing\n- Package: [$ amount], 3 months.\n- Three invoices: 50% at kickoff, 25% when the build is ready for your testing, 25% at go-live.\n"
 },
 {
  "name": "Timeline",
  "markdown": "# Timeline\n\n> Template. Fill in the dates when you create a client's space.\n\n| Stage | Date | What happens | Status |\n|---|---|---|---|\n| Kickoff | [Date] | Agreement signed, first invoice paid, kickoff call: services, service area, hours, booking rules, calendar | [Not started / Done] |\n| Build | [Date] | We set up your assistant, connect your lead source and calendar, and add consent wording to your form | [ ] |\n| Testing | [Date] | You test the assistant with your own calls and leads; we adjust | [ ] |\n| Go-live | [Date] | Every new lead gets a call within about 60 seconds | [ ] |\n| 30-day review | [Date] | Results review call | [ ] |\n"
 },
 {
  "name": "Documents",
  "markdown": "# Documents\n\n> Template. Upload or link each document when it exists.\n\n| Document | Link | Date |\n|---|---|---|\n| Signed agreement | [Link] | [Date] |\n| Welcome packet | [Link] | [Date] |\n| Project brief (intake answers) | [Link] | [Date] |\n| Invoices | [Stripe link] | [Date] |\n| Monthly reports | [Link] | [Date] |\n"
 },
 {
  "name": "Results Dashboard",
  "markdown": "# Results Dashboard\n\n> Template. Updated weekly once you are live.\n\n| Week of | New leads | Called within 60 s | Reached | Booked | Avg seconds to first ring |\n|---|---|---|---|---|---|\n| [Date] | [0] | [0] | [0] | [0] | [0] |\n\n## Notes\n- [What worked, what we changed this week]\n"
 }
]

tid = input("Token ID: ").strip()
sec = getpass.getpass("Token Secret (hidden): ").strip()


def api(method, path, body=None, ok404=False):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        "Authorization": f"Token {tid}:{sec}", "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        if ok404 and e.code == 404:
            return None
        sys.exit(f"STOPPED: API {method} {path} -> {e.code} {e.read()[:300].decode(errors='replace')}")


def find(kind, field, value):
    q = urllib.parse.urlencode({f"filter[{field}]": value})
    rows = api("GET", f"/{kind}?{q}&count=500")["data"]
    # BookStack silently ignores unknown filter fields, so always confirm the match here.
    return next((r for r in rows if r.get(field) == value), None)


def lock_book(book_id, role_ids_view, admin_id):
    perms = [{"role_id": admin_id, "view": True, "create": True, "update": True, "delete": True}]
    perms += [{"role_id": r, "view": True, "create": False, "update": False, "delete": False} for r in role_ids_view]
    api("PUT", f"/content-permissions/book/{book_id}", {
        "fallback_permissions": {"inheriting": False, "view": False, "create": False, "update": False, "delete": False},
        "role_permissions": perms})


roles = api("GET", "/roles?count=100")["data"]
admin = next((r for r in roles if "id" in r and (r.get("system_name") == "admin"
                                                 or r.get("display_name", "").lower() == "admin")), None)
if not admin:  # fresh installs create the Admin role first
    one = api("GET", "/roles/1", ok404=True)
    admin = one if one and one.get("display_name", "").lower() == "admin" else None
if not admin:
    sys.exit("STOPPED: could not find the Admin role.")
admin_id = admin["id"]

print("\n== Client Template")
book = find("books", "name", "Client Template")
if book:
    print(f"already exists (book {book['id']}), left as is")
else:
    book = api("POST", "/books", {"name": "Client Template",
                                 "description": "Copy this book for each new client. Admins only."})
    for i, p in enumerate(TEMPLATE_PAGES):
        api("POST", "/pages", {"book_id": book["id"], "name": p["name"], "markdown": p["markdown"], "priority": i})
    print(f"created book {book['id']} with {len(TEMPLATE_PAGES)} pages")
lock_book(book["id"], [], admin_id)
print("locked to admins only")

print("\n== Dummy clients")
made = {}
for tag in ("A", "B"):
    name = f"Test Client {tag}"
    role = api("POST", "/roles", {
        "display_name": f"Client - Test {tag}", "description": "Dummy client for the privacy test", "permissions": []})
    pw = secrets.token_urlsafe(18)
    email = f"test-client-{tag.lower()}@example.com"
    user = find("users", "email", email)
    if user:
        api("PUT", f"/users/{user['id']}", {"password": pw, "roles": [role["id"]]})
    else:
        user = api("POST", "/users", {"name": name, "email": email, "password": pw, "roles": [role["id"]]})
    b = find("books", "name", name) or api("POST", "/books", {"name": name})
    if not api("GET", f"/books/{b['id']}")["contents"]:
        api("POST", "/pages", {"book_id": b["id"], "name": f"Welcome {tag}", "markdown": f"Private page for {name}."})
    lock_book(b["id"], [role["id"]], admin_id)
    made[tag] = {"role": role, "user": user, "book": b, "email": email, "pw": pw}
    print(f"{name}: user {user['id']}, role {role['id']}, book {b['id']}")

print("\n== Log in as Test Client A and look for anything from B")
jar = http.cookiejar.CookieJar()
web = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def get(path):
    try:
        with web.open(SITE + path, timeout=30) as r:
            return r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")


_, html = get("/login")
m = re.search(r'name="_token" value="([^"]+)"', html)
if not m:
    sys.exit("STOPPED: login form not found.")
data = urllib.parse.urlencode({"_token": m.group(1), "email": made["A"]["email"], "password": made["A"]["pw"]}).encode()
with web.open(SITE + "/login", data=data, timeout=30) as r:
    home = r.read().decode(errors="replace")
if "Test Client A" not in home:
    sys.exit("STOPPED: could not log in as Test Client A.")

results = []


def check(label, path, must_not=("Test Client B", "Welcome B", "Client Template"), must=()):
    code, body = get(path)
    leaked = [s for s in must_not if s in body]
    missing = [s for s in must if s not in body]
    ok = not leaked and not missing
    results.append(ok)
    note = "" if ok else f"  leaked={leaked} missing={missing}"
    print(f"{'PASS' if ok else 'FAIL'}  {label} (HTTP {code}){note}")


check("Books list shows only A's book", "/books", must=("Test Client A",))
check("Search for 'Test'", "/search?term=Test")
check("Search for 'Client'", "/search?term=Client")
check("Open B's book directly", "/books/test-client-b")
check("Open the Client Template directly", "/books/client-template")
check("@mention user lookup", "/search/users/mention?search=Test")
check("User picker", "/search/users/select?search=Test")
check("Users admin list", "/settings/users")
check("Shelves", "/shelves")
code, body = get("/user/test-client-b")
print(f"NOTE  B's profile page by guessed address: {'name visible' if 'Test Client B' in body else 'hidden'} "
      f"(HTTP {code}). Expected: name only, never email -> {'email hidden' if made['B']['email'] not in body else 'EMAIL LEAKED'}")
if made["B"]["email"] in body:
    results.append(False)

print("\n== Clean up dummy clients")
for tag, d in made.items():
    api("DELETE", f"/books/{d['book']['id']}", ok404=True)
    api("DELETE", f"/users/{d['user']['id']}", ok404=True)
    api("DELETE", f"/roles/{d['role']['id']}", ok404=True)
print("deleted dummy users, roles and books (books go to the recycle bin)")

print("\n== RESULT:", "ALL PASS - clients are isolated" if all(results) else "SOMETHING LEAKED - do not onboard clients yet")
print(f"Client Template: {SITE}/books/client-template")
