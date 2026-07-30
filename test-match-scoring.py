#!/usr/bin/env python3
"""Comprehensive test of match play live scoring module."""
import json
import sys
import requests

BASE = "https://betfranklin-prod.up.railway.app"
PIN = {"x-admin-pin": "2424"}
passed = 0
failed = 0
test_tokens = []  # (token, matchId) pairs to clean up
test_match_ids = []

def test(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  ✓ {name}")
    else:
        failed += 1
        print(f"  ✗ {name} — {detail}")

print("=" * 60)
print("MATCH PLAY LIVE SCORING — COMPREHENSIVE TESTS")
print("=" * 60)

# 0. Ensure matches exist
print("\n--- Setup: Ensure matches ---")
r = requests.get(f"{BASE}/api/matches/ensure")
test("Matches ensure endpoint returns 200", r.status_code == 200, f"Got {r.status_code}")

# Get all matches
r = requests.get(f"{BASE}/api/matches?day=2")
day2_matches = r.json()
test("Day 2 has 6 matches", len(day2_matches) == 6, f"Got {len(day2_matches)}")
for m in day2_matches:
    test_match_ids.append(m["id"])

r = requests.get(f"{BASE}/api/matches?day=3")
day3_matches = r.json()
test("Day 3 has 6 matches", len(day3_matches) == 6, f"Got {len(day3_matches)}")
for m in day3_matches:
    test_match_ids.append(m["id"])

# --- TEST 1: Token generation for multiple matches ---
print("\n--- Test 1: Token generation ---")
tokens_generated = []
for i, m in enumerate(day2_matches[:3]):  # Generate for first 3 matches
    mid = m["id"]
    r = requests.post(f"{BASE}/api/matches/{mid}/token", headers=PIN)
    test(f"Token for match {mid} returns 200", r.status_code == 200, f"Got {r.status_code}")
    token = r.json().get("token")
    test(f"Token {i+1} is 8 chars", len(token) == 8 if token else False, f"Got '{token}'")
    test(f"Token {i+1} is alphanumeric", token.isalnum() if token else False, f"Got '{token}'")
    tokens_generated.append((token, mid))
    test_tokens.append((token, mid))

# Verify tokens are unique
token_vals = [t[0] for t in tokens_generated]
test("All tokens are unique", len(set(token_vals)) == len(token_vals), f"Got {token_vals}")

# --- TEST 2: List score tokens (admin) ---
print("\n--- Test 2: List score tokens ---")
r = requests.get(f"{BASE}/api/score-tokens", headers=PIN)
test("List tokens returns 200", r.status_code == 200)
tokens_list = r.json()
test("Tokens list includes our tokens", len(tokens_list) >= 3, f"Got {len(tokens_list)}")

# --- TEST 3: Score entry page loads with valid token ---
print("\n--- Test 3: Get score entry by token ---")
token1, match1_id = tokens_generated[0]
r = requests.get(f"{BASE}/api/score/{token1}")
test("Get score entry returns 200", r.status_code == 200)
entry = r.json()
test("Entry has matchId", "matchId" in entry, f"Keys: {list(entry.keys())}")
test("Entry has day", entry.get("day") == 2, f"Got day={entry.get('day')}")
test("Entry has matchIndex", "matchIndex" in entry, f"Got {entry.get('matchIndex')}")
test("Entry has tommyWins", "tommyWins" in entry, f"Keys: {list(entry.keys())}")
test("Entry has goonWins", "goonWins" in entry, f"Keys: {list(entry.keys())}")
test("Entry has holeResults list", isinstance(entry.get("holeResults"), list))
test("Entry starts at 0-0", entry["tommyWins"] == 0 and entry["goonWins"] == 0,
     f"Got {entry['tommyWins']}-{entry['goonWins']}")

# --- TEST 4: Invalid token ---
print("\n--- Test 4: Invalid token ---")
r = requests.get(f"{BASE}/api/score/INVALID123")
test("Invalid token returns 404", r.status_code == 404, f"Got {r.status_code}")
r = requests.post(f"{BASE}/api/score/INVALID123/hole", json={"holeNumber": 1, "result": "tommy"})
test("Submit to invalid token returns 404", r.status_code == 404, f"Got {r.status_code}")

# --- TEST 5: Submit all 3 outcome types ---
print("\n--- Test 5: Submit outcomes (Tommy, Goon, Halve) ---")
# Hole 1: Tommy wins
r = requests.post(f"{BASE}/api/score/{token1}/hole", json={"holeNumber": 1, "result": "tommy"})
test("Submit Tommy hole 1 returns 200", r.status_code == 200, f"Got {r.status_code}")
test("Response has result=tommy", r.json().get("result") == "tommy")

# Hole 2: Goon wins
r = requests.post(f"{BASE}/api/score/{token1}/hole", json={"holeNumber": 2, "result": "goon"})
test("Submit Goon hole 2 returns 200", r.status_code == 200, f"Got {r.status_code}")
test("Response has result=goon", r.json().get("result") == "goon")

# Hole 3: Halved
r = requests.post(f"{BASE}/api/score/{token1}/hole", json={"holeNumber": 3, "result": "halve"})
test("Submit Halve hole 3 returns 200", r.status_code == 200, f"Got {r.status_code}")
test("Response has result=halve", r.json().get("result") == "halve")

# Verify counts
r = requests.get(f"{BASE}/api/score/{token1}")
entry = r.json()
test("After 3 holes: tommyWins=1", entry["tommyWins"] == 1, f"Got {entry['tommyWins']}")
test("After 3 holes: goonWins=1", entry["goonWins"] == 1, f"Got {entry['goonWins']}")
test("After 3 holes: halved=1", entry["halved"] == 1, f"Got {entry['halved']}")
test("After 3 holes: 3 hole results", len(entry["holeResults"]) == 3)

# --- TEST 6: Edit an existing hole result ---
print("\n--- Test 6: Edit hole result ---")
# Change hole 1 from tommy to goon
r = requests.post(f"{BASE}/api/score/{token1}/hole", json={"holeNumber": 1, "result": "goon"})
test("Edit hole 1 to goon returns 200", r.status_code == 200)
# Verify counts changed
r = requests.get(f"{BASE}/api/score/{token1}")
entry = r.json()
test("After edit: tommyWins=0", entry["tommyWins"] == 0, f"Got {entry['tommyWins']}")
test("After edit: goonWins=2", entry["goonWins"] == 2, f"Got {entry['goonWins']}")
test("After edit: still 3 hole results", len(entry["holeResults"]) == 3)

# --- TEST 7: Clear a hole result ---
print("\n--- Test 7: Clear hole result ---")
r = requests.delete(f"{BASE}/api/score/{token1}/hole/3")
test("Clear hole 3 returns 200", r.status_code == 200)
r = requests.get(f"{BASE}/api/score/{token1}")
entry = r.json()
test("After clear: 2 hole results", len(entry["holeResults"]) == 2, f"Got {len(entry['holeResults'])}")
test("After clear: halved=0", entry["halved"] == 0, f"Got {entry['halved']}")
test("After clear: goonWins=2", entry["goonWins"] == 2, f"Got {entry['goonWins']}")

# --- TEST 8: Invalid result type rejected ---
print("\n--- Test 8: Invalid result type ---")
r = requests.post(f"{BASE}/api/score/{token1}/hole", json={"holeNumber": 5, "result": "invalid"})
test("Invalid result returns 400", r.status_code == 400, f"Got {r.status_code}")

# --- TEST 9: Missing params ---
print("\n--- Test 9: Missing params ---")
r = requests.post(f"{BASE}/api/score/{token1}/hole", json={"holeNumber": 5})
test("Missing result returns 400", r.status_code == 400, f"Got {r.status_code}")
r = requests.post(f"{BASE}/api/score/{token1}/hole", json={"result": "tommy"})
test("Missing holeNumber returns 400", r.status_code == 400, f"Got {r.status_code}")

# --- TEST 10: Live summaries update ---
print("\n--- Test 10: Match summaries update ---")
r = requests.get(f"{BASE}/api/matches/summaries/2")
summaries = r.json()
test("Summaries returns 6 matches", len(summaries) == 6)
match1_summary = next(s for s in summaries if s["match"]["id"] == match1_id)
test("Match 1 summary: tommyWins=0", match1_summary["tommyWins"] == 0, f"Got {match1_summary['tommyWins']}")
test("Match 1 summary: goonWins=2", match1_summary["goonWins"] == 2, f"Got {match1_summary['goonWins']}")
test("Match 1 summary: thruHole=2", match1_summary["thruHole"] == 2, f"Got {match1_summary['thruHole']}")
test("Match 1 summary: halved=0", match1_summary["halved"] == 0, f"Got {match1_summary['halved']}")
test("Match 1 summary has holeResults", "holeResults" in match1_summary)
test("Match 1 summary: 2 hole results", len(match1_summary["holeResults"]) == 2)

# --- TEST 11: Day totals aggregate across matches ---
print("\n--- Test 11: Day totals aggregation ---")
# Match 1 has: 2 goon wins (holes 1,2)
# Now add scores to match 2 (token2)
token2, match2_id = tokens_generated[1]
# Match 2: 3 tommy, 1 goon
requests.post(f"{BASE}/api/score/{token2}/hole", json={"holeNumber": 1, "result": "tommy"})
requests.post(f"{BASE}/api/score/{token2}/hole", json={"holeNumber": 2, "result": "tommy"})
requests.post(f"{BASE}/api/score/{token2}/hole", json={"holeNumber": 3, "result": "tommy"})
requests.post(f"{BASE}/api/score/{token2}/hole", json={"holeNumber": 4, "result": "goon"})

r = requests.get(f"{BASE}/api/matches/totals/2")
totals = r.json()
test("Totals has tommy key", "tommy" in totals)
test("Totals has goon key", "goon" in totals)
test("Totals has halved key", "halved" in totals)
test("Totals tommy=3 (from match 2)", totals["tommy"] == 3, f"Got {totals['tommy']}")
test("Totals goon=3 (2 from match1 + 1 from match2)", totals["goon"] == 3, f"Got {totals['goon']}")

# --- TEST 12: Multiple matches with different results ---
print("\n--- Test 12: Multiple matches independent ---")
token3, match3_id = tokens_generated[2]
# Match 3: all halved
requests.post(f"{BASE}/api/score/{token3}/hole", json={"holeNumber": 1, "result": "halve"})
requests.post(f"{BASE}/api/score/{token3}/hole", json={"holeNumber": 2, "result": "halve"})

r = requests.get(f"{BASE}/api/score/{token3}")
entry3 = r.json()
test("Match 3: tommyWins=0", entry3["tommyWins"] == 0)
test("Match 3: goonWins=0", entry3["goonWins"] == 0)
test("Match 3: halved=2", entry3["halved"] == 2, f"Got {entry3['halved']}")

# Verify match 1 unaffected by match 3
r = requests.get(f"{BASE}/api/score/{token1}")
entry1 = r.json()
test("Match 1 unaffected by match 3: goonWins=2", entry1["goonWins"] == 2, f"Got {entry1['goonWins']}")

# --- TEST 13: Full 18-hole simulation ---
print("\n--- Test 13: Full 18-hole match simulation ---")
# Clear match 3 and simulate a full match
for h in [1, 2]:
    requests.delete(f"{BASE}/api/score/{token3}/hole/{h}")

# Simulate: 10 tommy, 6 goon, 2 halved
for h in range(1, 19):
    if h <= 10:
        result = "tommy"
    elif h <= 16:
        result = "goon"
    else:
        result = "halve"
    requests.post(f"{BASE}/api/score/{token3}/hole", json={"holeNumber": h, "result": result})

r = requests.get(f"{BASE}/api/score/{token3}")
entry3 = r.json()
test("Full match: tommyWins=10", entry3["tommyWins"] == 10, f"Got {entry3['tommyWins']}")
test("Full match: goonWins=6", entry3["goonWins"] == 6, f"Got {entry3['goonWins']}")
test("Full match: halved=2", entry3["halved"] == 2, f"Got {entry3['halved']}")
test("Full match: 18 hole results", len(entry3["holeResults"]) == 18, f"Got {len(entry3['holeResults'])}")

# --- TEST 14: Admin override (direct hole entry) ---
print("\n--- Test 14: Admin direct hole entry ---")
r = requests.post(f"{BASE}/api/matches/{match3_id}/hole", headers=PIN,
                  json={"holeNumber": 18, "result": "tommy"})
test("Admin override returns 200", r.status_code == 200, f"Got {r.status_code}")
r = requests.get(f"{BASE}/api/score/{token3}")
entry3 = r.json()
test("After admin override: tommyWins=11", entry3["tommyWins"] == 11, f"Got {entry3['tommyWins']}")
test("After admin override: goonWins=6", entry3["goonWins"] == 6, f"Got {entry3['goonWins']}")

# --- TEST 15: Admin clear hole result ---
print("\n--- Test 15: Admin clear hole result ---")
r = requests.delete(f"{BASE}/api/matches/{match3_id}/hole/18", headers=PIN)
test("Admin clear returns 200", r.status_code == 200)
r = requests.get(f"{BASE}/api/score/{token3}")
entry3 = r.json()
test("After admin clear: tommyWins back to 10", entry3["tommyWins"] == 10, f"Got {entry3['tommyWins']}")

# --- CLEANUP ---
print("\n--- Cleanup: Clearing all test data ---")
# Clear all hole results from test matches
for token, match_id in test_tokens:
    entry = requests.get(f"{BASE}/api/score/{token}").json()
    for h in entry.get("holeResults", []):
        requests.delete(f"{BASE}/api/score/{token}/hole/{h['holeNumber']}")
    # Also try admin clear
    for h in range(1, 19):
        requests.delete(f"{BASE}/api/matches/{match_id}/hole/{h}", headers=PIN)

# Verify cleanup
for token, _ in test_tokens:
    entry = requests.get(f"{BASE}/api/score/{token}").json()
    test(f"Cleanup: token {token} has 0 results", len(entry["holeResults"]) == 0,
         f"Got {len(entry['holeResults'])}")

# --- SUMMARY ---
print("\n" + "=" * 60)
print(f"RESULTS: {passed} passed, {failed} failed")
print("=" * 60)
sys.exit(1 if failed > 0 else 0)
