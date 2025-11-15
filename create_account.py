#!/usr/bin/env python3
"""
Скрипт для создания учетной записи для входа
Создает команду team251 и клиента team251-1 с счетом
"""
import asyncio
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models import Team, Client, Account


async def create_account():
    """Создать учетную запись для входа"""
    
    TEAM_ID = "team251"
    ORGANIZER_SECRET = "***REMOVED***"
    CLIENT_ID = "team251-1"
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. Проверяем/создаем команду team251
            result = await session.execute(
                select(Team).where(Team.client_id == TEAM_ID)
            )
            team = result.scalar_one_or_none()
            
            if not team:
                print(f"📝 Создаю команду {TEAM_ID}...")
                team = Team(
                    client_id=TEAM_ID,
                    client_secret=ORGANIZER_SECRET,
                    team_name="Команда 251 (VTB API 2025)",
                    is_active=True,
                    created_at=datetime.utcnow()
                )
                session.add(team)
                await session.flush()  # Чтобы получить ID
                print(f"✅ Команда {TEAM_ID} создана")
            else:
                # Обновляем секрет если нужно
                if team.client_secret != ORGANIZER_SECRET:
                    print(f"🔄 Обновляю секрет для команды {TEAM_ID}...")
                    team.client_secret = ORGANIZER_SECRET
                    await session.flush()
                    print(f"✅ Секрет обновлен")
                else:
                    print(f"✅ Команда {TEAM_ID} уже существует")
            
            # 2. Проверяем/создаем клиента team251-1
            result = await session.execute(
                select(Client).where(Client.person_id == CLIENT_ID)
            )
            client = result.scalar_one_or_none()
            
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
                session.add(client)
                await session.flush()  # Чтобы получить ID
                print(f"✅ Клиент {CLIENT_ID} создан")
            else:
                print(f"✅ Клиент {CLIENT_ID} уже существует")
            
            # 3. Проверяем/создаем счет для клиента
            result = await session.execute(
                select(Account).where(Account.client_id == client.id)
            )
            account = result.scalar_one_or_none()
            
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
                session.add(account)
                print(f"✅ Счет создан: {account.account_number}, баланс: {account.balance} RUB")
            else:
                print(f"✅ Счет уже существует: {account.account_number}, баланс: {account.balance} RUB")
            
            await session.commit()
            
            print()
            print("=" * 50)
            print("🎉 Учетная запись успешно создана!")
            print("=" * 50)
            print()
            print("📋 Данные для входа:")
            print(f"   Логин: {CLIENT_ID}")
            print(f"   Пароль: {ORGANIZER_SECRET}")
            print()
            print("💡 Используйте эти данные для входа в личный кабинет:")
            print("   http://localhost:8001/client/index.html")
            print()
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Ошибка при создании учетной записи: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    print("🔄 Создание учетной записи...")
    print()
    asyncio.run(create_account())

