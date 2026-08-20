import json
import logging

from openai import OpenAI

from ai.models import AISettings
from chats.models import ChatMessage, ChatSession
from clients.models import Client, ClientStatus
from integrations.services import get_integration_value

logger = logging.getLogger(__name__)

BASE_SYSTEM_PROMPT = """
You are AvikonCRM AI sales assistant.
Your architecture is strictly: system prompt + function calls.
Do not use hidden heuristics, helper logic, hardcoded triggers, or invented facts.
You must rely on the conversation and the available function calls.

You can do only these things through functions:
1. get_current_customer_client
   Use when you need to check whether the current chat already has a CRM client.
2. create_client
   Use when you have enough data to create a new client.
   Minimum required fields: full_name and phone.
   interested_product and notes are optional.
3. update_current_customer_client
   Use when the current customer already exists and you need to fix or update their name, phone, interested_product, or notes.

Rules:
- Never invent CRM data.
- If the customer corrects their name or phone, prefer update_current_customer_client.
- Ask only for missing required data needed to create the client.
- Do not call create_client twice for the same customer if they are already linked.
- If the customer already exists, inspect with get_current_customer_client before updating.
- Keep the conversation natural and concise.
"""


def get_active_ai_settings() -> AISettings | None:
    return AISettings.objects.filter(is_active=True).order_by("-updated_at").first()


def get_function_definitions():
    return [
        {
            "type": "function",
            "function": {
                "name": "get_current_customer_client",
                "description": "Get the CRM client linked to the current chat session, if any.",
                "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_client",
                "description": "Create a new CRM client when at least full_name and phone are known.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "full_name": {"type": "string"},
                        "phone": {"type": "string"},
                        "interested_product": {"type": "string"},
                        "notes": {"type": "string"},
                        "status_slug": {"type": "string"},
                    },
                    "required": ["full_name", "phone"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "update_current_customer_client",
                "description": "Update the current linked CRM client when the customer corrects or adds data.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "full_name": {"type": "string"},
                        "phone": {"type": "string"},
                        "interested_product": {"type": "string"},
                        "notes": {"type": "string"},
                        "status_slug": {"type": "string"},
                    },
                    "additionalProperties": False,
                },
            },
        },
    ]


def _serialize_client(client: Client | None):
    if not client:
        return None
    return {
        "id": str(client.id),
        "full_name": client.full_name,
        "phone": client.phone,
        "interested_product": client.interested_product,
        "notes": client.notes,
        "status": client.status.slug if client.status else "",
        "status_name": client.status.name if client.status else "",
    }


def _resolve_status(status_slug: str | None):
    if status_slug:
        status = ClientStatus.objects.filter(slug=status_slug).first()
        if status:
            return status
    return ClientStatus.objects.filter(is_default=True).order_by("sort_order", "name").first()


def _tool_call_result(session: ChatSession, name: str, arguments: dict):
    if name == "get_current_customer_client":
        return {"client": _serialize_client(session.client)}

    if name == "create_client":
        client = Client.objects.create(
            full_name=arguments["full_name"],
            phone=arguments["phone"],
            interested_product=arguments.get("interested_product", ""),
            notes=arguments.get("notes", ""),
            status=_resolve_status(arguments.get("status_slug")),
        )
        session.client = client
        session.save(update_fields=["client", "updated_at"])
        return {"client": _serialize_client(client)}

    if name == "update_current_customer_client":
        client = session.client
        if not client:
            return {"updated": False, "reason": "no_client_linked"}
        for field in ("full_name", "phone", "interested_product", "notes"):
            if field in arguments and arguments.get(field) not in (None, ""):
                setattr(client, field, arguments[field])
        if "status_slug" in arguments:
            client.status = _resolve_status(arguments.get("status_slug"))
        client.save()
        return {"updated": True, "client": _serialize_client(client)}

    return {"error": "unknown_function"}


def _build_messages(session: ChatSession, incoming_messages: list[ChatMessage]):
    history = list(session.messages.order_by("-created_at")[:12])
    history.reverse()
    messages = [{"role": "system", "content": BASE_SYSTEM_PROMPT}]
    ai_settings = get_active_ai_settings()
    if ai_settings and ai_settings.system_prompt:
        messages.append({"role": "system", "content": ai_settings.system_prompt})
    for msg in history:
        role = "assistant" if msg.sender_type in {ChatMessage.SenderType.AI, ChatMessage.SenderType.OPERATOR} else "user"
        messages.append({"role": role, "content": msg.content})
    if incoming_messages:
        combined = "\n".join(message.content for message in incoming_messages)
        messages.append({"role": "user", "content": combined})
    return messages, ai_settings


def generate_ai_reply_for_session(session: ChatSession, incoming_messages: list[ChatMessage]) -> str:
    api_key = get_integration_value("openai", "api_key", "")
    if not api_key:
        return ""

    messages, ai_settings = _build_messages(session, incoming_messages)
    client = OpenAI(api_key=api_key)
    model = ai_settings.model if ai_settings else "gpt-4o-mini"
    temperature = ai_settings.temperature if ai_settings else 0.2
    tools = get_function_definitions()
    tool_outputs = []

    for _ in range(4):
        response = client.responses.create(
            model=model,
            temperature=temperature,
            input=messages,
            tools=tools,
        )
        reply_text_parts = []
        tool_calls = []
        for item in response.output:
            if item.type == "message":
                for content_item in item.content:
                    if getattr(content_item, "type", "") == "output_text":
                        reply_text_parts.append(content_item.text)
            elif item.type == "function_call":
                tool_calls.append(item)

        if tool_calls:
            for tool_call in tool_calls:
                arguments = json.loads(tool_call.arguments or "{}")
                result = _tool_call_result(session, tool_call.name, arguments)
                messages.append(
                    {
                        "role": "assistant",
                        "content": [
                            {
                                "type": "function_call",
                                "call_id": tool_call.call_id,
                                "name": tool_call.name,
                                "arguments": json.dumps(arguments),
                            }
                        ],
                    }
                )
                messages.append(
                    {
                        "role": "tool",
                        "content": [
                            {
                                "type": "function_call_output",
                                "call_id": tool_call.call_id,
                                "output": json.dumps(result),
                            }
                        ],
                    }
                )
                tool_outputs.append(result)
            continue

        final_text = "\n".join(part.strip() for part in reply_text_parts if part.strip()).strip()
        return final_text

    logger.warning("AI response loop exhausted without final text", extra={"session_id": str(session.id), "tool_outputs": tool_outputs})
    return ""
