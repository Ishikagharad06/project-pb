from rest_framework import serializers
from .models import UserProfile, ParkingLocation, ParkingSlot, Booking


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = '__all__'


class ParkingSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingSlot
        fields = '__all__'


class ParkingLocationSerializer(serializers.ModelSerializer):
    slots = ParkingSlotSerializer(many=True, read_only=True)

    class Meta:
        model = ParkingLocation
        fields = '__all__'


class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = '__all__'