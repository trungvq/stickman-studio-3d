import json, os, re, glob
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = json.load(open(f'{R}/sau/rows.json'))
goc = json.load(open(f'{R}/sau/goc.json'))
ANG = ['cheo', 'truoc', 'ngang']
PAT = re.compile(r'^([\d.]+)-(.+)-(tay-phải|tay-trái|hai-tay)-(cheo|truoc|ngang)\.png$')

notes, verdict = {}, {}
for line in open(f'{R}/shot-doi-hinh.md'):
    c = [x.strip() for x in line.strip().strip('|').split('|')]
    if len(c) >= 9 and c[0].isdigit():
        notes[int(c[0]) - 1] = c[-1]
        m = re.match(r'\*\*(.+?)\*\*', c[-1])
        verdict[int(c[0]) - 1] = m.group(1).rstrip('.;') if m else ''

def index(d):
    out = {}
    for p in glob.glob(f'{d}/*.png'):
        m = PAT.match(os.path.basename(p))
        if m: out[(float(m[1]), m[2], m[3], m[4])] = os.path.relpath(p, R)
    return out

def pick(idx, sec, cast, hand, a):
    return idx.get((sec, cast, hand, a)) or idx.get((sec, cast, 'hai-tay', a))

items = []
for i, r in enumerate(rows):
    sc, cast = r['scene'], r['cast']
    hand = 'tay-phải' if r['side'] == 'right' else 'tay-trái'
    sau = index(f'{R}/sau/can-tay/{sc}')
    tr = {**index(f'{R}/truoc/can-tay-them/{sc}'), **index(f'{R}/truoc/can-tay/{sc}')}
    secs = sorted({k[0] for k in sau if k[1] == cast and k[2] in (hand, 'hai-tay')})
    frames = []
    for s in secs:
        views = {}
        for a in ANG:
            b, f = pick(tr, s, cast, hand, a), pick(sau, s, cast, hand, a)
            if b and f: views[a] = {'truoc': b, 'sau': f}
        if not views: continue
        picked = any(abs(s - p) < 1e-6 for p in r['pick'])
        g = next((v for k, v in goc.items() if k.split('|')[0] == str(i) and abs(float(k.split('|')[1]) - s) < 1e-6), None)
        frames.append({'t': s, 'picked': picked, 'goc': g if g in views else ('cheo' if 'cheo' in views else next(iter(views))), 'views': views})
    items.append({
        'id': f'g6-{i + 1}', 'n': i + 1, 'kind': 'shot', 'scene': sc, 'cast': cast,
        'side': 'phải' if r['side'] == 'right' else 'trái', 'role': r['role'], 'old': r['old'],
        'label': r['label'], 'item': r['hold'].get('item') or r['old'].split('#')[0],
        'group': r['hold'].get('group') or 'platform (tay phụ)', 'angle': r['angle'], 'shift': r['shift'],
        'note': notes.get(i, ''), 'verdict': verdict.get(i, ''), 'frames': frames,
    })

prog = [l for l in open(f'{R}/tien-do.md') if l.startswith('| G4-')]
docs = [(p, l) for p in glob.glob(f'{R}/g*/so*.md') for l in open(p)]

# video: `duyet/g4-<tên>.mp4` một mục; `g4-<tên>--<nhãn>.mp4` cùng tên gộp một mục, mỗi file một khung có nhãn.
# Tờ ảnh `duyet/g4-<tên>*.jpg` cùng tên gắn vào mục video (ảnh tĩnh), không thành mục riêng
vids, taken = {}, set()
for p in sorted(glob.glob(f'{R}/duyet/g4-*.mp4')):
    stem = os.path.basename(p)[:-4]
    name, _, label = stem.partition('--')
    vids.setdefault(name, []).append({'label': label.replace('-', ' '), 'src': os.path.relpath(p, R)})
for name, vs in vids.items():
    imgs = sorted(q for q in glob.glob(f'{R}/duyet/{name}*.jpg') if os.path.basename(q)[len(name):len(name) + 1] in ('', '-', '.'))
    taken.update(imgs)
    title = name[3:]
    note = next((l for l in prog if f'duyet/{name}' in l and '.mp4' in l), '')
    note = ' | '.join(c.strip() for c in note.strip().strip('|').split('|')[:2])
    hint = [l.strip().lstrip('- ') for _, l in docs if f'{name}.mp4' in l or f'{name}--' in l]
    items.append({'id': name, 'kind': 'video', 'title': title, 'group': title.split('-')[0], 'fps': 30, 'videos': vs,
        'images': [os.path.relpath(q, R) for q in imgs], 'note': note, 'hint': hint})

for p in sorted(glob.glob(f'{R}/duyet/g4-*.jpg')):
    if p in taken: continue
    base = os.path.basename(p)
    name = base[3:-4]
    pre = 'duyet/g4-' + name.split('-')[0] + '-*'
    note = next((l for l in prog if f'duyet/{base}' in l), None) or next((l for l in prog if pre in l), '')
    note = ' | '.join(c.strip() for c in note.strip().strip('|').split('|')[:2])
    hint = [l.strip().lstrip('- ') for _, l in docs if base in l]
    items.append({'id': f'g4-{name}', 'kind': 'sheet', 'title': name, 'group': name.split('-')[0], 'src': os.path.relpath(p, R), 'note': note, 'hint': hint})

for md in sorted(glob.glob(f'{R}/mau/*.md')):
    name = os.path.basename(md)[:-3]
    pngs = sorted(glob.glob(f'{R}/mau/{name}.jpg')) or sorted(glob.glob(f'{R}/mau/{name}-*.jpg'))
    for p in pngs:
        sub = os.path.basename(p)[:-4]
        items.append({'id': f'mau-{sub}', 'kind': 'sheet', 'title': f'mẫu · {sub}', 'group': 'ảnh mẫu', 'src': os.path.relpath(p, R),
            'note': open(md).read().strip(), 'hint': []})

json.dump(items, open(f'{R}/duyet-web/data.json', 'w'), ensure_ascii=False)
print(len(items), 'mục;', sum(len(x.get('frames', [])) for x in items), 'khung')
for x in items:
    if x['kind'] == 'shot':
        print(x['n'], x['scene'], x['cast'], x['side'], 'khung', len(x['frames']), 'chọn', sum(f['picked'] for f in x['frames']))
