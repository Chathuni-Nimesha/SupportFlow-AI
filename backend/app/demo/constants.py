"""Stable identifiers for the local portfolio demo seed."""

# Marker stored on seeded knowledge documents (and used in lookups).
DEMO_SEED_TAG = "demo-seed"

# Deterministic demo emails (local only — not production accounts).
DEFAULT_OWNER_EMAIL = "owner@supportflow.demo"
DEFAULT_OWNER_PASSWORD = "SupportFlowDemo1!"
DEFAULT_OWNER_FIRST_NAME = "Ava"
DEFAULT_OWNER_LAST_NAME = "Morales"
DEFAULT_OWNER_COMPANY = "Nova Commerce Support"

# Directory-only team members (no login accounts).
ADMIN_EMAIL = "sarah.mitchell@supportflow.demo"
AGENT_ONE_EMAIL = "daniel.perera@supportflow.demo"
AGENT_TWO_EMAIL = "emma.wilson@supportflow.demo"

# Conversation / ticket natural keys for idempotent upserts.
DEMO_SEED_KEY_FIELD = "demo_seed_key"
