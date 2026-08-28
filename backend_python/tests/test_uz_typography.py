"""Uzbek user-facing text uses the real apostrophe glyphs, not ASCII.

The frontend prefers the server's sentence over any client key
(``useAuthErrors.ts``), so these strings are printed straight into the auth
form and the toasts, next to ``src/i18n/locales/uz/`` copy that uses ``o‘``,
``g‘`` and ``’``. An ASCII ``'`` in one of them puts two different apostrophe
glyphs in the same paragraph on the busiest form in the product.

Scoped to the ``uz`` entries on purpose: an apostrophe is ordinary English
punctuation, so the ``en`` (and occasionally ``ru``) values legitimately
contain one.
"""

from __future__ import annotations

import pytest

from app.core.errors import MESSAGES
from app.services.sms import TEMPLATES

UZ_TEXT = [
    (f"MESSAGES[{code!r}]", group["uz"])
    for code, group in MESSAGES.items()
    if isinstance(group, dict) and "uz" in group
] + [
    (f"sms TEMPLATES[{name!r}]", group["uz"])
    for name, group in TEMPLATES.items()
    if "uz" in group
]


@pytest.mark.parametrize("label,text", UZ_TEXT)
def test_uz_text_uses_typographic_apostrophes(label: str, text: str) -> None:
    assert "'" not in text, (
        f"{label} contains an ASCII apostrophe: {text!r}. "
        "Use ‘ for o‘/g‘, ’ for the tutuq belgisi and « » for quotation."
    )
