from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from core.roles import Role, effective_permissions


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True, role=Role.PLATFORM_SUPER_ADMIN)
        return self._create(email, password, **extra)


class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True)
    custom_role = models.ForeignKey("communities.CommunityRole", null=True, blank=True, on_delete=models.SET_NULL, related_name="users",
                                    help_text="Set when role=CUSTOM: the community-defined role this user holds")
    role = models.CharField(max_length=40, choices=Role.CHOICES, default=Role.CUSTOMER)
    community = models.ForeignKey("communities.Community", null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    is_active = models.BooleanField(default=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]
    objects = UserManager()

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    def get_full_name(self):
        return self.full_name

    @property
    def permissions(self):
        return sorted(effective_permissions(self))

    @property
    def role_label(self):
        if self.role == Role.CUSTOM and self.custom_role_id:
            return self.custom_role.name
        return dict(Role.CHOICES).get(self.role, self.role)

    @property
    def is_platform(self):
        return self.role in Role.PLATFORM_ROLES
