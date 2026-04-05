from rest_framework.permissions import BasePermission


def is_hospital_admin_user(user):
    profile = getattr(user, "profile", None) or getattr(user, "user_profile", None)
    return bool(
        user
        and user.is_authenticated
        and (
            getattr(user, "is_superuser", False)
            or hasattr(user, "hospital_admin_profile")
            or (
                profile
                and getattr(profile, "role", "") == "hospital"
                and hasattr(user, "managed_hospital")
            )
        )
    )


class IsPatientUser(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and hasattr(user, "patient_profile"))


class IsHospitalAdmin(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return is_hospital_admin_user(user)


class IsHospitalAdminOwner(BasePermission):
    message = "Only authenticated hospital admins can update hospital details."

    def has_permission(self, request, view):
        return is_hospital_admin_user(getattr(request, "user", None))
