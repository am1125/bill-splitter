import unittest
import server


class StaticServerTests(unittest.TestCase):
    def handler(self, path):
        handler = object.__new__(server.Handler)
        handler.path = path
        handler.send_json = lambda status, data: setattr(handler, 'result', (status, data))
        return handler

    def test_private_files_and_removed_api_are_not_served(self):
        for path in ['/.env', '/.git/config', '/server.py', '/%2e%2e/.env', '/api/config']:
            handler = self.handler(path)
            handler.do_GET()
            self.assertEqual(handler.result[0], 404)

    def test_receipt_uploads_are_rejected(self):
        handler = self.handler('/api/receipts/parse')
        handler.do_POST()
        self.assertEqual(handler.result[0], 405)


if __name__ == '__main__':
    unittest.main()
