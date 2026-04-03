from rest_framework.permissions import BasePermission


class IsPatientUser(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and hasattr(user, "patient_profile"))


class IsHospitalAdmin(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and hasattr(user, "hospital_admin_profile"))
