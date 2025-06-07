import unittest
import json
from app import app

class APITestCase(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_list_prophet_models(self):
        resp = self.app.get('/api/models/prophet')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertIn('success', data)
        self.assertTrue(data['success'])
        self.assertIn('models', data)

    def test_feature_store(self):
        resp = self.app.get('/api/features?area_type=national&area_name=ITA')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertIn('success', data)
        self.assertTrue(data['success'])
        self.assertIn('features', data)

    def test_predict_prophet(self):
        resp = self.app.get('/api/predict/prophet?indicator=nuovi_positivi&area_type=national&area_name=ITA&days=5')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertIn('success', data)
        self.assertTrue(data['success'])
        self.assertIn('prediction', data)
        self.assertEqual(len(data['prediction']), 5)

if __name__ == '__main__':
    unittest.main() 