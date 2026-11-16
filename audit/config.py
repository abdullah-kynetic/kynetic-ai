"""Business-type and provider policy configuration.

Keeping these values in data makes wording and KPI changes reviewable without changing scoring.
"""

BUSINESS_TYPES = {
    "home_services_contractors": {"label": "Home services / contractors", "kpis": ["lead response time", "close rate", "cash collected"]},
    "professional_services": {"label": "Professional services", "kpis": ["qualified leads", "proposal win rate", "days to cash"]},
    "restaurants_hospitality": {"label": "Restaurants / hospitality", "kpis": ["covers", "repeat rate", "labor hours"]},
    "auto": {"label": "Auto", "kpis": ["booked jobs", "show rate", "average ticket"]},
    "beauty_wellness": {"label": "Beauty / wellness (non-HIPAA)", "kpis": ["booked appointments", "show rate", "repeat rate"]},
    "real_estate": {"label": "Real estate", "kpis": ["inquiries", "appointments", "conversion rate"]},
    "retail_ecommerce": {"label": "Retail / e-commerce", "kpis": ["conversion rate", "average order value", "repeat rate"]},
    "b2b_local_services": {"label": "B2B / local services", "kpis": ["sales cycle", "win rate", "days to cash"]},
}

START_FREE_MODELS = (
    "particle-ai/particle-1:free",
    "google/gemma-4-26b-a4b-it:free",
)


def require_free_model(model_id: str) -> str:
    """Reject paid OpenRouter models before a provider request can be made."""
    normalized = model_id.strip().lower()
    if not normalized or not normalized.endswith(":free"):
        raise ValueError("only OpenRouter :free models are permitted")
    return model_id.strip()


def free_models_from_catalog(payload: list[dict]) -> list[str]:
    models = []
    for item in payload:
        pricing = item.get("pricing") or {}
        if pricing.get("prompt") in (0, "0", "0.0") and pricing.get("completion") in (0, "0", "0.0"):
            model_id = item.get("id")
            if isinstance(model_id, str) and model_id.endswith(":free"):
                models.append(model_id)
    return list(dict.fromkeys((*START_FREE_MODELS, *sorted(models))))

