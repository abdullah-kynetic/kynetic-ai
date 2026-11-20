# Vendor attribution and license boundary

The public audit implementation uses only small, independently tested interfaces. No AGPL code is copied into this repository. PhantomReach is intentionally not vendored because the repository's locked instructions prohibit AGPL dependencies; the operator-only adapter is a guarded extension point and cannot run on the public path. The three MIT license notices in this directory preserve attribution for the compatible source references.

The SEO, geo-AEO prompt, and geogrid work is represented by original compatible code in `audit/checks/` and `audit/geogrid.py`; no upstream application, dashboard, SQLite store, or paid data provider is included.

