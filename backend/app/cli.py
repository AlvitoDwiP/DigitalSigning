import argparse
import sys
from sqlalchemy.orm import Session
from app.core.database import engine
from app.models.user import User
from app.core.security import get_password_hash
import getpass

def create_super_admin():
    print("Bootstrap Super Admin")
    email = input("Email: ").strip()
    if not email:
        print("Email cannot be empty.")
        sys.exit(1)
        
    password = getpass.getpass("Password: ")
    confirm_password = getpass.getpass("Confirm Password: ")
    
    if not password:
        print("Password cannot be empty.")
        sys.exit(1)
        
    if password != confirm_password:
        print("Passwords do not match.")
        sys.exit(1)
        
    name = input("Name [Super Admin]: ").strip() or "Super Admin"
    nik = input("NIK [0000000000000000]: ").strip() or "0000000000000000"
    
    with Session(engine) as session:
        # Check if email exists
        existing_user = session.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"User with email {email} already exists.")
            sys.exit(1)
            
        new_admin = User(
            name=name,
            nik=nik,
            email=email,
            password_hash=get_password_hash(password),
            role="SUPER_ADMIN",
            status="ACTIVE"
        )
        session.add(new_admin)
        session.commit()
        print(f"Super Admin '{email}' created successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Digital Signature Platform CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Subparser for create-super-admin
    parser_csa = subparsers.add_parser("create-super-admin", help="Create initial super admin")
    
    args = parser.parse_args()
    
    if args.command == "create-super-admin":
        create_super_admin()
    else:
        parser.print_help()
