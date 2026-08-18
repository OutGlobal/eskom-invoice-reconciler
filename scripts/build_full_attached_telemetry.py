import sys
import re
import json

# Read input attached text from transcript or prompt
path = "/Users/admin/.gemini/antigravity/brain/09f3c432-15af-42da-81a1-ddd18099bc29/.system_generated/logs/transcript_full.jsonl"
raw_lines = []

with open(path, "r", encoding="utf-8") as f:
    for line in f:
        matches = re.findall(r"2026-\d\d-\d\d \d\d:\d\d.*", line)
        if len(matches) > len(raw_lines):
            raw_lines = matches

print(f"Extracted {len(raw_lines)} interval lines from transcript.")

parsed_readings = []

for line in raw_lines:
    line = line.strip()
    if not line or "DateTime" in line:
        continue
    
    # Handle semicolon or comma delimiter
    if ";" in line:
        parts = line.split(";")
    else:
        parts = line.split(",")

    if len(parts) < 2:
        continue

    dt_str = parts[0].strip()
    
    def parse_num(val_str):
        val_str = val_str.strip().replace(",", ".")
        try:
            return float(val_str)
        except ValueError:
            return None

    kW = parse_num(parts[1]) if len(parts) > 1 else None
    kVAr = parse_num(parts[2]) if len(parts) > 2 else None
    kVA = parse_num(parts[3]) if len(parts) > 3 else None
    pf = parse_num(parts[4]) if len(parts) > 4 else None

    parsed_readings.append({
        "ts": dt_str,
        "kW": kW,
        "kVAr": kVAr,
        "kVA": kVA,
        "pf": pf
    })

print(f"Parsed {len(parsed_readings)} interval readings.")
with open("/Users/admin/.gemini/antigravity/brain/09f3c432-15af-42da-81a1-ddd18099bc29/scratch/parsed_telemetry.json", "w") as out:
    json.dump(parsed_readings, out, indent=2)

print("Saved scratch/parsed_telemetry.json")
