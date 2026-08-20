from celery import shared_task

from ai.services import generate_ai_reply_for_session
from chats.models import ChatSession
from chats.services import create_ai_message, get_pending_customer_messages, mark_customer_messages_processed, quiet_window_passed


@shared_task
def process_session_ai_task(session_id: str):
    session = ChatSession.objects.filter(id=session_id).first()
    if not session or not session.ai_enabled:
        return {"processed": False}
    pending_messages = list(get_pending_customer_messages(session))
    if not pending_messages:
        return {"processed": False}
    if not quiet_window_passed(session):
        latest = pending_messages[-1]
        process_session_ai_task.apply_async(args=[session_id], countdown=5)
        return {"processed": False, "rescheduled_from": str(latest.id)}
    reply = generate_ai_reply_for_session(session=session, incoming_messages=pending_messages)
    if reply:
        create_ai_message(session, reply)
    mark_customer_messages_processed(session, pending_messages[-1])
    return {"processed": True, "message_count": len(pending_messages), "has_reply": bool(reply)}
