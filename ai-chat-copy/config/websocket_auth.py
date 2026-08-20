from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware


@database_sync_to_async
def get_user_for_token(token: str):
    try:
        from rest_framework_simplejwt.authentication import JWTAuthentication

        authenticator = JWTAuthentication()
        validated_token = authenticator.get_validated_token(token)
        return authenticator.get_user(validated_token)
    except Exception:
        return None


class QueryStringJWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        params = parse_qs(query_string)
        token = params.get("token", [None])[0]
        if token:
            user = await get_user_for_token(token)
            if user is not None:
                scope["user"] = user
        return await super().__call__(scope, receive, send)
