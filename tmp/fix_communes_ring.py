"""
Fix the communes_marrakech.geojson by re-downloading using a different strategy:
Instead of querying relations and chaining ways manually, use Overpass with 'out geom;'
which returns pre-assembled geometry for each way member. We then sort ways into a 
proper ring using the winding algorithm.

Since Overpass is throttled, this script will use the existing raw file and 
reconstruct proper rings from the geometry already stored.
"""
import json
import math

def chain_ways_into_ring(members):
    """
    Properly chain OSM way segments into a single closed outer ring.
    Uses endpoint matching to connect segments like puzzle pieces.
    """
    segments = []
    for m in members:
        if m.get('type') == 'way' and m.get('role') in ('outer', ''):
            geom = m.get('geometry', [])
            if geom and len(geom) >= 2:
                pts = [(round(g['lon'], 6), round(g['lat'], 6)) for g in geom]
                segments.append(pts)
    
    if not segments:
        return None
    if len(segments) == 1:
        r = segments[0]
        if r[0] != r[-1]:
            r = r + [r[0]]
        return r if len(r) >= 4 else None
    
    def close_enough(p1, p2, tol=5e-4):
        return abs(p1[0] - p2[0]) < tol and abs(p1[1] - p2[1]) < tol
    
    ring = list(segments[0])
    remaining = list(segments[1:])
    max_passes = len(remaining) * 3
    passes = 0
    
    while remaining and passes < max_passes:
        passes += 1
        found = False
        for i, seg in enumerate(remaining):
            if close_enough(ring[-1], seg[0]):
                ring.extend(seg[1:])
                remaining.pop(i)
                found = True
                break
            elif close_enough(ring[-1], seg[-1]):
                ring.extend(list(reversed(seg))[1:])
                remaining.pop(i)
                found = True
                break
            elif close_enough(ring[0], seg[-1]):
                ring = seg + ring[1:]
                remaining.pop(i)
                found = True
                break
            elif close_enough(ring[0], seg[0]):
                ring = list(reversed(seg)) + ring[1:]
                remaining.pop(i)
                found = True
                break
        
        if not found:
            # No direct connection found - skip segment (it may be inner ring)
            remaining.pop(0)
    
    if ring and ring[0] != ring[-1]:
        ring.append(ring[0])
    
    return ring if len(ring) >= 4 else None


def douglas_peucker(points, epsilon=0.0002):
    """Reduce polygon complexity while preserving shape."""
    if len(points) <= 4:
        return points
    
    def pt_line_dist(pt, s, e):
        dx, dy = e[0]-s[0], e[1]-s[1]
        if dx == 0 and dy == 0:
            return math.hypot(pt[0]-s[0], pt[1]-s[1])
        t = max(0, min(1, ((pt[0]-s[0])*dx + (pt[1]-s[1])*dy) / (dx*dx + dy*dy)))
        return math.hypot(pt[0]-(s[0]+t*dx), pt[1]-(s[1]+t*dy))
    
    def simplify(pts, eps):
        if len(pts) <= 2:
            return pts
        dmax, idx = 0, 0
        for i in range(1, len(pts)-1):
            d = pt_line_dist(pts[i], pts[0], pts[-1])
            if d > dmax:
                dmax, idx = d, i
        if dmax > eps:
            l = simplify(pts[:idx+1], eps)
            r = simplify(pts[idx:], eps)
            return l[:-1] + r
        return [pts[0], pts[-1]]
    
    result = simplify(points, epsilon)
    if result[0] != result[-1]:
        result.append(result[0])
    return result


# Load the existing file which already has way geometries cached
print("Loading existing communes_marrakech.geojson...")
with open('Frontend/src/data/communes_marrakech.geojson', 'r', encoding='utf-8') as f:
    existing = json.load(f)

print(f"Current features: {len(existing['features'])}")

# Check the quality of existing polygons
for feat in existing['features'][:5]:
    coords = feat['geometry']['coordinates'][0]
    name = feat['properties'].get('commune_fr', 'N/A')
    print(f"  {name}: {len(coords)} vertices")

print("\nThe existing file was constructed using concatenated (not chained) ways.")
print("Attempting to fix via re-download from raw OSM data cache...")

# Since we can't re-chain (original members data is lost after conversion),
# we need to fetch fresh from Overpass. Let's try a different endpoint.
import urllib.request
import urllib.parse
import time

mirrors = [
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

# Use more targeted query - just Marrakech city area
query = """[out:json][timeout:90];
(
  relation["admin_level"="8"]["name:fr"](31.4,-8.3,31.9,-7.7);
  relation["admin_level"="8"]["name"](31.55,-8.05,31.70,-7.85);
);
out geom;"""

result = None
for mirror in mirrors:
    print(f"\nTrying {mirror}...")
    try:
        data = urllib.parse.urlencode({"data": query}).encode()
        req = urllib.request.Request(mirror, data=data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        req.add_header("User-Agent", "MarrakechRealEstate/1.0")
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read().decode('utf-8')
        result = json.loads(raw)
        elements = result.get('elements', [])
        print(f"  Got {len(elements)} elements!")
        if elements:
            break
    except Exception as e:
        print(f"  Failed: {e}")
        time.sleep(2)

if not result or not result.get('elements'):
    print("\nAll mirrors failed. Need to wait for Overpass rate limit to reset.")
    exit(1)

elements = result.get('elements', [])
features = []
failed = []

for el in elements:
    tags = el.get('tags', {})
    name_fr = tags.get('name:fr') or tags.get('name') or ''
    if not name_fr:
        continue
    
    members = el.get('members', [])
    ring = chain_ways_into_ring(members)
    
    if not ring or len(ring) < 4:
        failed.append(name_fr)
        continue
    
    # Simplify to ~50-200 points per commune
    simplified = douglas_peucker(ring, epsilon=0.0003)
    if len(simplified) < 4:
        simplified = ring[:min(200, len(ring))]
        if simplified[0] != simplified[-1]:
            simplified.append(simplified[0])
    
    lons = [c[0] for c in simplified[:-1]]
    lats = [c[1] for c in simplified[:-1]]
    clat = round(sum(lats)/len(lats), 6)
    clon = round(sum(lons)/len(lons), 6)
    
    features.append({
        "type": "Feature",
        "properties": {
            "commune_fr": name_fr,
            "osm_id": el.get('id'),
            "centroid_lat": clat,
            "centroid_lon": clon
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [simplified]
        }
    })

print(f"\nSuccessfully converted: {len(features)} communes")
if failed:
    print(f"Failed to chain ring: {failed}")

geojson = {"type": "FeatureCollection", "features": features}
with open('Frontend/src/data/communes_marrakech.geojson', 'w', encoding='utf-8') as f:
    json.dump(geojson, f, ensure_ascii=False, indent=2)

file_size = sum(1 for _ in open('Frontend/src/data/communes_marrakech.geojson'))
print(f"\nSaved {len(features)} communes | {file_size} lines")
print("\nSample (with vertex counts):")
for feat in features[:10]:
    n = len(feat['geometry']['coordinates'][0])
    print(f"  - {feat['properties']['commune_fr']}: {n} vertices")
