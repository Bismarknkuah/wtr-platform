from django.db import models


class Sequence(models.Model):
    prefix = models.CharField(max_length=40, unique=True)
    value = models.PositiveBigIntegerField(default=0)

    def __str__(self):
        return f"{self.prefix}{self.value}"
