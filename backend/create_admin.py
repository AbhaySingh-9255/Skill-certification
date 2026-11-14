import getpass
import re
import sqlite3

from werkzeug.security import generate_password_hash

from app import app, get_db


def main() -> None:
    name = input("Administrator name: ").strip()
    email = input("Administrator email: ").strip().lower()
    if not name or len(name) > 120 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise SystemExit("Enter a name and valid email address.")
    password = getpass.getpass("Password (minimum 12 characters): ")
    confirmation = getpass.getpass("Confirm password: ")
    if len(password) < 12:
        raise SystemExit("Password must contain at least 12 characters.")
    if password != confirmation:
        raise SystemExit("Passwords did not match.")
    with app.app_context():
        db = get_db()
        try:
            db.execute(
                "INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')",
                (name, email, generate_password_hash(password)),
            )
            db.commit()
        except sqlite3.IntegrityError as exc:
            db.rollback()
            raise SystemExit("An account with that email already exists.") from exc
    print(f"Administrator account created for {email}.")


if __name__ == "__main__":
    main()
