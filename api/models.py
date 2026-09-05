from django.db import models


class UserProfile(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    name = models.CharField(max_length=255)
    email = models.EmailField(max_length=254, unique=True)
    role = models.CharField(max_length=32, default='user')
    phone = models.CharField(max_length=32, blank=True, null=True)
    wallet_balance = models.DecimalField(max_digits=10, decimal_places=2, default=500.0)
    avatar_url = models.TextField(blank=True, null=True)
    auth_provider = models.CharField(max_length=32, default='email')
    created_at = models.DateTimeField(auto_now_add=True)
    password = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['email'], name='idx_user_email'),
            models.Index(fields=['role'], name='idx_user_role'),
        ]


class ParkingLocation(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    name = models.CharField(max_length=255)
    address = models.TextField()
    city = models.CharField(max_length=128)
    latitude = models.FloatField(default=28.4595)
    longitude = models.FloatField(default=77.0266)
    total_slots = models.IntegerField(default=30)
    opening_time = models.CharField(max_length=32, default='06:00')
    closing_time = models.CharField(max_length=32, default='23:59')
    status = models.CharField(max_length=32, default='active')

    class Meta:
        indexes = [
            models.Index(fields=['city'], name='idx_loc_city'),
            models.Index(fields=['city', 'status'], name='idx_loc_city_status'),
        ]


class ParkingSlot(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    slot_number = models.CharField(max_length=32)
    slot_type = models.CharField(max_length=32, default='regular')
    status = models.CharField(max_length=32, default='available')
    price_per_hr = models.DecimalField(max_digits=8, decimal_places=2, default=20.0)
    floor = models.CharField(max_length=64, default='Ground Floor')

    parking = models.ForeignKey(
        ParkingLocation,
        on_delete=models.CASCADE,
        related_name='slots'
    )

    class Meta:
        indexes = [
            models.Index(
                fields=['parking', 'status'],
                name='idx_slot_parking_status'
            ),
            models.Index(
                fields=['slot_type', 'status'],
                name='idx_slot_type_status'
            ),
        ]


class Booking(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    parking_name = models.CharField(max_length=255)
    slot_number = models.CharField(max_length=32)
    vehicle_number = models.CharField(max_length=64)
    start_time = models.DateTimeField(auto_now_add=True)
    scheduled_end_time = models.DateTimeField()
    actual_end_time = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=32, default='active')
    base_amount = models.DecimalField(max_digits=10, decimal_places=2)
    extension_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)

    parking = models.ForeignKey(
        ParkingLocation,
        on_delete=models.CASCADE
    )

    slot = models.ForeignKey(
        ParkingSlot,
        on_delete=models.CASCADE
    )

    user = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE
    )

    class Meta:
        indexes = [
            models.Index(
                fields=['user', 'status'],
                name='idx_booking_user_status'
            ),
            models.Index(
                fields=['parking', 'status'],
                name='idx_booking_parking_status'
            ),
        ]