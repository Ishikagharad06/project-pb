from django.contrib import admin
from django.urls import path, include
from api.views import root_api, chat_assistant

urlpatterns = [
    path('', root_api, name='root_api'),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    # ChatWidget.tsx calls '/chat' directly (not '/api/chat'), so expose it at root too.
    path('chat', chat_assistant, name='chat_assistant_root'),
]
