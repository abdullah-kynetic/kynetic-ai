import unittest
from unittest.mock import Mock
from urllib.error import HTTPError, URLError
from portal_check import admin_is_blocked, check_dev_portal, probe

URL = 'https://dev.kyneticai.com/admin'


class PortalCheckTests(unittest.TestCase):
    def test_exact_denial_statuses_and_sign_in_redirect(self):
        for status in (401, 403):
            self.assertTrue(admin_is_blocked(status, '', URL))
        for status in (302, 303, 307):
            for target in ('/sign-in', '/sign-in?next=/admin', 'https://dev.kyneticai.com/sign-in'):
                self.assertTrue(admin_is_blocked(status, target, URL))
        for status in (0, 200, 301, 308, 404, 500, 502):
            self.assertFalse(admin_is_blocked(status, '/sign-in', URL))
        for target in ('', '/dashboard', 'https://portal.kyneticai.com/sign-in', '//other.invalid/sign-in'):
            self.assertFalse(admin_is_blocked(302, target, URL))

    def test_redirect_raw_status_and_exact_unauthenticated_request(self):
        opener = Mock()
        opener.open.side_effect = HTTPError(URL, 307, 'redirect', {'Location': '/sign-in'}, None)
        self.assertEqual(probe(URL, lambda line: None, opener), (307, '/sign-in'))
        req = opener.open.call_args.args[0]
        self.assertEqual(req.get_method(), 'GET')
        self.assertEqual(req.full_url, URL)
        self.assertIsNone(req.get_header('Cookie'))
        self.assertIsNone(req.get_header('Authorization'))
        opener.open.assert_called_once()

    def test_transport_error_is_never_an_auth_denial(self):
        opener = Mock()
        opener.open.side_effect = URLError('proxy unavailable')
        self.assertEqual(probe(URL, lambda line: None, opener), (0, ''))

    def test_production_is_refused_before_any_network_call(self):
        opener = Mock()
        with self.assertRaises(ValueError):
            check_dev_portal('https://portal.kyneticai.com', opener=opener)
        opener.open.assert_not_called()


if __name__ == '__main__':
    unittest.main()
