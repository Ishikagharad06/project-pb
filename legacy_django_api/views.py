from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
import uuid
import time
import re
from .models import UserProfile, ParkingLocation, ParkingSlot, Booking
from .serializers import (
    UserProfileSerializer,
    ParkingLocationSerializer,
    ParkingSlotSerializer,
    BookingSerializer
)


# NOTE: This demo app has no real session/auth layer, so bookings are
# associated with a single demo user (matching the frontend's local demo
# account). In a production build you'd pull the user from the request's
# auth/session instead of hardcoding this.
DEMO_USER_ID = 'usr-demo'
DEMO_USER_EMAIL = 'keshavgupta5060@gmail.com'


def _get_or_create_demo_user():
    return UserProfile.objects.get(
        email=DEMO_USER_EMAIL
    )


@api_view(['GET'])
def root_api(request):
    return Response({
        'app': 'ParkBy Smart Parking REST API',
        'status': 'running',
        'version': '1.0.0',
        'endpoints': {
            'health': '/api/health',
            'locations': '/api/locations',
            'slots': '/api/slots',
            'auth_google': '/api/auth/google',
            'chat': '/api/chat',
            'admin': '/admin/'
        }
    })


@api_view(['GET'])
def health_check(request):
    return Response({
        'status': 'ok',
        'backend': 'Django REST Framework'
    })


@api_view(['GET', 'POST'])
def google_auth(request):
    if request.method == 'POST':
        email = request.data.get('email', '').strip().lower()
        name = request.data.get('name', 'User')

        if not email:
            return Response(
                {'success': False, 'reason': 'Valid email required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = UserProfile.objects.get(email=email)

            serializer = UserProfileSerializer(user)

            return Response({
                'success': True,
                'user': serializer.data,
                'isNew': False,
                'message': f"Welcome back, {user.name}!"
            })

        except UserProfile.DoesNotExist:
            is_admin = "admin" in email or "keshav" in email

            user = UserProfile.objects.create(
                id=f"usr-g-{int(time.time())}",
                name=name,
                email=email,
                role='admin' if is_admin else 'user',
                wallet_balance=500.00,
                avatar_url=f"https://api.dicebear.com/7.x/bottts/svg?seed={email}",
                auth_provider='google'
            )

            serializer = UserProfileSerializer(user)

            return Response({
                'success': True,
                'user': serializer.data,
                'isNew': True,
                'message': "Welcome to ParkBy! Your account is created with ₹500 welcome bonus."
            })


@api_view(['POST'])
def auth_signup(request):
    name = request.data.get('name', '').strip()
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')
    role = request.data.get('role', 'user')
    phone = request.data.get('phone', '')

    if not name or not email:
        return Response(
            {
                'success': False,
                'reason': 'Name and email are required'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    if UserProfile.objects.filter(email=email).exists():
        return Response(
            {
                'success': False,
                'reason': 'An account with this email already exists'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    user = UserProfile.objects.create(
        id=f"usr-{int(time.time())}",
        name=name,
        email=email,
        password=password,
        role=role or 'user',
        phone=phone,
        wallet_balance=500.00,
        avatar_url=f"https://api.dicebear.com/7.x/bottts/svg?seed={email}",
        auth_provider='email',
    )

    serializer = UserProfileSerializer(user)

    return Response(
        {
            'success': True,
            'user': serializer.data
        },
        status=status.HTTP_201_CREATED
    )


@api_view(['POST'])
def auth_login(request):
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')

    if not email:
        return Response(
            {
                'success': False,
                'reason': 'Email is required'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user = UserProfile.objects.get(email=email)

    except UserProfile.DoesNotExist:
        return Response(
            {
                'success': False,
                'reason': 'No account found with that email'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    if user.password and user.password != password:
        return Response(
            {
                'success': False,
                'reason': 'Incorrect password'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    serializer = UserProfileSerializer(user)

    return Response({
        'success': True,
        'user': serializer.data
    })


@api_view(['POST'])
def auth_logout(request):
    return Response({
        'success': True,
        'message': 'Successfully signed out'
    })


@api_view(['GET', 'POST'])
def locations_list(request):

    if request.method == 'GET':
        locations = ParkingLocation.objects.all()
        serializer = ParkingLocationSerializer(
            locations,
            many=True
        )
        return Response(serializer.data)

    elif request.method == 'POST':
        data = request.data.copy()

        # Generate ID automatically if frontend doesn't provide one
        if not data.get('id'):
            data['id'] = f"loc-{uuid.uuid4().hex[:12]}"

        serializer = ParkingLocationSerializer(data=data)

        if serializer.is_valid():
            serializer.save()

            return Response(
                {
                    'success': True,
                    'location': serializer.data
                },
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET', 'POST'])
def slots_list(request):

    if request.method == 'GET':
        slots = ParkingSlot.objects.all()
        serializer = ParkingSlotSerializer(
            slots,
            many=True
        )
        return Response(serializer.data)

    elif request.method == 'POST':
        data = request.data.copy()

        # Generate ID automatically if frontend doesn't provide one
        if not data.get('id'):
            data['id'] = f"slot-{uuid.uuid4().hex[:12]}"

        # Connect slot to selected parking location
        if not data.get('parking'):
            parking_id = (
                data.get('parking_id')
                or data.get('location_id')
            )

            if parking_id:
                data['parking'] = parking_id

        serializer = ParkingSlotSerializer(data=data)

        if serializer.is_valid():
            serializer.save()

            return Response(
                {
                    'success': True,
                    'slot': serializer.data
                },
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
def bookings_my(request):
    bookings = Booking.objects.filter(
        user_id=DEMO_USER_ID
    ).order_by('-start_time')

    serializer = BookingSerializer(
        bookings,
        many=True
    )

    return Response(serializer.data)


@api_view(['POST'])
def bookings_create(request):
    slot_id = request.data.get('slot_id')
    vehicle_number = request.data.get(
        'vehicle_number',
        'UNKNOWN'
    )
    duration = int(
        request.data.get('duration') or 2
    )

    if not slot_id:
        return Response(
            {
                'success': False,
                'reason': 'slot_id is required'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        slot = ParkingSlot.objects.select_related(
            'parking'
        ).get(id=slot_id)

    except ParkingSlot.DoesNotExist:
        return Response(
            {
                'success': False,
                'reason': f'Slot {slot_id} does not exist'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    if slot.status != 'available':
        return Response(
            {
                'success': False,
                'reason': (
                    f'Slot {slot.slot_number} '
                    f'is currently {slot.status}'
                )
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    user = _get_or_create_demo_user()
    now = timezone.now()

    base_amount = (
        float(slot.price_per_hr) * duration
    )

    booking = Booking.objects.create(
        id=f"bk-{int(time.time() * 1000)}",
        user=user,
        parking=slot.parking,
        parking_name=slot.parking.name,
        slot=slot,
        slot_number=slot.slot_number,
        vehicle_number=vehicle_number,
        scheduled_end_time=(
            now + timedelta(hours=duration)
        ),
        status='active',
        base_amount=base_amount,
        extension_amount=0,
        total_amount=base_amount,
    )

    slot.status = 'occupied'
    slot.save(update_fields=['status'])

    serializer = BookingSerializer(booking)

    return Response(
        {
            'success': True,
            'booking': serializer.data
        },
        status=status.HTTP_201_CREATED
    )


@api_view(['POST'])
def bookings_extend(request):
    booking_id = request.data.get('booking_id')
    hours = int(
        request.data.get('hours') or 1
    )

    try:
        booking = Booking.objects.select_related(
            'slot'
        ).get(
            id=booking_id,
            status='active'
        )

    except Booking.DoesNotExist:
        return Response(
            {
                'success': False,
                'reason': 'No active booking found'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    extra_amount = (
        float(booking.slot.price_per_hr) * hours
    )

    booking.scheduled_end_time = (
        booking.scheduled_end_time
        + timedelta(hours=hours)
    )

    booking.extension_amount = (
        float(booking.extension_amount)
        + extra_amount
    )

    booking.total_amount = (
        float(booking.total_amount)
        + extra_amount
    )

    booking.save(
        update_fields=[
            'scheduled_end_time',
            'extension_amount',
            'total_amount'
        ]
    )

    serializer = BookingSerializer(booking)

    return Response({
        'success': True,
        'booking': serializer.data
    })


@api_view(['POST'])
def bookings_cancel(request):
    booking_id = request.data.get('booking_id')

    try:
        booking = Booking.objects.select_related(
            'slot'
        ).get(id=booking_id)

    except Booking.DoesNotExist:
        return Response(
            {
                'success': False,
                'reason': 'Booking not found'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    booking.status = 'cancelled'
    booking.actual_end_time = timezone.now()

    booking.save(
        update_fields=[
            'status',
            'actual_end_time'
        ]
    )

    booking.slot.status = 'available'
    booking.slot.save(
        update_fields=['status']
    )

    serializer = BookingSerializer(booking)

    return Response({
        'success': True,
        'booking': serializer.data
    })


FAQS = {
    'rates': (
        "Parking rates vary by location and vehicle type — "
        "check the Locations tab for exact per-hour pricing."
    ),
    'hours': (
        "Most ParkBy locations are open 24/7 "
        "with automated barrier access."
    ),
    'payment': (
        "We accept UPI, credit/debit cards, "
        "and cash at the entry gate."
    ),
    'cancellation': (
        "You can cancel any active booking free of charge "
        "from the Active Bookings tab."
    ),
    'support': (
        "You can reach our support hotline at "
        "+91-1800-PARKBY or use this chat assistant."
    ),
}


INTENT_KEYWORDS = {
    'greeting': [
        'hi',
        'hello',
        'hey',
        'good morning',
        'good evening',
        'start'
    ],
    'booking': [
        'book',
        'reserve',
        'reservation',
        'park here'
    ],
    'availability': [
        'vacant',
        'available',
        'free slot',
        'empty',
        'space',
        'parking spot',
        'any spot',
        'spots',
        'slot'
    ],
    'extension': [
        'extend',
        'more time',
        'add hour',
        'increase time'
    ],
    'rates': [
        'price',
        'rate',
        'cost',
        'how much',
        'charges',
        'fee',
        'pricing'
    ],
    'hours': [
        'open',
        'timing',
        'hours',
        'close',
        'schedule'
    ],
    'payment': [
        'pay',
        'payment',
        'upi',
        'card',
        'cash'
    ],
    'cancellation': [
        'cancel',
        'refund'
    ],
    'support': [
        'help',
        'contact',
        'support',
        'number',
        'phone'
    ],
}


def _detect_intent(message):
    text = message.lower()

    for intent, keywords in INTENT_KEYWORDS.items():
        if any(
            kw in text
            for kw in keywords
        ):
            return intent

    return 'fallback'


def _extract_slot_number(message):
    match = re.search(
        r'\b([A-Za-z])-?0*(\d+)\b',
        message
    )

    return (
        (
            match.group(1).upper(),
            int(match.group(2))
        )
        if match
        else None
    )


@api_view(['POST'])
def chat_assistant(request):
    """
    Chat endpoint backed by live database data.
    Reads/writes ParkingSlot and Booking rows.
    """

    message = request.data.get(
        'message',
        ''
    )

    if not message:
        return Response(
            {'error': 'Message is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    intent = _detect_intent(message)

    data = {}
    reply = ''

    if intent in (
        'availability',
        'greeting'
    ):
        available = (
            ParkingSlot.objects
            .filter(status='available')
            .select_related('parking')
        )

        data['slots'] = [
            {
                'slot_number': s.slot_number,
                'location_name': s.parking.name,
                'price_per_hr': float(
                    s.price_per_hr
                ),
                'slot_type': s.slot_type
            }
            for s in available
        ]

        if intent == 'greeting':
            reply = (
                "Hi there! 👋 Welcome to ParkBy. "
                "I can help you find available spots, "
                "check prices, or book a slot. "
                "How can I help?"
            )

        elif not data['slots']:
            reply = (
                "Sorry, no vacant slots are available "
                "right now. Please check back shortly."
            )

        else:
            lines = [
                (
                    f"• {s['slot_number']} at "
                    f"{s['location_name']} "
                    f"(₹{s['price_per_hr']}/hr - "
                    f"{s['slot_type'].upper()})"
                )
                for s in data['slots']
            ]

            reply = (
                "Here are the currently available slots:\n"
                + "\n".join(lines)
                + "\n\nWould you like to book one? "
                "(e.g. \"Book slot A2\")"
            )

    elif intent == 'booking':
        slot_num = _extract_slot_number(message)
        slot = None

        if slot_num:
            # Seeded slot numbers look like "A-01";
            # user messages say "A1"/"a-1", so compare
            # letter and numeric value.
            target_letter, target_digits = slot_num

            for candidate in (
                ParkingSlot.objects
                .select_related('parking')
                .all()
            ):
                cand_match = re.match(
                    r'([A-Za-z])-?0*(\d+)',
                    candidate.slot_number
                )

                if (
                    cand_match
                    and cand_match.group(1).upper()
                    == target_letter
                    and int(cand_match.group(2))
                    == target_digits
                ):
                    slot = candidate
                    break

        if not slot:
            data['booking_result'] = {
                'success': False,
                'reason': (
                    'Please specify a slot number '
                    '(e.g. A2, B1, C1)'
                )
            }

        elif slot.status != 'available':
            data['booking_result'] = {
                'success': False,
                'reason': (
                    f'Slot {slot.slot_number} '
                    f'is currently {slot.status}'
                )
            }

        else:
            user = _get_or_create_demo_user()
            base_amount = (
                float(slot.price_per_hr) * 2
            )

            booking = Booking.objects.create(
                id=f"bk-{int(time.time() * 1000)}",
                user=user,
                parking=slot.parking,
                parking_name=slot.parking.name,
                slot=slot,
                slot_number=slot.slot_number,
                vehicle_number='CHAT-BOOKED',
                scheduled_end_time=(
                    timezone.now()
                    + timedelta(hours=2)
                ),
                status='active',
                base_amount=base_amount,
                extension_amount=0,
                total_amount=base_amount,
            )

            slot.status = 'occupied'
            slot.save(
                update_fields=['status']
            )

            data['booking_result'] = {
                'success': True,
                'booking': {
                    'slot_number': booking.slot_number,
                    'parking_name': booking.parking_name,
                    'vehicle_number': booking.vehicle_number,
                    'total_amount': float(
                        booking.total_amount
                    )
                }
            }

        result = data['booking_result']

        if result.get('success'):
            b = result['booking']

            reply = (
                f"🎉 Success! Slot {b['slot_number']} "
                f"at {b['parking_name']} has been booked. "
                f"Total amount: ₹{b['total_amount']}."
            )

        else:
            reply = (
                "Sorry, I couldn't book that slot: "
                f"{result.get('reason')}"
            )

    elif intent in FAQS:
        data['faq_answer'] = FAQS[intent]
        reply = FAQS[intent]

    else:
        reply = (
            "I'm not sure I understood that. "
            "You can ask me about parking availability, "
            "rates, or say 'Book slot A2'!"
        )

    return Response({
        'reply': reply,
        'intent': intent,
        'session_id': request.data.get(
            'session_id',
            'session-default'
        ),
        'data': data
    })