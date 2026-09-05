from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health_check'),

    path('auth/google/', views.google_auth, name='google_auth'),
    path('auth/signup/', views.auth_signup, name='auth_signup'),
    path('auth/login/', views.auth_login, name='auth_login'),
    path('auth/logout/', views.auth_logout, name='auth_logout'),

    path('locations/', views.locations_list, name='locations_list'),
    path('slots/', views.slots_list, name='slots_list'),

    path('bookings/my/', views.bookings_my, name='bookings_my'),
    path('bookings/', views.bookings_create, name='bookings_create'),
    path('bookings/extend/', views.bookings_extend, name='bookings_extend'),
    path('bookings/cancel/', views.bookings_cancel, name='bookings_cancel'),

    path('chat/', views.chat_assistant, name='chat_assistant'),
]