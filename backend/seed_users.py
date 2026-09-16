"""Create local development accounts in MongoDB if they do not already exist."""

from database import get_db
from models import User, UserRole
from security import hash_password

DEVELOPMENT_USERS = [
    ("System Administrator", "admin@cardioxai.org", "Admin@123", UserRole.admin),
    ("Dr. Aditi Sharma", "doctor@cardioxai.org", "Doctor@123", UserRole.doctor),
    ("Rohan Mehta", "patient@cardioxai.org", "Patient@123", UserRole.patient),
    ("Arjun Singh", "lab@cardioxai.org", "Lab@123", UserRole.lab_technician),
]


def seed_users() -> None:
    db = get_db()
    users_collection = db["users"]

    for full_name, email, password, role in DEVELOPMENT_USERS:
        if users_collection.find_one({"email": email}):
            print(f"Skipped existing user: {email}")
            continue

        user = User(
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
            role=role,
        )
        users_collection.insert_one(user.model_dump(by_alias=True, exclude={"id"}))
        print(f"Created: {email}")


if __name__ == "__main__":
    seed_users()
