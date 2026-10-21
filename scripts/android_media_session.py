"""Parse Aiplayed's own Android media session across numeric/named dump formats."""
import re

def session_text(raw, package='app.localmusic.player'):
    match = re.search(r'(?m)^([ \t]*)package='+re.escape(package)+r'[ \t]*$', raw)
    if not match: return ''
    tail = raw[match.end():]
    # Another session heading is less indented than this session's properties.
    boundary = re.search(r'(?m)^[ \t]{0,'+str(max(0,len(match[1])-1))+r'}\S', tail)
    return tail[:boundary.start()] if boundary else tail

def is_playing(raw):
    session = session_text(raw)
    return bool(re.search(r'(?m)^[ \t]*active=true[ \t]*$', session) and
                re.search(r'\bstate=PlaybackState\s*\{\s*state=(?:PLAYING\(3\)|3)(?=[,\s}])', session))
