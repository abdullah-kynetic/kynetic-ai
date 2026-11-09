import copy
import unittest
from workflow_retry import has_retry_or_error_branch

class WorkflowRetryTests(unittest.TestCase):
    def setUp(self):
        self.workflow = {'nodes': [
            {'name': 'send', 'type': 'n8n-nodes-base.httpRequest', 'retryOnFail': False},
            {'name': 'review', 'type': 'n8n-nodes-base.code'}
        ], 'connections': {}}

    def test_disabled_retry_is_not_retry_handling(self):
        self.assertFalse(has_retry_or_error_branch(self.workflow))

    def test_error_output_must_be_connected_to_existing_node(self):
        self.workflow['nodes'][0]['onError'] = 'continueErrorOutput'
        self.assertFalse(has_retry_or_error_branch(self.workflow))
        self.workflow['connections']['send'] = {'main': [[], [{'node': 'missing'}]]}
        self.assertFalse(has_retry_or_error_branch(self.workflow))
        self.workflow['connections']['send']['main'][1][0]['node'] = 'review'
        self.assertTrue(has_retry_or_error_branch(self.workflow))

    def test_bounded_explicit_retry(self):
        for tries, expected in [(None, False), (1, False), (3, True), (100, False)]:
            value = copy.deepcopy(self.workflow)
            value['nodes'][0].update(retryOnFail=True, maxTries=tries)
            self.assertEqual(has_retry_or_error_branch(value), expected)

if __name__ == '__main__':
    unittest.main()
