"""
Скрипт для проверки и создания пользователя team251-1
Запуск: python check_and_create_user.py
"""
import asyncio
import os
import sys
from pathlib import Path

# Добавляем корневую директорию в PYTHONPATH
root_dir = Path(__file__).parent
sys.path.insert(0, str(root_dir))

from database import get_db
from models import Client, Team, Account
from sqlalchemy import select
from datetime import datetime


async def check_and_create_user():
    """Проверяет и создает пользователя team251-1 если его нет"""
    
    TEAM_ID = "team251"
    CLIENT_ID = "team251-1"
    TEAM_SECRET = os.getenv("TEAM_CLIENT_SECRET", "")  # Из env.txt
    
    async for db in get_db():
        try:
            print("=" * 60)
            print(f"🔍 Проверка команды {TEAM_ID} и клиента {CLIENT_ID}")
            print("=" * 60)
            
            # 1. Проверяем/создаем команду team251
            team_result = await db.execute(
                select(Team).where(Team.client_id == TEAM_ID)
            )
            team = team_result.scalar_one_or_none()
            
            if not team:
                print(f"📝 Создаю команду {TEAM_ID}...")
                team = Team(
                    client_id=TEAM_ID,
                    client_secret=TEAM_SECRET,
                    team_name=f"Команда {TEAM_ID}",
                    is_active=True,
                    created_at=datetime.utcnow()
                )
                db.add(team)
                await db.flush()
                print(f"✅ Команда {TEAM_ID} создана")
            else:
                print(f"✅ Команда {TEAM_ID} уже существует")
                print(f"   Client Secret: {team.client_secret}")
            
            # 2. Проверяем/создаем клиента team251-1
            client_result = await db.execute(
                select(Client).where(Client.person_id == CLIENT_ID)
            )
            client = client_result.scalar_one_or_none()
            
            if not client:
                print(f"📝 Создаю клиента {CLIENT_ID}...")
                client = Client(
                    person_id=CLIENT_ID,
                    client_type="INDIVIDUAL",
                    full_name="Тестовый клиент команды 251",
                    segment="MASS",
                    birth_year=1995,
                    monthly_income=100000,
                    created_at=datetime.utcnow()
                )
                db.add(client)
                await db.flush()
                print(f"✅ Клиент {CLIENT_ID} создан")
            else:
                print(f"✅ Клиент {CLIENT_ID} уже существует")
                print(f"   Имя: {client.full_name}")
            
            # 3. Проверяем/создаем счет для клиента
            account_result = await db.execute(
                select(Account).where(Account.client_id == client.id)
            )
            account = account_result.scalar_one_or_none()
            
            if not account:
                print(f"📝 Создаю счет для клиента {CLIENT_ID}...")
                account = Account(
                    client_id=client.id,
                    account_number="40817810251000000001",
                    account_type="checking",
                    balance=500000.00,
                    currency="RUB",
                    status="active",
                    opened_at=datetime.utcnow()
                )
                db.add(account)
                print(f"✅ Счет создан: {account.account_number}, баланс: {account.balance} RUB")
            else:
                print(f"✅ Счет уже существует: {account.account_number}, баланс: {account.balance} RUB")
            
            await db.commit()
            
            print()
            print("=" * 60)
            print("✅ Готово! Теперь вы можете войти:")
            print(f"   Username: {CLIENT_ID}")
            print(f"   Password: {team.client_secret}")
            print("=" * 60)
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Ошибка: {e}")
            import traceback
            traceback.print_exc()
        finally:
            break


if __name__ == "__main__":
    asyncio.run(check_and_create_user())

