"""Stato HTTP di ogni indirizzo della matrice sul sito nuovo (criterio della `1E-W4`).

Le pagine allegato e i vecchi percorsi dei media rispondono 301 verso `/media/…`
invece che verso `/wp-content/uploads/…`: è il cambio voluto da ADR-004 e DR-034,
e qui conta come esito atteso.
"""
import csv, sys, urllib.request, urllib.error, urllib.parse, collections

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3200'

class NoRedir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None

op = urllib.request.build_opener(NoRedir)
esiti = collections.Counter(); diversi = []
for r in csv.DictReader(open('docs/migration/url-matrix.csv', encoding='utf-8')):
    if r['tipo'] == 'amministrazione': continue
    url = r['url']
    try:
        resp = op.open(BASE + urllib.parse.quote(url, safe='/:?=&%'), timeout=60); code = resp.status; loc = ''
    except urllib.error.HTTPError as e:
        code = e.code; loc = (e.headers.get('location') or '').replace(BASE, '')
    atteso = int(r['stato_misurato'])
    dest = r['destinazione_redirect'].replace('/wp-content/uploads/', '/media/')
    ok = code == atteso and (atteso not in (301, 302) or loc == dest)
    esiti[ok] += 1
    if not ok: diversi.append((r['tipo'], url, atteso, dest, code, loc))
print('conformi', esiti[True], 'difformi', esiti[False])
for d in diversi: print(d)
