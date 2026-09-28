#!/usr/bin/env python3
"""
Measure X — Seed Easy Demo Accounts
Creates or updates super-easy, memorable demo credentials:
  - Admin:   admin@demo.com   / admin123
  - Officer: officer@demo.com / officer123 (alias: lmo@demo.com / lmo123)
  - GATC:    gatc@demo.com    / gatc123
  - Trader:  trader@demo.com  / trader123  (alias: owner@demo.com / owner123)
"""

import sys
import os
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv()

from backend.database import db, User, hash_password

def seed_easy_users():
    session = db.get_session()
    try:
        easy_users = [
            {
                "id": "USR-ADM-DEMO-0001",
                "email": "admin@demo.com",
                "password": "admin123",
                "role_id": "ADMIN",
                "name": "State Controller (Admin)",
                "mobile": "9800000001",
                "department": "Directorate of Legal Metrology",
                "designation": "Director General of Legal Metrology",
                "office_address": "Directorate Headquarters, Patna, Bihar",
                "status": "ACTIVE"
            },
            {
                "id": "USR-LMO-DEMO-0002",
                "email": "officer@demo.com",
                "password": "officer123",
                "role_id": "LMO",
                "name": "Rahul Kumar (LMO Officer)",
                "mobile": "9800000002",
                "department": "Department of Legal Metrology",
                "designation": "Legal Metrology Officer (Inspector)",
                "employee_id": "LMO-PAT-2026-0042",
                "jurisdiction": "Patna Central Circle",
                "district": "Patna",
                "state": "Bihar",
                "office_address": "Patna Circle Office, Bihar",
                "status": "ACTIVE"
            },
            {
                "id": "USR-LMO-DEMO-0012",
                "email": "lmo@demo.com",
                "password": "lmo123",
                "role_id": "LMO",
                "name": "Rahul Kumar (LMO)",
                "mobile": "9800000012",
                "department": "Department of Legal Metrology",
                "designation": "Legal Metrology Officer (Inspector)",
                "employee_id": "LMO-PAT-2026-0042",
                "jurisdiction": "Patna Central Circle",
                "district": "Patna",
                "state": "Bihar",
                "status": "ACTIVE"
            },

            {
                "id": "USR-OWN-DEMO-0004",
                "email": "trader@demo.com",
                "password": "trader123",
                "role_id": "OWNER",
                "name": "Rajesh Verma (Commercial Trader)",
                "mobile": "9800000004",
                "business_name": "Bihar Agro Commodities Mandi",
                "business_type": "Wholesale Grain Mandi Merchant",
                "address": "Bazar Samiti, Patna, Bihar",
                "district": "Patna",
                "state": "Bihar",
                "pincode": "800006",
                "status": "ACTIVE"
            },
            {
                "id": "USR-OWN-DEMO-0014",
                "email": "owner@demo.com",
                "password": "owner123",
                "role_id": "OWNER",
                "name": "Rajesh Verma (Owner)",
                "mobile": "9800000014",
                "business_name": "Bihar Agro Commodities Mandi",
                "business_type": "Wholesale Grain Mandi Merchant",
                "address": "Bazar Samiti, Patna, Bihar",
                "district": "Patna",
                "state": "Bihar",
                "pincode": "800006",
                "status": "ACTIVE"
            }
        ]

        print("Seeding easy demo accounts into MySQL...")
        for u_data in easy_users:
            user = session.query(User).filter(User.email == u_data["email"]).first()
            if user:
                # Update existing user password and status
                user.password_hash = hash_password(u_data["password"])
                user.status = "ACTIVE"
                user.name = u_data["name"]
                user.role_id = u_data["role_id"]
                if "business_name" in u_data:
                    user.business_name = u_data["business_name"]
                if "department" in u_data:
                    user.department = u_data["department"]
                if "jurisdiction" in u_data:
                    user.jurisdiction = u_data["jurisdiction"]
                if "accreditation_number" in u_data:
                    user.accreditation_number = u_data["accreditation_number"]
                print(f"Updated user: {u_data['email']} -> password: {u_data['password']}")
            else:
                new_user = User(
                    id=u_data["id"],
                    name=u_data["name"],
                    email=u_data["email"],
                    mobile=u_data["mobile"],
                    password_hash=hash_password(u_data["password"]),
                    role_id=u_data["role_id"],
                    status=u_data["status"],
                    department=u_data.get("department"),
                    designation=u_data.get("designation"),
                    employee_id=u_data.get("employee_id"),
                    jurisdiction=u_data.get("jurisdiction"),
                    office_address=u_data.get("office_address"),
                    business_name=u_data.get("business_name"),
                    business_type=u_data.get("business_type"),
                    address=u_data.get("address"),
                    accreditation_number=u_data.get("accreditation_number"),
                    district=u_data.get("district", "Patna"),
                    state=u_data.get("state", "Bihar"),
                    pincode=u_data.get("pincode", "800001"),
                    created_at=datetime.utcnow()
                )
                session.add(new_user)
                print(f"Created user: {u_data['email']} -> password: {u_data['password']}")

        session.commit()
        print("\nAll easy demo accounts successfully created and verified in database!")

    except Exception as e:
        session.rollback()
        print(f"Error seeding demo users: {e}")
        sys.exit(1)
    finally:
        session.close()

if __name__ == "__main__":
    seed_easy_users()
