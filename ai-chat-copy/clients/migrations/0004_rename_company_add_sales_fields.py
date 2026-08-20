# Generated manually for client sales fields update.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("clients", "0003_client_district_client_neighborhood_and_more"),
    ]

    operations = [
        migrations.RenameField(
            model_name="client",
            old_name="company",
            new_name="auditor_company_name",
        ),
        migrations.AddField(
            model_name="client",
            name="auditor_company_phone",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="client",
            name="contract_id",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="client",
            name="payment_type",
            field=models.CharField(blank=True, choices=[("cash", "Naqt"), ("credit", "Kredit")], max_length=20),
        ),
    ]
