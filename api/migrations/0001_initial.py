from django.db import migrations, models
import django.db.models.deletion
import uuid

class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='ParkingLocation',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=64, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('address', models.TextField()),
                ('city', models.CharField(max_length=128)),
                ('latitude', models.FloatField(default=28.4595)),
                ('longitude', models.FloatField(default=77.0266)),
                ('total_slots', models.IntegerField(default=30)),
                ('opening_time', models.CharField(default='06:00', max_length=32)),
                ('closing_time', models.CharField(default='23:59', max_length=32)),
                ('status', models.CharField(default='active', max_length=32)),
            ],
        ),
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=64, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('role', models.CharField(default='user', max_length=32)),
                ('phone', models.CharField(blank=True, max_length=32, null=True)),
                ('wallet_balance', models.DecimalField(decimal_places=2, default=500.0, max_digits=10)),
                ('avatar_url', models.TextField(blank=True, null=True)),
                ('auth_provider', models.CharField(default='email', max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='ParkingSlot',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=64, primary_key=True, serialize=False)),
                ('slot_number', models.CharField(max_length=32)),
                ('slot_type', models.CharField(default='regular', max_length=32)),
                ('status', models.CharField(default='available', max_length=32)),
                ('price_per_hr', models.DecimalField(decimal_places=2, default=20.0, max_digits=8)),
                ('floor', models.CharField(default='Ground Floor', max_length=64)),
                ('parking', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='slots', to='api.parkinglocation')),
            ],
        ),
        migrations.CreateModel(
            name='Booking',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, max_length=64, primary_key=True, serialize=False)),
                ('parking_name', models.CharField(max_length=255)),
                ('slot_number', models.CharField(max_length=32)),
                ('vehicle_number', models.CharField(max_length=64)),
                ('start_time', models.DateTimeField(auto_now_add=True)),
                ('scheduled_end_time', models.DateTimeField()),
                ('actual_end_time', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(default='active', max_length=32)),
                ('base_amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('extension_amount', models.DecimalField(decimal_places=2, default=0.0, max_digits=10)),
                ('total_amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('parking', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.parkinglocation')),
                ('slot', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.parkingslot')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.userprofile')),
            ],
        ),
    ]
