from django.contrib.auth import get_user_model
from django.db.models import Count
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from chats.models import ChatMessage, ChatSession
from clients.models import Client
from common.models import AuditLog
from common.permissions import IsAdminOrDeveloper
from common.serializers import AuditLogSerializer


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "success", "data": {"service": "avikoncrm", "ok": True}})


class AuditLogListView(ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminOrDeveloper]
    search_fields = ("target_type", "target_id", "target_repr", "actor__username")
    ordering_fields = ("created_at",)

    def get_queryset(self):
        queryset = AuditLog.objects.select_related("actor").order_by("-created_at")
        if self.request.user.role != "developer":
            developer_ids = list(get_user_model().objects.filter(role="developer").values_list("id", flat=True))
            queryset = queryset.exclude(actor__role="developer")
            if developer_ids:
                queryset = queryset.exclude(target_type="User", target_id__in=[str(item) for item in developer_ids])
        actor_id = self.request.query_params.get("actor")
        action = self.request.query_params.get("action")
        target_type = self.request.query_params.get("target_type")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if actor_id:
            queryset = queryset.filter(actor_id=actor_id)
        if action:
            queryset = queryset.filter(action=action)
        if target_type:
            queryset = queryset.filter(target_type=target_type)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        return queryset


class DashboardOverviewView(APIView):
    permission_classes = [IsAdminOrDeveloper]

    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        client_status = request.query_params.get("client_status")

        clients_qs = Client.objects.select_related("status").all()
        sessions_qs = ChatSession.objects.select_related("client").all()
        messages_qs = ChatMessage.objects.all()

        if client_status:
            clients_qs = clients_qs.filter(status__slug=client_status)
            sessions_qs = sessions_qs.filter(client__status__slug=client_status)
        if date_from:
            clients_qs = clients_qs.filter(created_at__date__gte=date_from)
            sessions_qs = sessions_qs.filter(created_at__date__gte=date_from)
            messages_qs = messages_qs.filter(created_at__date__gte=date_from)
        if date_to:
            clients_qs = clients_qs.filter(created_at__date__lte=date_to)
            sessions_qs = sessions_qs.filter(created_at__date__lte=date_to)
            messages_qs = messages_qs.filter(created_at__date__lte=date_to)

        by_status = (
            clients_qs.values("status__slug", "status__name", "status__color")
            .annotate(count=Count("id"))
            .order_by("status__name")
        )
        by_interest = (
            clients_qs.values("interested_product")
            .annotate(count=Count("id"))
            .order_by("-count", "interested_product")
        )

        data = {
            "filters": {
                "date_from": date_from,
                "date_to": date_to,
                "client_status": client_status,
            },
            "clients": {
                "total_clients": clients_qs.count(),
                "by_status": [
                    {
                        "key": row["status__slug"] or "",
                        "label": row["status__name"] or "No status",
                        "color": row["status__color"] or "",
                        "count": row["count"],
                    }
                    for row in by_status
                ],
                "by_interested_product": [
                    {
                        "key": row["interested_product"] or "",
                        "label": row["interested_product"] or "No product",
                        "count": row["count"],
                    }
                    for row in by_interest
                ],
            },
            "chats": {
                "total_sessions": sessions_qs.count(),
                "sessions_needing_operator": sessions_qs.filter(operator_needed=True).count(),
                "ai_paused_sessions": sessions_qs.exclude(ai_paused_until__isnull=True).count(),
                "total_messages": messages_qs.count(),
                "incoming_messages": messages_qs.filter(direction=ChatMessage.Direction.IN).count(),
                "outgoing_messages": messages_qs.filter(direction=ChatMessage.Direction.OUT).count(),
            },
        }
        return Response({"status": "success", "data": data})
