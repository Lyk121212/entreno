#!/usr/bin/env python3
"""Pone la marca de versión en todos los archivos de la app. Uso: python3 scripts/version.py 1.2.0

El service worker solo acepta una actualización si todos los archivos llevan la misma marca,
así que hay que ejecutar esto antes de cada publicación."""
import re, sys, pathlib

v = sys.argv[1]
assert re.fullmatch(r'\d+\.\d+\.\d+', v), 'versión con formato X.Y.Z'
raiz = pathlib.Path(__file__).resolve().parent.parent
MARCA = re.compile(r'entreno v\d+\.\d+\.\d+')

def marcar(p, cabecera):
    t = p.read_text(encoding='utf-8')
    if MARCA.search(t.split('\n', 1)[0]):
        t = MARCA.sub('entreno v' + v, t, count=1)
    else:
        t = cabecera + '\n' + t
    p.write_text(t, encoding='utf-8')

for p in sorted((raiz / 'js').glob('*.js')):
    marcar(p, '// entreno v' + v)
marcar(raiz / 'css' / 'app.css', '/* entreno v' + v + ' */')
marcar(raiz / 'sw.js', '// entreno v' + v)

idx = raiz / 'index.html'
t = idx.read_text(encoding='utf-8')
t = re.sub(r"window\.APP_VERSION = '[^']*'", f"window.APP_VERSION = '{v}'", t)
if MARCA.search(t):
    t = MARCA.sub('entreno v' + v, t)
else:
    t = t.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- entreno v' + v + ' -->', 1)
idx.write_text(t, encoding='utf-8')

sw = raiz / 'sw.js'
t = sw.read_text(encoding='utf-8')
t = re.sub(r"const VERSION = '[^']*';", f"const VERSION = '{v}';", t)
sw.write_text(t, encoding='utf-8')
print('versión', v, 'aplicada')
