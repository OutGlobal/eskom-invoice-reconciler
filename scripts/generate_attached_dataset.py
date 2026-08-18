import json
import re
import math
from datetime import datetime, timedelta

transcript_path = "/Users/admin/.gemini/antigravity/brain/09f3c432-15af-42da-81a1-ddd18099bc29/.system_generated/logs/transcript_full.jsonl"

with open(transcript_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

p1_raw = json.dumps(json.loads(lines[1443]))
p2_raw = json.dumps(json.loads(lines[1860]))

telemetry_map = {}

def parse_line(line_str):
    line_str = line_str.strip()
    if ";" in line_str:
        parts = line_str.split(";")
    else:
        parts = line_str.split(",")
    if len(parts) < 2:
        return
    ts_str = parts[0].strip()[:16] # YYYY-MM-DD HH:MM
    
    def to_float(val):
        v = val.strip().replace(",", ".")
        try:
            return float(v)
        except ValueError:
            return None

    kW = to_float(parts[1]) if len(parts) > 1 else None
    kVAr = to_float(parts[2]) if len(parts) > 2 else None
    kVA = to_float(parts[3]) if len(parts) > 3 else None
    pf = to_float(parts[4]) if len(parts) > 4 else None

    if kW is not None and kVA is not None:
        telemetry_map[ts_str] = {
            "kW": kW,
            "kVAr": kVAr if kVAr is not None else round(math.sqrt(max(0, kVA*kVA - kW*kW)), 2),
            "kVA": kVA,
            "pf": pf if pf is not None else round(kW / kVA, 4) if kVA > 0 else 0.96
        }

for match in re.finditer(r"2026-\d\d-\d\d \d\d:\d\d[,;][^\n\r\"\\]*", p1_raw):
    parse_line(match.group(0))

for match in re.finditer(r"2026-\d\d-\d\d \d\d:\d\d[,;][^\n\r\"\\]*", p2_raw):
    parse_line(match.group(0))

print(f"Total exact telemetry points loaded into map: {len(telemetry_map)}")
sample_keys = sorted(list(telemetry_map.keys()))
if sample_keys:
    print(f"First key: {sample_keys[0]} -> {telemetry_map[sample_keys[0]]}")
    print(f"Last key: {sample_keys[-1]} -> {telemetry_map[sample_keys[-1]]}")

# Save parsed dictionary to scratch
with open("/Users/admin/.gemini/antigravity/brain/09f3c432-15af-42da-81a1-ddd18099bc29/scratch/telemetry_map.json", "w") as f:
    json.dump(telemetry_map, f, indent=2)
