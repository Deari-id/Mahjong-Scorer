"""Builds index.html by inlining src/engine.js into src/page.html. Run: python3 build.py"""
page = open('src/page.html', encoding='utf-8').read()
engine = open('src/engine.js', encoding='utf-8').read().replace("if (typeof module !== 'undefined') module.exports = MJ;", '')
open('index.html', 'w', encoding='utf-8').write(page.replace('/*ENGINE*/', engine))
