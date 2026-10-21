import re, sys, collections
def norm(p):
    out = collections.Counter()
    for l in open(p):
        l = re.sub(r' ở giây.*', '', l.rstrip())
        l = re.sub(r', slant [0-9]+( \([^)]*\))?', '', l)
        key = re.sub(r'lún [0-9.]+ \(quá', 'lún X (quá', l)
        out[key] += 1
    return out
a, b = norm(sys.argv[1]), norm(sys.argv[2])
for k in sorted(set(a) | set(b)):
    if a[k] != b[k]:
        print(a[k], '->', b[k], k[:260])
# lún số đo trước/sau cho cùng dòng
def sinks(p):
    d = {}
    for l in open(p):
        m = re.search(r'^(.*?da lún vào món — .*?): lún ([0-9.]+)', l)
        if m: d[re.sub(r', slant [0-9]+( \([^)]*\))?', '', m.group(1))] = m.group(2)
    return d
sa, sb = sinks(sys.argv[1]), sinks(sys.argv[2])
for k in sorted(set(sa) | set(sb)):
    if sa.get(k) != sb.get(k): print('LUN', sa.get(k), '->', sb.get(k), k[:160])
