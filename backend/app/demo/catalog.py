"""Realistic static content for the local portfolio demo seed."""

from __future__ import annotations

from typing import Any, TypedDict

from app.demo.constants import (
    ADMIN_EMAIL,
    AGENT_ONE_EMAIL,
    AGENT_TWO_EMAIL,
    DEMO_SEED_TAG,
)


class TeamSpec(TypedDict):
    key: str
    first_name: str
    last_name: str
    email: str
    role: str


class CustomerSpec(TypedDict):
    key: str
    first_name: str
    last_name: str
    email: str
    phone: str | None
    company: str | None
    notes: str | None


class MessageSpec(TypedDict):
    sender_type: str
    content: str
    sender_name: str | None


class ConversationSpec(TypedDict):
    key: str
    customer_key: str
    subject: str
    channel: str
    status: str
    assigned_agent_key: str | None
    unread_count: int
    messages: list[MessageSpec]


class TicketSpec(TypedDict):
    key: str
    customer_key: str
    conversation_key: str | None
    title: str
    description: str
    status: str
    priority: str
    assignee_key: str | None
    resolution_note: str | None


class KnowledgeSpec(TypedDict):
    key: str
    title: str
    content: str
    tags: list[str]


# 1 ADMIN + 2 AGENTS (OWNER is the existing logged-in workspace owner).
TEAM_MEMBERS: list[TeamSpec] = [
    {
        "key": "admin",
        "first_name": "Sarah",
        "last_name": "Mitchell",
        "email": ADMIN_EMAIL,
        "role": "ADMIN",
    },
    {
        "key": "agent_daniel",
        "first_name": "Daniel",
        "last_name": "Perera",
        "email": AGENT_ONE_EMAIL,
        "role": "AGENT",
    },
    {
        "key": "agent_emma",
        "first_name": "Emma",
        "last_name": "Wilson",
        "email": AGENT_TWO_EMAIL,
        "role": "AGENT",
    },
]

CUSTOMERS: list[CustomerSpec] = [
    {
        "key": "olivia",
        "first_name": "Olivia",
        "last_name": "Carter",
        "email": "olivia.carter@brightline.io",
        "phone": "+1-415-555-0142",
        "company": "Brightline Labs",
        "notes": "Annual Pro plan. Prefers email.",
    },
    {
        "key": "ethan",
        "first_name": "Ethan",
        "last_name": "Williams",
        "email": "ethan.williams@harborgoods.com",
        "phone": "+1-206-555-0198",
        "company": "Harbor Goods",
        "notes": "Frequent billing questions near renewal.",
    },
    {
        "key": "sophia",
        "first_name": "Sophia",
        "last_name": "Brown",
        "email": "sophia.brown@northwind.studio",
        "phone": "+1-312-555-0177",
        "company": "Northwind Studio",
        "notes": "Design agency on monthly Pro.",
    },
    {
        "key": "noah",
        "first_name": "Noah",
        "last_name": "Wilson",
        "email": "noah.wilson@cascade.health",
        "phone": "+1-503-555-0111",
        "company": "Cascade Health",
        "notes": "Compliance-sensitive account.",
    },
    {
        "key": "amelia",
        "first_name": "Amelia",
        "last_name": "Davis",
        "email": "amelia.davis@leaflynx.app",
        "phone": None,
        "company": "LeafLynx",
        "notes": "Startup founder. High urgency on login issues.",
    },
    {
        "key": "liam",
        "first_name": "Liam",
        "last_name": "Taylor",
        "email": "liam.taylor@rivermill.co",
        "phone": "+1-617-555-0133",
        "company": "Rivermill Co",
        "notes": "Often asks about cancellations and refunds.",
    },
    {
        "key": "grace",
        "first_name": "Grace",
        "last_name": "Anderson",
        "email": "grace.anderson@pixelnest.co",
        "phone": "+1-646-555-0190",
        "company": "PixelNest",
        "notes": "Prefers Slack when available.",
    },
    {
        "key": "james",
        "first_name": "James",
        "last_name": "Martin",
        "email": "james.martin@summitops.com",
        "phone": "+1-720-555-0164",
        "company": "SummitOps",
        "notes": "Ops lead. Tracks SLA closely.",
    },
]


def _msg(
    sender_type: str,
    content: str,
    sender_name: str | None = None,
) -> MessageSpec:
    return {
        "sender_type": sender_type,
        "content": content,
        "sender_name": sender_name,
    }


# Conversation statuses must match backend: Open, Waiting, Closed, AI Resolved.
CONVERSATIONS: list[ConversationSpec] = [
    {
        "key": "conv_refund",
        "customer_key": "olivia",
        "subject": "Refund request for recent order",
        "channel": "Email",
        "status": "Open",
        "assigned_agent_key": "agent_daniel",
        "unread_count": 1,
        "messages": [
            _msg(
                "customer",
                "Hi — I placed order #A-10482 last week and need a refund for "
                "two unused seats. Can you help?",
                "Olivia Carter",
            ),
            _msg(
                "agent",
                "Hi Olivia, I can help with that. Confirming you want a prorated "
                "credit for the two seats reduced on March 12?",
                "Daniel Perera",
            ),
            _msg(
                "customer",
                "Yes, please apply it as account credit if a cash refund isn't available.",
                "Olivia Carter",
            ),
        ],
    },
    {
        "key": "conv_password",
        "customer_key": "amelia",
        "subject": "Password reset assistance",
        "channel": "Chat",
        "status": "Open",
        "assigned_agent_key": "agent_emma",
        "unread_count": 2,
        "messages": [
            _msg(
                "customer",
                "I requested a password reset three times and never received the email. "
                "Account is amelia.davis@leaflynx.app.",
                "Amelia Davis",
            ),
            _msg(
                "agent",
                "Sorry about that. I cleared a delivery hold and triggered a fresh reset. "
                "Please check inbox and spam in about two minutes.",
                "Emma Wilson",
            ),
        ],
    },
    {
        "key": "conv_payment",
        "customer_key": "ethan",
        "subject": "Payment failed during checkout",
        "channel": "Chat",
        "status": "Waiting",
        "assigned_agent_key": "agent_emma",
        "unread_count": 0,
        "messages": [
            _msg(
                "customer",
                "Checkout failed with a card declined message after we updated our card.",
                "Ethan Williams",
            ),
            _msg(
                "agent",
                "I see the failed charge. Please retry from Billing → Payment methods, "
                "then reply here if it still fails.",
                "Emma Wilson",
            ),
            _msg(
                "ai",
                "Tip: some banks block the first SaaS charge. Ask your bank to allow "
                "the merchant if the retry fails.",
                "SupportFlow AI",
            ),
        ],
    },
    {
        "key": "conv_upgrade",
        "customer_key": "sophia",
        "subject": "Subscription upgrade question",
        "channel": "Email",
        "status": "AI Resolved",
        "assigned_agent_key": None,
        "unread_count": 0,
        "messages": [
            _msg(
                "customer",
                "We're evaluating an upgrade. Does Enterprise include SSO and "
                "priority support?",
                "Sophia Brown",
            ),
            _msg(
                "ai",
                "Yes — SSO and priority support are included on Enterprise. Pro includes "
                "standard chat and email support. See Subscription Plans and Billing FAQ.",
                "SupportFlow AI",
            ),
            _msg(
                "customer",
                "Perfect, that answers it. We'll discuss with finance.",
                "Sophia Brown",
            ),
        ],
    },
    {
        "key": "conv_shipping",
        "customer_key": "grace",
        "subject": "Shipping delay on hardware kit",
        "channel": "Slack",
        "status": "Waiting",
        "assigned_agent_key": "agent_daniel",
        "unread_count": 0,
        "messages": [
            _msg(
                "customer",
                "Our onboarding hardware kit was supposed to arrive Friday and tracking "
                "still shows in transit.",
                "Grace Anderson",
            ),
            _msg(
                "agent",
                "Thanks Grace — I've opened a carrier ticket and will update you when "
                "we have a revised ETA.",
                "Daniel Perera",
            ),
        ],
    },
    {
        "key": "conv_duplicate",
        "customer_key": "liam",
        "subject": "Duplicate payment concern",
        "channel": "Email",
        "status": "Open",
        "assigned_agent_key": "admin",
        "unread_count": 1,
        "messages": [
            _msg(
                "customer",
                "I was charged twice for March. Please check invoices INV-2041 and INV-2042.",
                "Liam Taylor",
            ),
        ],
    },
    {
        "key": "conv_email_change",
        "customer_key": "noah",
        "subject": "Account email change",
        "channel": "Email",
        "status": "Waiting",
        "assigned_agent_key": "agent_emma",
        "unread_count": 0,
        "messages": [
            _msg(
                "customer",
                "Please change our billing contact email from the old address to "
                "billing@cascade.health.",
                "Noah Wilson",
            ),
            _msg(
                "agent",
                "I can update that after a quick identity check. Reply confirming the "
                "workspace name and last four digits of the card on file.",
                "Emma Wilson",
            ),
        ],
    },
    {
        "key": "conv_cancel",
        "customer_key": "liam",
        "subject": "Cancellation request",
        "channel": "Email",
        "status": "Closed",
        "assigned_agent_key": "admin",
        "unread_count": 0,
        "messages": [
            _msg(
                "customer",
                "Please cancel our Pro plan at the end of the current billing period. "
                "No refund needed.",
                "Liam Taylor",
            ),
            _msg(
                "agent",
                "Cancellation scheduled for the next billing date. You'll keep access "
                "until then — confirmation email sent.",
                "Sarah Mitchell",
            ),
            _msg(
                "customer",
                "Thanks — confirmed.",
                "Liam Taylor",
            ),
        ],
    },
    {
        "key": "conv_invoice",
        "customer_key": "ethan",
        "subject": "Invoice request",
        "channel": "Email",
        "status": "Closed",
        "assigned_agent_key": "agent_daniel",
        "unread_count": 0,
        "messages": [
            _msg(
                "customer",
                "Can you resend the February invoice PDF to accounting@harborgoods.com?",
                "Ethan Williams",
            ),
            _msg(
                "agent",
                "Sent! Attached the same PDF in this thread for your records.",
                "Daniel Perera",
            ),
        ],
    },
    {
        "key": "conv_setup",
        "customer_key": "james",
        "subject": "Product setup question",
        "channel": "Chat",
        "status": "AI Resolved",
        "assigned_agent_key": "agent_daniel",
        "unread_count": 0,
        "messages": [
            _msg(
                "customer",
                "Where do we invite teammates and choose Admin vs Agent roles?",
                "James Martin",
            ),
            _msg(
                "ai",
                "Go to Team → Invite member. Admins manage settings and members; "
                "Agents handle conversations and tickets. Owners retain full control.",
                "SupportFlow AI",
            ),
        ],
    },
]

TICKETS: list[TicketSpec] = [
    {
        "key": "tkt_refund",
        "customer_key": "olivia",
        "conversation_key": "conv_refund",
        "title": "Prorated refund for unused seats",
        "description": (
            "Customer requested a prorated credit/refund for two unused seats "
            "on order #A-10482."
        ),
        "status": "IN_PROGRESS",
        "priority": "HIGH",
        "assignee_key": "agent_daniel",
        "resolution_note": None,
    },
    {
        "key": "tkt_payment",
        "customer_key": "ethan",
        "conversation_key": "conv_payment",
        "title": "Failed checkout payment",
        "description": (
            "Card declined during checkout after card update. Awaiting customer retry."
        ),
        "status": "PENDING",
        "priority": "URGENT",
        "assignee_key": "agent_emma",
        "resolution_note": None,
    },
    {
        "key": "tkt_password",
        "customer_key": "amelia",
        "conversation_key": "conv_password",
        "title": "Password reset emails not delivering",
        "description": (
            "Multiple reset emails did not arrive. Delivery hold cleared; "
            "awaiting customer confirmation."
        ),
        "status": "OPEN",
        "priority": "HIGH",
        "assignee_key": "agent_emma",
        "resolution_note": None,
    },
    {
        "key": "tkt_cancel",
        "customer_key": "liam",
        "conversation_key": "conv_cancel",
        "title": "Schedule Pro plan cancellation",
        "description": (
            "Customer requested end-of-period cancellation with no refund."
        ),
        "status": "RESOLVED",
        "priority": "MEDIUM",
        "assignee_key": "admin",
        "resolution_note": (
            "Cancellation scheduled for next billing date. Confirmation emailed."
        ),
    },
    {
        "key": "tkt_duplicate",
        "customer_key": "liam",
        "conversation_key": "conv_duplicate",
        "title": "Investigate duplicate March charges",
        "description": (
            "Customer reports duplicate charges INV-2041 and INV-2042."
        ),
        "status": "OPEN",
        "priority": "URGENT",
        "assignee_key": "admin",
        "resolution_note": None,
    },
    {
        "key": "tkt_shipping",
        "customer_key": "grace",
        "conversation_key": "conv_shipping",
        "title": "Hardware kit shipping delay",
        "description": (
            "Onboarding kit delayed past promised Friday delivery. Carrier ticket opened."
        ),
        "status": "IN_PROGRESS",
        "priority": "MEDIUM",
        "assignee_key": "agent_daniel",
        "resolution_note": None,
    },
    {
        "key": "tkt_invoice",
        "customer_key": "ethan",
        "conversation_key": "conv_invoice",
        "title": "Resend February invoice PDF",
        "description": "Accounting requested a copy of the February invoice.",
        "status": "CLOSED",
        "priority": "LOW",
        "assignee_key": "agent_daniel",
        "resolution_note": "Invoice PDF resent to accounting@harborgoods.com.",
    },
]

KNOWLEDGE_DOCUMENTS: list[KnowledgeSpec] = [
    {
        "key": "kb_refund",
        "title": "Refund and Cancellation Policy",
        "content": """# Refund and Cancellation Policy

## How long do customers have to request a refund?
Customers may request a refund within **14 days** of the original purchase for annual plans when usage is under 10% of included seats. Monthly plans are eligible for prorated account credit when seats are reduced mid-cycle.

## Cancellations
- Cancel anytime from Billing → Plan.
- End-of-period cancellation keeps access until the period ends.
- Immediate cancellation ends access within 24 hours.

## Refunds and credits
- Seat reductions mid-cycle usually receive a **prorated account credit**, not a cash refund, unless required by law.
- Annual plans: cash/credit refund within 14 days if usage stays under the threshold above.
- Chargebacks pause the account until resolved.

## How to request
1. Open a support conversation with subject "Refund" or "Cancellation".
2. Include workspace name, plan, and effective date.
3. An agent confirms the schedule and emails confirmation.

Credits typically appear within 3–5 business days.
""",
        "tags": [DEMO_SEED_TAG, "billing", "refunds"],
    },
    {
        "key": "kb_payment",
        "title": "Payment Troubleshooting Guide",
        "content": """# Payment Troubleshooting Guide

## Common failure reasons
- Expired or incorrect card details
- Insufficient funds
- Bank blocking the first international / SaaS charge
- Abandoned 3-D Secure challenge

## Steps for customers
1. Open Billing → Payment methods and update the card.
2. Retry the failed invoice from Billing → Invoices.
3. If the bank declines again, ask them to allow the merchant.
4. Contact support with the invoice ID if the portal still shows past due.

## Past-due grace
Accounts remain usable for 7 days after a failed renewal. After 7 days, write access is limited until payment succeeds.
""",
        "tags": [DEMO_SEED_TAG, "billing", "payments"],
    },
    {
        "key": "kb_login",
        "title": "Account and Login Guide",
        "content": """# Account and Login Guide

## Sign in
Use the email associated with your workspace invitation. Passwords must be at least 8 characters.

## Password reset
1. Click "Forgot password" on the login page.
2. Check inbox and spam for the reset link (valid for 60 minutes).
3. If no email arrives within 5 minutes, ask support to clear delivery holds.

## Inviting teammates
Owners and Admins can invite members from Team → Invite.
- Admin: manage settings, team, and assignments
- Agent: handle conversations and tickets
- Owner: full control of the workspace
""",
        "tags": [DEMO_SEED_TAG, "account", "login"],
    },
    {
        "key": "kb_plans",
        "title": "Subscription Plans and Billing FAQ",
        "content": """# Subscription Plans and Billing FAQ

## Plans
- **Starter**: email support, up to 3 agents, core inbox
- **Pro**: chat + email, up to 15 agents, knowledge base, AI assist
- **Enterprise**: SSO, priority support, unlimited agents, custom SLA, invoice billing

## Billing cycle
Plans renew automatically on the anniversary date. Seat changes prorate on the next invoice or as account credit.

## Invoices
Download PDFs from Billing → Invoices. Request a resend by opening a conversation with your invoice month.
""",
        "tags": [DEMO_SEED_TAG, "billing", "plans"],
    },
    {
        "key": "kb_faq",
        "title": "General Customer Support FAQ",
        "content": """# General Customer Support FAQ

## What is SupportFlow AI?
SupportFlow AI helps teams manage customer conversations, tickets, and a workspace knowledge base with optional AI-assisted replies grounded in published articles.

## Channels
Conversations can arrive from Chat, Email, or Slack integrations depending on your plan.

## Knowledge base tips
Publish clear articles for refunds, login, payments, and plan differences so AI answers stay accurate. Keep drafts unpublished until reviewed.

## Contacting support
Use in-app chat for urgent issues. For billing changes, include your company name and the affected invoice or seat count.
""",
        "tags": [DEMO_SEED_TAG, "faq", "support"],
    },
]

RAG_SMOKE_QUERY = "How long do customers have to request a refund?"


def catalog_summary() -> dict[str, Any]:
    """Return expected seed sizes for docs and dry-run output."""
    return {
        "team_members_excluding_owner": len(TEAM_MEMBERS),
        "customers": len(CUSTOMERS),
        "conversations": len(CONVERSATIONS),
        "tickets": len(TICKETS),
        "knowledge_documents": len(KNOWLEDGE_DOCUMENTS),
        "messages": sum(len(item["messages"]) for item in CONVERSATIONS),
    }
