import json
import os
import hashlib

USERS_FILE = "data/users.json"


def load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, "r") as f:
        return json.load(f)


def save_users(users):
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=4)


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def register_user(email, password):
    users = load_users()

    if email in users:
        return False, "User already exists"

    users[email] = {
        "password": hash_password(password)
    }

    save_users(users)
    return True, "Registration successful"


def login_user(email, password):
    users = load_users()

    if email not in users:
        return False

    return users[email]["password"] == hash_password(password)
