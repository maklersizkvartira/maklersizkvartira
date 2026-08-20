from django.test import TestCase

from ai.services import get_function_definitions


class AIFunctionDefinitionTests(TestCase):
    def test_ai_has_only_required_function_calls(self):
        names = [item["function"]["name"] for item in get_function_definitions()]
        self.assertEqual(
            names,
            ["get_current_customer_client", "create_client", "update_current_customer_client"],
        )
