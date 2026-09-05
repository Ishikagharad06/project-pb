from django.core.management.base import BaseCommand
from api.models import UserProfile, ParkingLocation, ParkingSlot, Booking
import time

class Command(BaseCommand):
    help = 'Seeds initial demo data into the ParkBy database'

    def handle(self, *args, **kwargs):
        self.stdout.write('🌱 Seeding database...')

        # 1. Seed Demo User
        user, created = UserProfile.objects.get_or_create(
            email='keshavgupta5060@gmail.com',
            defaults={
                'id': 'usr-demo',
                'name': 'Keshav Gupta',
                'role': 'admin',
                'phone': '+91-9876543210',
                'wallet_balance': 500.00,
                'avatar_url': 'https://api.dicebear.com/7.x/bottts/svg?seed=keshavgupta5060@gmail.com',
                'auth_provider': 'google'
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f' Created demo user: {user.email}'))
        else:
            self.stdout.write(f'  Demo user already exists: {user.email}')

        # 2. Seed Locations
        locations_data = [
            {
                'id': 'loc-1',
                'name': 'Central Mall Underground',
                'address': '123 MG Road, Sector 14',
                'city': 'Gurugram',
                'latitude': 28.4595,
                'longitude': 77.0266,
                'total_slots': 40,
                'opening_time': '06:00',
                'closing_time': '23:59',
                'status': 'active'
            },
            {
                'id': 'loc-2',
                'name': 'Cyber Hub Parking Lot B',
                'address': 'DLF Cyber City',
                'city': 'Gurugram',
                'latitude': 28.4950,
                'longitude': 77.0895,
                'total_slots': 60,
                'opening_time': '24 Hours',
                'closing_time': '24 Hours',
                'status': 'active'
            },
            {
                'id': 'loc-3',
                'name': 'Metro Station Plaza',
                'address': 'HUDA City Centre Metro Station',
                'city': 'Gurugram',
                'latitude': 28.4593,
                'longitude': 77.0724,
                'total_slots': 25,
                'opening_time': '05:00',
                'closing_time': '00:00',
                'status': 'active'
            }
        ]

        locations_dict = {}
        for loc_info in locations_data:
            loc, loc_created = ParkingLocation.objects.get_or_create(
                id=loc_info['id'],
                defaults=loc_info
            )
            locations_dict[loc.id] = loc
            if loc_created:
                self.stdout.write(self.style.SUCCESS(f' Created location: {loc.name}'))

        # 3. Seed Slots
        slots_data = [
            {'id': 's1', 'parking_id': 'loc-1', 'slot_number': 'A-01', 'slot_type': 'regular', 'status': 'available', 'price_per_hr': 20.00, 'floor': 'Basement 1'},
            {'id': 's2', 'parking_id': 'loc-1', 'slot_number': 'A-02', 'slot_type': 'ev', 'status': 'available', 'price_per_hr': 35.00, 'floor': 'Basement 1'},
            {'id': 's3', 'parking_id': 'loc-1', 'slot_number': 'A-03', 'slot_type': 'accessible', 'status': 'available', 'price_per_hr': 20.00, 'floor': 'Basement 1'},
            {'id': 's4', 'parking_id': 'loc-2', 'slot_number': 'B-01', 'slot_type': 'regular', 'status': 'available', 'price_per_hr': 25.00, 'floor': 'Ground Floor'},
            {'id': 's5', 'parking_id': 'loc-2', 'slot_number': 'B-02', 'slot_type': 'ev', 'status': 'available', 'price_per_hr': 40.00, 'floor': 'Ground Floor'},
            {'id': 's6', 'parking_id': 'loc-3', 'slot_number': 'C-01', 'slot_type': 'regular', 'status': 'available', 'price_per_hr': 15.00, 'floor': 'Plaza Level'}
        ]

        for s_info in slots_data:
            p_id = s_info.pop('parking_id')
            slot_id = s_info['id']
            if p_id in locations_dict:
                slot, s_created = ParkingSlot.objects.get_or_create(
                    id=slot_id,
                    defaults={'parking': locations_dict[p_id], **s_info}
                )
                if s_created:
                    self.stdout.write(self.style.SUCCESS(f' Created slot: {slot.slot_number} at {locations_dict[p_id].name}'))

        self.stdout.write(self.style.SUCCESS('🎉 Database seeding completed successfully!'))
