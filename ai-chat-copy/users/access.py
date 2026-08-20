PERMISSION_CATALOG = [
    {"key": "dashboard.view", "label": "View Dashboard", "module": "dashboard", "description": "View dashboard statistics"},
    {"key": "audit_logs.view", "label": "View Audit Logs", "module": "audit_logs", "description": "View system audit logs"},
    {"key": "users.view", "label": "View Users", "module": "users", "description": "View users and roles"},
    {"key": "users.manage", "label": "Manage Users", "module": "users", "description": "Create and update users"},
    {"key": "clients.view", "label": "View Clients", "module": "clients", "description": "View client data"},
    {"key": "clients.manage", "label": "Manage Clients", "module": "clients", "description": "Create and update clients"},
    {"key": "chats.view", "label": "View Chats", "module": "chats", "description": "View chat sessions and messages"},
    {"key": "chats.manage", "label": "Manage Chats", "module": "chats", "description": "Reply and manage chat sessions"},
    {"key": "integrations.view", "label": "View Integrations", "module": "integrations", "description": "View integration settings"},
    {"key": "integrations.manage", "label": "Manage Integrations", "module": "integrations", "description": "Update integration settings"},
    {"key": "ai.view", "label": "View AI Settings", "module": "ai", "description": "View AI settings"},
    {"key": "ai.manage", "label": "Manage AI Settings", "module": "ai", "description": "Create and update AI settings"},
]

DEVELOPER_ONLY_PERMISSION_KEYS = {"integrations.manage", "ai.manage"}

ROLE_DEFAULT_PERMISSIONS = {
    "developer": [item["key"] for item in PERMISSION_CATALOG],
    "admin": [item["key"] for item in PERMISSION_CATALOG if item["key"] not in DEVELOPER_ONLY_PERMISSION_KEYS],
    "operator": [
        "dashboard.view",
        "clients.view",
        "chats.view",
        "chats.manage",
    ],
}

ROLE_CATALOG = [
    {"key": "developer", "label": "Developer", "default_permissions": ROLE_DEFAULT_PERMISSIONS["developer"]},
    {"key": "admin", "label": "Admin", "default_permissions": ROLE_DEFAULT_PERMISSIONS["admin"]},
    {"key": "operator", "label": "Operator", "default_permissions": ROLE_DEFAULT_PERMISSIONS["operator"]},
]


def get_visible_permissions_for_role(role: str):
    if role == "developer":
        return PERMISSION_CATALOG
    return [item for item in PERMISSION_CATALOG if item["key"] not in DEVELOPER_ONLY_PERMISSION_KEYS]


def get_visible_roles_for_role(role: str):
    if role == "developer":
        return ROLE_CATALOG
    return [item for item in ROLE_CATALOG if item["key"] != "developer"]
