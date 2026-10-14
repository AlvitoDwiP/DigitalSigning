import argparse
import sys
from sqlalchemy.orm import Session
from app.core.database import engine
from app.models.user import User
from app.core.security import get_password_hash
import getpass

def create_super_admin(email=None, password=None, name=None, nik=None, organization=None, ou=None):
    print("Bootstrap Super Admin")
    if not email:
        email = input("Email: ").strip()
    if not email:
        print("Email cannot be empty.")
        sys.exit(1)
        
    if not password:
        password = getpass.getpass("Password: ")
        confirm_password = getpass.getpass("Confirm Password: ")
        if password != confirm_password:
            print("Passwords do not match.")
            sys.exit(1)
    
    if not password:
        print("Password cannot be empty.")
        sys.exit(1)
        
    if not name:
        name = input("Name [Super Admin]: ").strip() or "Super Admin"
    if not nik:
        nik = input("NIK [0000000000000000]: ").strip() or "0000000000000000"
    if not organization:
        organization = "Universitas B"
    if not ou:
        ou = "TTE"
    
    with Session(engine) as session:
        # Check if email exists
        existing_user = session.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"User with email '{email}' already exists.")
            return
            
        # Check if NIK exists
        existing_nik = session.query(User).filter(User.nik == nik).first()
        if existing_nik:
            print(f"User with NIK '{nik}' already exists.")
            return

        new_admin = User(
            name=name,
            nik=nik,
            email=email,
            organization=organization,
            ou=ou,
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
    parser_csa.add_argument("--email", type=str, help="Admin email address")
    parser_csa.add_argument("--password", type=str, help="Admin password")
    parser_csa.add_argument("--name", type=str, default="Super Admin", help="Admin name")
    parser_csa.add_argument("--nik", type=str, default="0000000000000000", help="Admin NIK")
    parser_csa.add_argument("--organization", type=str, default="Universitas B", help="Admin Organization")
    parser_csa.add_argument("--ou", type=str, default="TTE", help="Admin OU")
    
    args = parser.parse_args()
    
    if args.command == "create-super-admin":
        create_super_admin(
            email=args.email,
            password=args.password,
            name=args.name,
            nik=args.nik,
            organization=args.organization,
            ou=args.ou
        )
    else:
        parser.print_help()
