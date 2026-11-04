"""Unauthenticated dev portal probe. Never follows redirects or requests production."""
import json
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def admin_is_blocked(status, location, admin_url):
    if status in (401, 403):
        return True
    if status not in (302, 303, 307) or not location:
        return False
    destination = urllib.parse.urlsplit(urllib.parse.urljoin(admin_url, location))
    origin = urllib.parse.urlsplit(admin_url)
    return (destination.scheme, destination.netloc, destination.path) == (origin.scheme, origin.netloc, '/sign-in')


def probe(url, emit=print, opener=None):
    parsed = urllib.parse.urlsplit(url)
    req = urllib.request.Request(url, method='GET', headers={
        'User-Agent': 'kynetic-checks', 'Accept': '*/*', 'Accept-Encoding': 'identity',
        'Connection': 'close', 'Host': parsed.netloc,
    })
    emit('REQUEST 1.7 ' + json.dumps({'url': url, 'method': req.get_method(),
         'headers': dict(req.header_items()), 'follow_redirects': False}, sort_keys=True))
    try:
        with (opener or urllib.request.build_opener(NoRedirect())).open(req, timeout=15) as response:
            status, location = response.status, response.headers.get('Location', '')
    except urllib.error.HTTPError as error:
        status, location = error.code, error.headers.get('Location', '')
        error.close()
    except (urllib.error.URLError, OSError) as error:
        emit('RESPONSE 1.7 ' + json.dumps({'url': url, 'raw_status': None,
             'error': type(error).__name__, 'note': 'No origin HTTP status received'}))
        return 0, ''
    emit('RESPONSE 1.7 ' + json.dumps({'url': url, 'raw_status': status, 'location': location}))
    return status, location


def check_dev_portal(base, emit=print, opener=None):
    parsed = urllib.parse.urlsplit(base)
    if (parsed.scheme != 'https' or parsed.hostname != 'dev.kyneticai.com'
            or parsed.port not in (None, 443) or parsed.username or parsed.password
            or parsed.path not in ('', '/') or parsed.query or parsed.fragment):
        raise ValueError('1.7 requires https://dev.kyneticai.com; production is never probed')
    admin_url = base.rstrip('/') + '/admin'
    admin, location = probe(admin_url, emit, opener)
    root, _ = probe(base.rstrip('/') + '/', emit, opener)
    return root in (200, 302, 303, 307, 308) and admin_is_blocked(admin, location, admin_url), root, admin
